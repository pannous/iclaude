import type { ServerWebSocket } from "bun";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type {
  CLIMessage,
  CLISystemInitMessage,
  CLISystemStatusMessage,
  CLIAssistantMessage,
  CLIResultMessage,
  CLIStreamEventMessage,
  CLIToolProgressMessage,
  CLIToolUseSummaryMessage,
  CLIControlRequestMessage,
  CLIControlResponseMessage,
  CLIAuthStatusMessage,
  BrowserOutgoingMessage,
  BrowserIncomingMessage,
  ReplayableBrowserIncomingMessage,
  BufferedBrowserEvent,
  SessionState,
  PermissionRequest,
  BackendType,
  McpServerDetail,
  McpServerConfig,
} from "./session-types.js";
import type { SessionStore } from "./session-store.js";
import type { CodexAdapter } from "./codex-adapter.js";
import type { RecorderManager } from "./recorder.js";
import { containerManager } from "./container-manager.js";

/** Truncate a message to use as a session title (max ~50 chars at word boundary). */
export function truncateTitle(message: string): string {
  const cleaned = message.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  const words = cleaned.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).length > 47) break;
    title += (title ? " " : "") + word;
  }
  return title + "...";
}

// ─── WebSocket data tags ──────────────────────────────────────────────────────

interface CLISocketData {
  kind: "cli";
  sessionId: string;
}

interface BrowserSocketData {
  kind: "browser";
  sessionId: string;
  subscribed?: boolean;
  lastAckSeq?: number;
}

interface TerminalSocketData {
  kind: "terminal";
  terminalId: string;
}

export type SocketData = CLISocketData | BrowserSocketData | TerminalSocketData;

// ─── Session ──────────────────────────────────────────────────────────────────

/** Tracks a pending control_request sent to CLI that expects a control_response. */
interface PendingControlRequest {
  subtype: string;
  resolve: (response: unknown) => void;
}

interface Session {
  id: string;
  backendType: BackendType;
  cliSocket: ServerWebSocket<SocketData> | null;
  codexAdapter: CodexAdapter | null;
  browserSockets: Set<ServerWebSocket<SocketData>>;
  state: SessionState;
  pendingPermissions: Map<string, PermissionRequest>;
  /** Pending control_requests sent TO CLI, keyed by request_id */
  pendingControlRequests: Map<string, PendingControlRequest>;
  messageHistory: BrowserIncomingMessage[];
  /** Messages queued while waiting for CLI to connect */
  pendingMessages: string[];
  /** CLI's internal session ID (for resuming) */
  cliSessionId?: string;
  /** Auto-generated or user-set title */
  title?: string;
  /** Timestamp when session was created */
  createdAt?: number;
  /** Monotonic sequence for broadcast events */
  nextEventSeq: number;
  /** Recent broadcast events for reconnect replay */
  eventBuffer: BufferedBrowserEvent[];
  /** Highest acknowledged seq seen from any browser for this session */
  lastAckSeq: number;
  /** Recently processed browser client_msg_id values for idempotency on reconnect retries */
  processedClientMessageIds: string[];
  processedClientMessageIdSet: Set<string>;
}

type GitSessionKey = "git_branch" | "is_worktree" | "is_containerized" | "repo_root" | "git_ahead" | "git_behind";

function makeDefaultState(sessionId: string, backendType: BackendType = "claude"): SessionState {
  return {
    session_id: sessionId,
    backend_type: backendType,
    model: "",
    cwd: "",
    tools: [],
    permissionMode: "default",
    claude_code_version: "",
    mcp_servers: [],
    agents: [],
    slash_commands: [],
    skills: [],
    total_cost_usd: 0,
    num_turns: 0,
    context_used_percent: 0,
    is_compacting: false,
    git_branch: "",
    is_worktree: false,
    is_containerized: false,
    repo_root: "",
    git_ahead: 0,
    git_behind: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
  };
}

// ─── Git info helper ─────────────────────────────────────────────────────────

