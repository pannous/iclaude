import { create } from "zustand";
import type { SessionState, PermissionRequest, ChatMessage, SdkSessionInfo, TaskItem, McpServerDetail } from "./types.js";
import type { UpdateInfo, PRStatusResponse, CreationProgressEvent, LinearIssue } from "./api.js";
import { safeStorage } from "./utils/safe-storage.js";
import { type TaskPanelConfig, getInitialTaskPanelConfig, getDefaultConfig, persistTaskPanelConfig, SECTION_DEFINITIONS } from "./components/task-panel-sections.js";

export interface QuickTerminalTab {
  id: string;
  label: string;
  cwd: string;
  containerId?: string;
}

export type QuickTerminalPlacement = "top" | "right" | "bottom" | "left";

export type DiffBase = "last-commit" | "default-branch";

interface AppState {
  // Sessions
  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;

  // Messages per session
  messages: Map<string, ChatMessage[]>;

  // Streaming partial text per session
  streaming: Map<string, string>;

  // Streaming stats: start time + output tokens
  streamingStartedAt: Map<string, number>;
  streamingOutputTokens: Map<string, number>;

  // Pending permissions per session (outer key = sessionId, inner key = request_id)
  pendingPermissions: Map<string, Map<string, PermissionRequest>>;

  // Connection state per session
  connectionStatus: Map<string, "connecting" | "connected" | "disconnected">;
  cliConnected: Map<string, boolean>;

  // Session status
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;

  // Plan mode: stores previous permission mode per session so we can restore it
  previousPermissionMode: Map<string, string>;

  // Tasks per session
  sessionTasks: Map<string, TaskItem[]>;

  // Files changed by the agent per session (Edit/Write tool calls)
  changedFiles: Map<string, Set<string>>;

  // Session display names
  sessionNames: Map<string, string>;
  sessionSubtitles: Map<string, string>;
  // Track sessions that were just renamed (for animation)
  recentlyRenamed: Set<string>;

  // PR status per session (pushed by server via WebSocket)
  prStatus: Map<string, PRStatusResponse>;

  // Linear issues linked to sessions
  linkedLinearIssues: Map<string, LinearIssue>;

  // MCP servers per session
  mcpServers: Map<string, McpServerDetail[]>;

  // Tool progress (session → tool_use_id → progress info)
  toolProgress: Map<string, Map<string, { toolName: string; elapsedSeconds: number }>>;

  // Sidebar project grouping
  collapsedProjects: Set<string>;

  // Diff panel
  diffPanelSelectedFile: Map<string, string>;

  // Update banner
  updateInfo: UpdateInfo | null;
  updateDismissedVersion: string | null;
  updateOverlayActive: boolean;

  // Session creation progress (SSE streaming)
  creationProgress: CreationProgressEvent[] | null;
  creationError: string | null;
  sessionCreating: boolean;
  sessionCreatingBackend: "claude" | "codex" | null;
  addCreationProgress: (step: CreationProgressEvent) => void;
  clearCreation: () => void;
  setSessionCreating: (creating: boolean, backend?: "claude" | "codex") => void;
  setCreationError: (error: string | null) => void;

  // UI
  darkMode: boolean;
  notificationSound: boolean;
  yoloMode: boolean;
  notificationDesktop: boolean;
  sidebarOpen: boolean;
  taskPanelOpen: boolean;
  taskPanelConfig: TaskPanelConfig;
  taskPanelConfigMode: boolean;
  homeResetKey: number;
  editorTabEnabled: boolean;
  newSessionCwd: string | null;
  activeTab: string; // "chat" | "diff" | "terminal" | "editor" | "skill:<slug>"
  openSkills: string[];
  editorOpenFile: Map<string, string>;
  editorUrl: Map<string, string>;
  editorLoading: Map<string, boolean>;
  editorUrls: Map<string, string>;
  chatTabReentryTickBySession: Map<string, number>;

  // File editor tab state (global, not per-session)
  editorFiles: string[]; // open file paths
  editorActiveFilePath: string | null;

  // Actions
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setNotificationSound: (v: boolean) => void;
  toggleNotificationSound: () => void;
  setYoloMode: (v: boolean) => void;
  toggleYoloMode: () => void;
  setNotificationDesktop: (v: boolean) => void;
  toggleNotificationDesktop: () => void;
  setSidebarOpen: (v: boolean) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setTaskPanelConfigMode: (open: boolean) => void;
  toggleSectionEnabled: (sectionId: string) => void;
  moveSectionUp: (sectionId: string) => void;
  moveSectionDown: (sectionId: string) => void;
  resetTaskPanelConfig: () => void;
  newSession: () => void;
  newSessionInFolder: (cwd: string) => void;

