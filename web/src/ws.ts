import { useStore } from "./store.js";
import type { BrowserIncomingMessage, BrowserOutgoingMessage, ContentBlock, ChatMessage, TaskItem, SdkSessionInfo, McpServerConfig } from "./types.js";
import { resultScanner, scanContent } from "./utils/result-scanner.js";
import { safeStorage } from "./utils/safe-storage.js";

import { playNotificationSound } from "./utils/notification-sound.js";

const WS_RECONNECT_DELAY_MS = 2000;
const sockets = new Map<string, WebSocket>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const reconnectAttempts = new Map<string, number>();
const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 2_000;
const lastSeqBySession = new Map<string, number>();
const taskCounters = new Map<string, number>();
const streamingPhaseBySession = new Map<string, "thinking" | "text">();
const streamingDraftMessageIdBySession = new Map<string, string>();
/** Track processed tool_use IDs to prevent duplicate task creation */
const processedToolUseIds = new Map<string, Set<string>>();
/** Whether an assistant message was finalized this turn (used to preserve post-thinking text) */
const hadAssistantThisTurn = new Set<string>();

function normalizePath(path: string): string {
  const isAbs = path.startsWith("/");
  const parts = path.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  return `${isAbs ? "/" : ""}${out.join("/")}`;
}

export function resolveSessionFilePath(filePath: string, cwd?: string): string {
  if (filePath.startsWith("/")) return normalizePath(filePath);
  if (!cwd) return normalizePath(filePath);
  return normalizePath(`${cwd}/${filePath}`);
}

function isPathInSessionScope(filePath: string, cwd?: string): boolean {
  if (!cwd) return true;
  const normalizedCwd = normalizePath(cwd);
  return filePath === normalizedCwd || filePath.startsWith(`${normalizedCwd}/`);
}

function getProcessedSet(sessionId: string): Set<string> {
  let set = processedToolUseIds.get(sessionId);
  if (!set) {
    set = new Set();
    processedToolUseIds.set(sessionId, set);
  }
  return set;
}

function extractTasksFromBlocks(sessionId: string, blocks: ContentBlock[]) {
  const store = useStore.getState();
  const processed = getProcessedSet(sessionId);

  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const { name, input, id: toolUseId } = block;

    // Deduplicate by tool_use_id
    if (toolUseId) {
      if (processed.has(toolUseId)) continue;
      processed.add(toolUseId);
    }

    // TodoWrite: full replacement — { todos: [{ content, status, activeForm }] }
    if (name === "TodoWrite") {
      const todos = input.todos as { content?: string; status?: string; activeForm?: string }[] | undefined;
      if (Array.isArray(todos)) {
        const tasks: TaskItem[] = todos.map((t, i) => ({
          id: String(i + 1),
          subject: t.content || "Task",
          description: "",
          activeForm: t.activeForm,
          status: (t.status as TaskItem["status"]) || "pending",
        }));
        store.setTasks(sessionId, tasks);
        taskCounters.set(sessionId, tasks.length);
      }
      continue;
    }

    // TaskCreate: incremental add — { subject, description, activeForm }
    if (name === "TaskCreate") {
      const count = (taskCounters.get(sessionId) || 0) + 1;
      taskCounters.set(sessionId, count);
      const task = {
        id: String(count),
        subject: (input.subject as string) || "Task",
        description: (input.description as string) || "",
        activeForm: input.activeForm as string | undefined,
        status: "pending" as const,
      };
      store.addTask(sessionId, task);
      continue;
    }

    // TaskUpdate: incremental update — { taskId, status, owner, activeForm, addBlockedBy }
    if (name === "TaskUpdate") {
      const taskId = input.taskId as string;
      if (taskId) {
        const updates: Partial<TaskItem> = {};
        if (input.status) updates.status = input.status as TaskItem["status"];
        if (input.owner) updates.owner = input.owner as string;
        if (input.activeForm !== undefined) updates.activeForm = input.activeForm as string;
        if (input.addBlockedBy) updates.blockedBy = input.addBlockedBy as string[];
        store.updateTask(sessionId, taskId, updates);
      }
    }
  }
}

function extractChangedFilesFromBlocks(sessionId: string, blocks: ContentBlock[]) {
  const store = useStore.getState();
  const sessionCwd =
    store.sessions.get(sessionId)?.cwd ||
    store.sdkSessions.find((sdk) => sdk.sessionId === sessionId)?.cwd;
  let dirty = false;
  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const { name, input } = block;
    if ((name === "Edit" || name === "Write") && typeof input.file_path === "string") {
      const resolvedPath = resolveSessionFilePath(input.file_path, sessionCwd);
      if (isPathInSessionScope(resolvedPath, sessionCwd)) {
        dirty = true;
      }
    }
  }
  if (dirty) store.bumpChangedFilesTick(sessionId);
}

