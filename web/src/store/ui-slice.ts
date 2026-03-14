import type { StateCreator } from "zustand";
import type { AppState } from "./index.js";
import { safeStorage } from "../utils/safe-storage.js";
import { setInMap, deleteFromMap } from "./utils.js";

export type DiffBase = "last-commit" | "default-branch";
export type ThemeMode = "system" | "dark" | "light";

export interface ConsoleLogEntry {
  level: "log" | "warn" | "error" | "info";
  args: string[];
  timestamp: number;
}

import { type TaskPanelConfig, getInitialTaskPanelConfig, getDefaultConfig, persistTaskPanelConfig } from "../components/task-panel-sections.js";

function initBool(key: string, fallback: boolean | (() => boolean)): boolean {
  if (typeof window === "undefined") return typeof fallback === "function" ? fallback() : fallback;
  const stored = safeStorage.getItem(key);
  if (stored !== null) return stored === "true";
  return typeof fallback === "function" ? fallback() : fallback;
}

function resolveThemeDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function initTheme(): ThemeMode {
  const valid: ThemeMode[] = ["system", "dark", "light"];
  const stored = typeof window !== "undefined" ? safeStorage.getItem("cc-theme") : null;
  if (stored && valid.includes(stored as ThemeMode)) return stored as ThemeMode;
  const legacy = typeof window !== "undefined" ? safeStorage.getItem("cc-dark-mode") : null;
  if (legacy === "true") return "dark";
  if (legacy === "false") return "light";
  return "system";
}

function initEnum<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = safeStorage.getItem(key) as T;
  return valid.includes(stored) ? stored : fallback;
}

function getInitialNotificationSound(): boolean {
  return initBool("cc-notification-sound", true);
}

function getInitialNotificationDesktop(): boolean {
  return initBool("cc-notification-desktop", true);
}

export function getInitialDiffBase(): DiffBase {
  return initEnum("cc-diff-base", ["last-commit", "default-branch"] as const, "last-commit");
}

export interface UiSlice {
  theme: ThemeMode;
  darkMode: boolean;
  notificationSound: boolean;
  notificationDesktop: boolean;
  yoloMode: boolean;
  showDebugMessages: boolean;
  sidebarOpen: boolean;
  taskPanelOpen: boolean;
  taskPanelConfig: TaskPanelConfig;
  taskPanelConfigMode: boolean;
  homeResetKey: number;
  publicUrl: string;
  editorTabEnabled: boolean;
  newSessionCwd: string | null;
  activeTab: string; // "chat" | "diff" | "terminal" | "editor" | "processes" | "browser" | "panel:<slug>"
  openPanels: string[];
  editorOpenFile: Map<string, string>;
  editorUrl: Map<string, string>;
  editorLoading: Map<string, boolean>;
  chatTabReentryTickBySession: Map<string, number>;
  editorFiles: string[];
  editorActiveFilePath: string | null;
  diffPanelSelectedFile: Map<string, string>;
  diffBase: DiffBase;
  focusedFolder: string | null;
  fragmentState: Map<string, Record<string, unknown>>;
  fragmentConsole: Map<string, ConsoleLogEntry[]>;

  setTheme: (theme: ThemeMode) => void;
  cycleTheme: () => void;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setNotificationSound: (v: boolean) => void;
  toggleNotificationSound: () => void;
  setNotificationDesktop: (v: boolean) => void;
  toggleNotificationDesktop: () => void;
  setYoloMode: (v: boolean) => void;
  toggleYoloMode: () => void;
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
  setDiffPanelSelectedFile: (sessionId: string, filePath: string | null) => void;
  setDiffBase: (base: DiffBase) => void;
  setFocusedFolder: (folder: string | null) => void;
  updateFragmentState: (fragmentId: string, state: Record<string, unknown>) => void;
  appendConsoleLog: (fragmentId: string, entry: ConsoleLogEntry) => void;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  theme: initTheme(),
  darkMode: resolveThemeDark(initTheme()),
  notificationSound: getInitialNotificationSound(),
  notificationDesktop: getInitialNotificationDesktop(),
  yoloMode: initBool("cc-yolo-mode", true),
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
  openPanels: [],
  editorOpenFile: new Map(),
  editorUrl: new Map(),
  editorLoading: new Map(),
  chatTabReentryTickBySession: new Map(),
  editorFiles: [],
  editorActiveFilePath: null,
  diffPanelSelectedFile: new Map(),
  diffBase: getInitialDiffBase(),
  focusedFolder: null,
  fragmentState: new Map(),
  fragmentConsole: new Map(),

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
  setDarkMode: (v) => {
    safeStorage.setItem("cc-dark-mode", String(v));
    set({ darkMode: v });
  },
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      const theme = next ? "dark" : "light";
      safeStorage.setItem("cc-theme", theme);
      safeStorage.setItem("cc-dark-mode", String(next));
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
    // Cross-slice write: clears currentSessionId (owned by SessionsSlice)
    set((s) => ({ currentSessionId: null, activeTab: "chat", homeResetKey: s.homeResetKey + 1 }));
  },
  newSessionInFolder: (cwd) => {
    safeStorage.removeItem("cc-current-session");
    set((s) => ({ currentSessionId: null, activeTab: "chat", newSessionCwd: cwd, homeResetKey: s.homeResetKey + 1 }));
  },
  setEditorTabEnabled: (enabled) => set({ editorTabEnabled: enabled }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  markChatTabReentry: (sessionId) =>
    set((s) => ({ chatTabReentryTickBySession: setInMap(s.chatTabReentryTickBySession, sessionId, (s.chatTabReentryTickBySession.get(sessionId) ?? 0) + 1) })),

  openPanel: (slug) =>
    set((s) => {
      const panels = s.openPanels.includes(slug) ? s.openPanels : [...s.openPanels, slug];
      return { openPanels: panels, activeTab: `panel:${slug}` };
    }),

  closePanel: (slug) =>
    set((s) => {
      const panels = s.openPanels.filter((p) => p !== slug);
      const activeTab = s.activeTab === `panel:${slug}` ? "chat" : s.activeTab;
      return { openPanels: panels, activeTab };
    }),

  setEditorOpenFile: (sessionId, filePath) =>
    set((s) => ({
      editorOpenFile: filePath ? setInMap(s.editorOpenFile, sessionId, filePath) : deleteFromMap(s.editorOpenFile, sessionId),
    })),

  setEditorUrl: (sessionId, url) =>
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

  setDiffBase: (base) => {
    if (typeof window !== "undefined") {
      safeStorage.setItem("cc-diff-base", base);
    }
    set({ diffBase: base });
  },

  setFocusedFolder: (folder) => set({ focusedFolder: folder }),

  updateFragmentState: (fragmentId, state) =>
    set((s) => ({ fragmentState: setInMap(s.fragmentState, fragmentId, state) })),

  appendConsoleLog: (fragmentId, entry) =>
    set((s) => {
      const MAX_LOGS = 200;
      const existing = s.fragmentConsole.get(fragmentId) || [];
      const updated = existing.length >= MAX_LOGS ? [...existing.slice(1), entry] : [...existing, entry];
      return { fragmentConsole: setInMap(s.fragmentConsole, fragmentId, updated) };
    }),
});
