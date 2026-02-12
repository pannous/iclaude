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
  CLIAuthStatusMessage,
  BrowserOutgoingMessage,
  BrowserIncomingMessage,
  SessionState,
  PermissionRequest,
  BackendType,
} from "./session-types.js";
import type { SessionStore } from "./session-store.js";
import type { CodexAdapter } from "./codex-adapter.js";

/** Truncate a message to use as a session title (max ~50 chars at word boundary). */
function truncateTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
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
}

export type SocketData = CLISocketData | BrowserSocketData;

// ─── Session ──────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  backendType: BackendType;
  cliSocket: ServerWebSocket<SocketData> | null;
  codexAdapter: CodexAdapter | null;
  browserSockets: Set<ServerWebSocket<SocketData>>;
  state: SessionState;
  pendingPermissions: Map<string, PermissionRequest>;
  messageHistory: BrowserIncomingMessage[];
  /** Messages queued while waiting for CLI to connect */
  pendingMessages: string[];
  /** CLI's internal session ID (for resuming) */
  cliSessionId?: string;
  /** Auto-generated or user-set title */
  title?: string;
  /** Timestamp when session was created */
  createdAt?: number;
}

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
    repo_root: "",
    git_ahead: 0,
    git_behind: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
  };
}

// ─── Git info helper ─────────────────────────────────────────────────────────

function resolveGitInfo(state: SessionState): void {
  if (!state.cwd) return;
  try {
    state.git_branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: state.cwd, encoding: "utf-8", timeout: 3000,
    }).trim();

    try {
      const gitDir = execSync("git rev-parse --git-dir", {
        cwd: state.cwd, encoding: "utf-8", timeout: 3000,
      }).trim();
      state.is_worktree = gitDir.includes("/worktrees/");
    } catch { /* ignore */ }

    try {
      if (state.is_worktree) {
        // For worktrees, --show-toplevel returns the worktree dir, not the original repo.
        // Use --git-common-dir to find the shared .git dir, then derive the repo root.
        const commonDir = execSync("git rev-parse --git-common-dir", {
          cwd: state.cwd, encoding: "utf-8", timeout: 3000,
        }).trim();
        state.repo_root = resolve(state.cwd, commonDir, "..");
      } else {
        state.repo_root = execSync("git rev-parse --show-toplevel", {
          cwd: state.cwd, encoding: "utf-8", timeout: 3000,
        }).trim();
      }
    } catch { /* ignore */ }

    try {
      const counts = execSync(
        "git rev-list --left-right --count @{upstream}...HEAD",
        { cwd: state.cwd, encoding: "utf-8", timeout: 3000 },
      ).trim();
      const [behind, ahead] = counts.split(/\s+/).map(Number);
      state.git_ahead = ahead || 0;
      state.git_behind = behind || 0;
    } catch {
      state.git_ahead = 0;
      state.git_behind = 0;
    }
  } catch {
    // Not a git repo or git not available
  }
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

export class WsBridge {
  private sessions = new Map<string, Session>();
  private store: SessionStore | null = null;
  private onCLISessionId: ((sessionId: string, cliSessionId: string) => void) | null = null;
  private onCLIRelaunchNeeded: ((sessionId: string) => void) | null = null;
  private onTitleGenerated: ((sessionId: string, title: string) => void) | null = null;
  private onFirstTurnCompleted: ((sessionId: string, firstUserMessage: string) => void) | null = null;
  private autoNamingAttempted = new Set<string>();
  private userMsgCounter = 0;

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

