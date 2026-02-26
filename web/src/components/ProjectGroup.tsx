import { useState, type RefObject } from "react";
import type { ProjectGroup as ProjectGroupType } from "../utils/project-grouping.js";
import type { ResumableSession } from "../api.js";
import { SessionItem } from "./SessionItem.js";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ProjectGroupProps {
  group: ProjectGroupType;
  isCollapsed: boolean;
  onToggleCollapse: (projectKey: string) => void;
  currentSessionId: string | null;
  sessionNames: Map<string, string>;
  pendingPermissions: Map<string, Map<string, unknown>>;
  recentlyRenamed: Set<string>;
  onSelect: (id: string) => void;
  onStartRename: (id: string, currentName: string) => void;
  onArchive: (e: React.MouseEvent, id: string) => void;
  onUnarchive: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onArchiveGroup: (e: React.MouseEvent, projectKey: string) => void;
  onNewSessionInFolder: (cwd: string) => void;
  onClearRecentlyRenamed: (id: string) => void;
  groupResumableSessions: ResumableSession[];
  onResumeSession: (rs: ResumableSession) => void;
  resumingId: string | null;
  editingSessionId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  editInputRef: RefObject<HTMLInputElement | null>;
  isFirst: boolean;
}

export function ProjectGroup({
  group,
  isCollapsed,
  onToggleCollapse,
  currentSessionId,
  sessionNames,
  pendingPermissions,
  recentlyRenamed,
  onSelect,
  onStartRename,
  onArchive,
  onUnarchive,
  onDelete,
  onArchiveGroup,
  onNewSessionInFolder,
  onClearRecentlyRenamed,
  groupResumableSessions,
  onResumeSession,
  resumingId,
  editingSessionId,
  editingName,
  setEditingName,
  onConfirmRename,
  onCancelRename,
  editInputRef,
  isFirst,
}: ProjectGroupProps) {
  const [showResumeDrop, setShowResumeDrop] = useState(false);

  // Build collapsed preview: first 2 session names
  const collapsedPreview = isCollapsed
    ? group.sessions
        .slice(0, 2)
        .map((s) => (s.title?.replace(/<[^>]*>/g, "").trim() || undefined) || sessionNames.get(s.id) || s.model || s.id.slice(0, 8))
        .join(", ") + (group.sessions.length > 2 ? ", ..." : "")
    : "";

  return (
    <div className={`group/project ${!isFirst ? "my-2 pt-2 border-t border-cc-separator" : ""}`}>
      {/* Group header */}
      <div className="flex items-center">
        {/* Toggle: arrow + folder icon — narrow, just the icons */}
        <button
          onClick={() => onToggleCollapse(group.key)}
          aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
          className="shrink-0 pl-2 pr-1 py-1.5 flex items-center gap-1.5 hover:bg-cc-hover rounded-md transition-colors cursor-pointer"
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-2.5 h-2.5 text-cc-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-muted/60 shrink-0">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.354.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
          </svg>
        </button>

        {/* Folder label — also toggles collapse */}
        <button
          onClick={() => onToggleCollapse(group.key)}
          className="min-w-0 py-1.5 pr-1 text-[12px] font-semibold text-cc-fg/80 truncate hover:bg-cc-hover rounded-md transition-colors cursor-pointer"
        >
          {group.label}
        </button>

        {/* Resume button — right after the folder name */}
        {groupResumableSessions.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResumeDrop((v) => !v); }}
            title={`Resume a previous ${group.label} session (${groupResumableSessions.length})`}
            className={`shrink-0 p-1 rounded transition-all cursor-pointer ${showResumeDrop ? "text-cc-primary bg-cc-active" : "text-cc-muted/60 hover:text-cc-primary hover:bg-cc-hover"}`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM2 8a6 6 0 1110.586 3.879l2.267 2.268a.75.75 0 11-1.06 1.06l-2.268-2.267A6 6 0 012 8z" />
              <path d="M8 5a.75.75 0 01.75.75v2.69l1.28 1.28a.75.75 0 11-1.06 1.06l-1.5-1.5A.75.75 0 017.25 8.75v-3A.75.75 0 018 5z" />
            </svg>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status dots */}
        <span className="flex items-center gap-1 shrink-0">
          {group.runningCount > 0 && (
            <span className="w-1 h-1 rounded-full bg-cc-success" title={`${group.runningCount} running`} />
          )}
          {group.permCount > 0 && (
            <span className="w-1 h-1 rounded-full bg-cc-warning" title={`${group.permCount} waiting`} />
          )}
        </span>

        {/* Count badge */}
        <span className="text-[10px] bg-cc-hover rounded-full px-1.5 py-0.5 text-cc-muted shrink-0">
          {group.sessions.length}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewSessionInFolder(group.key);
          }}
          title={`New session in ${group.label}`}
          className="shrink-0 p-1 rounded can-hover:opacity-0 can-hover:group-hover/project:opacity-100 text-cc-muted hover:text-cc-primary hover:bg-cc-hover transition-all cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button
          onClick={(e) => onArchiveGroup(e, group.key)}
          title={`Archive all ${group.sessions.length} sessions in ${group.label}`}
          className="shrink-0 p-1 mr-1 rounded can-hover:opacity-0 can-hover:group-hover/project:opacity-100 text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-all cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M1.75 3A1.75 1.75 0 000 4.75v.5C0 6.216.784 7 1.75 7h12.5A1.75 1.75 0 0016 5.25v-.5A1.75 1.75 0 0014.25 3H1.75zM1.5 4.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25v-.5zM1.75 8.5A.75.75 0 001 9.25v4a1.75 1.75 0 001.75 1.75h10.5A1.75 1.75 0 0015 13.25v-4a.75.75 0 00-1.5 0v4a.25.25 0 01-.25.25H2.75a.25.25 0 01-.25-.25v-4a.75.75 0 00-.75-.75zM6 10.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z" />
          </svg>
        </button>
      </div>

      {/* Resume dropdown */}
      {showResumeDrop && (
        <div className="mx-1 mb-1 rounded-[8px] border border-cc-border bg-cc-sidebar overflow-hidden">
          {groupResumableSessions.map((rs) => {
            const isResuming = resumingId === rs.sessionId;
            const displayTitle = rs.title?.replace(/^\[agent:[^\]]+\]\s*/, "").trim() || rs.sessionId.slice(0, 12);
            return (
              <button
                key={rs.sessionId}
                onClick={() => { onResumeSession(rs); setShowResumeDrop(false); }}
                disabled={!!resumingId}
                className="w-full px-2.5 py-1.5 text-left hover:bg-cc-hover transition-colors border-b border-cc-border last:border-b-0 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 w-1 h-1 rounded-full bg-cc-muted opacity-40" />
                  <span className="flex-1 min-w-0 text-[11px] text-cc-fg truncate">
                    {isResuming ? "Resuming…" : displayTitle}
                  </span>
                  <span className="shrink-0 text-[10px] text-cc-muted opacity-60">{formatTimeAgo(rs.lastModified)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Collapsed preview */}
      {isCollapsed && collapsedPreview && (
        <div className="text-[10px] text-cc-muted/70 truncate pl-7 pb-1">
          {collapsedPreview}
        </div>
      )}

      {/* Session list */}
      {!isCollapsed && (
        <div className="space-y-px mt-1">
          {group.sessions.map((s) => {
            const permCount = pendingPermissions.get(s.id)?.size ?? 0;
            return (
              <SessionItem
                key={s.id}
                session={s}
                isActive={currentSessionId === s.id}
                sessionName={sessionNames.get(s.id)}
                permCount={permCount}
                isRecentlyRenamed={recentlyRenamed.has(s.id)}
                onSelect={onSelect}
                onStartRename={onStartRename}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                onClearRecentlyRenamed={onClearRecentlyRenamed}
                editingSessionId={editingSessionId}
                editingName={editingName}
                setEditingName={setEditingName}
                onConfirmRename={onConfirmRename}
                onCancelRename={onCancelRename}
                editInputRef={editInputRef}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
