import { create } from "zustand";
import type { SessionState, PermissionRequest, ChatMessage, SdkSessionInfo, TaskItem, ProcessItem, McpServerDetail } from "./types.js";
import type { UpdateInfo, PRStatusResponse, CreationProgressEvent, LinearIssue } from "./api.js";
import { safeStorage } from "./utils/safe-storage.js";
import { AUTH_STORAGE_KEY } from "./utils/auth-constants.js";
import { type TaskPanelConfig, getInitialTaskPanelConfig, getDefaultConfig, persistTaskPanelConfig } from "./components/task-panel-sections.js";

function setInMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

function deleteFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
}

function addToSet<V>(set: Set<V>, value: V): Set<V> {
  if (set.has(value)) return set;
  const next = new Set(set);
  next.add(value);
  return next;
}

function deleteFromSet<V>(set: Set<V>, key: V): Set<V> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

export interface QuickTerminalTab {
  id: string;
  label: string;
  cwd: string;
  containerId?: string;
}

export type QuickTerminalPlacement = "top" | "right" | "bottom" | "left";

export type DiffBase = "last-commit" | "default-branch";

export interface ConsoleLogEntry {
  level: "log" | "warn" | "error" | "info";
  args: string[];
  timestamp: number;
}
export type ThemeMode = "system" | "dark" | "light";

function resolveThemeDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Migrate legacy `cc-dark-mode` boolean to new `cc-theme` enum on first load */
function initTheme(): ThemeMode {
  const valid: ThemeMode[] = ["system", "dark", "light"];
  const stored = typeof window !== "undefined" ? safeStorage.getItem("cc-theme") : null;
  if (stored && valid.includes(stored as ThemeMode)) return stored as ThemeMode;
  const legacy = typeof window !== "undefined" ? safeStorage.getItem("cc-dark-mode") : null;
  if (legacy === "true") return "dark";
  if (legacy === "false") return "light";
  return "system";
}

interface AppState {
  authToken: string | null;
  isAuthenticated: boolean;
  // LOCAL: true while autoAuth is in flight — prevents login-page flash when auth is disabled
  authChecking: boolean;

  sessions: Map<string, SessionState>;
  sdkSessions: SdkSessionInfo[];
  currentSessionId: string | null;
  messages: Map<string, ChatMessage[]>;
  streaming: Map<string, string>;
  streamingStartedAt: Map<string, number>;
  streamingOutputTokens: Map<string, number>;
  pendingPermissions: Map<string, Map<string, PermissionRequest>>;

  // AI-resolved permissions log per session
  aiResolvedPermissions: Map<string, Array<{
    request: PermissionRequest;
    behavior: "allow" | "deny";
    reason: string;
    timestamp: number;
  }>>;

  /** Browser↔Server WebSocket connection state per session */
  connectionStatus: Map<string, "connecting" | "connected" | "disconnected">;
  cliConnected: Map<string, boolean>;
  sessionStatus: Map<string, "idle" | "running" | "compacting" | null>;
  previousPermissionMode: Map<string, string>;
  /** msgIds currently queued server-side (not yet sent to CLI), cancellable. */
  queuedMessageIds: Map<string, Set<string>>;
  sessionTasks: Map<string, TaskItem[]>;

  // Tick incremented when agent edits an in-scope file — triggers DiffPanel re-fetch
  changedFilesTick: Map<string, number>;
  gitChangedFilesCount: Map<string, number>;

  sessionProcesses: Map<string, ProcessItem[]>;
  sessionNames: Map<string, string>;
  sessionSubtitles: Map<string, string>;
  recentlyRenamed: Set<string>;
  prStatus: Map<string, PRStatusResponse>;
  linkedLinearIssues: Map<string, LinearIssue>;
  mcpServers: Map<string, McpServerDetail[]>;
  toolProgress: Map<string, Map<string, { toolName: string; elapsedSeconds: number }>>;
  fragmentState: Map<string, Record<string, unknown>>;
  fragmentConsole: Map<string, ConsoleLogEntry[]>;
  collapsedProjects: Set<string>;
  archivedSubagentSessions: Set<string>;
  diffPanelSelectedFile: Map<string, string>;
  /** Last folder path clicked in the sidebar — panels can react to this */
  focusedFolder: string | null;
  updateInfo: UpdateInfo | null;
  updateDismissedVersion: string | null;
  updateOverlayActive: boolean;

