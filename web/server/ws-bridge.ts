import type { ServerWebSocket } from "bun";
// LOCAL: extra imports for title extraction from session files
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  CLIMessage,
  CLISystemMessage,
  CLIAssistantMessage,
  CLIResultMessage,
  CLIStreamEventMessage,
  CLIToolProgressMessage,
  CLIToolUseSummaryMessage,
  CLIControlRequestMessage,
  CLIAuthStatusMessage,
  BrowserOutgoingMessage,
  BrowserIncomingMessage,
  SessionState,
  PermissionRequest,
  BackendType,
  McpServerConfig,
} from "./session-types.js";
import type { SessionStore } from "./session-store.js";
import type { CodexAdapter } from "./codex-adapter.js";
import type { RecorderManager } from "./recorder.js";
import { resolveSessionGitInfo } from "./session-git-info.js";
import type {
  Session,
  SocketData,
  CLISocketData,
  BrowserSocketData,
  GitSessionKey,
} from "./ws-bridge-types.js";
import { makeDefaultState } from "./ws-bridge-types.js";
export type { SocketData } from "./ws-bridge-types.js";
import {
  isDuplicateClientMessage,
  rememberClientMessage,
  isHistoryBackedEvent,
  sequenceEvent,
} from "./ws-bridge-replay.js";
import { attachCodexAdapterHandlers } from "./ws-bridge-codex.js";
import {
  handleInterrupt,
  handleSetModel,
  handleSetPermissionMode,
  handleControlResponse,
  sendControlRequest,
  handleMcpGetStatus,
  handleMcpToggle,
  handleMcpReconnect,
  handleMcpSetServers,
} from "./ws-bridge-controls.js";
import {
  handleSessionSubscribe,
  handleSessionAck,
  handlePermissionResponse,
} from "./ws-bridge-browser.js";

// LOCAL: Known system-injected XML tags that wrap (or replace) user content.
// Matches the tag AND its enclosed text so both are removed before title generation.
const SYSTEM_TAG_RE = /<\/?(local-command-caveat|local-command-stdout|command-name|command-message|command-args|system-reminder|user-prompt-submit-hook|antml:[a-z_]+)[^>]*>/g;

/** Strip Claude Code system-injected XML tags and their content from a message. */
export function stripSystemTags(message: string): string {
  return message.replace(SYSTEM_TAG_RE, "").replace(/\s+/g, " ").trim();
}

