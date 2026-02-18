import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStore } from "../store.js";
import { api, type ResumableSession } from "../api.js";
import { connectSession, connectAllSessions, disconnectSession, waitForConnection } from "../ws.js";
import { navigateToSession, navigateHome, parseHash } from "../utils/routing.js";
import { ProjectGroup } from "./ProjectGroup.js";
import { SessionItem } from "./SessionItem.js";
import { groupSessionsByProject, type SessionItem as SessionItemType } from "../utils/project-grouping.js";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showResumePicker, setShowResumePicker] = useState(false);
  const [resumableSessions, setResumableSessions] = useState<ResumableSession[]>([]);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : ""));
  const editInputRef = useRef<HTMLInputElement>(null);
  const sessions = useStore((s) => s.sessions);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const removeSession = useStore((s) => s.removeSession);
  const sessionNames = useStore((s) => s.sessionNames);
  const recentlyRenamed = useStore((s) => s.recentlyRenamed);
  const clearRecentlyRenamed = useStore((s) => s.clearRecentlyRenamed);
  const pendingPermissions = useStore((s) => s.pendingPermissions);
  const collapsedProjects = useStore((s) => s.collapsedProjects);
  const toggleProjectCollapse = useStore((s) => s.toggleProjectCollapse);
  const setAllProjectsCollapsed = useStore((s) => s.setAllProjectsCollapsed);
  const route = parseHash(hash);
  const isSettingsPage = route.page === "settings";
  const isPromptsPage = route.page === "prompts";
  const isTerminalPage = route.page === "terminal";
  const isEnvironmentsPage = route.page === "environments";
  const isScheduledPage = route.page === "scheduled";

  // Poll for SDK sessions on mount
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const list = await api.listSessions();
        if (active) {
          useStore.getState().setSdkSessions(list);
          // Connect all active sessions so we receive notifications for all of them
          connectAllSessions(list);
          // Hydrate session names from server (server is source of truth)
          const store = useStore.getState();
          for (const s of list) {
            if (s.name && !store.sessionNames.has(s.sessionId)) {
              store.setSessionName(s.sessionId, s.name);
            }
          }
        }
      } catch {
        // server not ready
      }
    }
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function handleSelectSession(sessionId: string) {
    useStore.getState().closeTerminal();
    // Navigate to session hash — App.tsx hash effect handles setCurrentSession + connectSession
    navigateToSession(sessionId);
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

  function handleNewSession() {
    useStore.getState().closeTerminal();
    navigateHome();
    useStore.getState().newSession();
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

  async function handleShowResumePicker() {
    if (showResumePicker) {
      setShowResumePicker(false);
      return;
    }
    setResumeLoading(true);
    setShowResumePicker(true);
    try {
      const list = await api.listResumableSessions();
      setResumableSessions(list);
    } catch {
      setResumableSessions([]);
    }
    setResumeLoading(false);
  }

  async function handleResumeSession(rs: ResumableSession) {
    setResumingId(rs.sessionId);
    try {
      if (currentSessionId) disconnectSession(currentSessionId);
      const result = await api.createSession({
        cwd: rs.project,
        resumeSessionId: rs.sessionId,
      });
      const sessionId = result.sessionId;
      const name = rs.title.slice(0, 40) || rs.sessionId.slice(0, 8);
      useStore.getState().setSessionName(sessionId, name);
      setCurrentSession(sessionId);
      connectSession(sessionId);
      await waitForConnection(sessionId);
      setShowResumePicker(false);
      if (window.innerWidth < 768) {
        useStore.getState().setSidebarOpen(false);
      }
    } catch (err) {
      console.error("Failed to resume session:", err);
    }
    setResumingId(null);
  }

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  function confirmRename() {
    if (editingSessionId && editingName.trim()) {
      useStore.getState().setSessionName(editingSessionId, editingName.trim());
      api.renameSession(editingSessionId, editingName.trim()).catch(() => {});
    }
    setEditingSessionId(null);
    setEditingName("");
  }

  function cancelRename() {
    setEditingSessionId(null);
    setEditingName("");
  }

  function handleStartRename(id: string, currentName: string) {
    setEditingSessionId(id);
    setEditingName(currentName);
  }

  const handleDeleteSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      disconnectSession(sessionId);
      await api.deleteSession(sessionId);
    } catch {
      // best-effort
    }
    if (useStore.getState().currentSessionId === sessionId) {
      navigateHome();
    }
    removeSession(sessionId);
  }, [removeSession]);

  const handleArchiveSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    // Check if session uses a container — if so, ask for confirmation
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const bridgeState = sessions.get(sessionId);
    const isContainerized = bridgeState?.is_containerized || !!sdkInfo?.containerId || false;
    if (isContainerized) {
      setConfirmArchiveId(sessionId);
      return;
    }
    doArchive(sessionId);
  }, [sdkSessions, sessions]);

  const doArchive = useCallback(async (sessionId: string, force?: boolean) => {
    const store = useStore.getState();
    // Mark archived in sdkSessions BEFORE disconnect so scheduleReconnect skips it
    store.setSdkSessions(
      store.sdkSessions.map((s) =>
        s.sessionId === sessionId ? { ...s, archived: true } : s
      )
    );
    // Remove from WsBridge sessions map so bridge-only sessions (no sdkInfo) disappear
    const bridgeSessions = new Map(store.sessions);
    if (bridgeSessions.delete(sessionId)) {
      useStore.setState({ sessions: bridgeSessions });
    }
    disconnectSession(sessionId);
    if (store.currentSessionId === sessionId) {
      store.newSession();
    }
    try {
      await api.archiveSession(sessionId, force ? { force: true } : undefined);
    } catch {
      // best-effort
    }
    if (useStore.getState().currentSessionId === sessionId) {
      navigateHome();
      useStore.getState().newSession();
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  const confirmArchive = useCallback(() => {
    if (confirmArchiveId) {
      doArchive(confirmArchiveId, true);
      setConfirmArchiveId(null);
    }
  }, [confirmArchiveId, doArchive]);

  const cancelArchive = useCallback(() => {
    setConfirmArchiveId(null);
  }, []);

  const handleUnarchiveSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await api.unarchiveSession(sessionId);
    } catch {
      // best-effort
    }
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  const handleClearArchived = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useStore.getState();
    const archived = store.sdkSessions.filter((s) => s.archived);
    // Optimistically remove all archived from local state
    store.setSdkSessions(store.sdkSessions.filter((s) => !s.archived));
    setShowArchived(false);
    // Delete on server in parallel
    await Promise.allSettled(
      archived.map((s) => api.deleteSession(s.sessionId))
    );
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, []);

  // Combine sessions from WsBridge state + SDK sessions list
  const allSessionIds = new Set<string>();
  for (const id of sessions.keys()) allSessionIds.add(id);
  for (const s of sdkSessions) allSessionIds.add(s.sessionId);

  const allSessionList: SessionItemType[] = Array.from(allSessionIds).map((id) => {
    const bridgeState = sessions.get(id);
    const sdkInfo = sdkSessions.find((s) => s.sessionId === id);
    return {
      id,
      title: sdkInfo?.title,
      model: bridgeState?.model || sdkInfo?.model || "",
      cwd: bridgeState?.cwd || sdkInfo?.cwd || "",
      gitBranch: bridgeState?.git_branch || sdkInfo?.gitBranch || "",
      isWorktree: bridgeState?.is_worktree || sdkInfo?.isWorktree || false,
      isContainerized: bridgeState?.is_containerized || !!sdkInfo?.containerId || false,
      gitAhead: bridgeState?.git_ahead || sdkInfo?.gitAhead || 0,
      gitBehind: bridgeState?.git_behind || sdkInfo?.gitBehind || 0,
      linesAdded: bridgeState?.total_lines_added || sdkInfo?.totalLinesAdded || 0,
      linesRemoved: bridgeState?.total_lines_removed || sdkInfo?.totalLinesRemoved || 0,
      isConnected: cliConnected.get(id) ?? false,
      status: sessionStatus.get(id) ?? null,
      sdkState: sdkInfo?.state ?? null,
      createdAt: sdkInfo?.createdAt ?? 0,
      archived: sdkInfo?.archived ?? false,
      backendType: bridgeState?.backend_type || sdkInfo?.backendType || "claude",
      repoRoot: bridgeState?.repo_root || "",
      permCount: pendingPermissions.get(id)?.size ?? 0,
      cronJobId: bridgeState?.cronJobId || sdkInfo?.cronJobId,
      cronJobName: bridgeState?.cronJobName || sdkInfo?.cronJobName,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  // Filter out ghost sessions: no cwd/title, or sessions whose only label is the model name
  const validSessions = allSessionList.filter((s) => {
    if (!s.cwd && !s.title) return false;
    const name = sessionNames.get(s.id);
    const label = s.title || name;
    if (!label || label === s.model) return false;
    return true;
  });
  const activeSessions = validSessions.filter((s) => !s.archived && !s.cronJobId);
  const cronSessions = validSessions.filter((s) => !s.archived && !!s.cronJobId);
  const archivedSessions = validSessions.filter((s) => s.archived);
  const currentSession = currentSessionId ? allSessionList.find((s) => s.id === currentSessionId) : null;
  const logoSrc = currentSession?.backendType === "codex" ? "/logo-codex.svg" : "/logo.svg";
  const [showCronSessions, setShowCronSessions] = useState(true);

  // Group active sessions by project
  const projectGroups = useMemo(
    () => groupSessionsByProject(activeSessions),
    [activeSessions],
  );

  const handleArchiveGroup = useCallback(async (e: React.MouseEvent, projectKey: string) => {
    e.stopPropagation();
    const group = projectGroups.find((g) => g.key === projectKey);
    if (!group || group.sessions.length === 0) return;
    const store = useStore.getState();
    const ids = group.sessions.map((s) => s.id);
    // Optimistically mark all as archived
    store.setSdkSessions(
      store.sdkSessions.map((s) =>
        ids.includes(s.sessionId) ? { ...s, archived: true } : s
      )
    );
    // Remove from bridge sessions
    const bridgeSessions = new Map(store.sessions);
    let changed = false;
    for (const id of ids) {
      if (bridgeSessions.delete(id)) changed = true;
      disconnectSession(id);
    }
    if (changed) useStore.setState({ sessions: bridgeSessions });
    // Navigate away if current session is in this group
    if (store.currentSessionId && ids.includes(store.currentSessionId)) {
      store.newSession();
    }
    // Archive on server in parallel
    await Promise.allSettled(ids.map((id) => api.archiveSession(id)));
    try {
      const list = await api.listSessions();
      useStore.getState().setSdkSessions(list);
    } catch {
      // best-effort
    }
  }, [projectGroups]);

  // Shared props for SessionItem / ProjectGroup
  const sessionItemProps = {
    onSelect: handleSelectSession,
    onStartRename: handleStartRename,
    onArchive: handleArchiveSession,
    onUnarchive: handleUnarchiveSession,
    onDelete: handleDeleteSession,
    onClearRecentlyRenamed: clearRecentlyRenamed,
    editingSessionId,
    editingName,
    setEditingName,
    onConfirmRename: confirmRename,
    onCancelRename: cancelRename,
    editInputRef,
  };

  return (
    <aside className="w-[260px] h-full flex flex-col bg-cc-sidebar border-r border-cc-border">
      {/* Header */}
      <div className="p-4 pb-3">
        <a href="https://github.com/pannous/companion" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity">
          <img src={logoSrc} alt="" className="w-7 h-7" />
          <span className="text-sm font-semibold text-cc-fg tracking-tight">The Companion</span>
        </a>

        <div className="flex gap-1.5">
          <button
            onClick={handleNewSession}
            className="flex-1 py-2 px-3 text-sm font-medium rounded-[10px] bg-cc-primary hover:bg-cc-primary-hover text-white transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" />
            </svg>
            New
          </button>
          <button
            onClick={handleShowResumePicker}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-[10px] transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
              showResumePicker
                ? "bg-cc-active text-cc-fg"
                : "bg-cc-hover text-cc-muted hover:text-cc-fg"
            }`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M4 6l4 4 4-4" />
            </svg>
            Resume
          </button>
        </div>

        {showResumePicker && (
          <div className="mt-1.5 rounded-[10px] border border-cc-border bg-cc-sidebar overflow-hidden">
            {resumeLoading ? (
              <div className="px-3 py-4 text-xs text-cc-muted text-center">Loading sessions...</div>
            ) : resumableSessions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-cc-muted text-center">No resumable sessions found</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                {resumableSessions.map((rs) => {
                  const projectName = rs.project.split("/").pop() || rs.project;
                  const ago = formatTimeAgo(rs.lastModified);
                  const isResuming = resumingId === rs.sessionId;
                  return (
                    <button
                      key={rs.sessionId}
                      onClick={() => handleResumeSession(rs)}
                      disabled={!!resumingId}
                      className="w-full px-3 py-2 text-left hover:bg-cc-hover transition-colors border-b border-cc-border last:border-b-0 cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-cc-muted opacity-40" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-cc-fg truncate leading-snug">
                            {isResuming ? "Resuming..." : (rs.title || rs.sessionId.slice(0, 12))}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-cc-muted truncate">{projectName}</span>
                            <span className="text-[10px] text-cc-muted opacity-50">{ago}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Container archive confirmation */}
      {confirmArchiveId && (
        <div className="mx-2 mb-1 p-2.5 rounded-[10px] bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
              <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-cc-fg leading-snug">
                Archiving will <strong>remove the container</strong> and any uncommitted changes.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={cancelArchive}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-cc-hover text-cc-muted hover:text-cc-fg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmArchive}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {activeSessions.length === 0 && cronSessions.length === 0 && archivedSessions.length === 0 ? (
          <p className="px-3 py-8 text-xs text-cc-muted text-center leading-relaxed">
            No sessions yet.
          </p>
        ) : (
          <>
            {projectGroups.length > 1 && (
              <div className="flex justify-end px-1 mb-0.5">
                <button
                  onClick={() => {
                    const allKeys = projectGroups.map((g) => g.key);
                    const allCollapsed = allKeys.every((k) => collapsedProjects.has(k));
                    setAllProjectsCollapsed(allKeys, !allCollapsed);
                  }}
                  className="px-1.5 py-0.5 text-[10px] text-cc-muted hover:text-cc-fg transition-colors cursor-pointer rounded hover:bg-cc-hover"
                  title={projectGroups.every((g) => collapsedProjects.has(g.key)) ? "Expand all groups" : "Collapse all groups"}
                >
                  {projectGroups.every((g) => collapsedProjects.has(g.key)) ? "Expand all" : "Collapse all"}
                </button>
              </div>
            )}
            {projectGroups.map((group, i) => (
              <ProjectGroup
                key={group.key}
                group={group}
                isCollapsed={collapsedProjects.has(group.key)}
                onToggleCollapse={toggleProjectCollapse}
                currentSessionId={currentSessionId}
                sessionNames={sessionNames}
                pendingPermissions={pendingPermissions}
                recentlyRenamed={recentlyRenamed}
                onArchiveGroup={handleArchiveGroup}
                isFirst={i === 0}
                {...sessionItemProps}
              />
            ))}

            {cronSessions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-cc-border">
                <button
                  onClick={() => setShowCronSessions(!showCronSessions)}
                  className="w-full px-3 py-1.5 text-[11px] font-medium text-violet-400 uppercase tracking-wider flex items-center gap-1.5 hover:text-violet-300 transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${showCronSessions ? "rotate-90" : ""}`}>
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                    <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L9 7.586V5z" />
                  </svg>
                  Scheduled Runs ({cronSessions.length})
                </button>
                {showCronSessions && (
                  <div className="space-y-0.5 mt-1">
                    {cronSessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isActive={currentSessionId === s.id}
                        sessionName={sessionNames.get(s.id)}
                        permCount={pendingPermissions.get(s.id)?.size ?? 0}
                        isRecentlyRenamed={recentlyRenamed.has(s.id)}
                        {...sessionItemProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {archivedSessions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-cc-border">
                <div className="flex items-center">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex-1 px-3 py-1.5 text-[11px] font-medium text-cc-muted uppercase tracking-wider flex items-center gap-1.5 hover:text-cc-fg transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${showArchived ? "rotate-90" : ""}`}>
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                    Archived ({archivedSessions.length})
                  </button>
                  <button
                    onClick={handleClearArchived}
                    title="Delete all archived sessions"
                    className="px-2 py-1 mr-1 text-[10px] text-cc-muted hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-cc-hover"
                  >
                    Clear
                  </button>
                </div>
                {showArchived && (
                  <div className="space-y-0.5 mt-1">
                    {archivedSessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isActive={currentSessionId === s.id}
                        isArchived
                        sessionName={sessionNames.get(s.id)}
                        permCount={pendingPermissions.get(s.id)?.size ?? 0}
                        isRecentlyRenamed={recentlyRenamed.has(s.id)}
                        {...sessionItemProps}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-cc-border space-y-0.5">
        <button
          onClick={() => {
            useStore.getState().closeTerminal();
            window.location.hash = "#/prompts";
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer ${
            isPromptsPage
              ? "bg-cc-active text-cc-fg"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M3 2.5A1.5 1.5 0 014.5 1h5.879c.398 0 .779.158 1.06.44l1.621 1.62c.281.282.44.663.44 1.061V13.5A1.5 1.5 0 0112 15H4.5A1.5 1.5 0 013 13.5v-11zM4.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H12a.5.5 0 00.5-.5V4.121a.5.5 0 00-.146-.353l-1.621-1.621A.5.5 0 0010.379 2H4.5zm1.25 4.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5H6.5a.75.75 0 01-.75-.75z" />
          </svg>
          <span>Prompts</span>
        </button>
        <button
          onClick={() => {
            window.location.hash = "#/terminal";
            if (window.innerWidth < 768) {
              useStore.getState().setSidebarOpen(false);
            }
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer ${
            isTerminalPage
              ? "bg-cc-active text-cc-fg"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1.5l3 2.5-3 2.5V4.5zM8.5 10h3v1h-3v-1z" />
          </svg>
          <span>Terminal</span>
        </button>
        <button
          onClick={() => {
            useStore.getState().closeTerminal();
            window.location.hash = "#/environments";
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer ${
            isEnvironmentsPage
              ? "bg-cc-active text-cc-fg"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
          </svg>
          <span>Environments</span>
        </button>
        <button
          onClick={() => {
            useStore.getState().closeTerminal();
            window.location.hash = "#/scheduled";
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer ${
            isScheduledPage
              ? "bg-cc-active text-cc-fg"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L9 7.586V5z" />
          </svg>
          <span>Scheduled</span>
        </button>
        <button
          onClick={() => {
            useStore.getState().closeTerminal();
            window.location.hash = "#/settings";
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-sm transition-colors cursor-pointer ${
            isSettingsPage
              ? "bg-cc-active text-cc-fg"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.35-.8-2.92.77-2.12 2.12.54.9.07 2.04-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.39.95 2.29-.8 1.35.77 2.92 2.12 2.12.9-.54 2.04-.07 2.29.95.38 1.56 2.6 1.56 2.98 0 .25-1.02 1.39-1.49 2.29-.95 1.35.8 2.92-.77 2.12-2.12-.54-.9-.07-2.04.95-2.29 1.56-.38 1.56-2.6 0-2.98-1.02-.25-1.49-1.39-.95-2.29.8-1.35-.77-2.92-2.12-2.12-.9.54-2.04.07-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