function sendBrowserNotification(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, tag });
}

function summarizeSystemEvent(
  event: Extract<BrowserIncomingMessage, { type: "system_event" }>["event"],
): string | null {
  if (event.subtype === "compact_boundary") {
    return `Context compacted (${event.compact_metadata.trigger}, pre-tokens: ${event.compact_metadata.pre_tokens}).`;
  }

  if (event.subtype === "task_notification") {
    const summary = event.summary ? ` ${event.summary}` : "";
    return `Task ${event.status}: ${event.task_id}.${summary}`;
  }

  if (event.subtype === "files_persisted") {
    const persisted = event.files.length;
    const failed = event.failed.length;
    if (failed > 0) {
      return `Persisted ${persisted} file(s), ${failed} failed.`;
    }
    return `Persisted ${persisted} file(s).`;
  }

  if (event.subtype === "hook_started") {
    return `Hook started: ${event.hook_name} (${event.hook_event}).`;
  }

  if (event.subtype === "hook_response") {
    const exitCode = typeof event.exit_code === "number" ? ` (exit ${event.exit_code})` : "";
    return `Hook ${event.outcome}: ${event.hook_name} (${event.hook_event})${exitCode}.`;
  }

  // hook_progress can be high-volume; keep it out of chat by default.
  return null;
}

let idCounter = 0;
let clientMsgCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++idCounter}`;
}

// LOCAL: Desktop notification for background sessions
function firstParagraph(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.indexOf("\n\n");
  const paragraph = end > 0 ? trimmed.slice(0, end) : trimmed;
  return paragraph.length > 200 ? paragraph.slice(0, 197) + "..." : paragraph;
}

// LOCAL: Notify when a background session finishes
function notifySessionDone(sessionId: string, isError: boolean, resultText?: string) {
  const store = useStore.getState();
  if (store.currentSessionId === sessionId) return;
  if (!("Notification" in window)) return;

  const sdkTitle = store.sdkSessions.find((s) => s.sessionId === sessionId)?.title;
  const title = sdkTitle || store.sessionNames.get(sessionId) || sessionId.slice(0, 8);
  const body = resultText
    ? firstParagraph(resultText)
    : isError
    ? "Session ended with an error"
    : "Session finished successfully";

  const createNotification = () => {
    const notification = new Notification(title, { body, tag: `session-done-${sessionId}` });
    notification.onclick = () => {
      window.focus();
      useStore.getState().setCurrentSession(sessionId);
      connectSession(sessionId);
    };
  };

  if (Notification.permission === "granted") {
    createNotification();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        createNotification();
      }
    });
  }
}

function setStreamingDraftMessage(sessionId: string, content: string) {
  const store = useStore.getState();
  const existing = store.messages.get(sessionId) || [];
  const messages = [...existing];
  const existingDraftId = streamingDraftMessageIdBySession.get(sessionId);
  let draftIndex = -1;

  if (existingDraftId) {
    draftIndex = messages.findIndex((m) => m.id === existingDraftId);
    if (draftIndex === -1) {
      streamingDraftMessageIdBySession.delete(sessionId);
    }
  }

  if (draftIndex === -1) {
    const id = `stream-${sessionId}-${nextId()}`;
    streamingDraftMessageIdBySession.set(sessionId, id);
    messages.push({
      id,
      role: "assistant",
      content,
      timestamp: Date.now(),
      isStreaming: true,
    });
  } else {
    const prev = messages[draftIndex];
    messages[draftIndex] = {
      ...prev,
      role: "assistant",
      content,
      isStreaming: true,
    };
  }

  store.setMessages(sessionId, messages);
}

function finalizeStreamingDraftMessage(sessionId: string, finalMessage: ChatMessage): boolean {
  const draftId = streamingDraftMessageIdBySession.get(sessionId);
  console.log("[ws:TRACE] finalizeStreamingDraftMessage: draftId=", draftId, "finalMsg.id=", finalMessage.id, "finalMsg.scannedHtml=", finalMessage.scannedHtml?.length ?? 0);
  if (!draftId) return false;

  const store = useStore.getState();
  const existing = store.messages.get(sessionId) || [];
  const draftIndex = existing.findIndex((m) => m.id === draftId);
  console.log("[ws:TRACE] finalizeStreamingDraftMessage: draftIndex=", draftIndex, "totalMsgs=", existing.length);
  if (draftIndex === -1) {
    streamingDraftMessageIdBySession.delete(sessionId);
    return false;
  }

  const messages = [...existing];
  messages[draftIndex] = finalMessage;
  store.setMessages(sessionId, messages);
  streamingDraftMessageIdBySession.delete(sessionId);
  console.log("[ws:TRACE] finalizeStreamingDraftMessage: SUCCESS, replaced draft at index", draftIndex);
  return true;
}

function clearStreamingDraftMessage(sessionId: string) {
  const draftId = streamingDraftMessageIdBySession.get(sessionId);
  console.log("[ws:TRACE] clearStreamingDraftMessage: draftId=", draftId);
  if (!draftId) {
    console.log("[ws:TRACE] clearStreamingDraftMessage: no draft to clear (already finalized)");
    return;
  }

  const store = useStore.getState();
  const existing = store.messages.get(sessionId) || [];
  const draft = existing.find(m => m.id === draftId);
  console.log("[ws:TRACE] clearStreamingDraftMessage: REMOVING draft, content length=", draft?.content?.length ?? 0);
  const next = existing.filter((m) => m.id !== draftId);
  if (next.length !== existing.length) {
    store.setMessages(sessionId, next);
  }

  streamingDraftMessageIdBySession.delete(sessionId);
}

/**
 * If a streaming draft still exists after an assistant message was already
 * finalized this turn (extended thinking: thinking→assistant→text→result),
 * preserve it as a proper message with image/HTML scanning.
 * Otherwise, discard the transient draft.
 */
function finalizeOrClearStreamingDraft(sessionId: string) {
  const assistantSeen = hadAssistantThisTurn.has(sessionId);
  hadAssistantThisTurn.delete(sessionId);

  const draftId = streamingDraftMessageIdBySession.get(sessionId);
  if (!draftId) return;

  if (assistantSeen) {
    const store = useStore.getState();
    const msgs = store.messages.get(sessionId) || [];
    const draft = msgs.find(m => m.id === draftId);
    if (draft?.content && draft.content.trim().length > 0) {
      const scanned = scanForImagesAndHtml(draft.content, draftId);
      finalizeStreamingDraftMessage(sessionId, {
        ...draft,
        isStreaming: false,
        scannedImages: scanned.images,
        scannedHtml: scanned.html,
      });
      return;
    }
  }
  clearStreamingDraftMessage(sessionId);
}

function nextClientMsgId(): string {
  return `cmsg-${Date.now()}-${++clientMsgCounter}`;
}

const IDEMPOTENT_OUTGOING_TYPES = new Set<BrowserOutgoingMessage["type"]>([
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


function getWsUrl(sessionId: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/browser/${sessionId}`;
}

