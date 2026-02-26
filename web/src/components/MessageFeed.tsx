import { useContext, useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { MessageBubble } from "./MessageBubble.js";
import { ToolBlock, getToolIcon, getToolLabel, getPreview, ToolIcon } from "./ToolBlock.js";
import type { ChatMessage, ContentBlock, SdkSessionInfo } from "../types.js";
import { formatElapsed, formatTokenCount } from "../utils/format.js";
import { FeedSessionIdContext } from "./feed-context.js";

const FEED_PAGE_SIZE = 100;
const RESUME_HISTORY_PAGE_SIZE = 40;
const SCROLL_TOP_PREFETCH_PX = 120;
const savedDistanceFromBottomBySession = new Map<string, number>();

const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_SDK_SESSIONS: SdkSessionInfo[] = [];

function formatResumeSourcePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return path;
  return parts.slice(-2).join("/");
}

// ─── Message-level grouping ─────────────────────────────────────────────────

interface ToolItem { id: string; name: string; input: Record<string, unknown> }

interface ToolMsgGroup {
  kind: "tool_msg_group";
  toolName: string;
  items: ToolItem[];
  firstId: string;
}

interface SubagentGroup {
  kind: "subagent";
  taskToolUseId: string;
  description: string;
  agentType: string;
  children: FeedEntry[];
}

type FeedEntry =
  | { kind: "message"; msg: ChatMessage }
  | ToolMsgGroup
  | SubagentGroup;

function mergeDuplicateMessage(existing: ChatMessage, incoming: ChatMessage): ChatMessage {
  if (existing.role === "assistant" && incoming.role === "assistant") {
    return {
      ...existing,
      ...incoming,
      content: incoming.content || existing.content,
      contentBlocks: (incoming.contentBlocks && incoming.contentBlocks.length > 0)
        ? incoming.contentBlocks
        : existing.contentBlocks,
      timestamp: Math.max(existing.timestamp || 0, incoming.timestamp || 0) || incoming.timestamp || existing.timestamp,
    };
  }
  return (incoming.timestamp || 0) >= (existing.timestamp || 0) ? incoming : existing;
}

function dedupeMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const deduped: ChatMessage[] = [];
  const indexById = new Map<string, number>();
  for (const msg of messages) {
    const existingIndex = indexById.get(msg.id);
    if (existingIndex === undefined) {
      indexById.set(msg.id, deduped.length);
      deduped.push(msg);
      continue;
    }
    deduped[existingIndex] = mergeDuplicateMessage(deduped[existingIndex], msg);
  }
  return deduped;
}

/**
 * Get the dominant tool name if this message is "tool-only"
 * (assistant message whose contentBlocks are ALL tool_use of the same name).
 * Returns null if it has text/thinking or mixed tool types.
 */
function getToolOnlyName(msg: ChatMessage): string | null {
  if (msg.role !== "assistant") return null;
  const blocks = msg.contentBlocks;
  if (!blocks || blocks.length === 0) return null;

  let toolName: string | null = null;
  for (const b of blocks) {
    if (b.type === "text" && b.text.trim()) return null;
    if (b.type === "thinking") return null;
    if (b.type === "tool_use") {
      if (toolName === null) toolName = b.name;
      else if (toolName !== b.name) return null;
    }
  }
  return toolName;
}

function extractToolItems(msg: ChatMessage): ToolItem[] {
  const blocks = msg.contentBlocks || [];
  return blocks
    .filter((b): b is ContentBlock & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}

/** Get Task tool_use IDs from a feed entry */
function getTaskIdsFromEntry(entry: FeedEntry): string[] {
  if (entry.kind === "message") {
    const blocks = entry.msg.contentBlocks || [];
    return blocks
      .filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
      .filter(b => b.name === "Task")
      .map(b => b.id);
  }
  if (entry.kind === "tool_msg_group" && entry.toolName === "Task") {
    return entry.items.map(item => item.id);
  }
  return [];
}

/** Group consecutive same-tool messages */
function groupToolMessages(messages: ChatMessage[]): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const msg of messages) {
    const toolName = getToolOnlyName(msg);

    if (toolName) {
      const last = entries[entries.length - 1];
      if (last?.kind === "tool_msg_group" && last.toolName === toolName) {
        last.items.push(...extractToolItems(msg));
        continue;
      }
      entries.push({
        kind: "tool_msg_group",
        toolName,
        items: extractToolItems(msg),
        firstId: msg.id,
      });
    } else {
      entries.push({ kind: "message", msg });
    }
  }

  return entries;
}