  /** Attach a persistent store. Call restoreFromDisk() after. */
  setStore(store: SessionStore): void {
    this.store = store;
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
        messageHistory: p.messageHistory || [],
        pendingMessages: p.pendingMessages || [],
        cliSessionId: p.cliSessionId,
        title: p.title,
        createdAt: p.createdAt,
      };
      session.state.backend_type = session.backendType;
      // Resolve git info for restored sessions (may have been persisted without it)
      resolveGitInfo(session.state);
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
      if (!session.cliSocket && session.browserSockets.size === 0) {
        this.sessions.delete(session.id);
        this.store.remove(session.id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ws-bridge] Cleaned up ${removed} disconnected session(s) (${this.sessions.size} remaining)`);
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
    });
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
        messageHistory: [],
        pendingMessages: [],
        createdAt: Date.now(),
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
      this.persistSession(session);
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

  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values()).map((s) => s.state);
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
        resolveGitInfo(session.state);
        this.persistSession(session);
      } else if (msg.type === "session_update") {
        session.state = { ...session.state, ...msg.session, backend_type: "codex" };
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

    // Flush any messages that were queued while waiting for CLI to connect
    if (session.pendingMessages.length > 0) {
      console.log(`[ws-bridge] Flushing ${session.pendingMessages.length} queued message(s) for session ${sessionId}`);
      for (const ndjson of session.pendingMessages) {
        this.sendToCLI(session, ndjson);
      }
      session.pendingMessages = [];
    }
  }

  handleCLIMessage(ws: ServerWebSocket<SocketData>, raw: string | Buffer) {
    const data = typeof raw === "string" ? raw : raw.toString("utf-8");
    const sessionId = (ws.data as CLISocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

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
    session.browserSockets.add(ws);
    console.log(`[ws-bridge] Browser connected for session ${sessionId} (${session.browserSockets.size} browsers)`);

    // Send current session state as snapshot
    const snapshot: BrowserIncomingMessage = {
      type: "session_init",
      session: session.state,
    };
    this.sendToBrowser(ws, snapshot);

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
      if (this.onCLIRelaunchNeeded) {
        console.log(`[ws-bridge] Browser connected but backend is dead for session ${sessionId}, requesting relaunch`);
        this.onCLIRelaunchNeeded(sessionId);
      }
    }
  }

  handleBrowserMessage(ws: ServerWebSocket<SocketData>, raw: string | Buffer) {
    const data = typeof raw === "string" ? raw : raw.toString("utf-8");
    const sessionId = (ws.data as BrowserSocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let msg: BrowserOutgoingMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      console.warn(`[ws-bridge] Failed to parse browser message: ${data.substring(0, 200)}`);
      return;
    }

    this.routeBrowserMessage(session, msg);
  }

  handleBrowserClose(ws: ServerWebSocket<SocketData>) {
    const sessionId = (ws.data as BrowserSocketData).sessionId;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.browserSockets.delete(ws);
    console.log(`[ws-bridge] Browser disconnected for session ${sessionId} (${session.browserSockets.size} browsers)`);
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
      session.state.cwd = msg.cwd;
      session.state.tools = msg.tools;
      session.state.permissionMode = msg.permissionMode;
      session.state.claude_code_version = msg.claude_code_version;
      session.state.mcp_servers = msg.mcp_servers;
      session.state.agents = msg.agents ?? [];
      session.state.slash_commands = msg.slash_commands ?? [];
      session.state.skills = msg.skills ?? [];

      // Resolve git info from session cwd
      resolveGitInfo(session.state);

      this.broadcastToBrowsers(session, {
        type: "session_init",
        session: session.state,
      });
      this.persistSession(session);
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
      // Auto-approve if in dontAsk mode
      if (session.state.permissionMode === "dontAsk") {
        const ndjson = JSON.stringify({
          type: "control_response",
          response: {
            subtype: "success",
            request_id: msg.request_id,
            response: {
              behavior: "allow",
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

  private routeBrowserMessage(session: Session, msg: BrowserOutgoingMessage) {
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

  // ── Transport helpers ───────────────────────────────────────────────────

  private sendToCLI(session: Session, ndjson: string) {
    if (!session.cliSocket) {
      // Queue the message — CLI might still be starting up
      console.log(`[ws-bridge] CLI not yet connected for session ${session.id}, queuing message`);
      session.pendingMessages.push(ndjson);
      return;
    }
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

  private broadcastToBrowsers(session: Session, msg: BrowserIncomingMessage) {
    // Debug: warn when assistant messages are broadcast to 0 browsers (they may be lost)
    if (session.browserSockets.size === 0 && (msg.type === "assistant" || msg.type === "stream_event" || msg.type === "result")) {
      console.log(`[ws-bridge] ⚠ Broadcasting ${msg.type} to 0 browsers for session ${session.id} (stored in history: ${msg.type === "assistant" || msg.type === "result"})`);
    }
    const json = JSON.stringify(msg);
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
      ws.send(JSON.stringify(msg));
    } catch {
      // Socket will be cleaned up on close
    }
  }
}