function getLastSeqStorageKey(sessionId: string): string {
  return `companion:last-seq:${sessionId}`;
}

function getLastSeq(sessionId: string): number {
  const cached = lastSeqBySession.get(sessionId);
  if (typeof cached === "number") return cached;
  try {
    const raw = safeStorage.getItem(getLastSeqStorageKey(sessionId));
    const parsed = raw ? Number(raw) : 0;
    const normalized = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    lastSeqBySession.set(sessionId, normalized);
    return normalized;
  } catch {
    return 0;
  }
}

function setLastSeq(sessionId: string, seq: number): void {
  const normalized = Math.max(0, Math.floor(seq));
  lastSeqBySession.set(sessionId, normalized);
  try {
    safeStorage.setItem(getLastSeqStorageKey(sessionId), String(normalized));
  } catch {
    // ignore storage errors
  }
}

function ackSeq(sessionId: string, seq: number): void {
  sendToSession(sessionId, { type: "session_ack", last_seq: seq });
}

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "thinking") return b.thinking;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// LOCAL: Scan result text for inline images and HTML fragments
function scanForImagesAndHtml(text: string, messageId?: string): {
  images?: { src: string; original: string }[];
  html?: { html: string; original: string; preview: string; fragmentId: string }[];
} {
  const scanned = scanContent(text);
  const idBase = messageId || `msg-${Date.now()}`;
  return {
    images: scanned.images.length > 0
      ? scanned.images.map((img) => ({
          src: resultScanner.toDisplaySrc(img),
          original: img.original,
        }))
      : undefined,
    html: scanned.html.length > 0
      ? scanned.html.map((h, i) => ({ ...h, fragmentId: `${idBase}:${i}` }))
      : undefined,
  };
}

function mergeContentBlocks(prev?: ContentBlock[], next?: ContentBlock[]): ContentBlock[] | undefined {
  const prevBlocks = prev || [];
  const nextBlocks = next || [];
  if (prevBlocks.length === 0 && nextBlocks.length === 0) return undefined;

  const merged: ContentBlock[] = [];
  const seen = new Set<string>();

  const pushUnique = (block: ContentBlock) => {
    const key = JSON.stringify(block);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(block);
  };

  for (const block of prevBlocks) pushUnique(block);
  for (const block of nextBlocks) pushUnique(block);
  return merged;
}

