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
  // Build summary badges
  const summaryParts: string[] = [];
  if (group.runningCount > 0) summaryParts.push(`${group.runningCount} running`);
  if (group.permCount > 0) summaryParts.push(`${group.permCount} waiting`);

  return (
    <div className={`group/project ${!isFirst ? "mt-1 pt-1 border-t border-cc-border/50" : ""}`}>
      {/* Group header */}
      <div className="flex items-center">
        <button
          onClick={() => onToggleCollapse(group.key)}
          className="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-1.5 hover:bg-cc-hover rounded-md transition-colors cursor-pointer"
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 text-cc-muted transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <span className="text-[11px] font-semibold text-cc-fg/80 truncate">
            {group.label}
          </span>
          {summaryParts.length > 0 && (
            <span className="text-[10px] text-cc-muted ml-auto shrink-0">
              {summaryParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className={part.includes("running") ? "text-cc-success" : "text-cc-warning"}>
                    {part}
                  </span>
                </span>
              ))}
            </span>
          )}
          <span className="text-[10px] text-cc-muted/60 shrink-0 ml-1">
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

      {/* Session list */}
      {!isCollapsed && (
        <div className="space-y-0.5 mt-0.5">
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