// LOCAL: Truncate a message to use as a session title (max ~50 chars at word boundary).
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
  /** Cached fragment states received from browsers via fragment_state_update */
  private fragmentStateCache = new Map<string, Map<string, unknown>>();
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

  /** Return the last state pushed by a fragment via vibeReportState. */
  getFragmentState(sessionId: string, fragmentId: string): unknown {
    return this.fragmentStateCache.get(sessionId)?.get(fragmentId) ?? null;
  }

  /** Return all cached fragment states for a session. */
  getAllFragmentStates(sessionId: string): Record<string, unknown> {
    const cache = this.fragmentStateCache.get(sessionId);
    if (!cache) return {};
    return Object.fromEntries(cache);
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
      resolveSessionGitInfo(session.id, session.state);
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
    const before: Partial<Record<GitSessionKey, unknown>> = {};
    for (const key of WsBridge.GIT_SESSION_KEYS) before[key] = session.state[key];

    resolveSessionGitInfo(session.id, session.state);

    const changed = WsBridge.GIT_SESSION_KEYS.some((k) => session.state[k] !== before[k]);

    if (changed) {
      if (options.broadcastUpdate) {
        const gitState: Partial<SessionState> = {};
        for (const key of WsBridge.GIT_SESSION_KEYS) (gitState as Record<string, unknown>)[key] = session.state[key];
        this.broadcastToBrowsers(session, { type: "session_update", session: gitState });
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

            // Strip system-injected XML tags (e.g. <local-command-caveat>) from
            // CLI session history so they don't leak into titles or chat display.
            textContent = stripSystemTags(textContent);

            // Skip empty user messages (e.g., messages with only tool_result blocks
            // or messages that were entirely system tags)
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

  /** Resolve a session by Companion sessionId OR CLI session ID. */
  resolveSession(id: string): Session | undefined {
    const direct = this.sessions.get(id);
    if (direct) return direct;
    for (const session of this.sessions.values()) {
      if (session.cliSessionId === id) return session;
    }
    return undefined;
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
      return truncateTitle(firstUserMsg.content);
    }
    return undefined;
  }

  /** Retrieve full tool_result content from session history (for lazy loading) */
  getToolResult(sessionId: string, toolUseId: string): { content: string; is_error: boolean } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    for (const msg of session.messageHistory) {
      if (msg.type !== "assistant") continue;
      const content = (msg as any).message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === "tool_result" && block.tool_use_id === toolUseId) {
          const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          return { content: text, is_error: block.is_error ?? false };
        }
      }
    }
    return null;
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
    attachCodexAdapterHandlers(sessionId, session, adapter, {
      persistSession: this.persistSession.bind(this),
      refreshGitInfo: this.refreshGitInfo.bind(this),
      broadcastToBrowsers: this.broadcastToBrowsers.bind(this),
      onCLISessionId: this.onCLISessionId,
      onFirstTurnCompleted: this.onFirstTurnCompleted,
      autoNamingAttempted: this.autoNamingAttempted,
    });
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
   *  Used by the cron scheduler and agent executor to send prompts to autonomous sessions. */
  injectUserMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[ws-bridge] Cannot inject message: session ${sessionId} not found`);
      return;
    }
    this.routeBrowserMessage(session, { type: "user_message", content });
  }

  /** Configure MCP servers on a session programmatically (no browser required).
   *  Used by the agent executor to set up MCP servers after CLI connects. */
  injectMcpSetServers(sessionId: string, servers: Record<string, McpServerConfig>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[ws-bridge] Cannot inject MCP servers: session ${sessionId} not found`);
      return;
    }
    this.routeBrowserMessage(session, { type: "mcp_set_servers", servers });
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
        handleControlResponse(session, msg, (message) => console.warn(message));
        break;

      case "keep_alive":
        // Silently consume keepalives
        break;

      default:
        // Forward unknown messages as-is for debugging
        break;
    }
  }

  private handleSystemMessage(session: Session, msg: CLISystemMessage) {
    if (msg.subtype === "init") {
      // Keep the launcher-assigned session_id as the canonical ID.
      // The CLI may report its own internal session_id which differs
      // from the launcher UUID, causing duplicate entries in the sidebar.

      // Store the CLI's internal session_id so we can --resume on relaunch
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
      return;
    }

    if (msg.subtype === "status") {
      session.state.is_compacting = msg.status === "compacting";

      if (msg.permissionMode) {
        session.state.permissionMode = msg.permissionMode;
      }

      this.broadcastToBrowsers(session, {
        type: "status_change",
        status: msg.status ?? null,
      });
      return;
    }

    if (msg.subtype === "compact_boundary") {
      this.forwardSystemEvent(session, {
        subtype: "compact_boundary",
        compact_metadata: msg.compact_metadata,
        uuid: msg.uuid,
        session_id: msg.session_id,
      });
      return;
    }

    if (msg.subtype === "task_notification") {
      this.forwardSystemEvent(session, {
        subtype: "task_notification",
        task_id: msg.task_id,
        status: msg.status,
        output_file: msg.output_file,
        summary: msg.summary,
        uuid: msg.uuid,
        session_id: msg.session_id,
      });
      return;
    }

    if (msg.subtype === "files_persisted") {
      this.forwardSystemEvent(session, {
        subtype: "files_persisted",
        files: msg.files,
        failed: msg.failed,
        processed_at: msg.processed_at,
        uuid: msg.uuid,
        session_id: msg.session_id,
      });
      return;
    }

    if (msg.subtype === "hook_started") {
      this.forwardSystemEvent(session, {
        subtype: "hook_started",
        hook_id: msg.hook_id,
        hook_name: msg.hook_name,
        hook_event: msg.hook_event,
        uuid: msg.uuid,
        session_id: msg.session_id,
      });
      return;
    }

    if (msg.subtype === "hook_progress") {
      this.forwardSystemEvent(session, {
        subtype: "hook_progress",
        hook_id: msg.hook_id,
        hook_name: msg.hook_name,
        hook_event: msg.hook_event,
        stdout: msg.stdout,
        stderr: msg.stderr,
        output: msg.output,
        uuid: msg.uuid,
        session_id: msg.session_id,
      }, { persistInHistory: false });
      return;
    }

    if (msg.subtype === "hook_response") {
      this.forwardSystemEvent(session, {
        subtype: "hook_response",
        hook_id: msg.hook_id,
        hook_name: msg.hook_name,
        hook_event: msg.hook_event,
        output: msg.output,
        stdout: msg.stdout,
        stderr: msg.stderr,
        exit_code: msg.exit_code,
        outcome: msg.outcome,
        uuid: msg.uuid,
        session_id: msg.session_id,
      });
      return;
    }

    // Unknown system subtypes are intentionally ignored until we map them.
  }

  private forwardSystemEvent(
    session: Session,
    event: Extract<BrowserIncomingMessage, { type: "system_event" }>["event"],
    options: { persistInHistory?: boolean } = {},
  ) {
    const browserMsg: BrowserIncomingMessage = {
      type: "system_event",
      event,
      timestamp: Date.now(),
    };

    if (options.persistInHistory !== false) {
      session.messageHistory.push(browserMsg);
      this.persistSession(session);
    }

    this.broadcastToBrowsers(session, browserMsg);
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
    // Store full message in history (for on-demand API retrieval)
    session.messageHistory.push(browserMsg);

    // For subagent messages, strip tool_result content to save browser memory.
    // Results can be fetched on demand via GET /api/sessions/:id/tool-result/:toolUseId
    if (msg.parent_tool_use_id && msg.message?.content?.length) {
      const lightContent = msg.message.content.map((block: any) => {
        if (block.type === "tool_result" && block.content) {
          return { ...block, content: "__LAZY_RESULT__" };
        }
        return block;
      });
      const lightMsg: BrowserIncomingMessage = {
        ...browserMsg,
        message: { ...msg.message, content: lightContent },
      };
      this.broadcastToBrowsers(session, lightMsg);
    } else {
      this.broadcastToBrowsers(session, browserMsg);
    }
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
        // Strip system-injected tags before passing to auto-namer
        const cleanContent = stripSystemTags(firstUserMsg.content);
        if (cleanContent) {
          this.onFirstTurnCompleted(session.id, cleanContent);
        }
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
      handleSessionSubscribe(
        session,
        ws,
        msg.last_seq,
        this.sendToBrowser.bind(this),
        isHistoryBackedEvent,
      );
      return;
    }

    if (msg.type === "session_ack") {
      handleSessionAck(session, ws, msg.last_seq, this.persistSession.bind(this));
      return;
    }

    if (
      WsBridge.IDEMPOTENT_BROWSER_MESSAGE_TYPES.has(msg.type)
      && "client_msg_id" in msg
      && msg.client_msg_id
    ) {
      if (isDuplicateClientMessage(session, msg.client_msg_id)) {
        return;
      }
      rememberClientMessage(
        session,
        msg.client_msg_id,
        WsBridge.PROCESSED_CLIENT_MSG_ID_LIMIT,
        this.persistSession.bind(this),
      );
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
        handlePermissionResponse(session, msg, this.sendToCLI.bind(this));
        break;

      case "interrupt":
        handleInterrupt(session, this.sendToCLI.bind(this));
        break;

      case "set_model":
        handleSetModel(session, msg.model, this.sendToCLI.bind(this));
        break;

      case "set_permission_mode":
        handleSetPermissionMode(session, msg.mode, this.sendToCLI.bind(this));
        break;

      case "mcp_get_status":
        handleMcpGetStatus(
          session,
          (request, onResponse) => sendControlRequest(session, request, this.sendToCLI.bind(this), onResponse),
          this.broadcastToBrowsers.bind(this),
        );
        break;

      case "mcp_toggle":
        handleMcpToggle(
          (request) => sendControlRequest(session, request, this.sendToCLI.bind(this)),
          msg.serverName,
          msg.enabled,
          () =>
            handleMcpGetStatus(
              session,
              (request, onResponse) => sendControlRequest(session, request, this.sendToCLI.bind(this), onResponse),
              this.broadcastToBrowsers.bind(this),
            ),
        );
        break;

      case "mcp_reconnect":
        handleMcpReconnect(
          (request) => sendControlRequest(session, request, this.sendToCLI.bind(this)),
          msg.serverName,
          () =>
            handleMcpGetStatus(
              session,
              (request, onResponse) => sendControlRequest(session, request, this.sendToCLI.bind(this), onResponse),
              this.broadcastToBrowsers.bind(this),
            ),
        );
        break;

      case "mcp_set_servers":
        handleMcpSetServers(
          (request) => sendControlRequest(session, request, this.sendToCLI.bind(this)),
          msg.servers,
          () =>
            handleMcpGetStatus(
              session,
              (request, onResponse) => sendControlRequest(session, request, this.sendToCLI.bind(this), onResponse),
              this.broadcastToBrowsers.bind(this),
            ),
        );
        break;

      case "fragment_state_update": {
        const sessionCache = this.fragmentStateCache.get(session.id) ?? new Map<string, unknown>();
        sessionCache.set(msg.fragmentId, msg.state);
        this.fragmentStateCache.set(session.id, sessionCache);
        break;
      }
    }
  }

  private handleUserMessage(
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

  // LOCAL: Send a user message programmatically (for API use)
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


  private broadcastToBrowsers(session: Session, msg: BrowserIncomingMessage) {
    // Debug: warn when assistant messages are broadcast to 0 browsers (they may be lost)
    if (session.browserSockets.size === 0 && (msg.type === "assistant" || msg.type === "stream_event" || msg.type === "result")) {
      console.log(`[ws-bridge] ⚠ Broadcasting ${msg.type} to 0 browsers for session ${session.id} (stored in history: ${msg.type === "assistant" || msg.type === "result"})`);
    }
    const json = JSON.stringify(
      sequenceEvent(
        session,
        msg,
        WsBridge.EVENT_BUFFER_LIMIT,
        this.persistSession.bind(this),
      ),
    );

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