function mergeAssistantMessage(previous: ChatMessage, incoming: ChatMessage): ChatMessage {
  const mergedBlocks = mergeContentBlocks(previous.contentBlocks, incoming.contentBlocks);
  const mergedContent = mergedBlocks && mergedBlocks.length > 0
    ? extractTextFromBlocks(mergedBlocks)
    : (incoming.content || previous.content);

  // Re-scan merged content so HTML fragments survive across partial assistant merges.
  // Without this, a later tool_use-only message would overwrite scannedHtml with undefined.
  const scanned = scanForImagesAndHtml(mergedContent, previous.id);
  console.log("[ws:TRACE] mergeAssistantMessage:", previous.id,
    "prevHtml=", previous.scannedHtml?.length ?? 0,
    "incomingHtml=", incoming.scannedHtml?.length ?? 0,
    "mergedHtml=", scanned.html?.length ?? 0,
    "mergedContent length=", mergedContent.length);

  return {
    ...previous,
    ...incoming,
    content: mergedContent,
    contentBlocks: mergedBlocks,
    scannedImages: scanned.images,
    scannedHtml: scanned.html,
    // Keep the original timestamp position when this is an in-place assistant update.
    timestamp: previous.timestamp ?? incoming.timestamp,
    // Explicitly clear stale streaming marker when incoming is final.
    isStreaming: incoming.isStreaming,
  };
}

function upsertAssistantMessage(sessionId: string, incoming: ChatMessage) {
  const store = useStore.getState();
  const existing = store.messages.get(sessionId) || [];
  const index = existing.findIndex((m) => m.role === "assistant" && m.id === incoming.id);
  if (index === -1) {
    console.log("[ws:TRACE] upsertAssistantMessage: NEW message", incoming.id, "html=", incoming.scannedHtml?.length ?? 0, "content length=", incoming.content?.length);
    store.appendMessage(sessionId, incoming);
    return;
  }

  console.log("[ws:TRACE] upsertAssistantMessage: MERGING into existing", incoming.id, "prevHtml=", existing[index].scannedHtml?.length ?? 0, "incomingHtml=", incoming.scannedHtml?.length ?? 0);
  const messages = [...existing];
  messages[index] = mergeAssistantMessage(messages[index], incoming);
  console.log("[ws:TRACE] upsertAssistantMessage: MERGED html=", messages[index].scannedHtml?.length ?? 0);
  store.setMessages(sessionId, messages);
}

function handleMessage(sessionId: string, event: MessageEvent) {
  let data: BrowserIncomingMessage;
  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }

  // Promote to "connected" on first valid message (proves subscription succeeded)
  const store = useStore.getState();
  if (store.connectionStatus.get(sessionId) === "connecting") {
    store.setConnectionStatus(sessionId, "connected");
  }

  handleParsedMessage(sessionId, data);
}