  creationProgress: CreationProgressEvent[] | null;
  creationError: string | null;
  sessionCreating: boolean;
  sessionCreatingBackend: "claude" | "codex" | null;
  addCreationProgress: (step: CreationProgressEvent) => void;
  clearCreation: () => void;
  setSessionCreating: (creating: boolean, backend?: "claude" | "codex") => void;
  setCreationError: (error: string | null) => void;

  theme: ThemeMode;
  darkMode: boolean;
  notificationSound: boolean;
  yoloMode: boolean;
  notificationDesktop: boolean;
  showDebugMessages: boolean;
  sidebarOpen: boolean;
  taskPanelOpen: boolean;
  taskPanelConfig: TaskPanelConfig;
  taskPanelConfigMode: boolean;
  homeResetKey: number;
  publicUrl: string;
  editorTabEnabled: boolean;
  newSessionCwd: string | null; // LOCAL: custom cwd for new sessions
  activeTab: string; // LOCAL: "chat" | "diff" | "terminal" | "editor" | "processes" | "panel:<slug>"
  openPanels: string[];
  editorOpenFile: Map<string, string>;
  editorUrl: Map<string, string>;
  editorLoading: Map<string, boolean>;
  chatTabReentryTickBySession: Map<string, number>;

  editorFiles: string[];
  editorActiveFilePath: string | null;

  setAuthToken: (token: string) => void;
  setAuthChecking: (checking: boolean) => void;
  logout: () => void;

  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setNotificationSound: (v: boolean) => void;
  toggleNotificationSound: () => void;
  setYoloMode: (v: boolean) => void;
  toggleYoloMode: () => void;
  setNotificationDesktop: (v: boolean) => void;
  toggleNotificationDesktop: () => void;
  toggleShowDebugMessages: () => void;
  setPublicUrl: (url: string) => void;
  setSidebarOpen: (v: boolean) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setTaskPanelConfigMode: (open: boolean) => void;
  toggleSectionEnabled: (sectionId: string) => void;
  moveSectionUp: (sectionId: string) => void;
  moveSectionDown: (sectionId: string) => void;
  resetTaskPanelConfig: () => void;
  newSession: () => void;
  newSessionInFolder: (cwd: string) => void;