/** Build feed entries with subagent nesting */
function buildEntries(
  messages: ChatMessage[],
  taskInfo: Map<string, { description: string; agentType: string }>,
  childrenByParent: Map<string, ChatMessage[]>,
): FeedEntry[] {
  const grouped = groupToolMessages(messages);

  const result: FeedEntry[] = [];
  for (const entry of grouped) {
    result.push(entry);

    // After each entry containing Task tool_use(s), insert subagent groups
    const taskIds = getTaskIdsFromEntry(entry);
    for (const taskId of taskIds) {
      const children = childrenByParent.get(taskId);
      if (children && children.length > 0) {
        const info = taskInfo.get(taskId) || { description: "Subagent", agentType: "" };
        const childEntries = buildEntries(children, taskInfo, childrenByParent);
        result.push({
          kind: "subagent",
          taskToolUseId: taskId,
          description: info.description,
          agentType: info.agentType,
          children: childEntries,
        });
      }
    }
  }

  return result;
}

function groupMessages(messages: ChatMessage[]): FeedEntry[] {
  // Phase 1: Find all Task tool_use IDs across all messages
  const taskInfo = new Map<string, { description: string; agentType: string }>();
  for (const msg of messages) {
    if (!msg.contentBlocks) continue;
    for (const b of msg.contentBlocks) {
      if (b.type === "tool_use" && b.name === "Task") {
        const { input, id } = b;
        taskInfo.set(id, {
          description: String(input?.description || "Subagent"),
          agentType: String(input?.subagent_type || ""),
        });
      }
    }
  }

  // If no Task tool_uses found, skip the overhead
  if (taskInfo.size === 0) {
    return groupToolMessages(messages);
  }

  // Phase 2: Partition into top-level and child messages
  const childrenByParent = new Map<string, ChatMessage[]>();
  const topLevel: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.parentToolUseId && taskInfo.has(msg.parentToolUseId)) {
      let arr = childrenByParent.get(msg.parentToolUseId);
      if (!arr) { arr = []; childrenByParent.set(msg.parentToolUseId, arr); }
      arr.push(msg);
    } else {
      topLevel.push(msg);
    }
  }

  // Phase 3: Build grouped entries with subagent nesting
  return buildEntries(topLevel, taskInfo, childrenByParent);
}

// ─── Components ──────────────────────────────────────────────────────────────