function handleParsedMessage(
  sessionId: string,
  data: BrowserIncomingMessage,
  options: { processSeq?: boolean; ackSeqMessage?: boolean } = {},
) {
  const { processSeq = true, ackSeqMessage = true } = options;
  console.log(`[ws:TRACE] handleParsedMessage type="${data.type}" session=${sessionId.slice(0,8)}`);
  const store = useStore.getState();

  if (processSeq && typeof data.seq === "number") {
    const previous = getLastSeq(sessionId);
    if (data.seq <= previous) return;
    setLastSeq(sessionId, data.seq);
    if (ackSeqMessage) {
      ackSeq(sessionId, data.seq);
    }
  }

  switch (data.type) {
    case "session_init": {
      const existingSession = store.sessions.get(sessionId);
      store.addSession(data.session);
      store.setCliConnected(sessionId, true);
      if (!existingSession) {
        store.setSessionStatus(sessionId, "idle");
      }
      // Name will be set by session_name_update from server — no random fallback
      break;
    }

    case "session_update": {
      store.updateSession(sessionId, data.session);
      break;
    }

    case "assistant": {
      const msg = data.message;
      const textContent = extractTextFromBlocks(msg.content);
      console.log("[ws:TRACE] === ASSISTANT MESSAGE ===");
      console.log("[ws:TRACE] msg.id:", msg.id);
      console.log("[ws:TRACE] textContent length:", textContent.length);
      console.log("[ws:TRACE] textContent preview:", textContent.slice(0, 300));
      console.log("[ws:TRACE] contentBlocks count:", msg.content?.length, "types:", msg.content?.map((b: ContentBlock) => b.type));
      const scanned = scanForImagesAndHtml(textContent, msg.id);
      console.log("[ws:TRACE] scan result — html:", scanned.html?.length ?? 0, "images:", scanned.images?.length ?? 0);
      if (scanned.html) console.log("[ws:TRACE] html previews:", scanned.html.map(h => h.preview));
      const chatMsg: ChatMessage = {
        id: msg.id,
        role: "assistant",
        content: textContent,
        contentBlocks: msg.content,
        scannedImages: scanned.images,
        scannedHtml: scanned.html,
        timestamp: data.timestamp || Date.now(),
        parentToolUseId: data.parent_tool_use_id,
        model: msg.model,
        stopReason: msg.stop_reason,
      };
      const replacedDraft = finalizeStreamingDraftMessage(sessionId, chatMsg);
      if (!replacedDraft) {
        upsertAssistantMessage(sessionId, chatMsg);
      }
      hadAssistantThisTurn.add(sessionId);
      store.setStreaming(sessionId, null);
      streamingPhaseBySession.delete(sessionId);
      // Clear progress only for completed tools (tool_result blocks), not all tools.
      // Blanket clear would cause flickering during concurrent tool execution.
      if (msg.content?.length) {
        for (const block of msg.content) {
          if (block.type === "tool_result") {
            store.clearToolProgress(sessionId, block.tool_use_id);
          }
        }
      }
      store.setSessionStatus(sessionId, "running");

      // Start timer if not already started (for non-streaming tool calls)
      if (!store.streamingStartedAt.has(sessionId)) {
        store.setStreamingStats(sessionId, { startedAt: Date.now() });
      }

      // Extract tasks and changed files from tool_use content blocks
      if (msg.content?.length) {
        extractTasksFromBlocks(sessionId, msg.content);
        extractChangedFilesFromBlocks(sessionId, msg.content);
      }

      break;
    }

    case "stream_event": {
      const evt = data.event as Record<string, unknown>;
      if (evt && typeof evt === "object") {
        // message_start → mark generation start time
        if (evt.type === "message_start") {
          streamingPhaseBySession.delete(sessionId);
          clearStreamingDraftMessage(sessionId);
          if (!store.streamingStartedAt.has(sessionId)) {
            store.setStreamingStats(sessionId, { startedAt: Date.now(), outputTokens: 0 });
          }
        }

        // content_block_delta → accumulate streaming text
        if (evt.type === "content_block_delta") {
          const delta = evt.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            let current = store.streaming.get(sessionId) || "";
            const thinkingPrefix = "Thinking:\n";
            const responsePrefix = "\n\nResponse:\n";
            if (streamingPhaseBySession.get(sessionId) === "thinking" && !current.includes(responsePrefix)) {
              current += responsePrefix;
            }
            streamingPhaseBySession.set(sessionId, "text");
            const nextText = current + delta.text;
            store.setStreaming(sessionId, nextText);
            setStreamingDraftMessage(sessionId, nextText);
          }
          if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
            const current = store.streaming.get(sessionId) || "";
            const prefix = "Thinking:\n";
            const phase = streamingPhaseBySession.get(sessionId);
            const base = phase === "thinking"
              ? (current.startsWith(prefix) ? current : prefix)
              : prefix;
            streamingPhaseBySession.set(sessionId, "thinking");
            const nextText = base + delta.thinking;
            store.setStreaming(sessionId, nextText);
            setStreamingDraftMessage(sessionId, nextText);
          }
        }

        // message_delta → extract output token count
        if (evt.type === "message_delta") {
          const usage = (evt as { usage?: { output_tokens?: number } }).usage;
          if (usage?.output_tokens) {
            store.setStreamingStats(sessionId, { outputTokens: usage.output_tokens });
          }
        }
      }
      break;
    }

    case "result": {
      // Flush processed tool IDs at end of turn — deduplication only needed
      // within a single turn. Preserves memory in long-running sessions.
      processedToolUseIds.delete(sessionId);

      const r = data.data;
      const sessionUpdates: Partial<{ total_cost_usd: number; num_turns: number; context_used_percent: number; total_lines_added: number; total_lines_removed: number }> = {
        total_cost_usd: r.total_cost_usd,
        num_turns: r.num_turns,
      };
      // Forward lines changed if present
      if (typeof r.total_lines_added === "number") {
        sessionUpdates.total_lines_added = r.total_lines_added;
      }
      if (typeof r.total_lines_removed === "number") {
        sessionUpdates.total_lines_removed = r.total_lines_removed;
      }
      // Compute context % from modelUsage if available
      if (r.modelUsage) {
        for (const usage of Object.values(r.modelUsage)) {
          if (usage.contextWindow > 0) {
            const pct = Math.round(
              ((usage.inputTokens + usage.outputTokens) / usage.contextWindow) * 100
            );
            sessionUpdates.context_used_percent = Math.max(0, Math.min(pct, 100));
          }
        }
      }
      store.updateSession(sessionId, sessionUpdates);
      // Finalize any remaining streaming draft as a proper message.
      // With extended thinking, the assistant message only contains the thinking
      // block — the text output streams separately and must be preserved here.
      finalizeOrClearStreamingDraft(sessionId);
      store.setStreaming(sessionId, null);
      streamingPhaseBySession.delete(sessionId);
      store.setStreamingStats(sessionId, null);
      store.clearToolProgress(sessionId);
      store.setSessionStatus(sessionId, "idle");
      // Play notification sound if enabled and tab is not focused
      if (!document.hasFocus() && store.notificationSound) {
        playNotificationSound();
      }
      if (r.is_error && r.errors?.length) {
        store.appendMessage(sessionId, {
          id: nextId(),
          role: "system",
          content: `Error: ${r.errors.join(", ")}`,
          timestamp: Date.now(),
        });
      }
      // Notify when a background session finishes
      notifySessionDone(sessionId, r.is_error, r.result);
      break;
    }

    case "permission_request": {
      store.addPermission(sessionId, data.request);
      if (!document.hasFocus() && store.notificationDesktop) {
        const req = data.request;
        sendBrowserNotification(
          "Permission needed",
          `${req.tool_name}: approve or deny`,
          req.request_id,
        );
      }
      // Also extract tasks and changed files from permission requests
      const req = data.request;
      if (req.tool_name && req.input) {
        const permBlocks = [{
          type: "tool_use" as const,
          id: req.tool_use_id,
          name: req.tool_name,
          input: req.input,
        }];
        extractTasksFromBlocks(sessionId, permBlocks);
        extractChangedFilesFromBlocks(sessionId, permBlocks);
      }
      break;
    }

    case "permission_cancelled": {
      store.removePermission(sessionId, data.request_id);
      break;
    }

    case "tool_progress": {
      store.setToolProgress(sessionId, data.tool_use_id, {
        toolName: data.tool_name,
        elapsedSeconds: data.elapsed_time_seconds,
      });
      break;
    }

    case "tool_use_summary": {
      store.appendMessage(sessionId, {
        id: nextId(),
        role: "system",
        content: data.summary,
        timestamp: Date.now(),
      });
      break;
    }

    case "system_event": {
      const summary = summarizeSystemEvent(data.event);
      if (!summary) break;
      store.appendMessage(sessionId, {
        id: nextId(),
        role: "system",
        content: summary,
        timestamp: data.timestamp || Date.now(),
      });
      break;
    }

    case "status_change": {
      if (data.status === "compacting") {
        store.setSessionStatus(sessionId, "compacting");
      } else {
        store.setSessionStatus(sessionId, data.status);
      }
      break;
    }

    case "auth_status": {
      if (data.error) {
        store.appendMessage(sessionId, {
          id: nextId(),
          role: "system",
          content: `Auth error: ${data.error}`,
          timestamp: Date.now(),
        });
      }
      break;
    }

    case "error": {
      store.appendMessage(sessionId, {
        id: nextId(),
        role: "system",
        content: data.message,
        timestamp: Date.now(),
      });
      break;
    }

    case "cli_disconnected": {
      store.setCliConnected(sessionId, false);
      store.setSessionStatus(sessionId, null);
      break;
    }

    case "cli_connected": {
      store.setCliConnected(sessionId, true);
      break;
    }

    case "title_updated": {
      const updated = store.sdkSessions.map((s) =>
        s.sessionId === sessionId ? { ...s, title: data.title } : s
      );
      store.setSdkSessions(updated);
      break;
    }

    case "subtitle_updated": {
      store.setSessionSubtitle(sessionId, data.subtitle);
      break;
    }

    case "session_name_update": {
      // Always apply server-provided name (user manual renames go through REST API)
      store.setSessionName(sessionId, data.name);
      // Only animate if the session doesn't already have a stable title
      // (avoids a distracting flash when auto-namer sets a hidden lower-priority name)
      const hasTitle = store.sdkSessions.find((s) => s.sessionId === sessionId)?.title;
      if (!hasTitle) store.markRecentlyRenamed(sessionId);
      break;
    }

    case "pr_status_update": {
      store.setPRStatus(sessionId, { available: data.available, pr: data.pr });
      break;
    }

    case "mcp_status": {
      store.setMcpServers(sessionId, data.servers);
      break;
    }

    case "session_archived": {
      // Server has archived this session — disconnect immediately and stop reconnecting
      disconnectSession(sessionId);
      // Update the local store so reconnect logic also sees it as archived
      const sdkSessions = store.sdkSessions;
      store.setSdkSessions(sdkSessions.map(s =>
        s.sessionId === sessionId ? { ...s, archived: true } : s
      ));
      break;
    }

    case "message_history": {
      console.debug(`[ws] message_history for ${sessionId}: ${data.messages.length} messages`);
      const chatMessages: ChatMessage[] = [];

      for (let i = 0; i < data.messages.length; i++) {
        const histMsg = data.messages[i];
        if (histMsg.type === "user_message") {
          const userMsgId = histMsg.id || nextId();
          const userScanned = scanForImagesAndHtml(histMsg.content, userMsgId);
          chatMessages.push({
            id: userMsgId,
            role: "user",
            content: histMsg.content,
            timestamp: histMsg.timestamp,
            scannedHtml: userScanned.html,
          });
        } else if (histMsg.type === "assistant") {
          const msg = histMsg.message;
          const textContent = extractTextFromBlocks(msg.content);
          const scanned = scanForImagesAndHtml(textContent, msg.id);
          const assistantMsg: ChatMessage = {
            id: msg.id,
            role: "assistant",
            content: textContent,
            contentBlocks: msg.content,
            scannedImages: scanned.images,
            scannedHtml: scanned.html,
            timestamp: histMsg.timestamp || Date.now(),
            parentToolUseId: histMsg.parent_tool_use_id,
            model: msg.model,
            stopReason: msg.stop_reason,
          };
          const existingIndex = chatMessages.findIndex((m) => m.role === "assistant" && m.id === assistantMsg.id);
          if (existingIndex === -1) {
            chatMessages.push(assistantMsg);
          } else {
            chatMessages[existingIndex] = mergeAssistantMessage(chatMessages[existingIndex], assistantMsg);
          }
          // Also extract tasks and changed files from history
          if (msg.content?.length) {
            extractTasksFromBlocks(sessionId, msg.content);
            extractChangedFilesFromBlocks(sessionId, msg.content);
          }
        } else if (histMsg.type === "result") {
          const r = histMsg.data;
          if (r.is_error && r.errors?.length) {
            chatMessages.push({
              id: `hist-error-${i}`,
              role: "system",
              content: `Error: ${r.errors.join(", ")}`,
              timestamp: Date.now(),
            });
          } else if (r.result && typeof r.result === "string") {
            // The result text is the final response shown to the user during live streaming.
            // It may not exist in any assistant message's text blocks (the CLI sends individual
            // content blocks as separate assistant messages, and text was only delivered via
            // stream_event deltas). Add it only if not already covered by a preceding assistant.
            const resultText = r.result.trim();
            let coveredByAssistant = false;
            for (let j = chatMessages.length - 1; j >= 0; j--) {
              const prev = chatMessages[j];
              if (prev.role === "user") break;
              if (prev.role === "assistant" && prev.content.includes(resultText)) {
                coveredByAssistant = true;
                break;
              }
            }
            if (!coveredByAssistant) {
              const resultMsgId = `hist-result-${i}`;
              const scanned = scanForImagesAndHtml(resultText, resultMsgId);
              chatMessages.push({
                id: resultMsgId,
                role: "assistant",
                content: resultText,
                scannedImages: scanned.images,
                scannedHtml: scanned.html,
                timestamp: Date.now(),
              });
            }
          }
        } else if (histMsg.type === "system_event") {
          const summary = summarizeSystemEvent(histMsg.event);
          if (!summary) continue;
          chatMessages.push({
            id: `hist-system-event-${i}`,
            role: "system",
            content: summary,
            timestamp: histMsg.timestamp || Date.now(),
          });
        }
      }
      console.debug(`[ws] message_history: created ${chatMessages.length} ChatMessages (user: ${chatMessages.filter(m => m.role === "user").length}, assistant: ${chatMessages.filter(m => m.role === "assistant").length})`);
      if (chatMessages.length > 0) {
        const existing = store.messages.get(sessionId) || [];
        if (existing.length === 0) {
          // Initial connect: history is the full truth
          store.setMessages(sessionId, chatMessages);
          console.debug(`[ws] message_history: set ${chatMessages.length} messages (initial connect)`);
        } else {
          // Reconnect: merge history with live messages, upserting duplicate assistant IDs.
          const merged = [...existing];
          for (const incoming of chatMessages) {
            const idx = merged.findIndex((m) => m.id === incoming.id);
            if (idx === -1) {
              merged.push(incoming);
              continue;
            }
            const current = merged[idx];
            if (current.role === "assistant" && incoming.role === "assistant") {
              merged[idx] = mergeAssistantMessage(current, incoming);
            } else {
              merged[idx] = incoming;
            }
          }
          merged.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
          store.setMessages(sessionId, merged);
        }
      }
      break;
    }

    case "event_replay": {
      let latestProcessed: number | undefined;
      for (const evt of data.events) {
        const previous = getLastSeq(sessionId);
        if (evt.seq <= previous) continue;
        setLastSeq(sessionId, evt.seq);
        latestProcessed = evt.seq;
        handleParsedMessage(
          sessionId,
          evt.message as BrowserIncomingMessage,
          { processSeq: false, ackSeqMessage: false },
        );
      }
      if (typeof latestProcessed === "number") {
        ackSeq(sessionId, latestProcessed);
      }
      break;
    }
  }
}