  // Session actions
  setCurrentSession: (id: string | null) => void;
  addSession: (session: SessionState) => void;
  updateSession: (sessionId: string, updates: Partial<SessionState>) => void;
  removeSession: (sessionId: string) => void;
  setSdkSessions: (sessions: SdkSessionInfo[]) => void;

  // Message actions
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void;
  updateLastAssistantMessage: (sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  setStreaming: (sessionId: string, text: string | null) => void;
  setStreamingStats: (sessionId: string, stats: { startedAt?: number; outputTokens?: number } | null) => void;

  // Permission actions
  addPermission: (sessionId: string, perm: PermissionRequest) => void;
  removePermission: (sessionId: string, requestId: string) => void;

  // Task actions
  addTask: (sessionId: string, task: TaskItem) => void;
  setTasks: (sessionId: string, tasks: TaskItem[]) => void;
  updateTask: (sessionId: string, taskId: string, updates: Partial<TaskItem>) => void;

  // Changed files actions
  addChangedFile: (sessionId: string, filePath: string) => void;
  clearChangedFiles: (sessionId: string) => void;

  // Session name actions
  setSessionName: (sessionId: string, name: string) => void;
  setSessionSubtitle: (sessionId: string, subtitle: string) => void;
  markRecentlyRenamed: (sessionId: string) => void;
  clearRecentlyRenamed: (sessionId: string) => void;

  // PR status action
  setPRStatus: (sessionId: string, status: PRStatusResponse) => void;

  // Linear issue actions
  setLinkedLinearIssue: (sessionId: string, issue: LinearIssue | null) => void;

  // MCP actions
  setMcpServers: (sessionId: string, servers: McpServerDetail[]) => void;

  // Tool progress actions
  setToolProgress: (sessionId: string, toolUseId: string, data: { toolName: string; elapsedSeconds: number }) => void;
  clearToolProgress: (sessionId: string, toolUseId?: string) => void;

  // Sidebar project grouping actions
  toggleProjectCollapse: (projectKey: string) => void;
  setAllProjectsCollapsed: (projectKeys: string[], collapsed: boolean) => void;

  // Plan mode actions
  setPreviousPermissionMode: (sessionId: string, mode: string) => void;

  // Connection actions
  setConnectionStatus: (sessionId: string, status: "connecting" | "connected" | "disconnected") => void;
  setCliConnected: (sessionId: string, connected: boolean) => void;
  setSessionStatus: (sessionId: string, status: "idle" | "running" | "compacting" | null) => void;

  // Diff panel actions
  setDiffPanelSelectedFile: (sessionId: string, filePath: string) => void;

  // Update banner actions
  setUpdateInfo: (info: UpdateInfo | null) => void;
  dismissUpdate: (version: string) => void;
  setUpdateOverlayActive: (active: boolean) => void;
  setEditorTabEnabled: (enabled: boolean) => void;

  // Editor / Skill actions
  setActiveTab: (tab: string) => void;
  markChatTabReentry: (sessionId: string) => void;
  openSkill: (slug: string) => void;
  closeSkill: (slug: string) => void;
  setEditorOpenFile: (sessionId: string, filePath: string | null) => void;
  setEditorUrl: (sessionId: string, url: string) => void;
  setEditorLoading: (sessionId: string, loading: boolean) => void;

  // File editor tab actions
  openFileInEditor: (filePath: string) => void;
  closeEditorFile: (filePath: string) => void;
  setEditorActiveFilePath: (filePath: string | null) => void;

  // Session quick terminal (docked in session workspace)
  quickTerminalOpen: boolean;
  quickTerminalTabs: QuickTerminalTab[];
  activeQuickTerminalTabId: string | null;
  quickTerminalPlacement: QuickTerminalPlacement;
  quickTerminalNextHostIndex: number;
  quickTerminalNextDockerIndex: number;

  // Diff settings
  diffBase: DiffBase;

  // Session quick terminal actions
  setQuickTerminalOpen: (open: boolean) => void;
  openQuickTerminal: (opts: { target: "host" | "docker"; cwd: string; containerId?: string; reuseIfExists?: boolean }) => void;
  closeQuickTerminalTab: (tabId: string) => void;
  setActiveQuickTerminalTabId: (tabId: string | null) => void;
  setQuickTerminalPlacement: (placement: QuickTerminalPlacement) => void;
  resetQuickTerminal: () => void;

  // Diff settings actions
  setDiffBase: (base: DiffBase) => void;

  // Terminal state
  terminalOpen: boolean;
  terminalCwd: string | null;
  terminalId: string | null;

  // Terminal actions
  setTerminalOpen: (open: boolean) => void;
  setTerminalCwd: (cwd: string | null) => void;
  setTerminalId: (id: string | null) => void;
  openTerminal: (cwd: string) => void;
  closeTerminal: () => void;

  reset: () => void;
}

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

function getInitialDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  const stored = safeStorage.getItem("cc-dark-mode");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getInitialNotificationSound(): boolean {
  if (typeof window === "undefined") return true;
  const stored = safeStorage.getItem("cc-notification-sound");
  if (stored !== null) return stored === "true";
  return true;
}

function getInitialYoloMode(): boolean {
  if (typeof window === "undefined") return true;
  const stored = safeStorage.getItem("cc-yolo-mode");
  if (stored !== null) return stored === "true";
  return true;
}

function getInitialNotificationDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const stored = safeStorage.getItem("cc-notification-desktop");
  if (stored !== null) return stored === "true";
  return false;
}

