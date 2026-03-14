import type { StateCreator } from "zustand";
import type { AppState } from "./index.js";
import type { SessionState, SdkSessionInfo, McpServerDetail } from "../types.js";
import type { PRStatusResponse, LinearIssue } from "../api.js";
import { safeStorage } from "../utils/safe-storage.js";
import { setInMap, deleteFromMap, addToSet, deleteFromSet } from "./utils.js";

function getInitialSessionNames(): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    return new Map(JSON.parse(safeStorage.getItem("cc-session-names") || "[]"));
  } catch {
    return new Map();
  }
}

function getInitialSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return safeStorage.getItem("cc-current-session") || null;
}

function getInitialCollapsedProjects(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(safeStorage.getItem("cc-collapsed-projects") || "[]"));
  } catch {
    return new Set();
  }
}

export interface SessionsSlice {
  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;
  connectionStatus: Map<string, "connecting" | "connected" | "disconnected">;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  previousPermissionMode: Map<string, string>;
  sessionNames: Map<string, string>;
  sessionSubtitles: Map<string, string>;
  recentlyRenamed: Set<string>;
  prStatus: Map<string, PRStatusResponse>;
  linkedLinearIssues: Map<string, LinearIssue>;
  mcpServers: Map<string, McpServerDetail[]>;
  collapsedProjects: Set<string>;
  queuedMessageIds: Map<string, Set<string>>;
  archivedSubagentSessions: Set<string>;

  setCurrentSession: (id: string | null) => void;
  addSession: (session: SessionState) => void;
  updateSession: (sessionId: string, updates: Partial<SessionState>) => void;
  removeSession: (sessionId: string) => void;
  setSdkSessions: (sessions: SdkSessionInfo[]) => void;
  setConnectionStatus: (sessionId: string, status: "connecting" | "connected" | "disconnected") => void;
  setCliConnected: (sessionId: string, connected: boolean) => void;
  setSessionStatus: (sessionId: string, status: "idle" | "running" | "compacting" | null) => void;
  setPreviousPermissionMode: (sessionId: string, mode: string) => void;
  setSessionName: (sessionId: string, name: string) => void;
  setSessionSubtitle: (sessionId: string, subtitle: string) => void;
  markRecentlyRenamed: (sessionId: string) => void;
  clearRecentlyRenamed: (sessionId: string) => void;
  setPRStatus: (sessionId: string, status: PRStatusResponse) => void;
  setLinkedLinearIssue: (sessionId: string, issue: LinearIssue | null) => void;
  setMcpServers: (sessionId: string, servers: McpServerDetail[]) => void;
  toggleProjectCollapse: (projectKey: string) => void;
  setAllProjectsCollapsed: (projectKeys: string[], collapsed: boolean) => void;
  setSessionAiValidation: (sessionId: string, settings: { aiValidationEnabled?: boolean | null; aiValidationAutoApprove?: boolean | null; aiValidationAutoDeny?: boolean | null }) => void;
  markMessageQueued: (sessionId: string, msgId: string) => void;
  unmarkMessageQueued: (sessionId: string, msgId: string) => void;
  archiveSubagents: (sessionId: string) => void;
  unarchiveSubagents: (sessionId: string) => void;
}