function shellEscapeSingle(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function runGitCommand(sessionId: string, state: SessionState, command: string): string {
  if (state.is_containerized) {
    const container = containerManager.getContainer(sessionId);
    if (container?.containerId) {
      const containerCwd = container.containerCwd || "/workspace";
      const inner = `cd '${shellEscapeSingle(containerCwd)}' && ${command}`;
      const dockerCmd = `docker exec ${container.containerId} sh -lc ${JSON.stringify(inner)}`;
      return execSync(dockerCmd, { encoding: "utf-8", timeout: 3000 }).trim();
    }
    // Containerized session without a tracked container: preserve previous git state.
    throw new Error("container not tracked");
  }

  return execSync(command, {
    cwd: state.cwd, encoding: "utf-8", timeout: 3000,
  }).trim();
}

function mapContainerPathToHost(sessionId: string, state: SessionState, pathValue: string): string {
  if (!state.is_containerized || !pathValue) return pathValue;
  const container = containerManager.getContainer(sessionId);
  const containerCwd = (container?.containerCwd || "/workspace").replace(/\/+$/, "") || "/";
  const hostCwd = (container?.hostCwd || state.cwd || "").replace(/\/+$/, "") || "/";

  if (pathValue === containerCwd) return hostCwd;
  if (containerCwd !== "/" && pathValue.startsWith(`${containerCwd}/`)) {
    return `${hostCwd}${pathValue.slice(containerCwd.length)}`;
  }
  return pathValue;
}

function resolveGitInfo(sessionId: string, state: SessionState): void {
  if (!state.cwd) return;
  // Preserve is_containerized — it's set during session launch, not derived from git
  const wasContainerized = state.is_containerized;
  const previous = {
    git_branch: state.git_branch,
    is_worktree: state.is_worktree,
    repo_root: state.repo_root,
    git_ahead: state.git_ahead,
    git_behind: state.git_behind,
  };
  try {
    state.git_branch = runGitCommand(sessionId, state, "git rev-parse --abbrev-ref HEAD 2>/dev/null");

    // Detect if this is a linked worktree
    try {
      const gitDir = runGitCommand(sessionId, state, "git rev-parse --git-dir 2>/dev/null");
      state.is_worktree = gitDir.includes("/worktrees/");
    } catch {
      state.is_worktree = false;
    }

    try {
      // For worktrees, --show-toplevel gives the worktree root, not the main repo.
      // Use --git-common-dir to find the real repo root.
      if (state.is_worktree) {
        const commonDir = runGitCommand(sessionId, state, "git rev-parse --git-common-dir 2>/dev/null");
        // commonDir is e.g. /path/to/repo/.git — parent is the repo root
        state.repo_root = resolve(state.cwd, commonDir, "..");
      } else {
        state.repo_root = runGitCommand(sessionId, state, "git rev-parse --show-toplevel 2>/dev/null");
      }
      state.repo_root = mapContainerPathToHost(sessionId, state, state.repo_root);
    } catch { /* ignore */ }

    try {
      const counts = runGitCommand(
        sessionId,
        state,
        "git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null",
      );
      const [behind, ahead] = counts.split(/\s+/).map(Number);
      state.git_ahead = ahead || 0;
      state.git_behind = behind || 0;
    } catch {
      state.git_ahead = 0;
      state.git_behind = 0;
    }
  } catch (error) {
    if (state.is_containerized && error instanceof Error && error.message === "container not tracked") {
      // Container metadata can be restored slightly after session state; keep prior git info.
      state.git_branch = previous.git_branch;
      state.is_worktree = previous.is_worktree;
      state.repo_root = previous.repo_root;
      state.git_ahead = previous.git_ahead;
      state.git_behind = previous.git_behind;
      state.is_containerized = wasContainerized;
      return;
    }
    // Not a git repo or git not available
    state.git_branch = "";
    state.is_worktree = false;
    state.repo_root = "";
    state.git_ahead = 0;
    state.git_behind = 0;
  }
  state.is_containerized = wasContainerized;
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

export class WsBridge {
  private static readonly EVENT_BUFFER_LIMIT = 600;
  private static readonly PROCESSED_CLIENT_MSG_ID_LIMIT = 1000;
  private static readonly IDEMPOTENT_BROWSER_MESSAGE_TYPES = new Set<string>([
    "user_message",
    "permission_response",
    "interrupt",
    "set_model",
    "set_permission_mode",
    "mcp_get_status",
    "mcp_toggle",
    "mcp_reconnect",
    "mcp_set_servers",
  ]);
  /** Grace period (ms) before requesting a relaunch when browser connects and CLI is dead.
   *  Gives CLIs time to reconnect their WS after a server restart. */
  private static readonly RELAUNCH_GRACE_MS = Number(process.env.COMPANION_RELAUNCH_GRACE_MS || "2000");
  private sessions = new Map<string, Session>();
  private store: SessionStore | null = null;
  private recorder: RecorderManager | null = null;
  private onCLISessionId: ((sessionId: string, cliSessionId: string) => void) | null = null;
  private onCLIRelaunchNeeded: ((sessionId: string) => void) | null = null;
  private onTitleGenerated: ((sessionId: string, title: string) => void) | null = null;
  private onFirstTurnCompleted: ((sessionId: string, firstUserMessage: string) => void) | null = null;
  private autoNamingAttempted = new Set<string>();
  /** Per-session timers for deferred relaunch requests (cancelled if CLI reconnects in time). */
  private pendingRelaunches = new Map<string, ReturnType<typeof setTimeout>>();
  private userMsgCounter = 0;
  private onGitInfoReady: ((sessionId: string, cwd: string, branch: string) => void) | null = null;
  private sessionInfoLookup: ((sessionId: string) => { cliSessionId?: string; cwd?: string } | null) | null = null;
  private static readonly GIT_SESSION_KEYS: GitSessionKey[] = [
    "git_branch",
    "is_worktree",
    "is_containerized",
    "repo_root",
    "git_ahead",
    "git_behind",
  ];

  /** Register a callback for when we learn the CLI's internal session ID. */
  onCLISessionIdReceived(cb: (sessionId: string, cliSessionId: string) => void): void {
    this.onCLISessionId = cb;
  }

  /** Register a callback for when a title is auto-generated from the first user message. */
  onTitleGeneratedCallback(cb: (sessionId: string, title: string) => void): void {
    this.onTitleGenerated = cb;
  }

  /** Register a callback for when a browser connects but CLI is dead. */
  onCLIRelaunchNeededCallback(cb: (sessionId: string) => void): void {
    this.onCLIRelaunchNeeded = cb;
  }

  /** Register a callback for when a session completes its first turn. */
  onFirstTurnCompletedCallback(cb: (sessionId: string, firstUserMessage: string) => void): void {
    this.onFirstTurnCompleted = cb;
  }

  /** Register a callback for when git info is resolved and branch is known. */
  onSessionGitInfoReadyCallback(cb: (sessionId: string, cwd: string, branch: string) => void): void {
    this.onGitInfoReady = cb;
  }

  /** Register a callback to look up session info (cliSessionId, cwd) from the launcher.
   *  Used by handleBrowserOpen to load CLI history for sessions that lost their messageHistory. */
  onSessionInfoLookupCallback(cb: (sessionId: string) => { cliSessionId?: string; cwd?: string } | null): void {
    this.sessionInfoLookup = cb;
  }

  /**
   * Pre-populate a session with container info so that handleSystemMessage
   * preserves the host cwd instead of overwriting it with /workspace.
   * Call this right after launcher.launch() for containerized sessions.
   */
  markContainerized(sessionId: string, hostCwd: string): void {
    const session = this.getOrCreateSession(sessionId);
    session.state.is_containerized = true;
    session.state.cwd = hostCwd;
  }

  /** Push a message to all connected browsers for a session (public, for PRPoller etc.). */
  broadcastToSession(sessionId: string, msg: BrowserIncomingMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.broadcastToBrowsers(session, msg);
  }

  /** Attach a persistent store. Call restoreFromDisk() after. */
  setStore(store: SessionStore): void {
    this.store = store;
  }

  /** Attach a recorder for raw message capture. */
  setRecorder(recorder: RecorderManager): void {
    this.recorder = recorder;
  }

  /** Restore sessions from disk (call once at startup). */
  restoreFromDisk(): number {
    if (!this.store) return 0;
    const persisted = this.store.loadAll();
    let count = 0;
    let skipped = 0;
    for (const p of persisted) {
      if (this.sessions.has(p.id)) continue; // don't overwrite live sessions
      // Skip ghost sessions: no cwd and no message history means never initialized
      if (!p.state.cwd && (!p.messageHistory || p.messageHistory.length === 0)) {
        this.store.remove(p.id);
        skipped++;
        continue;
      }
      const session: Session = {
        id: p.id,
        backendType: p.state.backend_type || "claude",
        cliSocket: null,
        codexAdapter: null,
        browserSockets: new Set(),
        state: p.state,
        pendingPermissions: new Map(p.pendingPermissions || []),
        pendingControlRequests: new Map(),
        messageHistory: p.messageHistory || [],
        pendingMessages: p.pendingMessages || [],
        cliSessionId: p.cliSessionId,
        title: p.title,
        createdAt: p.createdAt,
        nextEventSeq: p.nextEventSeq && p.nextEventSeq > 0 ? p.nextEventSeq : 1,
        eventBuffer: Array.isArray(p.eventBuffer) ? p.eventBuffer : [],
        lastAckSeq: typeof p.lastAckSeq === "number" ? p.lastAckSeq : 0,
        processedClientMessageIds: Array.isArray(p.processedClientMessageIds) ? p.processedClientMessageIds : [],
        processedClientMessageIdSet: new Set(
          Array.isArray(p.processedClientMessageIds) ? p.processedClientMessageIds : [],
        ),
      };
      session.state.backend_type = session.backendType;
      // Resolve git info for restored sessions (may have been persisted without it)
      resolveGitInfo(session.id, session.state);
      this.sessions.set(p.id, session);
      // Restored sessions with completed turns don't need auto-naming re-triggered
      if (session.state.num_turns > 0) {
        this.autoNamingAttempted.add(session.id);
      }
      count++;
    }
    if (count > 0 || skipped > 0) {
      console.log(`[ws-bridge] Restored ${count} session(s) from disk${skipped > 0 ? `, purged ${skipped} ghost session(s)` : ""}`);
    }
    return count;
  }

  /**
   * Remove all disconnected sessions. Manually triggered, so cleans everything.
   */
  cleanupOldSessions(): void {
    if (!this.store) return;

    let removed = 0;
    for (const session of this.sessions.values()) {
      const isGhost = !session.state.cwd && session.messageHistory.length === 0;
      const isDisconnected = !session.cliSocket && session.browserSockets.size === 0;
      if (isGhost || isDisconnected) {
        this.sessions.delete(session.id);
        this.store.remove(session.id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ws-bridge] Cleaned up ${removed} disconnected/ghost session(s) (${this.sessions.size} remaining)`);
    }
  }

  /** Persist a session to disk (debounced). */
  private persistSession(session: Session): void {
    if (!this.store) return;
    this.store.save({
      id: session.id,
      state: session.state,
      messageHistory: session.messageHistory,
      pendingMessages: session.pendingMessages,
      pendingPermissions: Array.from(session.pendingPermissions.entries()),
      cliSessionId: session.cliSessionId,
      title: session.title,
      createdAt: session.createdAt,
      eventBuffer: session.eventBuffer,
      nextEventSeq: session.nextEventSeq,
      lastAckSeq: session.lastAckSeq,
      processedClientMessageIds: session.processedClientMessageIds,
    });
  }

  private refreshGitInfo(
    session: Session,
    options: { broadcastUpdate?: boolean; notifyPoller?: boolean } = {},
  ): void {
    const before = {
      git_branch: session.state.git_branch,
      is_worktree: session.state.is_worktree,
      is_containerized: session.state.is_containerized,
      repo_root: session.state.repo_root,
      git_ahead: session.state.git_ahead,
      git_behind: session.state.git_behind,
    };

    resolveGitInfo(session.id, session.state);

    let changed = false;
    for (const key of WsBridge.GIT_SESSION_KEYS) {
      if (session.state[key] !== before[key]) {
        changed = true;
        break;
      }
    }

    if (changed) {
      if (options.broadcastUpdate) {
        this.broadcastToBrowsers(session, {
          type: "session_update",
          session: {
            git_branch: session.state.git_branch,
            is_worktree: session.state.is_worktree,
            is_containerized: session.state.is_containerized,
            repo_root: session.state.repo_root,
            git_ahead: session.state.git_ahead,
            git_behind: session.state.git_behind,
          },
        });
      }
      this.persistSession(session);
    }

    if (options.notifyPoller && session.state.git_branch && session.state.cwd && this.onGitInfoReady) {
      this.onGitInfoReady(session.id, session.state.cwd, session.state.git_branch);
    }
  }

  // ── Session management ──────────────────────────────────────────────────

  /**
   * Load message history from the CLI's session file.
   * The CLI stores conversation history in ~/.claude/projects/<cwd-hash>/<session-id>.jsonl
   */
  private loadCLIHistory(cliSessionId: string, cwd?: string): BrowserIncomingMessage[] {
    try {
      // Compute the project directory name (same logic as CLI)
      const projectDir = cwd ? cwd.replace(/\//g, "-") : "";
      const projectPath = join(homedir(), ".claude", "projects", projectDir);
      const sessionFile = join(projectPath, `${cliSessionId}.jsonl`);

      if (!existsSync(sessionFile)) {
        console.log(`[ws-bridge] CLI session file not found: ${sessionFile}`);
        return [];
      }

      const content = readFileSync(sessionFile, "utf-8");
      const lines = content.split("\n").filter(l => l.trim());

      // Assistant messages arrive as streaming chunks with the same ID.
      // Collect all chunks per message ID and merge their content.
      const assistantChunks = new Map<string, { chunks: any[]; timestamp: number; firstSeen: number }>();
      const allMessages: Array<{ type: "user" | "assistant"; data: any; order: number }> = [];
      let order = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          if (entry.type === "user") {
            // Extract text content from user message
            let textContent = "";
            if (typeof entry.message.content === "string") {
              textContent = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              // Extract text from text blocks in the content array
              const textBlocks = entry.message.content.filter((block: any) => block?.type === "text");
              textContent = textBlocks.map((block: any) => block.text || "").join("\n").trim();
            }

            // Skip empty user messages (e.g., messages with only tool_result blocks)
            if (!textContent) {
              continue;
            }

            allMessages.push({
              type: "user",
              order: order++,
              data: {
                content: textContent,
                timestamp: new Date(entry.timestamp).getTime(),
              },
            });
          } else if (entry.type === "assistant" && entry.message) {
            const msg = entry.message;
            const id = msg.id || `cli-${entry.uuid}`;
            const timestamp = new Date(entry.timestamp).getTime();

            if (!assistantChunks.has(id)) {
              assistantChunks.set(id, { chunks: [], timestamp, firstSeen: order++ });
            }
            assistantChunks.get(id)!.chunks.push(msg);
          }
        } catch (e) {
          // Skip invalid lines
          console.warn(`[ws-bridge] Failed to parse CLI history line:`, e);
        }
      }

      // Merge assistant chunks
      for (const [id, data] of assistantChunks.entries()) {
        const mergedContent: any[] = [];
        let model: string | undefined;
        let stop_reason: string | null = null;
        let usage: any;

        // Merge content from all chunks
        for (const chunk of data.chunks) {
          if (Array.isArray(chunk.content)) {
            mergedContent.push(...chunk.content);
          }
          // Use metadata from last chunk (most complete)
          model = chunk.model || model;
          stop_reason = chunk.stop_reason ?? stop_reason;
          usage = chunk.usage || usage;
        }

        allMessages.push({
          type: "assistant",
          order: data.firstSeen,
          data: {
            id,
            content: mergedContent,
            model,
            stop_reason,
            usage,
            timestamp: data.timestamp,
          },
        });
      }

      // Sort by order and build final message list
      allMessages.sort((a, b) => a.order - b.order);
      const messages: BrowserIncomingMessage[] = allMessages.map((m) => {
        if (m.type === "user") {
          return {
            type: "user_message",
            content: m.data.content,
            timestamp: m.data.timestamp,
          };
        } else {
          return {
            type: "assistant",
            message: {
              id: m.data.id,
              type: "message",
              role: "assistant",
              content: m.data.content,
              model: m.data.model,
              stop_reason: m.data.stop_reason,
              usage: m.data.usage,
            },
            parent_tool_use_id: null,
            timestamp: m.data.timestamp,
          };
        }
      });

      return messages;
    } catch (error) {
      console.error(`[ws-bridge] Failed to load CLI history for session ${cliSessionId}:`, error);
      return [];
    }
  }

  getOrCreateSession(sessionId: string, backendType?: BackendType, opts?: { resumeCliSessionId?: string; cwd?: string }): Session {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const type = backendType || "claude";
      session = {
        id: sessionId,
        backendType: type,
        cliSocket: null,
        codexAdapter: null,
        browserSockets: new Set(),
        state: makeDefaultState(sessionId, type),
        pendingPermissions: new Map(),
        pendingControlRequests: new Map(),
        messageHistory: [],
        pendingMessages: [],
        createdAt: Date.now(),
        nextEventSeq: 1,
        eventBuffer: [],
        lastAckSeq: 0,
        processedClientMessageIds: [],
        processedClientMessageIdSet: new Set(),
      };

      // If resuming, try to load message history from the CLI's session file
      if (opts?.resumeCliSessionId) {
        const cliHistory = this.loadCLIHistory(opts.resumeCliSessionId, opts.cwd);
        if (cliHistory.length > 0) {
          console.log(`[ws-bridge] Resuming session ${sessionId} from CLI session ${opts.resumeCliSessionId}, loading ${cliHistory.length} message(s) from CLI history`);
          session.messageHistory = cliHistory;
          session.cliSessionId = opts.resumeCliSessionId;
        }
      }

      this.sessions.set(sessionId, session);
      // Only persist if the session already has meaningful state (e.g. resumed with history).
      // New empty sessions get persisted later when system.init sets the cwd.
      // This prevents ghost session files from sessions that never fully initialize.
      if (session.messageHistory.length > 0 || session.state.cwd) {
        this.persistSession(session);
      }
    } else if (backendType) {
      // Only overwrite backendType when explicitly provided (e.g. attachCodexAdapter)
      // Prevents handleBrowserOpen from resetting codex→claude
      session.backendType = backendType;
      session.state.backend_type = backendType;
    }
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Re-key a session from a temporary routing token to the real CLI session ID.
   * Moves the session in all internal maps and updates persisted state.
   */
  rekeySession(oldId: string, newId: string): boolean {
    const session = this.sessions.get(oldId);
    if (!session) return false;
    if (this.sessions.has(newId)) {
      console.warn(`[ws-bridge] Cannot rekey ${oldId} → ${newId}: target already exists`);
      return false;
    }

    // Update session identity
    session.id = newId;
    session.state.session_id = newId;

    // Move in sessions map
    this.sessions.delete(oldId);
    this.sessions.set(newId, session);

    // Update CLI socket routing data (Bun WS data is mutable)
    if (session.cliSocket) {
      (session.cliSocket.data as CLISocketData).sessionId = newId;
    }

    // Move pending relaunch timer
    const timer = this.pendingRelaunches.get(oldId);
    if (timer) {
      this.pendingRelaunches.delete(oldId);
      this.pendingRelaunches.set(newId, timer);
    }

    // Move auto-naming tracking
    if (this.autoNamingAttempted.has(oldId)) {
      this.autoNamingAttempted.delete(oldId);
      this.autoNamingAttempted.add(newId);
    }

    // Rename persisted session file
    this.store?.rename(oldId, newId);

    console.log(`[ws-bridge] Re-keyed session ${oldId} → ${newId}`);
    return true;
  }

  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values()).map((s) => s.state);
  }

  /** Get session title, falling back to first user message content. */
  getSessionTitle(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (session.title) return session.title;
    const firstUserMsg = session.messageHistory.find((m) => m.type === "user_message");
    if (firstUserMsg && firstUserMsg.type === "user_message") {
      return firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "..." : "");
    }
    return undefined;
  }

  getCodexRateLimits(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session?.codexAdapter?.getRateLimits() ?? null;
  }

  isCliConnected(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.backendType === "codex") {
      return !!session.codexAdapter?.isConnected();
    }
    return !!session.cliSocket;
  }

  /** Set the title for a session, persist it, and notify browsers. */
  setTitle(sessionId: string, title: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.title = title;
      this.persistSession(session);
      this.broadcastToBrowsers(session, { type: "title_updated", title });
    }
  }

  removeSession(sessionId: string) {
    const timer = this.pendingRelaunches.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.pendingRelaunches.delete(sessionId);
    }
    this.sessions.delete(sessionId);
    this.autoNamingAttempted.delete(sessionId);
    this.store?.remove(sessionId);
  }

  /**
   * Initialize a session that will resume from a CLI session.
   * Loads message history from the CLI's session file.
   */
  initializeResumedSession(sessionId: string, resumeCliSessionId: string, cwd?: string): void {
    this.getOrCreateSession(sessionId, "claude", { resumeCliSessionId, cwd });
  }

  /**
   * Close all sockets (CLI + browsers) for a session and remove it.
   */
  closeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Close CLI socket (Claude)
    if (session.cliSocket) {
      try { session.cliSocket.close(); } catch {}
      session.cliSocket = null;
    }

    // Disconnect Codex adapter
    if (session.codexAdapter) {
      session.codexAdapter.disconnect().catch(() => {});
      session.codexAdapter = null;
    }

    // Close all browser sockets
    for (const ws of session.browserSockets) {
      try { ws.close(); } catch {}
    }
    session.browserSockets.clear();

    const pendingTimer = this.pendingRelaunches.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingRelaunches.delete(sessionId);
    }
    this.sessions.delete(sessionId);
    this.autoNamingAttempted.delete(sessionId);
    this.store?.remove(sessionId);
  }

  // ── Codex adapter attachment ────────────────────────────────────────────

  /**
   * Attach a CodexAdapter to a session. The adapter handles all message
   * translation between the Codex app-server (stdio JSON-RPC) and the
   * browser WebSocket protocol.
   */
  attachCodexAdapter(sessionId: string, adapter: CodexAdapter): void {
    const session = this.getOrCreateSession(sessionId, "codex");
    session.backendType = "codex";
    session.state.backend_type = "codex";
    session.codexAdapter = adapter;

    // Forward translated messages to browsers
    adapter.onBrowserMessage((msg) => {
      if (msg.type === "session_init") {
        session.state = { ...session.state, ...msg.session, backend_type: "codex" };
        this.refreshGitInfo(session, { notifyPoller: true });
        this.persistSession(session);
      } else if (msg.type === "session_update") {
        session.state = { ...session.state, ...msg.session, backend_type: "codex" };
        this.refreshGitInfo(session, { notifyPoller: true });
        this.persistSession(session);
      } else if (msg.type === "status_change") {
        session.state.is_compacting = msg.status === "compacting";
        this.persistSession(session);
      }

      // Store assistant/result messages in history for replay
      if (msg.type === "assistant") {
        session.messageHistory.push({ ...msg, timestamp: msg.timestamp || Date.now() });
        this.persistSession(session);
      } else if (msg.type === "result") {
        session.messageHistory.push(msg);
        this.persistSession(session);
      }

      // Diagnostic: log tool_use assistant messages
      if (msg.type === "assistant") {
        const content = (msg as { message?: { content?: Array<{ type: string }> } }).message?.content;
        const hasToolUse = content?.some((b) => b.type === "tool_use");
        if (hasToolUse) {
          console.log(`[ws-bridge] Broadcasting tool_use assistant to ${session.browserSockets.size} browser(s) for session ${session.id}`);
        }
      }

      // Handle permission requests
      if (msg.type === "permission_request") {
        session.pendingPermissions.set(msg.request.request_id, msg.request);
        this.persistSession(session);
      }

      this.broadcastToBrowsers(session, msg);

      // Trigger auto-naming after the first result
      if (
        msg.type === "result" &&
        !(msg.data as { is_error?: boolean }).is_error &&
        this.onFirstTurnCompleted &&
        !this.autoNamingAttempted.has(session.id)
      ) {
        this.autoNamingAttempted.add(session.id);
        const firstUserMsg = session.messageHistory.find((m) => m.type === "user_message");
        if (firstUserMsg && firstUserMsg.type === "user_message") {
          this.onFirstTurnCompleted(session.id, firstUserMsg.content);
        }
      }
    });

    // Handle session metadata updates
    adapter.onSessionMeta((meta) => {
      if (meta.cliSessionId && this.onCLISessionId) {
        this.onCLISessionId(session.id, meta.cliSessionId);
      }
      if (meta.model) session.state.model = meta.model;
      if (meta.cwd) session.state.cwd = meta.cwd;
      session.state.backend_type = "codex";
      this.refreshGitInfo(session, { broadcastUpdate: true, notifyPoller: true });
      this.persistSession(session);
    });

    // Handle disconnect
    adapter.onDisconnect(() => {
      for (const [reqId] of session.pendingPermissions) {
        this.broadcastToBrowsers(session, { type: "permission_cancelled", request_id: reqId });
      }
      session.pendingPermissions.clear();
      session.codexAdapter = null;
      this.persistSession(session);
      console.log(`[ws-bridge] Codex adapter disconnected for session ${sessionId}`);
      this.broadcastToBrowsers(session, { type: "cli_disconnected" });
    });

    // Flush any messages queued while waiting for the adapter
    if (session.pendingMessages.length > 0) {
      console.log(`[ws-bridge] Flushing ${session.pendingMessages.length} queued message(s) to Codex adapter for session ${sessionId}`);
      const queued = session.pendingMessages.splice(0);
      for (const raw of queued) {
        try {
          const msg = JSON.parse(raw) as BrowserOutgoingMessage;
          adapter.sendBrowserMessage(msg);
        } catch {
          console.warn(`[ws-bridge] Failed to parse queued message for Codex: ${raw.substring(0, 100)}`);
        }
      }
    }

    // Notify browsers that the backend is connected
    this.broadcastToBrowsers(session, { type: "cli_connected" });
    console.log(`[ws-bridge] Codex adapter attached for session ${sessionId}`);
  }

  // ── CLI WebSocket handlers ──────────────────────────────────────────────

  handleCLIOpen(ws: ServerWebSocket<SocketData>, sessionId: string, opts?: { cliSessionId?: string; cwd?: string }) {
    const session = this.getOrCreateSession(sessionId);
    session.cliSocket = ws;
    // Cancel any pending relaunch — CLI reconnected before the grace period expired.
    const pendingTimer = this.pendingRelaunches.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingRelaunches.delete(sessionId);
    }
    console.log(`[ws-bridge] CLI connected for session ${sessionId}`);
    this.broadcastToBrowsers(session, { type: "cli_connected" });

    // If the session has no message history (e.g. after server restart),
    // try to reload it from the CLI's session file
    if (session.messageHistory.length === 0 && opts?.cliSessionId) {
      const cliHistory = this.loadCLIHistory(opts.cliSessionId, opts.cwd);
      if (cliHistory.length > 0) {
        console.log(`[ws-bridge] Reloaded ${cliHistory.length} message(s) from CLI history for session ${sessionId}`);
        session.messageHistory = cliHistory;
        session.cliSessionId = opts.cliSessionId;
        this.persistSession(session);
        // Push history to any already-connected browsers
        this.broadcastToBrowsers(session, {
          type: "message_history",
          messages: cliHistory,
        });
      }
    }

    // Flush any messages queued while waiting for the CLI WebSocket.
    // Per the SDK protocol, the first user message triggers system.init,
    // so we must send it as soon as the WebSocket is open — NOT wait for
    // system.init (which would create a deadlock for slow-starting sessions
    // like Docker containers where the user message arrives before CLI connects).
    if (session.pendingMessages.length > 0) {
      console.log(`[ws-bridge] Flushing ${session.pendingMessages.length} queued message(s) on CLI connect for session ${sessionId}`);
      const queued = session.pendingMessages.splice(0);
      for (const ndjson of queued) {
        this.sendToCLI(session, ndjson);
      }
    }
  }

  handleCLIMessage(ws: ServerWebSocket<SocketData>, raw: string | Buffer) {
    const data = typeof raw === "string" ? raw : raw.toString("utf-8");
    const sessionId = (ws.data as CLISocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Record raw incoming CLI message before any parsing
    this.recorder?.record(sessionId, "in", data, "cli", session.backendType, session.state.cwd);

    // NDJSON: split on newlines, parse each line
    const lines = data.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      let msg: CLIMessage;
      try {
        msg = JSON.parse(line);
      } catch {
        console.warn(`[ws-bridge] Failed to parse CLI message: ${line.substring(0, 200)}`);
        continue;
      }
      this.routeCLIMessage(session, msg);
    }
  }

  handleCLIClose(ws: ServerWebSocket<SocketData>) {
    const sessionId = (ws.data as CLISocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.cliSocket = null;
    console.log(`[ws-bridge] CLI disconnected for session ${sessionId}`);
    this.broadcastToBrowsers(session, { type: "cli_disconnected" });

    // Cancel any pending permission requests
    for (const [reqId] of session.pendingPermissions) {
      this.broadcastToBrowsers(session, { type: "permission_cancelled", request_id: reqId });
    }
    session.pendingPermissions.clear();
  }

  // ── Browser WebSocket handlers ──────────────────────────────────────────

  handleBrowserOpen(ws: ServerWebSocket<SocketData>, sessionId: string) {
    const session = this.getOrCreateSession(sessionId);
    const browserData = ws.data as BrowserSocketData;
    browserData.subscribed = false;
    browserData.lastAckSeq = 0;
    session.browserSockets.add(ws);
    console.log(`[ws-bridge] Browser connected for session ${sessionId} (${session.browserSockets.size} browsers)`);

    // Refresh git state on browser connect so branch changes made mid-session are reflected.
    this.refreshGitInfo(session, { notifyPoller: true });

    // Send current session state as snapshot
    const snapshot: BrowserIncomingMessage = {
      type: "session_init",
      session: session.state,
    };
    this.sendToBrowser(ws, snapshot);

    // If message history is empty, try to recover from CLI session files.
    // This handles cases where the session was restored from disk but lost its
    // messageHistory (debounce didn't flush), or was newly created by browser connect.
    if (session.messageHistory.length === 0) {
      let cliSessionId = session.cliSessionId;
      let cwd = session.state.cwd;

      // If we don't have cliSessionId locally, ask the launcher
      if (!cliSessionId && this.sessionInfoLookup) {
        const info = this.sessionInfoLookup(sessionId);
        if (info) {
          if (info.cliSessionId) {
            cliSessionId = info.cliSessionId;
            session.cliSessionId = cliSessionId;
          }
          if (info.cwd && !cwd) {
            cwd = info.cwd;
            session.state.cwd = cwd;
          }
        }
      }

      if (cliSessionId) {
        const cliHistory = this.loadCLIHistory(cliSessionId, cwd);
        if (cliHistory.length > 0) {
          console.log(`[ws-bridge] Recovered ${cliHistory.length} message(s) from CLI history for session ${sessionId} on browser connect`);
          session.messageHistory = cliHistory;
          this.persistSession(session);
        }
      }
    }

    // Replay message history so the browser can reconstruct the conversation
    if (session.messageHistory.length > 0) {
      this.sendToBrowser(ws, {
        type: "message_history",
        messages: session.messageHistory,
      });
    }

    // Send any pending permission requests
    for (const perm of session.pendingPermissions.values()) {
      this.sendToBrowser(ws, { type: "permission_request", request: perm });
    }

    // Notify if backend is not connected and request relaunch
    const backendConnected = session.backendType === "codex"
      // Treat an attached adapter as "alive" during init.
      // `isConnected()` flips true only after initialize/thread start, and
      // relaunching during that window can kill a healthy startup.
      ? !!session.codexAdapter
      : !!session.cliSocket;

    if (!backendConnected) {
      this.sendToBrowser(ws, { type: "cli_disconnected" });
      // Defer the relaunch request by a short grace period. If the CLI reconnects
      // its WS within that window (e.g. after a server hot-reload), we cancel the
      // timer and skip the relaunch entirely — eliminating false-alarm spam.
      if (this.onCLIRelaunchNeeded && !this.pendingRelaunches.has(sessionId)) {
        const timer = setTimeout(() => {
          this.pendingRelaunches.delete(sessionId);
          const s = this.sessions.get(sessionId);
          const stillDead = s && (s.backendType === "codex" ? !s.codexAdapter : !s.cliSocket);
          if (stillDead && this.onCLIRelaunchNeeded) {
            console.log(`[ws-bridge] Backend still dead for session ${sessionId}, requesting relaunch`);
            this.onCLIRelaunchNeeded(sessionId);
          }
        }, WsBridge.RELAUNCH_GRACE_MS);
        this.pendingRelaunches.set(sessionId, timer);
      }
    }
  }

  handleBrowserMessage(ws: ServerWebSocket<SocketData>, raw: string | Buffer) {
    const data = typeof raw === "string" ? raw : raw.toString("utf-8");
    const sessionId = (ws.data as BrowserSocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Record raw incoming browser message
    this.recorder?.record(sessionId, "in", data, "browser", session.backendType, session.state.cwd);

    let msg: BrowserOutgoingMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      console.warn(`[ws-bridge] Failed to parse browser message: ${data.substring(0, 200)}`);
      return;
    }

    this.routeBrowserMessage(session, msg, ws);
  }

  /** Send a user message into a session programmatically (no browser required).
   *  Used by the cron scheduler to send prompts to autonomous sessions. */
  injectUserMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[ws-bridge] Cannot inject message: session ${sessionId} not found`);
      return;
    }
    this.routeBrowserMessage(session, { type: "user_message", content });
  }

  handleBrowserClose(ws: ServerWebSocket<SocketData>) {
    const sessionId = (ws.data as BrowserSocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.browserSockets.delete(ws);
    console.log(`[ws-bridge] Browser disconnected for session ${sessionId} (${session.browserSockets.size} browsers)`);

    // If nobody is watching anymore, cancel any pending relaunch — pointless to relaunch
    // only to immediately go idle with no browser. The next browser connect will re-arm it.
    if (session.browserSockets.size === 0) {
      const timer = this.pendingRelaunches.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.pendingRelaunches.delete(sessionId);
      }
    }
  }

  // ── CLI message routing ─────────────────────────────────────────────────

  private routeCLIMessage(session: Session, msg: CLIMessage) {
    switch (msg.type) {
      case "system":
        this.handleSystemMessage(session, msg);
        break;

      case "assistant":
        this.handleAssistantMessage(session, msg);
        break;

      case "result":
        this.handleResultMessage(session, msg);
        break;

      case "stream_event":
        this.handleStreamEvent(session, msg);
        break;

      case "control_request":
        this.handleControlRequest(session, msg);
        break;

      case "tool_progress":
        this.handleToolProgress(session, msg);
        break;

      case "tool_use_summary":
        this.handleToolUseSummary(session, msg);
        break;

      case "auth_status":
        this.handleAuthStatus(session, msg);
        break;

      case "control_response":
        this.handleControlResponse(session, msg);
        break;

      case "keep_alive":
        // Silently consume keepalives
        break;

      default:
        // Forward unknown messages as-is for debugging
        break;
    }
  }

  private handleSystemMessage(session: Session, msg: CLISystemInitMessage | CLISystemStatusMessage) {
    if (msg.subtype === "init") {
      // The CLI's session_id becomes the canonical session ID.
      // For temp-token sessions, the onCLISessionId callback triggers re-keying.
      if (msg.session_id) {
        session.cliSessionId = msg.session_id;
        if (this.onCLISessionId) {
          this.onCLISessionId(session.id, msg.session_id);
        }

        // If the session has no message history (e.g. after server restart),
        // try to reload it from the CLI's session file
        if (session.messageHistory.length === 0) {
          const cliHistory = this.loadCLIHistory(msg.session_id, msg.cwd);
          if (cliHistory.length > 0) {
            console.log(`[ws-bridge] Reloaded ${cliHistory.length} message(s) from CLI history for session ${session.id}`);
            session.messageHistory = cliHistory;
            // Push history to any already-connected browsers
            this.broadcastToBrowsers(session, {
              type: "message_history",
              messages: cliHistory,
            });
          }
        }
      }

      session.state.model = msg.model;
      // For containerized sessions, the CLI reports /workspace as its cwd.
      // Keep the host path (set by markContainerized()) for correct project grouping.
      if (!session.state.is_containerized) {
        session.state.cwd = msg.cwd;
      }
      session.state.tools = msg.tools;
      session.state.permissionMode = msg.permissionMode;
      session.state.claude_code_version = msg.claude_code_version;
      session.state.mcp_servers = msg.mcp_servers;
      session.state.agents = msg.agents ?? [];
      session.state.slash_commands = msg.slash_commands ?? [];
      session.state.skills = msg.skills ?? [];

      // Resolve and publish git info
      this.refreshGitInfo(session, { notifyPoller: true });

      this.broadcastToBrowsers(session, {
        type: "session_init",
        session: session.state,
      });
      this.persistSession(session);

      // Flush any messages queued before CLI was initialized (e.g. user sent
      // a message while the container was still starting up).
      if (session.pendingMessages.length > 0) {
        console.log(`[ws-bridge] Flushing ${session.pendingMessages.length} queued message(s) after init for session ${session.id}`);
        const queued = session.pendingMessages.splice(0);
        for (const ndjson of queued) {
          this.sendToCLI(session, ndjson);
        }
      }
    } else if (msg.subtype === "status") {
      session.state.is_compacting = msg.status === "compacting";

      if (msg.permissionMode) {
        session.state.permissionMode = msg.permissionMode;
      }

      this.broadcastToBrowsers(session, {
        type: "status_change",
        status: msg.status ?? null,
      });
    }
    // Other system subtypes (compact_boundary, task_notification, etc.) can be forwarded as needed
  }

  private handleAssistantMessage(session: Session, msg: CLIAssistantMessage) {
    const browserMsg: BrowserIncomingMessage = {
      type: "assistant",
      message: msg.message,
      parent_tool_use_id: msg.parent_tool_use_id,
      timestamp: Date.now(),
    };
    // Deduplicate: skip if this message ID is already in history (e.g. from resume replay)
    const msgId = msg.message?.id;
    if (msgId && session.messageHistory.some(
      m => m.type === "assistant" && (m as any).message?.id === msgId
    )) {
      return;
    }
    session.messageHistory.push(browserMsg);
    this.broadcastToBrowsers(session, browserMsg);
    this.persistSession(session);
  }

  private handleResultMessage(session: Session, msg: CLIResultMessage) {
    // Broadcast CLI result summary as subtitle (shown below the title in TopBar)
    if (msg.result) {
      const subtitle = truncateTitle(msg.result);
      this.broadcastToBrowsers(session, { type: "subtitle_updated", subtitle });
    }

    // Update session cost/turns
    session.state.total_cost_usd = msg.total_cost_usd;
    session.state.num_turns = msg.num_turns;

    // Update lines changed (CLI may send these in result)
    if (typeof msg.total_lines_added === "number") {
      session.state.total_lines_added = msg.total_lines_added;
    }
    if (typeof msg.total_lines_removed === "number") {
      session.state.total_lines_removed = msg.total_lines_removed;
    }

    // Compute context usage from modelUsage
    if (msg.modelUsage) {
      for (const usage of Object.values(msg.modelUsage)) {
        if (usage.contextWindow > 0) {
          const pct = Math.round(
            ((usage.inputTokens + usage.outputTokens) / usage.contextWindow) * 100
          );
          session.state.context_used_percent = Math.max(0, Math.min(pct, 100));
        }
      }
    }

    // Re-check git state after each turn in case branch moved during the session.
    this.refreshGitInfo(session, { broadcastUpdate: true, notifyPoller: true });

    const browserMsg: BrowserIncomingMessage = {
      type: "result",
      data: msg,
    };
    session.messageHistory.push(browserMsg);
    this.broadcastToBrowsers(session, browserMsg);
    this.persistSession(session);

    // Trigger auto-naming after the first successful result for this session.
    // Note: num_turns counts all internal tool-use turns, so it's typically > 1
    // even on the first user interaction. We track per-session instead.
    if (
      !msg.is_error &&
      this.onFirstTurnCompleted &&
      !this.autoNamingAttempted.has(session.id)
    ) {
      this.autoNamingAttempted.add(session.id);
      const firstUserMsg = session.messageHistory.find(
        (m) => m.type === "user_message",
      );
      if (firstUserMsg && firstUserMsg.type === "user_message") {
        this.onFirstTurnCompleted(session.id, firstUserMsg.content);
      }
    }
  }

  private handleStreamEvent(session: Session, msg: CLIStreamEventMessage) {
    this.broadcastToBrowsers(session, {
      type: "stream_event",
      event: msg.event,
      parent_tool_use_id: msg.parent_tool_use_id,
    });
  }

  private handleControlRequest(session: Session, msg: CLIControlRequestMessage) {
    if (msg.request.subtype === "can_use_tool") {
      // Auto-approve in bypassPermissions (agent) mode — the CLI handles most
      // permissions internally but some tool calls still reach the server.
      // Auto-deny in dontAsk mode — per SDK: "deny if not pre-approved".
      if (session.state.permissionMode === "bypassPermissions" || session.state.permissionMode === "dontAsk") {
        const shouldAllow = session.state.permissionMode === "bypassPermissions";
        const ndjson = JSON.stringify({
          type: "control_response",
          response: {
            subtype: "success",
            request_id: msg.request_id,
            response: {
              behavior: shouldAllow ? "allow" : "deny",
              updatedInput: msg.request.input ?? {},
            },
          },
        });
        this.sendToCLI(session, ndjson);
        return;
      }

      const perm: PermissionRequest = {
        request_id: msg.request_id,
        tool_name: msg.request.tool_name,
        input: msg.request.input,
        permission_suggestions: msg.request.permission_suggestions,
        description: msg.request.description,
        tool_use_id: msg.request.tool_use_id,
        agent_id: msg.request.agent_id,
        timestamp: Date.now(),
      };
      session.pendingPermissions.set(msg.request_id, perm);

      this.broadcastToBrowsers(session, {
        type: "permission_request",
        request: perm,
      });
      this.persistSession(session);
    }
  }

  private handleToolProgress(session: Session, msg: CLIToolProgressMessage) {
    this.broadcastToBrowsers(session, {
      type: "tool_progress",
      tool_use_id: msg.tool_use_id,
      tool_name: msg.tool_name,
      elapsed_time_seconds: msg.elapsed_time_seconds,
    });
  }

  private handleToolUseSummary(session: Session, msg: CLIToolUseSummaryMessage) {
    this.broadcastToBrowsers(session, {
      type: "tool_use_summary",
      summary: msg.summary,
      tool_use_ids: msg.preceding_tool_use_ids,
    });
  }

  private handleAuthStatus(session: Session, msg: CLIAuthStatusMessage) {
    this.broadcastToBrowsers(session, {
      type: "auth_status",
      isAuthenticating: msg.isAuthenticating,
      output: msg.output,
      error: msg.error,
    });
  }

  // ── Browser message routing ─────────────────────────────────────────────

  private routeBrowserMessage(
    session: Session,
    msg: BrowserOutgoingMessage,
    ws?: ServerWebSocket<SocketData>,
  ) {
    if (msg.type === "session_subscribe") {
      this.handleSessionSubscribe(session, ws, msg.last_seq);
      return;
    }

    if (msg.type === "session_ack") {
      this.handleSessionAck(session, ws, msg.last_seq);
      return;
    }

    if (
      WsBridge.IDEMPOTENT_BROWSER_MESSAGE_TYPES.has(msg.type)
      && "client_msg_id" in msg
      && msg.client_msg_id
    ) {
      if (this.isDuplicateClientMessage(session, msg.client_msg_id)) {
        return;
      }
      this.rememberClientMessage(session, msg.client_msg_id);
    }

    // For Codex sessions, delegate entirely to the adapter
    if (session.backendType === "codex") {
      // Store user messages in history for replay with stable ID for dedup on reconnect
      if (msg.type === "user_message") {
        const ts = Date.now();
        session.messageHistory.push({
          type: "user_message",
          content: msg.content,
          timestamp: ts,
          id: `user-${ts}-${this.userMsgCounter++}`,
        });
        this.persistSession(session);
      }
      if (msg.type === "permission_response") {
        session.pendingPermissions.delete(msg.request_id);
        this.persistSession(session);
      }

      if (session.codexAdapter) {
        session.codexAdapter.sendBrowserMessage(msg);
      } else {
        // Adapter not yet attached — queue for when it's ready.
        // The adapter itself also queues during init, but this covers
        // the window between session creation and adapter attachment.
        console.log(`[ws-bridge] Codex adapter not yet attached for session ${session.id}, queuing ${msg.type}`);
        session.pendingMessages.push(JSON.stringify(msg));
      }
      return;
    }

    // Claude Code path (existing logic)
    switch (msg.type) {
      case "user_message":
        void this.handleUserMessage(session, msg);
        break;

      case "permission_response":
        this.handlePermissionResponse(session, msg);
        break;

      case "interrupt":
        this.handleInterrupt(session);
        break;

      case "set_model":
        this.handleSetModel(session, msg.model);
        break;

      case "set_permission_mode":
        this.handleSetPermissionMode(session, msg.mode);
        break;

      case "mcp_get_status":
        this.handleMcpGetStatus(session);
        break;

      case "mcp_toggle":
        this.handleMcpToggle(session, msg.serverName, msg.enabled);
        break;

      case "mcp_reconnect":
        this.handleMcpReconnect(session, msg.serverName);
        break;

      case "mcp_set_servers":
        this.handleMcpSetServers(session, msg.servers);
        break;
    }
  }

  private isDuplicateClientMessage(session: Session, clientMsgId: string): boolean {
    return session.processedClientMessageIdSet.has(clientMsgId);
  }

  private rememberClientMessage(session: Session, clientMsgId: string): void {
    session.processedClientMessageIds.push(clientMsgId);
    session.processedClientMessageIdSet.add(clientMsgId);
    if (session.processedClientMessageIds.length > WsBridge.PROCESSED_CLIENT_MSG_ID_LIMIT) {
      const overflow = session.processedClientMessageIds.length - WsBridge.PROCESSED_CLIENT_MSG_ID_LIMIT;
      const removed = session.processedClientMessageIds.splice(0, overflow);
      for (const id of removed) {
        session.processedClientMessageIdSet.delete(id);
      }
    }
    this.persistSession(session);
  }

  private handleSessionSubscribe(
    session: Session,
    ws: ServerWebSocket<SocketData> | undefined,
    lastSeq: number,
  ) {
    if (!ws) return;
    const data = ws.data as BrowserSocketData;
    data.subscribed = true;
    const lastAckSeq = Number.isFinite(lastSeq) ? Math.max(0, Math.floor(lastSeq)) : 0;
    data.lastAckSeq = lastAckSeq;

    if (session.eventBuffer.length === 0) return;
    if (lastAckSeq >= session.nextEventSeq - 1) return;

    const earliest = session.eventBuffer[0]?.seq ?? session.nextEventSeq;
    const hasGap = lastAckSeq > 0 && lastAckSeq < earliest - 1;
    if (hasGap) {
      this.sendToBrowser(ws, {
        type: "message_history",
        messages: session.messageHistory,
      });
      const transientMissed = session.eventBuffer
        .filter((evt) => evt.seq > lastAckSeq && !this.isHistoryBackedEvent(evt.message));
      if (transientMissed.length > 0) {
        this.sendToBrowser(ws, {
          type: "event_replay",
          events: transientMissed,
        });
      }
      return;
    }

    const missed = session.eventBuffer.filter((evt) => evt.seq > lastAckSeq);
    if (missed.length === 0) return;
    this.sendToBrowser(ws, {
      type: "event_replay",
      events: missed,
    });
  }

  private handleSessionAck(
    session: Session,
    ws: ServerWebSocket<SocketData> | undefined,
    lastSeq: number,
  ) {
    const normalized = Number.isFinite(lastSeq) ? Math.max(0, Math.floor(lastSeq)) : 0;
    if (ws) {
      const data = ws.data as BrowserSocketData;
      const prior = typeof data.lastAckSeq === "number" ? data.lastAckSeq : 0;
      data.lastAckSeq = Math.max(prior, normalized);
    }
    if (normalized > session.lastAckSeq) {
      session.lastAckSeq = normalized;
      this.persistSession(session);
    }
  }

  private async handleUserMessage(
    session: Session,
    msg: { type: "user_message"; content: string; session_id?: string; images?: { media_type: string; data: string }[] }
  ) {
    // Count user messages in history to detect first message
    const userMessageCount = session.messageHistory.filter(m => m.type === "user_message").length;
    const isFirstMessage = userMessageCount === 0;

    // Store user message in history for replay with stable ID for dedup on reconnect
    const ts = Date.now();
    session.messageHistory.push({
      type: "user_message",
      content: msg.content,
      timestamp: ts,
      id: `user-${ts}-${this.userMsgCounter++}`,
    });

    // Use the user's first message directly as the initial title
    if (isFirstMessage && this.onTitleGenerated && msg.content.trim()) {
      const title = truncateTitle(msg.content);
      this.onTitleGenerated(session.id, title);
    }

    // Build content: if images are present, use content block array; otherwise plain string
    let content: string | unknown[];
    if (msg.images?.length) {
      const blocks: unknown[] = [];
      for (const img of msg.images) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        });
      }
      blocks.push({ type: "text", text: msg.content });
      content = blocks;
    } else {
      content = msg.content;
    }

    const ndjson = JSON.stringify({
      type: "user",
      message: { role: "user", content },
      parent_tool_use_id: null,
      session_id: msg.session_id || session.state.session_id || "",
    });
    this.sendToCLI(session, ndjson);
    this.persistSession(session);
  }

  private handlePermissionResponse(
    session: Session,
    msg: { type: "permission_response"; request_id: string; behavior: "allow" | "deny"; updated_input?: Record<string, unknown>; updated_permissions?: unknown[]; message?: string }
  ) {
    // Remove from pending
    const pending = session.pendingPermissions.get(msg.request_id);
    session.pendingPermissions.delete(msg.request_id);

    if (msg.behavior === "allow") {
      const response: Record<string, unknown> = {
        behavior: "allow",
        updatedInput: msg.updated_input ?? pending?.input ?? {},
      };
      if (msg.updated_permissions?.length) {
        response.updatedPermissions = msg.updated_permissions;
      }
      const ndjson = JSON.stringify({
        type: "control_response",
        response: {
          subtype: "success",
          request_id: msg.request_id,
          response,
        },
      });
      this.sendToCLI(session, ndjson);
    } else {
      const ndjson = JSON.stringify({
        type: "control_response",
        response: {
          subtype: "success",
          request_id: msg.request_id,
          response: {
            behavior: "deny",
            message: msg.message || "Denied by user",
          },
        },
      });
      this.sendToCLI(session, ndjson);
    }
  }

  private handleInterrupt(session: Session) {
    const ndjson = JSON.stringify({
      type: "control_request",
      request_id: randomUUID(),
      request: { subtype: "interrupt" },
    });
    this.sendToCLI(session, ndjson);
  }

  private handleSetModel(session: Session, model: string) {
    const ndjson = JSON.stringify({
      type: "control_request",
      request_id: randomUUID(),
      request: { subtype: "set_model", model },
    });
    this.sendToCLI(session, ndjson);
  }

  private handleSetPermissionMode(session: Session, mode: string) {
    const ndjson = JSON.stringify({
      type: "control_request",
      request_id: randomUUID(),
      request: { subtype: "set_permission_mode", mode },
    });
    this.sendToCLI(session, ndjson);
  }

  // ── Control response handling ─────────────────────────────────────────

  private handleControlResponse(
    session: Session,
    msg: CLIControlResponseMessage,
  ) {
    const reqId = msg.response.request_id;
    const pending = session.pendingControlRequests.get(reqId);
    if (!pending) return; // Not a request we're tracking
    session.pendingControlRequests.delete(reqId);

    if (msg.response.subtype === "error") {
      console.warn(`[ws-bridge] Control request ${pending.subtype} failed: ${msg.response.error}`);
      return;
    }

    pending.resolve(msg.response.response ?? {});
  }

  // ── MCP control messages ──────────────────────────────────────────────

  /** Send a control_request to CLI, optionally tracking the response via a callback. */
  private sendControlRequest(
    session: Session,
    request: Record<string, unknown>,
    onResponse?: PendingControlRequest,
  ) {
    const requestId = randomUUID();
    if (onResponse) {
      session.pendingControlRequests.set(requestId, onResponse);
    }
    this.sendToCLI(session, JSON.stringify({
      type: "control_request",
      request_id: requestId,
      request,
    }));
  }

  private handleMcpGetStatus(session: Session) {
    this.sendControlRequest(session, { subtype: "mcp_status" }, {
      subtype: "mcp_status",
      resolve: (response) => {
        const servers = (response as { mcpServers?: McpServerDetail[] }).mcpServers ?? [];
        this.broadcastToBrowsers(session, { type: "mcp_status", servers });
      },
    });
  }

  private handleMcpToggle(session: Session, serverName: string, enabled: boolean) {
    this.sendControlRequest(session, { subtype: "mcp_toggle", serverName, enabled });
    setTimeout(() => this.handleMcpGetStatus(session), 500);
  }

  private handleMcpReconnect(session: Session, serverName: string) {
    this.sendControlRequest(session, { subtype: "mcp_reconnect", serverName });
    setTimeout(() => this.handleMcpGetStatus(session), 1000);
  }

  private handleMcpSetServers(session: Session, servers: Record<string, McpServerConfig>) {
    this.sendControlRequest(session, { subtype: "mcp_set_servers", servers });
    setTimeout(() => this.handleMcpGetStatus(session), 2000);
  }

  // ── Transport helpers ───────────────────────────────────────────────────

  private sendToCLI(session: Session, ndjson: string) {
    if (!session.cliSocket) {
      // Queue the message — CLI might still be starting up.
      // Don't record here; the message will be recorded when flushed.
      console.log(`[ws-bridge] CLI not yet connected for session ${session.id}, queuing message`);
      session.pendingMessages.push(ndjson);
      return;
    }
    // Record raw outgoing CLI message (only when actually sending, not when queuing)
    this.recorder?.record(session.id, "out", ndjson, "cli", session.backendType, session.state.cwd);
    try {
      // NDJSON requires a newline delimiter
      session.cliSocket.send(ndjson + "\n");
    } catch (err) {
      console.error(`[ws-bridge] Failed to send to CLI for session ${session.id}:`, err);
    }
  }

  /** Push a session name update to all connected browsers for a session. */
  broadcastNameUpdate(sessionId: string, name: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.broadcastToBrowsers(session, { type: "session_name_update", name });
  }

  /** Send a user message programmatically (for API use) */
  sendUserMessage(sessionId: string, content: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const msg: BrowserOutgoingMessage = {
      type: "user_message",
      content,
    };

    this.routeBrowserMessage(session, msg);
    return true;
  }

  private shouldBufferForReplay(msg: BrowserIncomingMessage): msg is ReplayableBrowserIncomingMessage {
    return msg.type !== "session_init"
      && msg.type !== "message_history"
      && msg.type !== "event_replay";
  }

  private isHistoryBackedEvent(msg: ReplayableBrowserIncomingMessage): boolean {
    return msg.type === "assistant"
      || msg.type === "result"
      || msg.type === "user_message"
      || msg.type === "error";
  }

  private sequenceEvent(
    session: Session,
    msg: BrowserIncomingMessage,
  ): BrowserIncomingMessage {
    const seq = session.nextEventSeq++;
    const sequenced = { ...msg, seq };
    if (this.shouldBufferForReplay(msg)) {
      session.eventBuffer.push({ seq, message: msg });
      if (session.eventBuffer.length > WsBridge.EVENT_BUFFER_LIMIT) {
        session.eventBuffer.splice(0, session.eventBuffer.length - WsBridge.EVENT_BUFFER_LIMIT);
      }
      this.persistSession(session);
    }
    return sequenced;
  }


  private broadcastToBrowsers(session: Session, msg: BrowserIncomingMessage) {
    // Debug: warn when assistant messages are broadcast to 0 browsers (they may be lost)
    if (session.browserSockets.size === 0 && (msg.type === "assistant" || msg.type === "stream_event" || msg.type === "result")) {
      console.log(`[ws-bridge] ⚠ Broadcasting ${msg.type} to 0 browsers for session ${session.id} (stored in history: ${msg.type === "assistant" || msg.type === "result"})`);
    }
    const json = JSON.stringify(this.sequenceEvent(session, msg));

    // Record raw outgoing browser message
    this.recorder?.record(session.id, "out", json, "browser", session.backendType, session.state.cwd);

    for (const ws of session.browserSockets) {
      try {
        ws.send(json);
      } catch {
        session.browserSockets.delete(ws);
      }
    }
  }

  private sendToBrowser(ws: ServerWebSocket<SocketData>, msg: BrowserIncomingMessage) {
    try {
      const json = JSON.stringify(msg);
      const result = ws.send(json);
      if (result === 0) {
        console.warn(`[ws-bridge] sendToBrowser: message dropped (backpressure) type=${msg.type} size=${json.length}`);
      }
    } catch {
      // Socket will be cleaned up on close
    }
  }
}