function getInitialDismissedVersion(): string | null {
  if (typeof window === "undefined") return null;
  return safeStorage.getItem("cc-update-dismissed") || null;
}

function getInitialCollapsedProjects(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(safeStorage.getItem("cc-collapsed-projects") || "[]"));
  } catch {
    return new Set();
  }
}

function getInitialQuickTerminalPlacement(): QuickTerminalPlacement {
  if (typeof window === "undefined") return "bottom";
  const stored = safeStorage.getItem("cc-terminal-placement");
  if (stored === "top" || stored === "right" || stored === "bottom" || stored === "left") return stored;
  return "bottom";
}

function getInitialDiffBase(): DiffBase {
  if (typeof window === "undefined") return "last-commit";
  const stored = safeStorage.getItem("cc-diff-base");
  if (stored === "last-commit" || stored === "default-branch") return stored;
  return "last-commit";
}

export const useStore = create<AppState>((set) => ({
  sessions: new Map(),
  sdkSessions: [],
  currentSessionId: getInitialSessionId(),
  messages: new Map(),
  streaming: new Map(),
  streamingStartedAt: new Map(),
  streamingOutputTokens: new Map(),
  pendingPermissions: new Map(),
  connectionStatus: new Map(),
  cliConnected: new Map(),
  sessionStatus: new Map(),
  previousPermissionMode: new Map(),
  sessionTasks: new Map(),
  changedFiles: new Map(),
  diffPanelSelectedFile: new Map(),
  sessionNames: getInitialSessionNames(),
  sessionSubtitles: new Map(),
  recentlyRenamed: new Set(),
  prStatus: new Map(),
  linkedLinearIssues: new Map(),
  mcpServers: new Map(),
  toolProgress: new Map(),
  collapsedProjects: getInitialCollapsedProjects(),
  creationProgress: null,
  creationError: null,
  sessionCreating: false,
  sessionCreatingBackend: null,
  updateInfo: null,
  updateDismissedVersion: getInitialDismissedVersion(),
  updateOverlayActive: false,
  darkMode: getInitialDarkMode(),
  notificationSound: getInitialNotificationSound(),
  yoloMode: getInitialYoloMode(),
  notificationDesktop: getInitialNotificationDesktop(),
  sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  taskPanelOpen: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  taskPanelConfig: getInitialTaskPanelConfig(),
  taskPanelConfigMode: false,
  homeResetKey: 0,
  editorTabEnabled: false,
  newSessionCwd: null,
  activeTab: "chat",
  openSkills: [],
  editorOpenFile: new Map(),
  editorUrl: new Map(),
  editorLoading: new Map(),
  editorUrls: new Map(),
  chatTabReentryTickBySession: new Map(),
  editorFiles: [],
  editorActiveFilePath: null,
  quickTerminalOpen: false,
  quickTerminalTabs: [],
  activeQuickTerminalTabId: null,
  quickTerminalPlacement: getInitialQuickTerminalPlacement(),
  quickTerminalNextHostIndex: 1,
  quickTerminalNextDockerIndex: 1,
  diffBase: getInitialDiffBase(),
  terminalOpen: false,
  terminalCwd: null,
  terminalId: null,

  addCreationProgress: (step) => set((state) => {
    const existing = state.creationProgress || [];
    const idx = existing.findIndex((s) => s.step === step.step);
    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = step;
      return { creationProgress: updated };
    }
    return { creationProgress: [...existing, step] };
  }),
  clearCreation: () => set({ creationProgress: null, creationError: null, sessionCreating: false, sessionCreatingBackend: null }),
  setSessionCreating: (creating, backend) => set({ sessionCreating: creating, sessionCreatingBackend: backend ?? null }),
  setCreationError: (error) => set({ creationError: error }),

  setDarkMode: (v) => {
    safeStorage.setItem("cc-dark-mode", String(v));
    set({ darkMode: v });
  },
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      safeStorage.setItem("cc-dark-mode", String(next));
      return { darkMode: next };
    }),
  setNotificationSound: (v) => {
    safeStorage.setItem("cc-notification-sound", String(v));
    set({ notificationSound: v });
  },
  toggleNotificationSound: () =>
    set((s) => {
      const next = !s.notificationSound;
      safeStorage.setItem("cc-notification-sound", String(next));
      return { notificationSound: next };
    }),
  setYoloMode: (v) => {
    safeStorage.setItem("cc-yolo-mode", String(v));
    set({ yoloMode: v });
  },
  toggleYoloMode: () =>
    set((s) => {
      const next = !s.yoloMode;
      safeStorage.setItem("cc-yolo-mode", String(next));
      return { yoloMode: next };
    }),
  setNotificationDesktop: (v) => {
    safeStorage.setItem("cc-notification-desktop", String(v));
    set({ notificationDesktop: v });
  },
  toggleNotificationDesktop: () =>
    set((s) => {
      const next = !s.notificationDesktop;
      safeStorage.setItem("cc-notification-desktop", String(next));
      return { notificationDesktop: next };
    }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTaskPanelOpen: (open) => set({ taskPanelOpen: open }),
  setTaskPanelConfigMode: (open) => set({ taskPanelConfigMode: open }),
  toggleSectionEnabled: (sectionId) =>
    set((s) => {
      const config: TaskPanelConfig = {
        order: [...s.taskPanelConfig.order],
        enabled: { ...s.taskPanelConfig.enabled, [sectionId]: !s.taskPanelConfig.enabled[sectionId] },
      };
      persistTaskPanelConfig(config);
      return { taskPanelConfig: config };
    }),
  moveSectionUp: (sectionId) =>
    set((s) => {
      const order = [...s.taskPanelConfig.order];
      const idx = order.indexOf(sectionId);
      if (idx <= 0) return s;
      [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      const config: TaskPanelConfig = { ...s.taskPanelConfig, order };
      persistTaskPanelConfig(config);
      return { taskPanelConfig: config };
    }),
  moveSectionDown: (sectionId) =>
    set((s) => {
      const order = [...s.taskPanelConfig.order];
      const idx = order.indexOf(sectionId);
      if (idx < 0 || idx >= order.length - 1) return s;
      [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      const config: TaskPanelConfig = { ...s.taskPanelConfig, order };
      persistTaskPanelConfig(config);
      return { taskPanelConfig: config };
    }),
  resetTaskPanelConfig: () => {
    const config = getDefaultConfig();
    persistTaskPanelConfig(config);
    set({ taskPanelConfig: config });
  },
  newSession: () => {
    safeStorage.removeItem("cc-current-session");
    set((s) => ({ currentSessionId: null, homeResetKey: s.homeResetKey + 1 }));
  },
  newSessionInFolder: (cwd) => {
    safeStorage.removeItem("cc-current-session");
    set((s) => ({ currentSessionId: null, newSessionCwd: cwd, homeResetKey: s.homeResetKey + 1 }));
  },

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
    set((s) => {
      const sessions = new Map(s.sessions);
      sessions.set(session.session_id, session);
      const messages = new Map(s.messages);
      if (!messages.has(session.session_id)) messages.set(session.session_id, []);
      return { sessions, messages };
    }),

  updateSession: (sessionId, updates) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      const existing = sessions.get(sessionId);
      if (existing) sessions.set(sessionId, { ...existing, ...updates });
      return { sessions };
    }),

  removeSession: (sessionId) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      sessions.delete(sessionId);
      const messages = new Map(s.messages);
      messages.delete(sessionId);
      const streaming = new Map(s.streaming);
      streaming.delete(sessionId);
      const streamingStartedAt = new Map(s.streamingStartedAt);
      streamingStartedAt.delete(sessionId);
      const streamingOutputTokens = new Map(s.streamingOutputTokens);
      streamingOutputTokens.delete(sessionId);
      const connectionStatus = new Map(s.connectionStatus);
      connectionStatus.delete(sessionId);
      const cliConnected = new Map(s.cliConnected);
      cliConnected.delete(sessionId);
      const sessionStatus = new Map(s.sessionStatus);
      sessionStatus.delete(sessionId);
      const previousPermissionMode = new Map(s.previousPermissionMode);
      previousPermissionMode.delete(sessionId);
      const pendingPermissions = new Map(s.pendingPermissions);
      pendingPermissions.delete(sessionId);
      const sessionTasks = new Map(s.sessionTasks);
      sessionTasks.delete(sessionId);
      const changedFiles = new Map(s.changedFiles);
      changedFiles.delete(sessionId);
      const sessionNames = new Map(s.sessionNames);
      sessionNames.delete(sessionId);
      const recentlyRenamed = new Set(s.recentlyRenamed);
      recentlyRenamed.delete(sessionId);
      const editorOpenFile = new Map(s.editorOpenFile);
      editorOpenFile.delete(sessionId);
      const editorUrl = new Map(s.editorUrl);
      editorUrl.delete(sessionId);
      const editorLoading = new Map(s.editorLoading);
      editorLoading.delete(sessionId);
      const diffPanelSelectedFile = new Map(s.diffPanelSelectedFile);
      diffPanelSelectedFile.delete(sessionId);
      const mcpServers = new Map(s.mcpServers);
      mcpServers.delete(sessionId);
      const toolProgress = new Map(s.toolProgress);
      toolProgress.delete(sessionId);
      const prStatus = new Map(s.prStatus);
      prStatus.delete(sessionId);
      const linkedLinearIssues = new Map(s.linkedLinearIssues);
      linkedLinearIssues.delete(sessionId);
      safeStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
      if (s.currentSessionId === sessionId) {
        safeStorage.removeItem("cc-current-session");
      }
      return {
        sessions,
        messages,
        streaming,
        streamingStartedAt,
        streamingOutputTokens,
        connectionStatus,
        cliConnected,
        sessionStatus,
        previousPermissionMode,
        pendingPermissions,
        sessionTasks,
        changedFiles,
        diffPanelSelectedFile,
        sessionNames,
        recentlyRenamed,
        editorOpenFile,
        editorUrl,
        editorLoading,
        mcpServers,
        toolProgress,
        prStatus,
        linkedLinearIssues,
        sdkSessions: s.sdkSessions.filter((sdk) => sdk.sessionId !== sessionId),
        currentSessionId: s.currentSessionId === sessionId ? null : s.currentSessionId,
      };
    }),

  setSdkSessions: (sessions) => set({ sdkSessions: sessions }),

  appendMessage: (sessionId, msg) =>
    set((s) => {
      const existing = s.messages.get(sessionId) || [];
      // Deduplicate: skip if a message with same ID already exists
      if (msg.id && existing.some((m) => m.id === msg.id)) {
        return s;
      }
      const messages = new Map(s.messages);
      messages.set(sessionId, [...existing, msg]);
      return { messages };
    }),

  setMessages: (sessionId, msgs) =>
    set((s) => {
      const messages = new Map(s.messages);
      messages.set(sessionId, msgs);
      return { messages };
    }),

  updateLastAssistantMessage: (sessionId, updater) =>
    set((s) => {
      const messages = new Map(s.messages);
      const list = [...(messages.get(sessionId) || [])];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "assistant") {
          list[i] = updater(list[i]);
          break;
        }
      }
      messages.set(sessionId, list);
      return { messages };
    }),

  setStreaming: (sessionId, text) =>
    set((s) => {
      const streaming = new Map(s.streaming);
      if (text === null) {
        streaming.delete(sessionId);
      } else {
        streaming.set(sessionId, text);
      }
      return { streaming };
    }),

  setStreamingStats: (sessionId, stats) =>
    set((s) => {
      const streamingStartedAt = new Map(s.streamingStartedAt);
      const streamingOutputTokens = new Map(s.streamingOutputTokens);
      if (stats === null) {
        streamingStartedAt.delete(sessionId);
        streamingOutputTokens.delete(sessionId);
      } else {
        if (stats.startedAt !== undefined) streamingStartedAt.set(sessionId, stats.startedAt);
        if (stats.outputTokens !== undefined) streamingOutputTokens.set(sessionId, stats.outputTokens);
      }
      return { streamingStartedAt, streamingOutputTokens };
    }),

  addPermission: (sessionId, perm) =>
    set((s) => {
      const pendingPermissions = new Map(s.pendingPermissions);
      const sessionPerms = new Map(pendingPermissions.get(sessionId) || []);
      sessionPerms.set(perm.request_id, perm);
      pendingPermissions.set(sessionId, sessionPerms);
      return { pendingPermissions };
    }),

  removePermission: (sessionId, requestId) =>
    set((s) => {
      const pendingPermissions = new Map(s.pendingPermissions);
      const sessionPerms = pendingPermissions.get(sessionId);
      if (sessionPerms) {
        const updated = new Map(sessionPerms);
        updated.delete(requestId);
        pendingPermissions.set(sessionId, updated);
      }
      return { pendingPermissions };
    }),

  addTask: (sessionId, task) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      const tasks = [...(sessionTasks.get(sessionId) || []), task];
      sessionTasks.set(sessionId, tasks);
      return { sessionTasks };
    }),

  setTasks: (sessionId, tasks) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      sessionTasks.set(sessionId, tasks);
      return { sessionTasks };
    }),

  updateTask: (sessionId, taskId, updates) =>
    set((s) => {
      const sessionTasks = new Map(s.sessionTasks);
      const tasks = sessionTasks.get(sessionId);
      if (tasks) {
        sessionTasks.set(
          sessionId,
          tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        );
      }
      return { sessionTasks };
    }),

  addChangedFile: (sessionId, filePath) =>
    set((s) => {
      const changedFiles = new Map(s.changedFiles);
      const files = new Set(changedFiles.get(sessionId) || []);
      files.add(filePath);
      changedFiles.set(sessionId, files);
      return { changedFiles };
    }),

  clearChangedFiles: (sessionId) =>
    set((s) => {
      const changedFiles = new Map(s.changedFiles);
      changedFiles.delete(sessionId);
      return { changedFiles };
    }),

  setSessionName: (sessionId, name) =>
    set((s) => {
      const sessionNames = new Map(s.sessionNames);
      sessionNames.set(sessionId, name);
      safeStorage.setItem("cc-session-names", JSON.stringify(Array.from(sessionNames.entries())));
      return { sessionNames };
    }),

  setSessionSubtitle: (sessionId, subtitle) =>
    set((s) => {
      const sessionSubtitles = new Map(s.sessionSubtitles);
      sessionSubtitles.set(sessionId, subtitle);
      return { sessionSubtitles };
    }),

  markRecentlyRenamed: (sessionId) =>
    set((s) => {
      const recentlyRenamed = new Set(s.recentlyRenamed);
      recentlyRenamed.add(sessionId);
      return { recentlyRenamed };
    }),

  clearRecentlyRenamed: (sessionId) =>
    set((s) => {
      const recentlyRenamed = new Set(s.recentlyRenamed);
      recentlyRenamed.delete(sessionId);
      return { recentlyRenamed };
    }),

  setPRStatus: (sessionId, status) =>
    set((s) => {
      const prStatus = new Map(s.prStatus);
      prStatus.set(sessionId, status);
      return { prStatus };
    }),

  setLinkedLinearIssue: (sessionId, issue) =>
    set((s) => {
      const linkedLinearIssues = new Map(s.linkedLinearIssues);
      if (issue) {
        linkedLinearIssues.set(sessionId, issue);
      } else {
        linkedLinearIssues.delete(sessionId);
      }
      return { linkedLinearIssues };
    }),

  setMcpServers: (sessionId, servers) =>
    set((s) => {
      const mcpServers = new Map(s.mcpServers);
      mcpServers.set(sessionId, servers);
      return { mcpServers };
    }),

  setToolProgress: (sessionId, toolUseId, data) =>
    set((s) => {
      const toolProgress = new Map(s.toolProgress);
      const sessionProgress = new Map(toolProgress.get(sessionId) || []);
      sessionProgress.set(toolUseId, data);
      toolProgress.set(sessionId, sessionProgress);
      return { toolProgress };
    }),

  clearToolProgress: (sessionId, toolUseId) =>
    set((s) => {
      const toolProgress = new Map(s.toolProgress);
      if (toolUseId) {
        const sessionProgress = toolProgress.get(sessionId);
        if (sessionProgress) {
          const updated = new Map(sessionProgress);
          updated.delete(toolUseId);
          toolProgress.set(sessionId, updated);
        }
      } else {
        toolProgress.delete(sessionId);
      }
      return { toolProgress };
    }),

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

  setPreviousPermissionMode: (sessionId, mode) =>
    set((s) => {
      const previousPermissionMode = new Map(s.previousPermissionMode);
      previousPermissionMode.set(sessionId, mode);
      return { previousPermissionMode };
    }),

  setConnectionStatus: (sessionId, status) =>
    set((s) => {
      const connectionStatus = new Map(s.connectionStatus);
      connectionStatus.set(sessionId, status);
      return { connectionStatus };
    }),

  setCliConnected: (sessionId, connected) =>
    set((s) => {
      const cliConnected = new Map(s.cliConnected);
      cliConnected.set(sessionId, connected);
      return { cliConnected };
    }),

  setSessionStatus: (sessionId, status) =>
    set((s) => {
      const sessionStatus = new Map(s.sessionStatus);
      sessionStatus.set(sessionId, status);
      return { sessionStatus };
    }),

  setUpdateInfo: (info) => set({ updateInfo: info }),
  dismissUpdate: (version) => {
    safeStorage.setItem("cc-update-dismissed", version);
    set({ updateDismissedVersion: version });
  },
  setUpdateOverlayActive: (active) => set({ updateOverlayActive: active }),
  setEditorTabEnabled: (enabled) => set({ editorTabEnabled: enabled }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setEditorUrl: (sessionId, url) =>
    set((s) => {
      const next = new Map(s.editorUrls);
      next.set(sessionId, url);
      return { editorUrls: next };
    }),
  markChatTabReentry: (sessionId) =>
    set((s) => {
      const chatTabReentryTickBySession = new Map(s.chatTabReentryTickBySession);
      const nextTick = (chatTabReentryTickBySession.get(sessionId) ?? 0) + 1;
      chatTabReentryTickBySession.set(sessionId, nextTick);
      return { chatTabReentryTickBySession };
    }),


  setDiffPanelSelectedFile: (sessionId, filePath) =>
    set((s) => {
      const diffPanelSelectedFile = new Map(s.diffPanelSelectedFile);
      diffPanelSelectedFile.set(sessionId, filePath);
      return { diffPanelSelectedFile };
    }),

  openSkill: (slug) =>
    set((s) => {
      const skills = s.openSkills.includes(slug) ? s.openSkills : [...s.openSkills, slug];
      return { openSkills: skills, activeTab: `skill:${slug}` };
    }),

  closeSkill: (slug) =>
    set((s) => {
      const skills = s.openSkills.filter((s) => s !== slug);
      const activeTab = s.activeTab === `skill:${slug}` ? "chat" : s.activeTab;
      return { openSkills: skills, activeTab };
    }),

  setEditorOpenFile: (sessionId, filePath) =>
    set((s) => {
      const editorOpenFile = new Map(s.editorOpenFile);
      if (filePath) {
        editorOpenFile.set(sessionId, filePath);
      } else {
        editorOpenFile.delete(sessionId);
      }
      return { editorOpenFile };
    }),

  setEditorLoading: (sessionId, loading) =>
    set((s) => {
      const editorLoading = new Map(s.editorLoading);
      editorLoading.set(sessionId, loading);
      return { editorLoading };
    }),

  openFileInEditor: (filePath) =>
    set((s) => {
      const files = s.editorFiles.includes(filePath)
        ? s.editorFiles
        : [...s.editorFiles, filePath];
      return { editorFiles: files, editorActiveFilePath: filePath, activeTab: "editor" };
    }),

  closeEditorFile: (filePath) =>
    set((s) => {
      const files = s.editorFiles.filter((f) => f !== filePath);
      const active =
        s.editorActiveFilePath === filePath
          ? files[Math.max(0, s.editorFiles.indexOf(filePath) - 1)] ?? null
          : s.editorActiveFilePath;
      return {
        editorFiles: files,
        editorActiveFilePath: active,
        activeTab: files.length === 0 ? "chat" : s.activeTab,
      };
    }),

  setEditorActiveFilePath: (filePath) => set({ editorActiveFilePath: filePath }),

  setQuickTerminalOpen: (open) => set({ quickTerminalOpen: open }),
  openQuickTerminal: (opts) =>
    set((s) => {
      if (opts.reuseIfExists) {
        const existing = s.quickTerminalTabs.find((t) =>
          t.cwd === opts.cwd
          && t.containerId === opts.containerId,
        );
        if (existing) {
          return {
            quickTerminalOpen: true,
            activeQuickTerminalTabId: existing.id,
          };
        }
      }

      const isDocker = opts.target === "docker";
      const hostIndex = s.quickTerminalNextHostIndex;
      const dockerIndex = s.quickTerminalNextDockerIndex;
      const nextHostIndex = isDocker ? hostIndex : hostIndex + 1;
      const nextDockerIndex = isDocker ? dockerIndex + 1 : dockerIndex;
      const nextTab: QuickTerminalTab = {
        id: `${opts.target}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: isDocker
          ? `Docker ${dockerIndex}`
          : (hostIndex === 1 ? "Terminal" : `Terminal ${hostIndex}`),
        cwd: opts.cwd,
        containerId: opts.containerId,
      };
      return {
        quickTerminalOpen: true,
        quickTerminalTabs: [...s.quickTerminalTabs, nextTab],
        activeQuickTerminalTabId: nextTab.id,
        quickTerminalNextHostIndex: nextHostIndex,
        quickTerminalNextDockerIndex: nextDockerIndex,
      };
    }),
  closeQuickTerminalTab: (tabId) =>
    set((s) => {
      const nextTabs = s.quickTerminalTabs.filter((t) => t.id !== tabId);
      const nextActive = s.activeQuickTerminalTabId === tabId ? (nextTabs[0]?.id || null) : s.activeQuickTerminalTabId;
      return {
        quickTerminalTabs: nextTabs,
        activeQuickTerminalTabId: nextActive,
        quickTerminalOpen: nextTabs.length > 0 ? s.quickTerminalOpen : false,
      };
    }),
  setActiveQuickTerminalTabId: (tabId) => set({ activeQuickTerminalTabId: tabId }),
  setQuickTerminalPlacement: (placement) => {
    if (typeof window !== "undefined") {
      safeStorage.setItem("cc-terminal-placement", placement);
    }
    set({ quickTerminalPlacement: placement });
  },
  setDiffBase: (base) => {
    if (typeof window !== "undefined") {
      safeStorage.setItem("cc-diff-base", base);
    }
    set({ diffBase: base });
  },
  resetQuickTerminal: () =>
    set({
      quickTerminalOpen: false,
      quickTerminalTabs: [],
      activeQuickTerminalTabId: null,
      quickTerminalNextHostIndex: 1,
      quickTerminalNextDockerIndex: 1,
    }),


  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setTerminalCwd: (cwd) => set({ terminalCwd: cwd }),
  setTerminalId: (id) => set({ terminalId: id }),
  openTerminal: (cwd) => set({ terminalOpen: true, terminalCwd: cwd }),
  closeTerminal: () => set({ terminalOpen: false, terminalCwd: null, terminalId: null }),

  reset: () =>
    set({
      sessions: new Map(),
      sdkSessions: [],
      currentSessionId: null,
      messages: new Map(),
      streaming: new Map(),
      streamingStartedAt: new Map(),
      streamingOutputTokens: new Map(),
      pendingPermissions: new Map(),
      connectionStatus: new Map(),
      cliConnected: new Map(),
      sessionStatus: new Map(),
      previousPermissionMode: new Map(),
      sessionTasks: new Map(),
      changedFiles: new Map(),
      diffPanelSelectedFile: new Map(),
      updateInfo: null,
      updateDismissedVersion: null,
      sessionNames: new Map(),
      sessionSubtitles: new Map(),
      recentlyRenamed: new Set(),
      mcpServers: new Map(),
      toolProgress: new Map(),
      prStatus: new Map(),
      linkedLinearIssues: new Map(),
      taskPanelConfigMode: false,
      editorTabEnabled: false,
      activeTab: "chat" as const,
      editorOpenFile: new Map(),
      editorUrl: new Map(),
      editorLoading: new Map(),
      editorUrls: new Map(),
      chatTabReentryTickBySession: new Map(),
      editorFiles: [],
      editorActiveFilePath: null,
      quickTerminalOpen: false,
      quickTerminalTabs: [],
      activeQuickTerminalTabId: null,
      quickTerminalPlacement: getInitialQuickTerminalPlacement(),
      quickTerminalNextHostIndex: 1,
      quickTerminalNextDockerIndex: 1,
      diffBase: getInitialDiffBase(),
      terminalOpen: false,
      terminalCwd: null,
      terminalId: null,
    }),
}));