export function connectSession(sessionId: string) {
  if (sockets.has(sessionId)) {
    console.debug(`[ws] connectSession(${sessionId}): already connected, skipping`);
    return;
  }
  console.debug(`[ws] connectSession(${sessionId}): opening WebSocket`);

  const store = useStore.getState();
  store.setConnectionStatus(sessionId, "connecting");

  const ws = new WebSocket(getWsUrl(sessionId));
  sockets.set(sessionId, ws);

  ws.onopen = () => {
    // Stay in "connecting" until we receive the first message from the server,
    // proving the subscription succeeded. handleMessage promotes to "connected".
    reconnectAttempts.delete(sessionId);
    const lastSeq = getLastSeq(sessionId);
    console.debug(`[ws] session_subscribe for ${sessionId} with last_seq=${lastSeq}`);
    ws.send(JSON.stringify({ type: "session_subscribe", last_seq: lastSeq }));
    // Clear any reconnect timer
    const timer = reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      reconnectTimers.delete(sessionId);
    }
  };

  ws.onmessage = (event) => handleMessage(sessionId, event);

  ws.onclose = () => {
    sockets.delete(sessionId);
    useStore.getState().setConnectionStatus(sessionId, "disconnected");
    scheduleReconnect(sessionId);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function scheduleReconnect(sessionId: string) {
  if (reconnectTimers.has(sessionId)) return;
  const attempts = reconnectAttempts.get(sessionId) || 0;
  const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** attempts, MAX_RECONNECT_DELAY);
  reconnectAttempts.set(sessionId, attempts + 1);
  const timer = setTimeout(() => {
    reconnectTimers.delete(sessionId);
    const store = useStore.getState();
    // Only reconnect if this is still the active session and not archived
    if (store.currentSessionId !== sessionId) return;
    const sdkSession = store.sdkSessions.find((s) => s.sessionId === sessionId);
    if (sdkSession && !sdkSession.archived) {
      connectSession(sessionId);
    }
  }, delay);
  reconnectTimers.set(sessionId, timer);
}

