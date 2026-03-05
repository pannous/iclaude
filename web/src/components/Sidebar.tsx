import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStore } from "../store.js";
// LOCAL: keep ResumableSession import + disconnectAllExcept/waitForConnection for resume session flow
import { api, type ResumableSession, type ArchiveInfo } from "../api.js";
import { ArchiveLinearModal, type LinearTransitionChoice } from "./ArchiveLinearModal.js";
import { connectSession, disconnectSession, disconnectAllExcept, waitForConnection } from "../ws.js";
import { navigateToSession, navigateHome, parseHash } from "../utils/routing.js";
import { ProjectGroup } from "./ProjectGroup.js";
import { SessionItem } from "./SessionItem.js";
import { ThemeToggle } from "./TopBar.js";
import { groupSessionsByProject, type SessionItem as SessionItemType } from "../utils/project-grouping.js";

// LOCAL: spam filter patterns shared across active and resumable session lists
const SPAM_LABEL_PATTERNS = [/secret/i, /tell me the secret/i, /whats the secret/i];
const SPAM_CWD_PATTERNS = [/test_project/i];

function isSpamSession(label: string | undefined, cwd: string | undefined): boolean {
  if (label && SPAM_LABEL_PATTERNS.some((re) => re.test(label))) return true;
  if (cwd && SPAM_CWD_PATTERNS.some((re) => re.test(cwd))) return true;
  return false;
}

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
  shortLabel?: string;
  hash: string;
  viewBox: string;
  iconPath: string;
  activePages?: string[];
  fillRule?: "evenodd";
  clipRule?: "evenodd";
}

interface ExternalLink {
  label: string;
  url: string;
  viewBox: string;
  iconPath: string;
}

const EXTERNAL_LINKS: ExternalLink[] = [
  {
    label: "Documentation",
    url: "https://docs.thecompanion.sh",
    viewBox: "0 0 16 16",
    iconPath: "M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 000 2.5v11a.5.5 0 00.707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 00.78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0016 13.5v-11a.5.5 0 00-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z",
  },
  {
    label: "GitHub",
    url: "https://github.com/The-Vibe-Company/companion",
    viewBox: "0 0 16 16",
    iconPath: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z",
  },
  {
    label: "Website",
    url: "https://thecompanion.sh",
    viewBox: "0 0 16 16",
    iconPath: "M0 8a8 8 0 1116 0A8 8 0 010 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 005.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 01.64-1.539 6.7 6.7 0 01.597-.933A7.025 7.025 0 002.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 00-.656 2.5h2.49zM4.847 5a12.5 12.5 0 00-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 00-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 00.337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 01-.597-.933A9.268 9.268 0 014.09 12H2.255a7.024 7.024 0 003.072 2.472zM3.82 11a13.652 13.652 0 01-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0013.745 12H11.91a9.27 9.27 0 01-.64 1.539 6.688 6.688 0 01-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 01-.312 2.5zm2.802-3.5a6.959 6.959 0 00-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 00-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 00-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z",
  },
];

const NAV_ITEMS: NavItem[] = [
  {
    id: "prompts",
    label: "Prompts",
    hash: "#/prompts",
    viewBox: "0 0 16 16",
    iconPath: "M3 2.5A1.5 1.5 0 014.5 1h5.879c.398 0 .779.158 1.06.44l1.621 1.62c.281.282.44.663.44 1.061V13.5A1.5 1.5 0 0112 15H4.5A1.5 1.5 0 013 13.5v-11zM4.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5H12a.5.5 0 00.5-.5V4.121a.5.5 0 00-.146-.353l-1.621-1.621A.5.5 0 0010.379 2H4.5zm1.25 4.25a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5H6.5a.75.75 0 01-.75-.75z",
  },
  {
    id: "integrations",
    label: "Integrations",
    hash: "#/integrations",
    activePages: ["integrations", "integration-linear"],
    viewBox: "0 0 16 16",
    iconPath: "M2.5 3A1.5 1.5 0 001 4.5v2A1.5 1.5 0 002.5 8h2A1.5 1.5 0 006 6.5v-2A1.5 1.5 0 004.5 3h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zm9 0A1.5 1.5 0 0010 5.5v2A1.5 1.5 0 0011.5 9h2A1.5 1.5 0 0015 7.5v-2A1.5 1.5 0 0013.5 4h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zM2.5 10A1.5 1.5 0 001 11.5v2A1.5 1.5 0 002.5 15h2A1.5 1.5 0 006 13.5v-2A1.5 1.5 0 004.5 10h-2zm0 1h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2a.5.5 0 01.5-.5zM8.5 12a.5.5 0 100 1h5a.5.5 0 100-1h-5zm0-2a.5.5 0 100 1h2a.5.5 0 100-1h-2z",
  },
  {
    id: "terminal",
    label: "Terminal",
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
    hash: "#/environments",
    viewBox: "0 0 16 16",
    iconPath: "M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z",
    activePages: ["environments", "docker-builder"],
  },
  {
    id: "agents",
    label: "Agents",
    hash: "#/agents",
    activePages: ["agents", "agent-detail"],
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
    id: "runs",
    label: "Runs",
    hash: "#/runs",
    viewBox: "0 0 16 16",
    iconPath: "M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5a.75.75 0 011.5 0v3.19l2.03 2.03a.75.75 0 01-1.06 1.06l-2.25-2.25A.75.75 0 017.25 8V4.5z",
  },
  {
    id: "settings",
    label: "Settings",
    hash: "#/settings",
    viewBox: "0 0 20 20",
    iconPath: "M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.35-.8-2.92.77-2.12 2.12.54.9.07 2.04-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.39.95 2.29-.8 1.35.77 2.92 2.12 2.12.9-.54 2.04-.07 2.29.95.38 1.56 2.6 1.56 2.98 0 .25-1.02 1.39-1.49 2.29-.95 1.35.8 2.92-.77 2.12-2.12-.54-.9-.07-2.04.95-2.29 1.56-.38 1.56-2.6 0-2.98-1.02-.25-1.49-1.39-.95-2.29.8-1.35-.77-2.92-2.12-2.12-.9.54-2.04.07-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z",
    fillRule: "evenodd",
    clipRule: "evenodd",
  },
];