export const createSessionsSlice: StateCreator<AppState, [], [], SessionsSlice> = (set) => ({
  sessions: new Map(),
  sdkSessions: [],
  currentSessionId: getInitialSessionId(),
  connectionStatus: new Map(),
  cliConnected: new Map(),
  sessionStatus: new Map(),
  previousPermissionMode: new Map(),
  sessionNames: getInitialSessionNames(),
  sessionSubtitles: new Map(),
  recentlyRenamed: new Set(),
  prStatus: new Map(),
  linkedLinearIssues: new Map(),
  mcpServers: new Map(),
  collapsedProjects: getInitialCollapsedProjects(),
  queuedMessageIds: new Map<string, Set<string>>(),
  archivedSubagentSessions: new Set<string>(),

  setCurrentSession: (id) => {
    if (id) {
      safeStorage.setItem("cc-current-session", id);
    } else {
      safeStorage.removeItem("cc-current-session");
    }
    set((s) => ({
      currentSessionId: id,
      activeTab: s.activeTab === "editor" ? "chat" : s.activeTab,
    }));
  },

  addSession: (session) =>
    set((s) => ({
      sessions: setInMap(s.sessions, session.session_id, session),
      // Cross-slice write: initialize the messages entry (owned by ChatSlice)
      // atomically with the session so consumers always find a messages array.
      messages: s.messages.has(session.session_id) ? s.messages : setInMap(s.messages, session.session_id, []),
    })),

  updateSession: (sessionId, updates) =>
    set((s) => {
      const existing = s.sessions.get(sessionId);
      return existing ? { sessions: setInMap(s.sessions, sessionId, { ...existing, ...updates }) } : s;
    }),

  removeSession: (sessionId) =>
    set((s) => {
      const sessionNames = deleteFromMap(s.sessionNames, sessionId);
      safeStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
      if (s.currentSessionId === sessionId) {
        safeStorage.removeItem("cc-current-session");
      }
      return {
        // Sessions slice fields
        sessions: deleteFromMap(s.sessions, sessionId),
        connectionStatus: deleteFromMap(s.connectionStatus, sessionId),
        cliConnected: deleteFromMap(s.cliConnected, sessionId),
        sessionStatus: deleteFromMap(s.sessionStatus, sessionId),
        previousPermissionMode: deleteFromMap(s.previousPermissionMode, sessionId),
        sessionNames,
        recentlyRenamed: deleteFromSet(s.recentlyRenamed, sessionId),
        mcpServers: deleteFromMap(s.mcpServers, sessionId),
        prStatus: deleteFromMap(s.prStatus, sessionId),
        linkedLinearIssues: deleteFromMap(s.linkedLinearIssues, sessionId),
        sdkSessions: s.sdkSessions.filter((sdk) => sdk.sessionId !== sessionId),
        currentSessionId: s.currentSessionId === sessionId ? null : s.currentSessionId,
        // Chat slice fields
        messages: deleteFromMap(s.messages, sessionId),
        streaming: deleteFromMap(s.streaming, sessionId),
        streamingStartedAt: deleteFromMap(s.streamingStartedAt, sessionId),
        streamingOutputTokens: deleteFromMap(s.streamingOutputTokens, sessionId),
        // Permissions slice fields
        pendingPermissions: deleteFromMap(s.pendingPermissions, sessionId),
        aiResolvedPermissions: deleteFromMap(s.aiResolvedPermissions, sessionId),
        // Tasks slice fields
        sessionTasks: deleteFromMap(s.sessionTasks, sessionId),
        changedFilesTick: deleteFromMap(s.changedFilesTick, sessionId),
        gitChangedFilesCount: deleteFromMap(s.gitChangedFilesCount, sessionId),
        sessionProcesses: deleteFromMap(s.sessionProcesses, sessionId),
        toolProgress: deleteFromMap(s.toolProgress, sessionId),
        // UI slice fields
        diffPanelSelectedFile: deleteFromMap(s.diffPanelSelectedFile, sessionId),
        chatTabReentryTickBySession: deleteFromMap(s.chatTabReentryTickBySession, sessionId),
        editorOpenFile: deleteFromMap(s.editorOpenFile, sessionId),
        editorUrl: deleteFromMap(s.editorUrl, sessionId),
        editorLoading: deleteFromMap(s.editorLoading, sessionId),
      };
    }),

  setSdkSessions: (sessions) => set((s) => {
    // Preserve titles from WebSocket updates that may not be in the polled data yet
    if (s.sdkSessions.length === 0) return { sdkSessions: sessions };
    const titleMap = new Map<string, string>();
    for (const prev of s.sdkSessions) {
      if (prev.title) titleMap.set(prev.sessionId, prev.title);
    }
    const merged = sessions.map((sess) =>
      sess.title || !titleMap.has(sess.sessionId)
        ? sess
        : { ...sess, title: titleMap.get(sess.sessionId) }
    );
    return { sdkSessions: merged };
  }),

  setConnectionStatus: (sessionId, status) =>
    set((s) => ({ connectionStatus: setInMap(s.connectionStatus, sessionId, status) })),

  setCliConnected: (sessionId, connected) =>
    set((s) => ({ cliConnected: setInMap(s.cliConnected, sessionId, connected) })),

  setSessionStatus: (sessionId, status) =>
    set((s) => ({ sessionStatus: setInMap(s.sessionStatus, sessionId, status) })),

  setPreviousPermissionMode: (sessionId, mode) =>
    set((s) => ({ previousPermissionMode: setInMap(s.previousPermissionMode, sessionId, mode) })),

  setSessionName: (sessionId, name) =>
    set((s) => {
      const sessionNames = setInMap(s.sessionNames, sessionId, name);
      safeStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
      return { sessionNames };
    }),

  setSessionSubtitle: (sessionId, subtitle) =>
    set((s) => ({ sessionSubtitles: setInMap(s.sessionSubtitles, sessionId, subtitle) })),

  markRecentlyRenamed: (sessionId) =>
    set((s) => ({ recentlyRenamed: addToSet(s.recentlyRenamed, sessionId) })),

  clearRecentlyRenamed: (sessionId) =>
    set((s) => ({ recentlyRenamed: deleteFromSet(s.recentlyRenamed, sessionId) })),

  setPRStatus: (sessionId, status) =>
    set((s) => ({ prStatus: setInMap(s.prStatus, sessionId, status) })),

  setLinkedLinearIssue: (sessionId, issue) =>
    set((s) => ({
      linkedLinearIssues: issue ? setInMap(s.linkedLinearIssues, sessionId, issue) : deleteFromMap(s.linkedLinearIssues, sessionId),
    })),

  setMcpServers: (sessionId, servers) =>
    set((s) => ({ mcpServers: setInMap(s.mcpServers, sessionId, servers) })),

  toggleProjectCollapse: (projectKey) =>
    set((s) => {
      const collapsedProjects = new Set(s.collapsedProjects);
      if (collapsedProjects.has(projectKey)) {
        collapsedProjects.delete(projectKey);
      } else {
        collapsedProjects.add(projectKey);
      }
      safeStorage.setItem("cc-collapsed-projects", JSON.stringify(Array.from(collapsedProjects)));
      return { collapsedProjects };
    }),

  setAllProjectsCollapsed: (projectKeys, collapsed) =>
    set(() => {
      const collapsedProjects = collapsed ? new Set(projectKeys) : new Set<string>();
      safeStorage.setItem("cc-collapsed-projects", JSON.stringify(Array.from(collapsedProjects)));
      return { collapsedProjects };
    }),

  setSessionAiValidation: (sessionId, settings) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      const existing = sessions.get(sessionId);
      if (!existing) return {};
      sessions.set(sessionId, { ...existing, ...settings });
      return { sessions };
    }),

  markMessageQueued: (sessionId: string, msgId: string) =>
    set((s) => {
      const next = new Map(s.queuedMessageIds);
      const ids = new Set(next.get(sessionId) ?? []);
      ids.add(msgId);
      next.set(sessionId, ids);
      return { queuedMessageIds: next };
    }),

  unmarkMessageQueued: (sessionId: string, msgId: string) =>
    set((s) => {
      const next = new Map(s.queuedMessageIds);
      const ids = new Set(next.get(sessionId) ?? []);
      ids.delete(msgId);
      next.set(sessionId, ids);
      return { queuedMessageIds: next };
    }),

  archiveSubagents: (sessionId) =>
    set((s) => ({ archivedSubagentSessions: addToSet(s.archivedSubagentSessions, sessionId) })),

  unarchiveSubagents: (sessionId) =>
    set((s) => ({ archivedSubagentSessions: deleteFromSet(s.archivedSubagentSessions, sessionId) })),
});
