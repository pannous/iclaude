import type { RefObject } from "react";
import type { ProjectGroup as ProjectGroupType } from "../utils/project-grouping.js";
import { SessionItem } from "./SessionItem.js";

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
  editingSessionId,
  editingName,
  setEditingName,
  onConfirmRename,
  onCancelRename,
  editInputRef,
  isFirst,
}: ProjectGroupProps) {
  // Build collapsed preview: first 2 session names
  const collapsedPreview = isCollapsed
    ? group.sessions
        .slice(0, 2)
        .map((s) => s.title || sessionNames.get(s.id) || s.model || s.id.slice(0, 8))
        .join(", ") + (group.sessions.length > 2 ? ", ..." : "")
    : "";

  return (
    <div className={`group/project ${!isFirst ? "my-2 pt-2 border-t border-cc-separator" : ""}`}>
      {/* Group header */}
      <div className="flex items-center">
        <button
          onClick={() => onToggleCollapse(group.key)}
          className="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-1.5 hover:bg-cc-hover rounded-md transition-colors cursor-pointer"
        >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-2.5 h-2.5 text-cc-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        {/* Folder icon */}
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-muted/60 shrink-0">
          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.354.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
        </svg>
        <span className="text-[12px] font-semibold text-cc-fg/80 truncate">
          {group.label}
        </span>

        {/* Status dots */}
        <span className="flex items-center gap-1 ml-auto shrink-0">
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
        </button>
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