export function disconnectSession(sessionId: string) {
  const timer = reconnectTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(sessionId);
  }
  reconnectAttempts.delete(sessionId);
  const ws = sockets.get(sessionId);
  if (ws) {
    ws.close();
    sockets.delete(sessionId);
  }
  processedToolUseIds.delete(sessionId);
  taskCounters.delete(sessionId);
  streamingPhaseBySession.delete(sessionId);
  streamingDraftMessageIdBySession.delete(sessionId);
  lastSeqBySession.delete(sessionId);
}

export function disconnectAll() {
  for (const [id] of sockets) {
    disconnectSession(id);
  }
}

/** Close all open WS connections except the given session. */
export function disconnectAllExcept(keepSessionId: string | null) {
  for (const [id] of sockets) {
    if (id !== keepSessionId) {
      disconnectSession(id);
    }
  }
}

export function connectAllSessions(sessions: SdkSessionInfo[]) {
  for (const s of sessions) {
    if (!s.archived) {
      connectSession(s.sessionId);
    }
  }
}

export function waitForConnection(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = setInterval(() => {
      const ws = sockets.get(sessionId);
      if (ws?.readyState === WebSocket.OPEN) {
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 50);
    const timeout = setTimeout(() => {
      clearInterval(check);
      reject(new Error("Connection timeout"));
    }, 10000);
  });
}

