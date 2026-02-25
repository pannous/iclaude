import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStore } from "../store.js";
import { api, type ResumableSession } from "../api.js";
import { connectSession, disconnectSession, disconnectAllExcept, waitForConnection } from "../ws.js";
import { navigateToSession, navigateHome, parseHash } from "../utils/routing.js";
import { ProjectGroup } from "./ProjectGroup.js";
import { SessionItem } from "./SessionItem.js";
import { ThemeToggle } from "./TopBar.js";
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

interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  hash: string;
  viewBox: string;
  iconPath: string;
  activePages?: string[];
  fillRule?: "evenodd";
  clipRule?: "evenodd";
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "prompts",
    label: "Prompts",
    shortLabel: "Prompts",
    hash: "#/prompts",
    viewBox: "0 0 16 16",
    iconPath: "M3 2.5A1.5 1.5 0 014.5 1h5.879c.398 0 .779.158 1.06.44l1.621 1.62c.281.282.44.663.44 1.061V13.5A1.5 1.5 0 0112 15H4.5A1.5 1.5 0 013 13.5v-11zM4.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H12a.5.5 0 00.5-.5V4.121a.5.5 0 00-.146-.353l-1.621-1.621A.5.5 0 0010.379 2H4.5zm1.25 4.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5H6.5a.75.75 0 01-.75-.75z",
  },
  {
    id: "integrations",
    label: "Integrations",
    shortLabel: "Integr.",
    hash: "#/integrations",
    activePages: ["integrations", "integration-linear"],
    viewBox: "0 0 16 16",
    iconPath: "M2.5 3A1.5 1.5 0 001 4.5v2A1.5 1.5 0 002.5 8h2A1.5 1.5 0 006 6.5v-2A1.5 1.5 0 004.5 3h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zm9 0A1.5 1.5 0 0010 5.5v2A1.5 1.5 0 0011.5 9h2A1.5 1.5 0 0015 7.5v-2A1.5 1.5 0 0013.5 4h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zM2.5 10A1.5 1.5 0 001 11.5v2A1.5 1.5 0 002.5 15h2A1.5 1.5 0 006 13.5v-2A1.5 1.5 0 004.5 10h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zM8.5 12a.5.5 0 100 1h5a.5.5 0 100-1h-5zm0-2a.5.5 0 100 1h2a.5.5 0 100-1h-2z",
  },
  {
    id: "terminal",
    label: "Terminal",
    shortLabel: "Terminal",
    hash: "#/terminal",
    viewBox: "0 0 16 16",
    iconPath: "M2 3a1 1 0 011-1h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 1.5l3 2.5-3 2.5V4.5zM8.5 10h3v1h-3v-1z",
  },
  {
    // LOCAL: moved from TopBar workspace tabs to sidebar nav
    id: "processes",
    label: "Processes",
    shortLabel: "Procs",
    hash: "#/processes",
    viewBox: "0 0 16 16",
    iconPath: "M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zM8 4.5a.5.5 0 01.5.5v2.5H11a.5.5 0 010 1H8.5V11a.5.5 0 01-1 0V8.5H5a.5.5 0 010-1h2.5V5a.5.5 0 01.5-.5z",
  },
  {
    id: "environments",
    label: "Environments",
    shortLabel: "Envs",
    hash: "#/environments",
    viewBox: "0 0 16 16",
    iconPath: "M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z",
  },
  {
    id: "agents",
    label: "Agents",
    shortLabel: "Agents",
    hash: "#/agents",
    viewBox: "0 0 16 16",
    iconPath: "M8 1.5a2.5 2.5 0 00-2.5 2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S9.38 1.5 8 1.5zM4 8a4 4 0 00-4 4v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V12a4 4 0 00-4-4H4z",
  },
  {
    id: "panels",
    label: "Panels",
    shortLabel: "Panels",
    hash: "#/panels",
    viewBox: "0 0 16 16",
    iconPath: "M12.96 5.23a.66.66 0 00.19.59l1.04 1.04a1.6 1.6 0 010 2.27l-1.07 1.07a.65.65 0 01-.56.19 1.67 1.67 0 10-2.14 2.14.65.65 0 01-.19.56l-1.07 1.07a1.6 1.6 0 01-2.27 0l-1.04-1.04a.68.68 0 00-.59-.2 1.67 1.67 0 11-2.14-2.14.68.68 0 00-.2-.59L1.89 9.15a1.61 1.61 0 010-2.27l1.07-1.07a.65.65 0 00.19-.56 1.67 1.67 0 112.14-2.14.65.65 0 00.56-.19L6.92 1.86a1.6 1.6 0 012.27 0l1.04 1.04c.15.15.37.23.59.2a1.67 1.67 0 112.14 2.14z",
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "Settings",
    hash: "#/settings",
    viewBox: "0 0 20 20",
    iconPath: "M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.35-.8-2.92.77-2.12 2.12.54.9.07 2.04-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.39.95 2.29-.8 1.35.77 2.92 2.12 2.12.9-.54 2.04-.07 2.29.95.38 1.56 2.6 1.56 2.98 0 .25-1.02 1.39-1.49 2.29-.95 1.35.8 2.92-.77 2.12-2.12-.54-.9-.07-2.04.95-2.29 1.56-.38 1.56-2.6 0-2.98-1.02-.25-1.49-1.39-.95-2.29.8-1.35-.77-2.92-2.12-2.12-.9.54-2.04.07-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z",
    fillRule: "evenodd",
    clipRule: "evenodd",
  },
];

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showResumePicker, setShowResumePicker] = useState(false);
  const [resumableSessions, setResumableSessions] = useState<ResumableSession[]>([]);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
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


  // Poll for SDK sessions on mount
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const list = await api.listSessions();
        if (active) {
          useStore.getState().setSdkSessions(list);
          // Enforce single-active-connection: close any stale sockets for non-current sessions
          disconnectAllExcept(useStore.getState().currentSessionId);
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
    useStore.getState().setActiveTab("chat");
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
      // Filter out sessions that already appear in the active session list
      const activeCliIds = new Set(
        useStore.getState().sdkSessions.map((s) => s.cliSessionId).filter(Boolean)
      );
      setResumableSessions(list.filter((rs) => !activeCliIds.has(rs.sessionId)));
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
      api.renameSession(editingSessionId, editingName.trim()).catch((e) => console.warn("[sidebar] renameSession", e));
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

  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  }, []);

  const doDelete = useCallback(async (sessionId: string) => {
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

  const confirmDelete = useCallback(() => {
    if (confirmDeleteId) {
      doDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, doDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleDeleteAllArchived = useCallback(() => {
    setConfirmDeleteAll(true);
  }, []);

  const confirmDeleteAllArchived = useCallback(async () => {
    setConfirmDeleteAll(false);
    // Get fresh list of archived session IDs
    const store = useStore.getState();
    const allIds = new Set<string>();
    for (const id of store.sessions.keys()) allIds.add(id);
    for (const s of store.sdkSessions) allIds.add(s.sessionId);
    const archivedIds = Array.from(allIds).filter((id) => {
      const sdkInfo = store.sdkSessions.find((s) => s.sessionId === id);
      return sdkInfo?.archived ?? false;
    });
    for (const id of archivedIds) {
      await doDelete(id);
    }
  }, [doDelete]);

  const cancelDeleteAll = useCallback(() => {
    setConfirmDeleteAll(false);
  }, []);

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
    // Disconnect all archived sessions to cancel any pending reconnect timers
    for (const s of archived) {
      disconnectSession(s.sessionId);
    }
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
      agentId: bridgeState?.agentId || sdkInfo?.agentId,
      agentName: bridgeState?.agentName || sdkInfo?.agentName,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  // LOCAL: filter out ghost sessions and spam — upstream has no such filter
  const SPAM_PATTERNS = [/secret\.txt/i, /tell me the secret code/i];
  const validSessions = allSessionList.filter((s) => {
    if (!s.cwd && !s.title) return false;
    const name = sessionNames.get(s.id);
    const label = s.title || name;
    if (!label || label === s.model) return false;
    if (SPAM_PATTERNS.some((re) => re.test(label))) return false;
    return true;
  });
  const activeSessions = validSessions.filter((s) => !s.archived && !s.cronJobId && !s.agentId);
  const cronSessions = validSessions.filter((s) => !s.archived && !!s.cronJobId);
  const agentSessions = validSessions.filter((s) => !s.archived && !!s.agentId);
  const archivedSessions = validSessions.filter((s) => s.archived);
  const currentSession = currentSessionId ? allSessionList.find((s) => s.id === currentSessionId) : null;
  const logoSrc = currentSession?.backendType === "codex" ? "/logo-codex.svg" : "/logo.svg";
  const [showCronSessions, setShowCronSessions] = useState(true);
  const [showAgentSessions, setShowAgentSessions] = useState(false);

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

  function handleNewSessionInFolder(cwd: string) {
    useStore.getState().closeTerminal();
    navigateHome();
    useStore.getState().newSessionInFolder(cwd);
    if (window.innerWidth < 768) {
      useStore.getState().setSidebarOpen(false);
    }
  }

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
    <aside className="w-full md:w-[260px] h-full flex flex-col bg-cc-sidebar">
      {/* Header */}
      <div className="p-3.5 pb-2">
        {/* LOCAL: Link to GitHub repo */}
        <a href="https://github.com/pannous/companion" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 mb-3 hover:opacity-80 transition-opacity">
          <img src={logoSrc} alt="" className="w-6 h-6" />
          <span className="text-[13px] font-semibold text-cc-fg tracking-tight">The Companion</span>
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
          {/* Close button — mobile only (sidebar is full-width on mobile, so no backdrop to tap) */}
          <button
            onClick={() => useStore.getState().setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="md:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
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
      <div className="flex-1 overflow-y-auto px-2.5 pb-2">
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
                onNewSessionInFolder={handleNewSessionInFolder}
                isFirst={i === 0}
                {...sessionItemProps}
              />
            ))}

            {cronSessions.length > 0 && (
              <div className="mt-2 pt-2">
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

            {agentSessions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-cc-border">
                <button
                  onClick={() => setShowAgentSessions(!showAgentSessions)}
                  className="w-full px-3 py-1.5 text-[11px] font-medium text-cc-muted uppercase tracking-wider flex items-center gap-1.5 hover:text-cc-fg transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${showAgentSessions ? "rotate-90" : ""}`}>
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                    <path d="M8 1.5a2.5 2.5 0 00-2.5 2.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S9.38 1.5 8 1.5zM4 8a4 4 0 00-4 4v1.5a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V12a4 4 0 00-4-4H4z" />
                  </svg>
                  Agent Runs ({agentSessions.length})
                </button>
                {showAgentSessions && (
                  <div className="space-y-0.5 mt-1">
                    {agentSessions.map((s) => (
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
              <div className="mt-2 pt-2 border-t border-cc-border/50">
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
                  {showArchived && archivedSessions.length > 1 && (
                    <button
                      onClick={handleDeleteAllArchived}
                      className="px-2 py-1 mr-1 text-[10px] text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                      title="Delete all archived sessions"
                    >
                      Delete all
                    </button>
                  )}
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

      {/* Mobile FAB — New Session button in thumb zone */}
      <div className="md:hidden flex justify-end px-4 pb-2">
        <button
          onClick={handleNewSession}
          title="New Session"
          aria-label="New Session"
          className="w-12 h-12 rounded-full bg-cc-primary hover:bg-cc-primary-hover text-white flex items-center justify-center shadow-lg transition-colors duration-150 cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="p-2 pb-safe bg-cc-sidebar-footer">
        <div className="grid grid-cols-3 gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.activePages
              ? item.activePages.some((p) => route.page === p)
              : route.page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id !== "terminal") {
                    useStore.getState().closeTerminal();
                  }
                  window.location.hash = item.hash;
                  // Close sidebar on mobile so the navigated page is visible
                  if (window.innerWidth < 768) {
                    useStore.getState().setSidebarOpen(false);
                  }
                }}
                title={item.label}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-1.5 min-h-[44px] rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? "bg-cc-active text-cc-fg"
                    : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                }`}
              >
                <svg viewBox={item.viewBox} fill="currentColor" className="w-4 h-4">
                  <path d={item.iconPath} fillRule={item.fillRule} clipRule={item.clipRule} />
                </svg>
                <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
              </button>
            );
          })}
          {/* LOCAL: theme toggle as grid item — matches nav item styling */}
          <ThemeToggle />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {(confirmDeleteId || confirmDeleteAll) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
          onClick={confirmDeleteAll ? cancelDeleteAll : cancelDelete}
        >
          <div
            className="mx-4 w-full max-w-[280px] bg-cc-card border border-cc-border rounded-xl shadow-2xl p-5 animate-[menu-appear_150ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-red-400">
                  <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM6 2h4v1H6V2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Text */}
            <h3 className="text-[13px] font-semibold text-cc-fg text-center">
              {confirmDeleteAll ? "Delete all archived?" : "Delete session?"}
            </h3>
            <p className="text-[12px] text-cc-muted text-center mt-1.5 leading-relaxed">
              {confirmDeleteAll
                ? `This will permanently delete ${archivedSessions.length} archived session${archivedSessions.length === 1 ? "" : "s"}. This cannot be undone.`
                : "This will permanently delete this session and its history. This cannot be undone."}
            </p>

            {/* Actions */}
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={confirmDeleteAll ? cancelDeleteAll : cancelDelete}
                className="flex-1 px-3 py-2 text-[12px] font-medium rounded-lg bg-cc-hover text-cc-muted hover:text-cc-fg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAll ? confirmDeleteAllArchived : confirmDelete}
                className="flex-1 px-3 py-2 text-[12px] font-medium rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                {confirmDeleteAll ? "Delete all" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