function ToolMessageGroup({ group }: { group: ToolMsgGroup }) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(group.toolName);
  const label = getToolLabel(group.toolName);
  const count = group.items.length;

  // Single item — delegate to ToolBlock for consistent rendering (clickable file links, etc.)
  if (count === 1) {
    const item = group.items[0];
    return (
      <div className="animate-[fadeSlideIn_0.2s_ease-out]">
        <div className="flex items-start gap-3">
          <AssistantAvatar />
          <div className="flex-1 min-w-0">
            <ToolBlock name={item.name} input={item.input} toolUseId={item.id} />
          </div>
        </div>
      </div>
    );
  }

  // Multi-item group
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
            <button
              onClick={() => setOpen(!open)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cc-hover transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
                <path d="M6 4l4 4-4 4" />
              </svg>
              <ToolIcon type={iconType} />
              <span className="text-xs font-medium text-cc-fg">{label}</span>
              <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums font-medium">
                {count}
              </span>
            </button>

            {open && (
              <div className="border-t border-cc-border px-3 py-1.5">
                {group.items.map((item, i) => {
                  const preview = getPreview(item.name, item.input);
                  const filePath = (item.name === "Read" || item.name === "Write" || item.name === "Edit" || item.name === "Glob" || item.name === "Grep")
                    && (item.input.file_path || item.input.path || item.input.notebook_path)
                    ? String(item.input.file_path || item.input.path || item.input.notebook_path) : null;
                  return (
                    <div key={item.id || i} className="flex items-center gap-2 py-1 text-xs font-mono-code truncate">
                      <span className="w-1 h-1 rounded-full bg-cc-muted/40 shrink-0" />
                      {filePath ? (
                        <button
                          type="button"
                          className="truncate text-cc-muted hover:text-cc-primary cursor-pointer underline decoration-cc-muted/30 hover:decoration-cc-primary/50 transition-colors text-left"
                          onClick={(e) => { e.stopPropagation(); useStore.getState().openFileInEditor(filePath); }}
                          title={`Open ${filePath} in editor`}
                        >
                          {preview || filePath}
                        </button>
                      ) : (
                        <span className="truncate text-cc-muted">{preview || JSON.stringify(item.input).slice(0, 80)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedEntries({ entries }: { entries: FeedEntry[] }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (entry.kind === "tool_msg_group") {
          return <ToolMessageGroup key={`tool:${entry.firstId}:${i}`} group={entry} />;
        }
        if (entry.kind === "subagent") {
          return <SubagentContainer key={`subagent:${entry.taskToolUseId}:${i}`} group={entry} />;
        }
        return <MessageBubble key={`message:${entry.msg.id}:${i}`} message={entry.msg} />;
      })}
    </>
  );
}

// ─── Subagent tool activity extraction ───────────────────────────────────────

interface ToolActivity {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  /** true when the message had a tool_result (even if content was stripped) */
  hasResult: boolean;
  isError?: boolean;
}

/** Walk all children entries and extract tool_use blocks (results are fetched on demand) */
function extractToolActivity(children: FeedEntry[]): ToolActivity[] {
  const activities: ToolActivity[] = [];
  // Collect tool_use_ids that have a tool_result (even with stripped content)
  const resultMeta = new Map<string, { isError: boolean }>();
  for (const entry of children) {
    if (entry.kind === "message" && entry.msg.contentBlocks) {
      for (const b of entry.msg.contentBlocks) {
        if (b.type === "tool_result") {
          resultMeta.set(b.tool_use_id, { isError: b.is_error ?? false });
        }
      }
    }
  }

  for (const entry of children) {
    if (entry.kind === "tool_msg_group") {
      for (const item of entry.items) {
        const meta = resultMeta.get(item.id);
        activities.push({ toolUseId: item.id, name: item.name, input: item.input, hasResult: !!meta, isError: meta?.isError });
      }
    } else if (entry.kind === "message" && entry.msg.contentBlocks) {
      for (const b of entry.msg.contentBlocks) {
        if (b.type === "tool_use") {
          const meta = resultMeta.get(b.id);
          activities.push({ toolUseId: b.id, name: b.name, input: b.input, hasResult: !!meta, isError: meta?.isError });
        }
      }
    }
    if (entry.kind === "subagent") {
      activities.push(...extractToolActivity(entry.children));
    }
  }
  return activities;
}

const ACTIVITY_COLLAPSED_LIMIT = 8;

function ToolActivityLine({ activity }: { activity: ToolActivity }) {
  const sessionId = useContext(FeedSessionIdContext);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{ content: string; is_error: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const preview = getPreview(activity.name, activity.input);
  const iconType = getToolIcon(activity.name);
  const filePath = (activity.name === "Read" || activity.name === "Write" || activity.name === "Edit" || activity.name === "Glob" || activity.name === "Grep")
    && (activity.input.file_path || activity.input.path || activity.input.notebook_path)
    ? String(activity.input.file_path || activity.input.path || activity.input.notebook_path) : null;

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activity.hasResult) return;
    if (showResult) { setShowResult(false); return; }
    setShowResult(true);
    if (resultData) return; // already fetched
    setLoading(true);
    try {
      const data = await api.getToolResult(sessionId, activity.toolUseId);
      setResultData(data);
    } catch {
      setResultData({ content: "(failed to load result)", is_error: true });
    } finally {
      setLoading(false);
    }
  }, [sessionId, activity.toolUseId, activity.hasResult, showResult, resultData]);

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 py-0.5 text-left group ${activity.hasResult ? "cursor-pointer" : "cursor-default"}`}
      >
        {activity.hasResult && (
          <svg viewBox="0 0 16 16" fill="currentColor" className={`w-2.5 h-2.5 text-cc-muted/50 transition-transform shrink-0 ${showResult ? "rotate-90" : ""}`}>
            <path d="M6 4l4 4-4 4" />
          </svg>
        )}
        {!activity.hasResult && <span className="w-2.5 shrink-0" />}
        <ToolIcon type={iconType} />
        {filePath ? (
          <span
            className="text-[11px] font-mono-code truncate text-cc-muted hover:text-cc-primary cursor-pointer underline decoration-cc-muted/30 hover:decoration-cc-primary/50 transition-colors"
            onClick={(e) => { e.stopPropagation(); useStore.getState().openFileInEditor(filePath); }}
            role="link"
            title={`Open ${filePath} in editor`}
          >
            {preview}
          </span>
        ) : (
          <span className={`text-[11px] font-mono-code truncate ${activity.isError ? "text-cc-error" : "text-cc-muted"}`}>
            {activity.name === "Bash" ? `$ ${activity.input.command || ""}` : preview}
          </span>
        )}
      </button>
      {showResult && (
        <div className="ml-6 mt-0.5 mb-1">
          {loading && <span className="text-[10px] text-cc-muted animate-pulse">Loading...</span>}
          {resultData && <ToolResultPreview content={resultData.content} isError={resultData.is_error} toolName={activity.name} />}
        </div>
      )}
    </div>
  );
}

function ToolResultPreview({ content, isError, toolName }: { content: string; isError: boolean; toolName: string }) {
  const lines = content.split(/\r?\n/);
  const hasMore = lines.length > 12;
  const [showFull, setShowFull] = useState(false);
  const rendered = showFull || !hasMore ? content : lines.slice(-12).join("\n");

  return (
    <div className={`rounded-md border text-[11px] ${isError ? "bg-cc-error/5 border-cc-error/20" : "bg-cc-code-bg border-cc-border"}`}>
      {hasMore && (
        <div className="flex justify-end px-2 py-0.5 border-b border-cc-border">
          <button
            onClick={(e) => { e.stopPropagation(); setShowFull(!showFull); }}
            className="text-[10px] text-cc-primary hover:underline cursor-pointer"
          >
            {showFull ? "Show tail" : `Show all ${lines.length} lines`}
          </button>
        </div>
      )}
      <pre className={`font-mono-code px-2 py-1.5 whitespace-pre-wrap max-h-40 overflow-y-auto ${isError ? "text-cc-error" : "text-cc-muted"}`}>
        {rendered}
      </pre>
    </div>
  );
}

function SubagentContainer({ group }: { group: SubagentGroup }) {
  const [open, setOpen] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const label = group.description || "Subagent";
  const agentType = group.agentType;
  const childCount = group.children.length;

  // Extract all tool operations from children
  const activities = useMemo(() => extractToolActivity(group.children), [group.children]);
  const visibleActivities = showAllActivity ? activities : activities.slice(0, ACTIVITY_COLLAPSED_LIMIT);
  const hasMoreActivities = activities.length > ACTIVITY_COLLAPSED_LIMIT;

  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="ml-10 border-l-2 border-cc-primary/20 pl-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 py-1.5 text-left cursor-pointer mb-1"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}>
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-cc-primary shrink-0">
            <circle cx="8" cy="8" r="5" />
            <path d="M8 5v3l2 1" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium text-cc-fg truncate">{label}</span>
          {agentType && (
            <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 shrink-0">
              {agentType}
            </span>
          )}
          {activities.length > 0 && !open && (
            <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums shrink-0">
              {activities.length} cmd{activities.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] text-cc-muted bg-cc-hover rounded-full px-1.5 py-0.5 tabular-nums shrink-0 ml-auto">
            {childCount}
          </span>
        </button>

        {/* Compact tool activity log (visible when collapsed) */}
        {!open && activities.length > 0 && (
          <div className="mb-2">
            {visibleActivities.map((a) => (
              <ToolActivityLine key={a.toolUseId} activity={a} />
            ))}
            {hasMoreActivities && !showAllActivity && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowAllActivity(true); }}
                className="text-[10px] text-cc-primary hover:underline cursor-pointer ml-6 py-0.5"
              >
                +{activities.length - ACTIVITY_COLLAPSED_LIMIT} more...
              </button>
            )}
          </div>
        )}

        {open && (
          <div className="space-y-3 pb-2">
            <FeedEntries entries={group.children} />
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-cc-primary/10 flex items-center justify-center shrink-0 mt-0.5">
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-primary">
        <circle cx="8" cy="8" r="3" />
      </svg>
    </div>
  );
}

// ─── Main Feed ───────────────────────────────────────────────────────────────

export function MessageFeed({ sessionId }: { sessionId: string }) {
  const messages = useStore((s) => s.messages.get(sessionId) ?? EMPTY_MESSAGES);
  const sdkSession = useStore((s) => (s.sdkSessions || EMPTY_SDK_SESSIONS).find((session) => session.sessionId === sessionId));
  const streamingStartedAt = useStore((s) => s.streamingStartedAt.get(sessionId));
  const streamingOutputTokens = useStore((s) => s.streamingOutputTokens.get(sessionId));
  const sessionStatus = useStore((s) => s.sessionStatus.get(sessionId));
  const toolProgress = useStore((s) => s.toolProgress.get(sessionId));
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const [resumeHistoryMessages, setResumeHistoryMessages] = useState<ChatMessage[]>([]);
  const [resumeHistoryCursor, setResumeHistoryCursor] = useState(0);
  const [resumeHistoryHasMore, setResumeHistoryHasMore] = useState(false);
  const [resumeHistoryLoaded, setResumeHistoryLoaded] = useState(false);
  const [resumeHistoryLoading, setResumeHistoryLoading] = useState(false);
  const [resumeHistoryError, setResumeHistoryError] = useState("");
  const resumeHistoryMessageIdsRef = useRef<Set<string>>(new Set());
  // LOCAL: Tracks whether a fork session's auto-load has been attempted for the current session.
  const forkAutoLoadAttemptedRef = useRef<string>("");
  const chatTabReentryTick = useStore((s) => s.chatTabReentryTickBySession.get(sessionId) ?? 0);
  const hasStreamingAssistant = useMemo(
    () => messages.some((m) => m.role === "assistant" && m.isStreaming),
    [messages],
  );
  const resumeSourceSessionId = useMemo(() => {
    if (sdkSession?.backendType === "codex") return "";
    return (sdkSession?.resumeSessionAt || "").trim();
  }, [sdkSession?.backendType, sdkSession?.resumeSessionAt]);
  const canLoadResumeHistory = resumeSourceSessionId.length > 0;
  const isForkSession = sdkSession?.forkSession === true;
  const resumeModeLabel = isForkSession ? "Forked from" : "Continuing from";
  const mergedMessages = useMemo(() => {
    if (resumeHistoryMessages.length === 0) return dedupeMessagesById(messages);
    return dedupeMessagesById([...resumeHistoryMessages, ...messages]);
  }, [resumeHistoryMessages, messages]);

  const grouped = useMemo(() => groupMessages(mergedMessages), [mergedMessages]);

  // Reset paging/transcript state when switching sessions.
  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
    setResumeHistoryMessages([]);
    setResumeHistoryCursor(0);
    setResumeHistoryHasMore(false);
    setResumeHistoryLoaded(false);
    setResumeHistoryLoading(false);
    setResumeHistoryError("");
    resumeHistoryMessageIdsRef.current = new Set();
    forkAutoLoadAttemptedRef.current = "";
  }, [sessionId, resumeSourceSessionId]);

  const totalEntries = grouped.length;
  const hasMore = totalEntries > visibleCount;
  const visibleEntries = hasMore ? grouped.slice(totalEntries - visibleCount) : grouped;
  const hiddenCount = totalEntries - visibleEntries.length;

  const handleLoadMore = useCallback(() => {
    const el = containerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setVisibleCount((c) => c + FEED_PAGE_SIZE);
    // Preserve scroll position after DOM updates
    requestAnimationFrame(() => {
      if (el) {
        const newHeight = el.scrollHeight;
        el.scrollTop += newHeight - prevHeight;
      }
    });
  }, []);

  const loadResumeHistoryPage = useCallback(async (
    options: { preserveScroll?: boolean } = {},
  ) => {
    if (!canLoadResumeHistory || !resumeSourceSessionId || resumeHistoryLoading) return;

    const container = containerRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    const cursor = resumeHistoryLoaded ? resumeHistoryCursor : 0;

    setResumeHistoryLoading(true);
    setResumeHistoryError("");
    try {
      const page = await api.getClaudeSessionHistory(resumeSourceSessionId, {
        cursor,
        limit: RESUME_HISTORY_PAGE_SIZE,
      });

      const incoming = page.messages.map((msg): ChatMessage => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        contentBlocks: msg.role === "assistant" ? msg.contentBlocks : undefined,
        timestamp: msg.timestamp || Date.now(),
        model: msg.role === "assistant" ? msg.model : undefined,
        stopReason: msg.role === "assistant" ? msg.stopReason : undefined,
      }));

      const uniqueIncoming: ChatMessage[] = [];
      for (const msg of incoming) {
        if (resumeHistoryMessageIdsRef.current.has(msg.id)) continue;
        resumeHistoryMessageIdsRef.current.add(msg.id);
        uniqueIncoming.push(msg);
      }

      setResumeHistoryMessages((prev) => [...uniqueIncoming, ...prev]);
      setResumeHistoryCursor(page.nextCursor);
      setResumeHistoryHasMore(page.hasMore);
      setResumeHistoryLoaded(true);

      if (uniqueIncoming.length > 0) {
        setVisibleCount((count) => count + uniqueIncoming.length);
      }

      if (options.preserveScroll !== false && container) {
        requestAnimationFrame(() => {
          const newHeight = container.scrollHeight;
          container.scrollTop += newHeight - previousHeight;
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResumeHistoryError(message || "Failed to load previous history");
      if (!resumeHistoryLoaded) {
        setResumeHistoryMessages([]);
        setResumeHistoryCursor(0);
        setResumeHistoryHasMore(false);
      }
    } finally {
      setResumeHistoryLoading(false);
    }
  }, [
    canLoadResumeHistory,
    resumeSourceSessionId,
    resumeHistoryLoading,
    resumeHistoryLoaded,
    resumeHistoryCursor,
  ]);

  // LOCAL: For fork sessions, auto-load prior history when messages haven't been pre-populated
  // via message_history. Waits briefly for message_history to arrive before falling back to REST.
  // This ensures the user always sees the prior conversation without needing to click a button.
  useEffect(() => {
    if (!isForkSession || !canLoadResumeHistory || resumeHistoryLoaded || resumeHistoryLoading) return;
    if (forkAutoLoadAttemptedRef.current === sessionId) return;

    const timer = setTimeout(() => {
      if (messages.length === 0 && !resumeHistoryLoaded && !resumeHistoryLoading) {
        forkAutoLoadAttemptedRef.current = sessionId;
        void loadResumeHistoryPage({ preserveScroll: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [sessionId, isForkSession, canLoadResumeHistory, resumeHistoryLoaded, resumeHistoryLoading, messages.length, loadResumeHistoryPage]);

  // Tick elapsed time every second while generating
  useEffect(() => {
    if (!streamingStartedAt && sessionStatus !== "running") {
      setElapsed(0);
      return;
    }
    const start = streamingStartedAt || Date.now();
    setElapsed(Date.now() - start);
    const interval = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(interval);
  }, [streamingStartedAt, sessionStatus]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowScrollToBottom(!isNearBottom.current);
    const distanceFromBottom = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
    savedDistanceFromBottomBySession.set(sessionId, distanceFromBottom);

    if (
      canLoadResumeHistory
      && resumeHistoryLoaded
      && resumeHistoryHasMore
      && !resumeHistoryLoading
      && el.scrollTop <= SCROLL_TOP_PREFETCH_PX
    ) {
      void loadResumeHistoryPage({ preserveScroll: true });
    }
  }

  const scrollToBottomInstant = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const previousBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollTop = el.scrollHeight;
    el.style.scrollBehavior = previousBehavior;
  }, []);

  const restoreSavedScrollPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const previousBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    const savedDistance = savedDistanceFromBottomBySession.get(sessionId);
    if (typeof savedDistance === "number") {
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - savedDistance);
    } else {
      el.scrollTop = el.scrollHeight;
    }
    el.style.scrollBehavior = previousBehavior;
  }, [sessionId]);

  // On mount / session switch, restore previous reading position (or default to bottom).
  useEffect(() => {
    requestAnimationFrame(() => restoreSavedScrollPosition());
  }, [sessionId, restoreSavedScrollPosition]);

  // Persist the current scroll position for this session on unmount.
  useEffect(() => {
    return () => {
      const el = containerRef.current;
      if (!el) return;
      const distanceFromBottom = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
      savedDistanceFromBottomBySession.set(sessionId, distanceFromBottom);
    };
  }, [sessionId]);

  // Only force bottom on explicit workspace tab switch back to chat.
  useEffect(() => {
    if (!chatTabReentryTick) return;
    requestAnimationFrame(() => scrollToBottomInstant());
  }, [chatTabReentryTick, scrollToBottomInstant]);

  // Scroll to top when the Session tab title is clicked in TopBar.
  useEffect(() => {
    const handler = (e: CustomEvent<{ sessionId: string }>) => {
      if (e.detail.sessionId !== sessionId) return;
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("companion:scroll-to-top", handler as EventListener);
    return () => window.removeEventListener("companion:scroll-to-top", handler as EventListener);
  }, [sessionId]);

  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (mergedMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none px-6">
        <div className="w-14 h-14 rounded-2xl bg-cc-card border border-cc-border flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-cc-muted">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>
        <div className="text-center">
          {canLoadResumeHistory ? (
            <>
              <p className="text-sm text-cc-fg font-medium mb-1">This session has prior Claude context</p>
              <p className="text-xs text-cc-muted leading-relaxed mb-3">
                {resumeModeLabel} {resumeSourceSessionId.slice(0, 8)}.{" "}
                {isForkSession ? "Loading prior conversation..." : "Load earlier messages into this chat when needed."}
              </p>
              {!isForkSession && (
                <button
                  onClick={() => void loadResumeHistoryPage({ preserveScroll: false })}
                  disabled={resumeHistoryLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cc-fg bg-cc-card border border-cc-border rounded-lg hover:bg-cc-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resumeHistoryLoading ? "Loading..." : "Load previous history"}
                </button>
              )}
              {resumeHistoryLoading && (
                <p className="text-xs text-cc-muted mt-2">Loading...</p>
              )}
              {resumeHistoryError && (
                <p className="text-xs text-cc-error mt-2">{resumeHistoryError}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-cc-fg font-medium mb-1">Start a conversation</p>
              <p className="text-xs text-cc-muted leading-relaxed">
                Send a message to begin working with The Companion.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      {/* Top fade — softens the scroll edge under the top bar */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-cc-bg to-transparent z-10" />
      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cc-fg bg-cc-card border border-cc-border rounded-full shadow-md hover:bg-cc-hover transition-colors cursor-pointer"
          title="Scroll to bottom"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M8 11.5L2.5 6h11L8 11.5z" />
          </svg>
          Scroll to bottom
        </button>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-y-contain px-4 sm:px-6 py-5 sm:py-8"
      >
        <div className="max-w-3xl mx-auto space-y-5 sm:space-y-7">
          {/* LOCAL: Only show the load-history banner when no messages have been pre-loaded.
               If message_history already populated the chat, the banner is redundant (and
               clicking it would add duplicates with different IDs). */}
          {canLoadResumeHistory && !resumeHistoryLoaded && messages.length === 0 && (
            <div className="rounded-xl border border-cc-border bg-cc-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-cc-fg">{resumeModeLabel} existing Claude thread</p>
                  <p className="text-[11px] text-cc-muted mt-1">
                    {resumeSourceSessionId} {sdkSession?.cwd ? `· ${formatResumeSourcePath(sdkSession.cwd)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => void loadResumeHistoryPage({ preserveScroll: true })}
                  disabled={resumeHistoryLoading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cc-fg bg-cc-card border border-cc-border rounded-lg hover:bg-cc-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resumeHistoryLoading ? "Loading..." : "Load previous history"}
                </button>
              </div>
              {resumeHistoryError && (
                <p className="text-xs text-cc-error mt-2">{resumeHistoryError}</p>
              )}
            </div>
          )}

          {canLoadResumeHistory && resumeHistoryLoaded && (
            <div className="flex justify-center">
              <p className="text-[11px] text-cc-muted">
                {resumeHistoryHasMore
                  ? (resumeHistoryLoading
                    ? "Loading older transcript..."
                    : "Scroll to top to load older transcript")
                  : "Loaded all available prior transcript"}
              </p>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                onClick={handleLoadMore}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cc-muted hover:text-cc-fg bg-cc-card border border-cc-border rounded-lg hover:bg-cc-hover transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                </svg>
                Load {Math.min(FEED_PAGE_SIZE, hiddenCount)} more ({hiddenCount} hidden)
              </button>
            </div>
          )}
          <FeedSessionIdContext.Provider value={sessionId}>
            <FeedEntries entries={visibleEntries} />
          </FeedSessionIdContext.Provider>

          {/* Tool progress indicator */}
          {toolProgress && toolProgress.size > 0 && !hasStreamingAssistant && (
            <div className="flex items-center gap-1.5 text-[11px] text-cc-muted font-mono-code pl-10">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cc-primary animate-pulse" />
              {Array.from(toolProgress.values()).map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-cc-muted/40">·</span>}
                  <span>{getToolLabel(p.toolName)}</span>
                  <span className="text-cc-muted/60">{p.elapsedSeconds}s</span>
                </span>
              ))}
            </div>
          )}

          {/* Generation stats bar */}
          {sessionStatus === "running" && elapsed > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-cc-muted font-mono-code pl-10">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cc-primary animate-pulse" />
              <span>Generating...</span>
              <span className="text-cc-muted/60">(</span>
              <span>{formatElapsed(elapsed)}</span>
              {(streamingOutputTokens ?? 0) > 0 && (
                <>
                  <span className="text-cc-muted/40">·</span>
                  <span>↓ {formatTokenCount(streamingOutputTokens!)}</span>
                </>
              )}
              <span className="text-cc-muted/60">)</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