// LOCAL: flat nav list instead of upstream's Workbench/Workspace sections — we prefer a simple vertical list

export function Sidebar() {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showResumePicker, setShowResumePicker] = useState(false);
  const [resumableSessions, setResumableSessions] = useState<ResumableSession[]>([]);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [allResumable, setAllResumable] = useState<ResumableSession[]>([]);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [archiveModalSessionId, setArchiveModalSessionId] = useState<string | null>(null);
  const [archiveModalInfo, setArchiveModalInfo] = useState<ArchiveInfo | null>(null);
  const [archiveModalContainerized, setArchiveModalContainerized] = useState(false);
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
  const linkedLinearIssues = useStore((s) => s.linkedLinearIssues);
  const collapsedProjects = useStore((s) => s.collapsedProjects);
  const toggleProjectCollapse = useStore((s) => s.toggleProjectCollapse);
  const setAllProjectsCollapsed = useStore((s) => s.setAllProjectsCollapsed);
  const route = parseHash(hash);

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
    // Sync focusedFolder so panels (e.g. git-log) update to show this session's project
    const bridgeState = sessions.get(sessionId);
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const cwd = bridgeState?.cwd || sdkInfo?.cwd || "";
    if (cwd) useStore.getState().setFocusedFolder(cwd);
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
      const cleanTag = (t: string) => t.replace(/<[^>]*>/g, "").trim();
      setResumableSessions(
        list
          .filter((rs) => !activeCliIds.has(rs.sessionId))
          .map((rs) => ({ ...rs, title: cleanTag(rs.title || "") || rs.title }))
          .filter((rs) => !isSpamSession(rs.title, rs.project))
      );
    } catch {
      setResumableSessions([]);
    }
    setResumeLoading(false);
  }

  async function handleResumeSession(rs: ResumableSession) {
    setResumingId(rs.sessionId);
    const name = rs.title.slice(0, 40) || rs.sessionId.slice(0, 8);
    const tempId = `resuming-${rs.sessionId}`;
    const stub = { sessionId: tempId, cwd: rs.project, title: rs.title || name, state: "starting" as const, createdAt: Date.now(), backendType: "claude" as const };

    // Immediately move from resume list → folder list using a temp ID so the
    // transition feels instant. Replaced with the real session ID once createSession returns.
    const { sdkSessions, setSdkSessions, setSessionName } = useStore.getState();
    setSdkSessions([...sdkSessions, stub]);
    setSessionName(tempId, name);
    setResumableSessions((prev) => prev.filter((s) => s.sessionId !== rs.sessionId));
    setShowResumePicker(false);
    if (window.innerWidth < 768) useStore.getState().setSidebarOpen(false);

    try {
      if (currentSessionId) disconnectSession(currentSessionId);
      const result = await api.createSession({ cwd: rs.project, resumeSessionId: rs.sessionId });
      const sessionId = result.sessionId;

      // Swap temp stub for the real session
      const s = useStore.getState();
      s.setSdkSessions([...s.sdkSessions.filter((x) => x.sessionId !== tempId), { ...stub, sessionId }]);
      s.setSessionName(sessionId, name);
      setCurrentSession(sessionId);
      connectSession(sessionId);
      await waitForConnection(sessionId);
    } catch (err) {
      console.error("Failed to resume session:", err);
      useStore.getState().setSdkSessions(useStore.getState().sdkSessions.filter((x) => x.sessionId !== tempId));
    }
    setResumingId(null);
  }

  // Eagerly load all resumable sessions for per-group resume buttons
  useEffect(() => {
    const cleanTag = (t: string) => t.replace(/<[^>]*>/g, "").trim();
    api.listResumableSessions()
      .then((list) => setAllResumable(
        list
          .map((rs) => ({ ...rs, title: cleanTag(rs.title || "") || rs.title }))
          .filter((rs) => !isSpamSession(rs.title, rs.project))
      ))
      .catch(() => {});
  }, []);

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

  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    doDelete(sessionId);
  }, [doDelete]);

  const clearAllArchived = useCallback(async () => {
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

  const cancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (confirmDeleteId) {
      doDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, doDelete]);

  const confirmDeleteAllArchived = useCallback(async () => {
    setConfirmDeleteAll(false);
    await clearAllArchived();
  }, [clearAllArchived]);

  const handleArchiveSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const sdkInfo = sdkSessions.find((s) => s.sessionId === sessionId);
    const bridgeState = sessions.get(sessionId);
    const isContainerized = bridgeState?.is_containerized || !!sdkInfo?.containerId || false;

    // Check if session has a linked non-done Linear issue
    const linkedIssue = linkedLinearIssues.get(sessionId);
    const stateType = (linkedIssue?.stateType || "").toLowerCase();
    const isIssueDone = stateType === "completed" || stateType === "canceled" || stateType === "cancelled";

    if (linkedIssue && !isIssueDone) {
      // Fetch archive info (backlog availability, configured transition state)
      try {
        const info = await api.getArchiveInfo(sessionId);
        if (info.issueNotDone) {
          setArchiveModalSessionId(sessionId);
          setArchiveModalInfo(info);
          setArchiveModalContainerized(isContainerized);
          return;
        }
      } catch {
        // Fall through to normal archive flow on error
      }
    }

    // No linked non-done issue — use existing container-only confirmation or direct archive
    if (isContainerized) {
      setConfirmArchiveId(sessionId);
      return;
    }
    doArchive(sessionId);
  }, [sdkSessions, sessions, linkedLinearIssues]);

  // LOCAL: pre-disconnect state cleanup so scheduleReconnect skips archived sessions
  const doArchive = useCallback(async (sessionId: string, force?: boolean, linearTransition?: LinearTransitionChoice) => {
    const store = useStore.getState();
    // Mark archived in sdkSessions BEFORE disconnect so scheduleReconnect skips it
    store.setSdkSessions(
      store.sdkSessions.map((s) =>
        s.sessionId === sessionId ? { ...s, archived: true } : s
      )
    );
    // Remove from WsBridge sessions map so bridge-only sessions (no sdkInfo) disappear
    if (store.sessions.has(sessionId)) {
      store.removeSession(sessionId);
    }
    disconnectSession(sessionId);
    if (store.currentSessionId === sessionId) {
      store.newSession();
    }
    try {
      const opts: { force?: boolean; linearTransition?: LinearTransitionChoice } = {};
      if (force) opts.force = true;
      if (linearTransition && linearTransition !== "none") opts.linearTransition = linearTransition;
      await api.archiveSession(sessionId, Object.keys(opts).length > 0 ? opts : undefined);
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

  const handleArchiveModalConfirm = useCallback((choice: LinearTransitionChoice, force?: boolean) => {
    if (archiveModalSessionId) {
      doArchive(archiveModalSessionId, force, choice);
      setArchiveModalSessionId(null);
      setArchiveModalInfo(null);
    }
  }, [archiveModalSessionId, doArchive]);

  const handleArchiveModalCancel = useCallback(() => {
    setArchiveModalSessionId(null);
    setArchiveModalInfo(null);
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
      isFork: sdkInfo?.forkSession === true,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);

  // LOCAL: filter out ghost sessions and spam — upstream has no such filter
  const validSessions = allSessionList.filter((s) => {
    if (!s.cwd && !s.title) return false;
    const name = sessionNames.get(s.id);
    const label = (s.title?.replace(/<[^>]*>/g, "").trim() || undefined) || name;
    if (!label || label === s.model) return false;
    if (isSpamSession(label, s.cwd)) return false;
    if (name && isSpamSession(name, undefined)) return false;
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
  const prevAgentCountRef = useRef(agentSessions.length);
  useEffect(() => {
    if (agentSessions.length > prevAgentCountRef.current) setShowAgentSessions(true);
    prevAgentCountRef.current = agentSessions.length;
  }, [agentSessions.length]);

  const projectGroups = useMemo(
    () => groupSessionsByProject(activeSessions),
    [activeSessions],
  );

  // Per-group resumable sessions: exact match or subdirectory (path boundary)
  const resumableByGroup = useMemo(() => {
    return new Map(projectGroups.map((g) => [
      g.key,
      allResumable.filter((rs) =>
        rs.project === g.key || rs.project.startsWith(g.key + "/")
      ).slice(0, 16),
    ]));
  }, [allResumable, projectGroups]);

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
    for (const id of ids) {
      if (store.sessions.has(id)) store.removeSession(id);
      disconnectSession(id);
    }
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
                  const projectName = rs.project.split("/").filter(Boolean).pop() || rs.project;
                  const ago = formatTimeAgo(rs.lastModified);
                  const isResuming = resumingId === rs.sessionId;
                  // Strip [agent:type-slug Agent Name] prefix injected into agent session titles
                  const displayTitle = rs.title?.replace(/^\[agent:[^\]]+\]\s*/, "").trim() || rs.sessionId.slice(0, 12);
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
                            {isResuming ? "Resuming..." : displayTitle}
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
                    const allCollapsed = allKeys.every((k) => collapsedProjects.has(k)) && !showArchived;
                    setAllProjectsCollapsed(allKeys, !allCollapsed);
                    setShowArchived(allCollapsed);
                  }}
                  className="px-1.5 py-0.5 text-[10px] text-cc-muted hover:text-cc-fg transition-colors cursor-pointer rounded hover:bg-cc-hover"
                  title={projectGroups.every((g) => collapsedProjects.has(g.key)) && !showArchived ? "Expand all groups" : "Collapse all groups"}
                >
                  {projectGroups.every((g) => collapsedProjects.has(g.key)) && !showArchived ? "Expand all" : "Collapse all"}
                </button>
              </div>
            )}
            {projectGroups.map((group, i) => (
              <ProjectGroup
                key={group.key}
                group={group}
                isCollapsed={collapsedProjects.has(group.key)}
                onToggleCollapse={toggleProjectCollapse}
                onFolderClick={handleNewSessionInFolder}
                currentSessionId={currentSessionId}
                sessionNames={sessionNames}
                pendingPermissions={pendingPermissions}
                recentlyRenamed={recentlyRenamed}
                onArchiveGroup={handleArchiveGroup}
                onNewSessionInFolder={handleNewSessionInFolder}
                groupResumableSessions={resumableByGroup.get(group.key) ?? []}
                onResumeSession={handleResumeSession}
                resumingId={resumingId}
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
                  {archivedSessions.length > 0 && (
                    <button
                      onClick={clearAllArchived}
                      className="px-2 py-1 mr-1 text-[10px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover rounded-md transition-colors cursor-pointer"
                      title="Clear all archived sessions (resumable via Resume button)"
                    >
                      Clear all
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
      {/* LOCAL: flat nav list instead of upstream's Workbench/Workspace grouped sections */}
      <div className="px-2 py-1.5 pb-safe bg-cc-sidebar-footer">
        <nav className="flex flex-col gap-0.5" aria-label="Navigation">
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
                className={`flex items-center gap-2.5 px-2.5 py-1.5 min-h-[44px] rounded-md text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? "bg-cc-active text-cc-fg"
                    : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
                }`}
              >
                <svg viewBox={item.viewBox} fill="currentColor" className="w-4 h-4 shrink-0">
                  <path d={item.iconPath} fillRule={item.fillRule} clipRule={item.clipRule} />
                </svg>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-1.5 rounded-lg border border-cc-border/30 bg-cc-card/20 px-1.5 py-0.5">
          <div className="flex items-center justify-between">
            <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cc-muted/75">
              Resources
            </span>
            <div className="flex items-center gap-1">
              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  aria-label={`Open ${link.label.toLowerCase()}`}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors"
                >
                  <svg viewBox={link.viewBox} fill="currentColor" className="w-3.5 h-3.5">
                    <path d={link.iconPath} />
                  </svg>
                </a>
              ))}
              {/* LOCAL: theme toggle in resources bar */}
              <ThemeToggle />
            </div>
          </div>
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
      {/* Archive Linear transition modal */}
      {archiveModalSessionId && archiveModalInfo && (
        <ArchiveLinearModal
          issueIdentifier={archiveModalInfo.issue?.identifier || ""}
          issueStateName={archiveModalInfo.issue?.stateName || ""}
          isContainerized={archiveModalContainerized}
          archiveTransitionConfigured={archiveModalInfo.archiveTransitionConfigured || false}
          archiveTransitionStateName={archiveModalInfo.archiveTransitionStateName}
          hasBacklogState={archiveModalInfo.hasBacklogState || false}
          onConfirm={handleArchiveModalConfirm}
          onCancel={handleArchiveModalCancel}
        />
      )}
    </aside>
  );
}