  setCurrentSession: (id: string | null) => void;
  addSession: (session: SessionState) => void;
  updateSession: (sessionId: string, updates: Partial<SessionState>) => void;
  removeSession: (sessionId: string) => void;
  setSdkSessions: (sessions: SdkSessionInfo[]) => void;

  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void;
  updateLastAssistantMessage: (sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  setStreaming: (sessionId: string, text: string | null) => void;
  setStreamingStats: (sessionId: string, stats: { startedAt?: number; outputTokens?: number } | null) => void;

  addPermission: (sessionId: string, perm: PermissionRequest) => void;
  removePermission: (sessionId: string, requestId: string) => void;
  addAiResolvedPermission: (sessionId: string, entry: { request: PermissionRequest; behavior: "allow" | "deny"; reason: string; timestamp: number }) => void;
  clearAiResolvedPermissions: (sessionId: string) => void;
  setSessionAiValidation: (sessionId: string, settings: { aiValidationEnabled?: boolean | null; aiValidationAutoApprove?: boolean | null; aiValidationAutoDeny?: boolean | null }) => void;

  addTask: (sessionId: string, task: TaskItem) => void;
  setTasks: (sessionId: string, tasks: TaskItem[]) => void;
  updateTask: (sessionId: string, taskId: string, updates: Partial<TaskItem>) => void;

  bumpChangedFilesTick: (sessionId: string) => void;
  setGitChangedFilesCount: (sessionId: string, count: number) => void;

  addProcess: (sessionId: string, process: ProcessItem) => void;
  updateProcess: (sessionId: string, taskId: string, updates: Partial<ProcessItem>) => void;
  updateProcessByToolUseId: (sessionId: string, toolUseId: string, updates: Partial<ProcessItem>) => void;

  setSessionName: (sessionId: string, name: string) => void;
  setSessionSubtitle: (sessionId: string, subtitle: string) => void;
  markRecentlyRenamed: (sessionId: string) => void;
  clearRecentlyRenamed: (sessionId: string) => void;

  setPRStatus: (sessionId: string, status: PRStatusResponse) => void;
  setLinkedLinearIssue: (sessionId: string, issue: LinearIssue | null) => void;
  setMcpServers: (sessionId: string, servers: McpServerDetail[]) => void;
  setToolProgress: (sessionId: string, toolUseId: string, data: { toolName: string; elapsedSeconds: number }) => void;
  clearToolProgress: (sessionId: string, toolUseId?: string) => void;
  updateFragmentState: (fragmentId: string, state: Record<string, unknown>) => void;
  appendConsoleLog: (fragmentId: string, entry: ConsoleLogEntry) => void;
  toggleProjectCollapse: (projectKey: string) => void;
  setAllProjectsCollapsed: (projectKeys: string[], collapsed: boolean) => void;
  archiveSubagents: (sessionId: string) => void;
  unarchiveSubagents: (sessionId: string) => void;
  setPreviousPermissionMode: (sessionId: string, mode: string) => void;
  setConnectionStatus: (sessionId: string, status: "connecting" | "connected" | "disconnected") => void;
  setCliConnected: (sessionId: string, connected: boolean) => void;
  setSessionStatus: (sessionId: string, status: "idle" | "running" | "compacting" | null) => void;
  markMessageQueued: (sessionId: string, msgId: string) => void;
  unmarkMessageQueued: (sessionId: string, msgId: string) => void;
  setDiffPanelSelectedFile: (sessionId: string, filePath: string | null) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  dismissUpdate: (version: string) => void;
  setUpdateOverlayActive: (active: boolean) => void;
  setEditorTabEnabled: (enabled: boolean) => void;

  setActiveTab: (tab: string) => void;
  markChatTabReentry: (sessionId: string) => void;
  openPanel: (slug: string) => void;
  closePanel: (slug: string) => void;
  setEditorOpenFile: (sessionId: string, filePath: string | null) => void;
  setEditorUrl: (sessionId: string, url: string) => void;
  setEditorLoading: (sessionId: string, loading: boolean) => void;

  openFileInEditor: (filePath: string) => void;
  closeEditorFile: (filePath: string) => void;
  setEditorActiveFilePath: (filePath: string | null) => void;

  quickTerminalOpen: boolean;
  quickTerminalTabs: QuickTerminalTab[];
  activeQuickTerminalTabId: string | null;
  quickTerminalPlacement: QuickTerminalPlacement;
  quickTerminalNextHostIndex: number;
  quickTerminalNextDockerIndex: number;

  diffBase: DiffBase;

  setQuickTerminalOpen: (open: boolean) => void;
  openQuickTerminal: (opts: { target: "host" | "docker"; cwd: string; containerId?: string; reuseIfExists?: boolean }) => void;
  closeQuickTerminalTab: (tabId: string) => void;
  setActiveQuickTerminalTabId: (tabId: string | null) => void;
  resetQuickTerminal: () => void;

  setDiffBase: (base: DiffBase) => void;
  setFocusedFolder: (folder: string | null) => void;

  terminalOpen: boolean;
  terminalCwd: string | null;
  terminalId: string | null;

  setTerminalOpen: (open: boolean) => void;
  setTerminalCwd: (cwd: string | null) => void;
  setTerminalId: (id: string | null) => void;
  openTerminal: (cwd: string) => void;
  closeTerminal: () => void;

  reset: () => void;
}

// ─── Storage initialization helpers ──────────────────────────────────────────

function initBool(key: string, fallback: boolean | (() => boolean)): boolean {
  if (typeof window === "undefined") return typeof fallback === "function" ? fallback() : fallback;
  const stored = safeStorage.getItem(key);
  if (stored !== null) return stored === "true";
  return typeof fallback === "function" ? fallback() : fallback;
}

function initString(key: string): string | null {
  if (typeof window === "undefined") return null;
  return safeStorage.getItem(key) || null;
}

function initParsed<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = safeStorage.getItem(key);
    return raw ? parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function initEnum<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = safeStorage.getItem(key) as T;
  return valid.includes(stored) ? stored : fallback;
}

function getInitialAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_STORAGE_KEY) || null;
}

export const useStore = create<AppState>((set) => ({
  authToken: getInitialAuthToken(),
  // LOCAL: if no stored token, start in "checking" state to avoid login-page flash
  isAuthenticated: getInitialAuthToken() !== null,
  authChecking: getInitialAuthToken() === null,
  sessions: new Map(),
  sdkSessions: [],
  currentSessionId: initString("cc-current-session"),
  messages: new Map(),
  streaming: new Map(),
  streamingStartedAt: new Map(),
  streamingOutputTokens: new Map(),
  pendingPermissions: new Map(),
  aiResolvedPermissions: new Map(),
  connectionStatus: new Map(),
  cliConnected: new Map(),
  sessionStatus: new Map(),
  previousPermissionMode: new Map(),
  queuedMessageIds: new Map<string, Set<string>>(),
  sessionTasks: new Map(),
  changedFilesTick: new Map(),
  gitChangedFilesCount: new Map(),
  diffPanelSelectedFile: new Map(),
  focusedFolder: null,
  sessionProcesses: new Map(),
  sessionNames: initParsed("cc-session-names", (r) => new Map(JSON.parse(r) as [string, string][]), new Map<string, string>()),
  sessionSubtitles: new Map(),
  recentlyRenamed: new Set(),
  prStatus: new Map(),
  linkedLinearIssues: new Map(),
  mcpServers: new Map(),
  toolProgress: new Map(),
  fragmentState: new Map(),
  fragmentConsole: new Map(),
  collapsedProjects: initParsed("cc-collapsed-projects", (r) => new Set(JSON.parse(r) as string[]), new Set<string>()),
  archivedSubagentSessions: new Set<string>(),
  creationProgress: null,
  creationError: null,
  sessionCreating: false,
  sessionCreatingBackend: null,
  updateInfo: null,
  updateDismissedVersion: initString("cc-update-dismissed"),
  updateOverlayActive: false,
  theme: initTheme(),
  darkMode: resolveThemeDark(initTheme()),
  notificationSound: initBool("cc-notification-sound", true),
  yoloMode: initBool("cc-yolo-mode", true),
  notificationDesktop: initBool("cc-notification-desktop", true),
  showDebugMessages: initBool("cc-show-debug-messages", false),
  sidebarOpen: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  taskPanelOpen: typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  taskPanelConfig: getInitialTaskPanelConfig(),
  taskPanelConfigMode: false,
  homeResetKey: 0,
  publicUrl: "",
  editorTabEnabled: false,
  newSessionCwd: null,
  activeTab: "chat",
  openPanels: [], // LOCAL: panel tabs
  editorOpenFile: new Map(), // LOCAL
  editorUrl: new Map(), // LOCAL
  editorLoading: new Map(), // LOCAL
  chatTabReentryTickBySession: new Map(),
  editorFiles: [],
  editorActiveFilePath: null,
  quickTerminalOpen: false,
  quickTerminalTabs: [],
  activeQuickTerminalTabId: null,
  quickTerminalPlacement: initEnum("cc-terminal-placement", ["top", "right", "bottom", "left"] as const, "bottom"),
  quickTerminalNextHostIndex: 1,
  quickTerminalNextDockerIndex: 1,
  diffBase: initEnum("cc-diff-base", ["last-commit", "default-branch"] as const, "last-commit"),
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

  setTheme: (theme) => {
    safeStorage.setItem("cc-theme", theme);
    set({ theme, darkMode: resolveThemeDark(theme) });
  },
  cycleTheme: () =>
    set((s) => {
      const order: ThemeMode[] = ["system", "dark", "light"];
      const next = order[(order.indexOf(s.theme) + 1) % order.length];
      safeStorage.setItem("cc-theme", next);
      return { theme: next, darkMode: resolveThemeDark(next) };
    }),
  setAuthToken: (token) => {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    set({ authToken: token, isAuthenticated: true, authChecking: false });
  },
  setAuthChecking: (checking) => set({ authChecking: checking }),
  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    set({ authToken: null, isAuthenticated: false });
  },

  setDarkMode: (v) => {
    safeStorage.setItem("cc-dark-mode", String(v));
    set({ darkMode: v });
  },
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      const theme = next ? "dark" : "light";
      safeStorage.setItem("cc-theme", theme);
      return { theme, darkMode: next };
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
  toggleShowDebugMessages: () =>
    set((s) => {
      const next = !s.showDebugMessages;
      safeStorage.setItem("cc-show-debug-messages", String(next));
      return { showDebugMessages: next };
    }),
  setPublicUrl: (url) => set({ publicUrl: url }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTaskPanelOpen: (open) => set({ taskPanelOpen: open }),
  setTaskPanelConfigMode: (open) => set({ taskPanelConfigMode: open }),
  toggleSectionEnabled: (sectionId) =>
    set((s) => {
      const config: TaskPanelConfig = {
        ...s.taskPanelConfig,
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
    set((s) => ({ currentSessionId: null, activeTab: "chat", homeResetKey: s.homeResetKey + 1 }));
  },
  newSessionInFolder: (cwd) => {
    safeStorage.removeItem("cc-current-session");
    set((s) => ({ currentSessionId: null, activeTab: "chat", newSessionCwd: cwd, homeResetKey: s.homeResetKey + 1 }));
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
    set((s) => ({
      sessions: setInMap(s.sessions, session.session_id, session),
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
        sessions: deleteFromMap(s.sessions, sessionId),
        messages: deleteFromMap(s.messages, sessionId),
        streaming: deleteFromMap(s.streaming, sessionId),
        streamingStartedAt: deleteFromMap(s.streamingStartedAt, sessionId),
        streamingOutputTokens: deleteFromMap(s.streamingOutputTokens, sessionId),
        connectionStatus: deleteFromMap(s.connectionStatus, sessionId),
        cliConnected: deleteFromMap(s.cliConnected, sessionId),
        sessionStatus: deleteFromMap(s.sessionStatus, sessionId),
        previousPermissionMode: deleteFromMap(s.previousPermissionMode, sessionId),
        pendingPermissions: deleteFromMap(s.pendingPermissions, sessionId),
        aiResolvedPermissions: deleteFromMap(s.aiResolvedPermissions, sessionId),
        sessionTasks: deleteFromMap(s.sessionTasks, sessionId),
        changedFilesTick: deleteFromMap(s.changedFilesTick, sessionId),
        gitChangedFilesCount: deleteFromMap(s.gitChangedFilesCount, sessionId),
        diffPanelSelectedFile: deleteFromMap(s.diffPanelSelectedFile, sessionId),
        sessionProcesses: deleteFromMap(s.sessionProcesses, sessionId),
        sessionNames,
        recentlyRenamed: deleteFromSet(s.recentlyRenamed, sessionId),
        editorOpenFile: deleteFromMap(s.editorOpenFile, sessionId), // LOCAL
        editorUrl: deleteFromMap(s.editorUrl, sessionId), // LOCAL
        editorLoading: deleteFromMap(s.editorLoading, sessionId), // LOCAL
        mcpServers: deleteFromMap(s.mcpServers, sessionId),
        toolProgress: deleteFromMap(s.toolProgress, sessionId),
        prStatus: deleteFromMap(s.prStatus, sessionId),
        linkedLinearIssues: deleteFromMap(s.linkedLinearIssues, sessionId),
        chatTabReentryTickBySession: deleteFromMap(s.chatTabReentryTickBySession, sessionId),
        sdkSessions: s.sdkSessions.filter((sdk) => sdk.sessionId !== sessionId),
        currentSessionId: s.currentSessionId === sessionId ? null : s.currentSessionId,
      };
    }),

  setSdkSessions: (sessions) => set((s) => {
    // Preserve titles from WebSocket updates that may not be in the polled data yet
    // (race: poll in-flight when title was set → response arrives without it)
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

  appendMessage: (sessionId, msg) =>
    set((s) => {
      const existing = s.messages.get(sessionId) || [];
      // Deduplicate: skip if a message with same ID already exists
      if (msg.id && existing.some((m) => m.id === msg.id)) return s;
      return { messages: setInMap(s.messages, sessionId, [...existing, msg]) };
    }),

  setMessages: (sessionId, msgs) =>
    set((s) => ({ messages: setInMap(s.messages, sessionId, msgs) })),

  updateLastAssistantMessage: (sessionId, updater) =>
    set((s) => {
      const list = [...(s.messages.get(sessionId) || [])];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "assistant") { list[i] = updater(list[i]); break; }
      }
      return { messages: setInMap(s.messages, sessionId, list) };
    }),

  setStreaming: (sessionId, text) =>
    set((s) => ({
      streaming: text === null ? deleteFromMap(s.streaming, sessionId) : setInMap(s.streaming, sessionId, text),
    })),

  setStreamingStats: (sessionId, stats) =>
    set((s) => {
      if (stats === null) {
        return {
          streamingStartedAt: deleteFromMap(s.streamingStartedAt, sessionId),
          streamingOutputTokens: deleteFromMap(s.streamingOutputTokens, sessionId),
        };
      }
      return {
        streamingStartedAt: stats.startedAt !== undefined ? setInMap(s.streamingStartedAt, sessionId, stats.startedAt) : s.streamingStartedAt,
        streamingOutputTokens: stats.outputTokens !== undefined ? setInMap(s.streamingOutputTokens, sessionId, stats.outputTokens) : s.streamingOutputTokens,
      };
    }),

  addPermission: (sessionId, perm) =>
    set((s) => {
      const sessionPerms = setInMap(s.pendingPermissions.get(sessionId) || new Map(), perm.request_id, perm);
      return { pendingPermissions: setInMap(s.pendingPermissions, sessionId, sessionPerms) };
    }),

  removePermission: (sessionId, requestId) =>
    set((s) => {
      const sessionPerms = s.pendingPermissions.get(sessionId);
      if (!sessionPerms) return s;
      return { pendingPermissions: setInMap(s.pendingPermissions, sessionId, deleteFromMap(sessionPerms, requestId)) };
    }),

  addAiResolvedPermission: (sessionId, entry) =>
    set((s) => {
      const aiResolvedPermissions = new Map(s.aiResolvedPermissions);
      const sessionEntries = [...(aiResolvedPermissions.get(sessionId) || []), entry];
      // Keep only the last 50 entries per session to avoid unbounded growth
      if (sessionEntries.length > 50) sessionEntries.splice(0, sessionEntries.length - 50);
      aiResolvedPermissions.set(sessionId, sessionEntries);
      return { aiResolvedPermissions };
    }),

  clearAiResolvedPermissions: (sessionId) =>
    set((s) => {
      const aiResolvedPermissions = new Map(s.aiResolvedPermissions);
      aiResolvedPermissions.delete(sessionId);
      return { aiResolvedPermissions };
    }),

  setSessionAiValidation: (sessionId, settings) =>
    set((s) => {
      const sessions = new Map(s.sessions);
      const existing = sessions.get(sessionId);
      if (!existing) return {};
      sessions.set(sessionId, { ...existing, ...settings });
      return { sessions };
    }),

  addTask: (sessionId, task) =>
    set((s) => ({ sessionTasks: setInMap(s.sessionTasks, sessionId, [...(s.sessionTasks.get(sessionId) || []), task]) })),

  setTasks: (sessionId, tasks) =>
    set((s) => ({ sessionTasks: setInMap(s.sessionTasks, sessionId, tasks) })),

  updateTask: (sessionId, taskId, updates) =>
    set((s) => {
      const tasks = s.sessionTasks.get(sessionId);
      if (!tasks) return s;
      return { sessionTasks: setInMap(s.sessionTasks, sessionId, tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t))) };
    }),

  bumpChangedFilesTick: (sessionId) =>
    set((s) => {
      const changedFilesTick = new Map(s.changedFilesTick);
      changedFilesTick.set(sessionId, (changedFilesTick.get(sessionId) ?? 0) + 1);
      return { changedFilesTick };
    }),

  setGitChangedFilesCount: (sessionId, count) =>
    set((s) => {
      const gitChangedFilesCount = new Map(s.gitChangedFilesCount);
      gitChangedFilesCount.set(sessionId, count);
      return { gitChangedFilesCount };
    }),

  addProcess: (sessionId, process) =>
    set((s) => {
      const sessionProcesses = new Map(s.sessionProcesses);
      const processes = [...(sessionProcesses.get(sessionId) || []), process];
      sessionProcesses.set(sessionId, processes);
      return { sessionProcesses };
    }),

  updateProcess: (sessionId, taskId, updates) =>
    set((s) => {
      const sessionProcesses = new Map(s.sessionProcesses);
      const processes = sessionProcesses.get(sessionId);
      if (processes) {
        sessionProcesses.set(
          sessionId,
          processes.map((p) => (p.taskId === taskId ? { ...p, ...updates } : p)),
        );
      }
      return { sessionProcesses };
    }),

  updateProcessByToolUseId: (sessionId, toolUseId, updates) =>
    set((s) => {
      const sessionProcesses = new Map(s.sessionProcesses);
      const processes = sessionProcesses.get(sessionId);
      if (processes) {
        sessionProcesses.set(
          sessionId,
          processes.map((p) => (p.toolUseId === toolUseId ? { ...p, ...updates } : p)),
        );
      }
      return { sessionProcesses };
    }),

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

  setToolProgress: (sessionId, toolUseId, data) =>
    set((s) => {
      const sessionProgress = setInMap(s.toolProgress.get(sessionId) || new Map(), toolUseId, data);
      return { toolProgress: setInMap(s.toolProgress, sessionId, sessionProgress) };
    }),

  clearToolProgress: (sessionId, toolUseId) =>
    set((s) => {
      if (!toolUseId) return { toolProgress: deleteFromMap(s.toolProgress, sessionId) };
      const sessionProgress = s.toolProgress.get(sessionId);
      if (!sessionProgress) return s;
      return { toolProgress: setInMap(s.toolProgress, sessionId, deleteFromMap(sessionProgress, toolUseId)) };
    }),

  updateFragmentState: (fragmentId, state) =>
    set((s) => ({ fragmentState: setInMap(s.fragmentState, fragmentId, state) })),

  appendConsoleLog: (fragmentId, entry) =>
    set((s) => {
      const MAX_LOGS = 200;
      const existing = s.fragmentConsole.get(fragmentId) || [];
      const updated = existing.length >= MAX_LOGS ? [...existing.slice(1), entry] : [...existing, entry];
      return { fragmentConsole: setInMap(s.fragmentConsole, fragmentId, updated) };
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

  archiveSubagents: (sessionId) =>
    set((s) => ({ archivedSubagentSessions: addToSet(s.archivedSubagentSessions, sessionId) })),

  unarchiveSubagents: (sessionId) =>
    set((s) => ({ archivedSubagentSessions: deleteFromSet(s.archivedSubagentSessions, sessionId) })),

  setPreviousPermissionMode: (sessionId, mode) =>
    set((s) => ({ previousPermissionMode: setInMap(s.previousPermissionMode, sessionId, mode) })),

  setConnectionStatus: (sessionId, status) =>
    set((s) => ({ connectionStatus: setInMap(s.connectionStatus, sessionId, status) })),

  setCliConnected: (sessionId, connected) =>
    set((s) => ({ cliConnected: setInMap(s.cliConnected, sessionId, connected) })),

  setSessionStatus: (sessionId, status) =>
    set((s) => ({ sessionStatus: setInMap(s.sessionStatus, sessionId, status) })),

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

  setUpdateInfo: (info) => set({ updateInfo: info }),
  dismissUpdate: (version) => {
    safeStorage.setItem("cc-update-dismissed", version);
    set({ updateDismissedVersion: version });
  },
  setUpdateOverlayActive: (active) => set({ updateOverlayActive: active }),
  setEditorTabEnabled: (enabled) => set({ editorTabEnabled: enabled }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  markChatTabReentry: (sessionId) =>
    set((s) => ({ chatTabReentryTickBySession: setInMap(s.chatTabReentryTickBySession, sessionId, (s.chatTabReentryTickBySession.get(sessionId) ?? 0) + 1) })),

  setDiffPanelSelectedFile: (sessionId, filePath) =>
    set((s) => {
      const diffPanelSelectedFile = new Map(s.diffPanelSelectedFile);
      if (filePath) {
        diffPanelSelectedFile.set(sessionId, filePath);
      } else {
        diffPanelSelectedFile.delete(sessionId);
      }
      return { diffPanelSelectedFile };
    }),

  openPanel: (slug) =>
    set((s) => {
      const panels = s.openPanels.includes(slug) ? s.openPanels : [...s.openPanels, slug];
      return { openPanels: panels, activeTab: `panel:${slug}` };
    }),

  closePanel: (slug) =>
    set((s) => {
      const panels = s.openPanels.filter((s) => s !== slug);
      const activeTab = s.activeTab === `panel:${slug}` ? "chat" : s.activeTab;
      return { openPanels: panels, activeTab };
    }),

  setEditorOpenFile: (sessionId, filePath) =>
    set((s) => ({
      editorOpenFile: filePath ? setInMap(s.editorOpenFile, sessionId, filePath) : deleteFromMap(s.editorOpenFile, sessionId),
    })),

  setEditorUrl: (sessionId, url) => // LOCAL
    set((s) => ({ editorUrl: setInMap(s.editorUrl, sessionId, url) })),

  setEditorLoading: (sessionId, loading) =>
    set((s) => ({ editorLoading: setInMap(s.editorLoading, sessionId, loading) })),

  openFileInEditor: (filePath) =>
    set((s) => {
      const files = s.editorFiles.includes(filePath)
        ? s.editorFiles
        : [...s.editorFiles, filePath];
      return { editorFiles: files, editorActiveFilePath: filePath, activeTab: "editor", editorTabEnabled: true };
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
  setDiffBase: (base) => {
    if (typeof window !== "undefined") {
      safeStorage.setItem("cc-diff-base", base);
    }
    set({ diffBase: base });
  },
  setFocusedFolder: (folder) => set({ focusedFolder: folder }),
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
      aiResolvedPermissions: new Map(),
      connectionStatus: new Map(),
      cliConnected: new Map(),
      sessionStatus: new Map(),
      previousPermissionMode: new Map(),
      queuedMessageIds: new Map<string, Set<string>>(),
      sessionTasks: new Map(),
      changedFilesTick: new Map(),
      gitChangedFilesCount: new Map(),
      diffPanelSelectedFile: new Map(),
      sessionProcesses: new Map(),
      updateInfo: null,
      updateDismissedVersion: null,
      sessionNames: new Map(),
      sessionSubtitles: new Map(),
      recentlyRenamed: new Set(),
      mcpServers: new Map(),
      toolProgress: new Map(),
      fragmentState: new Map(),
      fragmentConsole: new Map(),
      prStatus: new Map(),
      linkedLinearIssues: new Map(),
      taskPanelConfigMode: false,
      editorTabEnabled: false,
      activeTab: "chat",
      editorOpenFile: new Map(), // LOCAL
      editorUrl: new Map(), // LOCAL
      editorLoading: new Map(), // LOCAL
      chatTabReentryTickBySession: new Map(),
      editorFiles: [],
      editorActiveFilePath: null,
      quickTerminalOpen: false,
      quickTerminalTabs: [],
      activeQuickTerminalTabId: null,
      quickTerminalPlacement: initEnum("cc-terminal-placement", ["top", "right", "bottom", "left"] as const, "bottom"),
      quickTerminalNextHostIndex: 1,
      quickTerminalNextDockerIndex: 1,
      diffBase: initEnum("cc-diff-base", ["last-commit", "default-branch"] as const, "last-commit"),
      terminalOpen: false,
      terminalCwd: null,
      terminalId: null,
    }),
}));