export function sendToSession(sessionId: string, msg: BrowserOutgoingMessage) {
  const ws = sockets.get(sessionId);
  let outgoing: BrowserOutgoingMessage = msg;
  if (IDEMPOTENT_OUTGOING_TYPES.has(msg.type)) {
    switch (msg.type) {
      case "user_message":
      case "permission_response":
      case "interrupt":
      case "set_model":
      case "set_permission_mode":
      case "mcp_get_status":
      case "mcp_toggle":
      case "mcp_reconnect":
      case "mcp_set_servers":
        if (!msg.client_msg_id) {
          outgoing = { ...msg, client_msg_id: nextClientMsgId() };
        }
        break;
    }
  }
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(outgoing));
  }
}

export function sendMcpGetStatus(sessionId: string) {
  sendToSession(sessionId, { type: "mcp_get_status" });
}

export function sendMcpToggle(sessionId: string, serverName: string, enabled: boolean) {
  sendToSession(sessionId, { type: "mcp_toggle", serverName, enabled });
}

export function sendMcpReconnect(sessionId: string, serverName: string) {
  sendToSession(sessionId, { type: "mcp_reconnect", serverName });
}

export function sendMcpSetServers(sessionId: string, servers: Record<string, McpServerConfig>) {
  sendToSession(sessionId, { type: "mcp_set_servers", servers });
}
