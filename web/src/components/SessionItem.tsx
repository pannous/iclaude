import { type RefObject, useMemo } from "react";
import type { SessionItem as SessionItemType } from "../utils/project-grouping.js";
import { useStore } from "../store.js";

interface SessionItemProps {
  session: SessionItemType;
  isActive: boolean;
  isArchived?: boolean;
  sessionName: string | undefined;
  permCount: number;
  isRecentlyRenamed: boolean;
  onSelect: (id: string) => void;
  onStartRename: (id: string, currentName: string) => void;
  onArchive: (e: React.MouseEvent, id: string) => void;
  onUnarchive: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onClearRecentlyRenamed: (id: string) => void;
  editingSessionId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  editInputRef: RefObject<HTMLInputElement | null>;
}

type DerivedStatus = "awaiting" | "running" | "idle" | "exited";

function deriveStatus(s: SessionItemType): DerivedStatus {
  if (s.permCount > 0) return "awaiting";
  if ((s.status === "running" || s.status === "compacting") && s.isConnected) return "running";
  if (s.isConnected) return "idle";
  return "exited";
}

function StatusDot({ status }: { status: DerivedStatus }) {
  switch (status) {
    case "running":
      return (
        <span className="relative shrink-0 w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-cc-success animate-[pulse-dot_1.5s_ease-in-out_infinite]" />
          <span className="w-2 h-2 rounded-full bg-cc-success block" />
        </span>
      );
    case "awaiting":
      return (
        <span className="relative shrink-0 w-2 h-2">
          <span className="w-2 h-2 rounded-full bg-cc-warning block animate-[ring-pulse_1.5s_ease-out_infinite]" />
        </span>
      );
    case "idle":
      return <span className="w-2 h-2 rounded-full bg-cc-muted/40 shrink-0" />;
    case "exited":
      return <span className="w-2 h-2 rounded-full border border-cc-muted/25 shrink-0" />;
  }
}

export function SessionItem({
  session: s,
  isActive,
  isArchived: archived,
  sessionName,
  permCount,
  isRecentlyRenamed,
  onSelect,
  onStartRename,
  onArchive,
  onUnarchive,
  onDelete,
  onClearRecentlyRenamed,
  editingSessionId,
  editingName,
  setEditingName,
  onConfirmRename,
  onCancelRename,
  editInputRef,
}: SessionItemProps) {
  const shortId = s.id.slice(0, 8);
  // LOCAL: s.title takes priority — upstream only uses sessionName || s.model || shortId
  // Strip any leaked XML/HTML tags (e.g. <local-command-caveat>) as a last-resort defence before render
  const cleanTitle = s.title?.replace(/<[^>]*>/g, "").trim() || undefined;
  const rawLabel = cleanTitle || sessionName || s.model || shortId;
  // For agent sessions: prefer agentName, strip "agent: " prefix (already in dedicated section)
  const label = s.agentName
    ? s.agentName
    : s.agentId && rawLabel.startsWith("agent: ") ? rawLabel.slice(7) : rawLabel;
  const isEditing = editingSessionId === s.id;

  const derivedStatus = archived ? ("exited" as DerivedStatus) : deriveStatus(s);

  // LOCAL: folder path removed — sessions are already grouped by project in sidebar

  const messages = useStore((st) => st.messages.get(s.id));
  const dateTooltip = useMemo(() => {
    const fmt = (ts: number) => new Date(ts).toLocaleString();
    const parts: string[] = [];
    if (messages && messages.length > 0) {
      const first = messages[0].timestamp;
      const last = messages[messages.length - 1].timestamp;
      if (first) parts.push(`First message: ${fmt(first)}`);
      if (last && last !== first) parts.push(`Last message: ${fmt(last)}`);
    }
    return parts.join("\n") || undefined;
  }, [messages]);

  return (
    <div className="relative group">
      <button
        onClick={() => onSelect(s.id)}
        onDoubleClick={(e) => {
          e.preventDefault();
          onStartRename(s.id, label);
        }}
        title={dateTooltip}
        className={`w-full flex items-center gap-1.5 py-2 pl-1 pr-12 min-h-[44px] rounded-lg transition-colors duration-100 cursor-pointer ${
          isActive
            ? "bg-cc-active"
            : "hover:bg-cc-hover"
        }`}
      >
        {/* Status dot */}
        {!isEditing && (
          <StatusDot status={derivedStatus} />
        )}

        {/* Session name / edit input */}
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirmRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelRename();
              }
              e.stopPropagation();
            }}
            onBlur={onConfirmRename}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="text-[13px] font-medium flex-1 min-w-0 text-cc-fg bg-transparent border border-cc-border rounded px-1.5 py-0.5 outline-none focus:border-cc-primary/50 focus:ring-1 focus:ring-cc-primary/20"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <span
              className={`text-[13px] font-medium truncate text-cc-fg leading-snug block ${
                isRecentlyRenamed ? "animate-name-appear" : ""
              }`}
              onAnimationEnd={() => onClearRecentlyRenamed(s.id)}
            >
              {label}
            </span>
          </div>
        )}

        {/* LOCAL: removed CC/CX BackendBadge — upstream shows backend type here */}
        {!isEditing && (s.isContainerized || s.cronJobId || s.isFork) && (
          <span className="flex items-center gap-1 shrink-0">
            {s.isFork && (
              <span className="flex items-center px-1 py-0.5 rounded bg-cc-primary/10" title="Forked session">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-cc-primary">
                  <circle cx="5" cy="3" r="1.5" />
                  <circle cx="11" cy="3" r="1.5" />
                  <circle cx="5" cy="13" r="1.5" />
                  <path d="M5 4.5v3C5 9.5 7 11 9 11h2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <path d="M11 4.5v6.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                </svg>
              </span>
            )}
            {s.isContainerized && (
              <span className="flex items-center px-1 py-0.5 rounded bg-blue-400/10" title="Docker">
                <img src="/logo-docker.svg" alt="Docker logo" className="w-3 h-3" />
              </span>
            )}
            {s.cronJobId && (
              <span className="flex items-center px-1 py-0.5 rounded bg-violet-400/10" title="Scheduled">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-violet-400">
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L9 7.586V5z" />
                </svg>
              </span>
            )}
          </span>
        )}
      </button>

      {/* Permission badge — hidden on hover to reveal action buttons */}
      {!archived && permCount > 0 && (
        <span className="absolute right-8 can-hover:right-2 top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cc-warning text-white text-[10px] font-bold leading-none px-1 can-hover:group-hover:opacity-0 transition-opacity pointer-events-none">
          {permCount}
        </span>
      )}

      {/* LOCAL: direct action buttons instead of upstream's three-dot context menu */}
      {archived ? (
        <>
          <button
            onClick={(e) => onUnarchive(e, s.id)}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md can-hover:opacity-0 can-hover:group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-cc-fg transition-all cursor-pointer"
            title="Restore session"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M8 10V3M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13h10" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={(e) => onDelete(e, s.id)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md can-hover:opacity-0 can-hover:group-hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-red-400 transition-all cursor-pointer"
            title="Delete permanently"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </>
      ) : (
        <button
          onClick={(e) => onArchive(e, s.id)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-30 hover:opacity-100 hover:bg-cc-border text-cc-muted hover:text-cc-fg transition-all cursor-pointer"
          title="Archive session"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M3 3h10v2H3zM4 5v7a1 1 0 001 1h6a1 1 0 001-1V5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 8h3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
