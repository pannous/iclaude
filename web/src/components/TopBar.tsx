import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { CopyButton } from "./CopyButton.js";
import { SkillPicker } from "./SkillPicker.js";
import { ClaudeMdEditor } from "./ClaudeMdEditor.js";
import { conversationToText } from "../utils/message-text.js";
import { parseHash } from "../utils/routing.js";

const EMPTY_MESSAGES: import("../types.js").ChatMessage[] = [];

type WorkspaceTab = "chat" | "diff" | "terminal" | "editor";

function getActiveTabSurfaceColor(tab: WorkspaceTab | string): string {
  if (tab === "terminal" || tab === "editor") return "var(--cc-card)";
  return "var(--cc-bg)";
}

function isVisibleColor(value: string | null | undefined): value is string {
  if (!value) return false;
  const color = value.trim().toLowerCase();
  return color !== "transparent" && color !== "rgba(0, 0, 0, 0)" && color !== "rgba(0,0,0,0)";
}

function sampleColorBelowTab(button: HTMLButtonElement | null): string | null {
  if (!button || typeof document.elementsFromPoint !== "function") return null;
  const rect = button.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), Math.max(window.innerWidth - 1, 0));
  const y = Math.min(Math.max(rect.bottom + 1, 0), Math.max(window.innerHeight - 1, 0));

  const stack = document.elementsFromPoint(x, y);
  for (const element of stack) {
    if (button.contains(element)) continue;
    const color = window.getComputedStyle(element).backgroundColor;
    if (isVisibleColor(color)) return color;
  }

  const bodyColor = window.getComputedStyle(document.body).backgroundColor;
  return isVisibleColor(bodyColor) ? bodyColor : null;
}

export function TopBar() {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
  );
  const route = useMemo(() => parseHash(hash), [hash]);
  const isSessionView = route.page === "session" || route.page === "home";
  const currentSessionId = useStore((s) => s.currentSessionId);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const sessionNames = useStore((s) => s.sessionNames);
  const sdkSessions = useStore((s) => s.sdkSessions);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const messages = useStore((s) => currentSessionId ? s.messages.get(currentSessionId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES);
  const getConversationText = useCallback(() => conversationToText(messages), [messages]);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openSkills = useStore((s) => s.openSkills);
  const closeSkill = useStore((s) => s.closeSkill);
  const markChatTabReentry = useStore((s) => s.markChatTabReentry);
  const editorUrl = useStore((s) => currentSessionId ? s.editorUrls.get(currentSessionId) : undefined);
  const [claudeMdOpen, setClaudeMdOpen] = useState(false);
  const quickTerminalOpen = useStore((s) => s.quickTerminalOpen);
  const quickTerminalTabs = useStore((s) => s.quickTerminalTabs);
  const openQuickTerminal = useStore((s) => s.openQuickTerminal);
  const resetQuickTerminal = useStore((s) => s.resetQuickTerminal);
  const changedFilesCount = useStore((s) => {
    if (!currentSessionId) return 0;
    const cwd =
      s.sessions.get(currentSessionId)?.cwd ||
      s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.cwd;
    const files = s.changedFiles.get(currentSessionId);
    if (!files) return 0;
    if (!cwd) return files.size;
    const prefix = `${cwd}/`;
    return [...files].filter((fp) => fp === cwd || fp.startsWith(prefix)).length;
  });

  const sessionTitle = useStore((s) => {
    if (!currentSessionId) return undefined;
    const sdkTitle = s.sdkSessions.find((ss) => ss.sessionId === currentSessionId)?.title;
    return sdkTitle || s.sessionNames.get(currentSessionId);
  });
  const cwd = useStore((s) => {
    if (!currentSessionId) return null;
    return (
      s.sessions.get(currentSessionId)?.cwd ||
      s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.cwd ||
      null
    );
  });
  const gitBranch = useStore((s) => {
    if (!currentSessionId) return null;
    return (
      s.sessions.get(currentSessionId)?.git_branch ||
      s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.gitBranch ||
      null
    );
  });
  const sdkSession = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId) || null;
  });
  const bridgeSession = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sessions.get(currentSessionId) || null;
  });
  const defaultTerminalOpts = useMemo(() => {
    if (sdkSession?.containerId) {
      return { target: "docker" as const, cwd: "/workspace", containerId: sdkSession.containerId };
    }
    return { target: "host" as const, cwd: cwd || "" };
  }, [cwd, sdkSession?.containerId]);
  const terminalButtonTitle = !cwd
    ? "Terminal unavailable while session is reconnecting"
    : sdkSession?.containerId || bridgeSession?.is_containerized
      ? "Open terminal in session container (Ctrl/Cmd+J)"
      : "Quick terminal (Ctrl/Cmd+J)";
  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const activeTabSurfaceColor = useMemo(() => getActiveTabSurfaceColor(activeTab as WorkspaceTab), [activeTab]);
  const chatTabRef = useRef<HTMLButtonElement>(null);
  const diffTabRef = useRef<HTMLButtonElement>(null);
  const editorTabRef = useRef<HTMLButtonElement>(null);
  const terminalTabRef = useRef<HTMLButtonElement>(null);
  const [sampledTabColors, setSampledTabColors] = useState<Partial<Record<WorkspaceTab, string>>>({});
  const sessionName = currentSessionId
    ? (sessionTitle ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showWorkspaceControls = !!(currentSessionId && isSessionView);
  const showContextToggle = route.page === "session" && !!currentSessionId;
  const editorFileCount = useStore((s) => s.editorFiles.length);
  const workspaceTabs = useMemo(() => {
    const tabs: WorkspaceTab[] = ["chat", "diff", "terminal", "editor"];
    return tabs;
  }, [editorFileCount]);

  const activateWorkspaceTab = (tab: WorkspaceTab) => {
    if (tab === "terminal") {
      if (!cwd) return;
      if (!quickTerminalOpen || quickTerminalTabs.length === 0) {
        openQuickTerminal({ ...defaultTerminalOpts, reuseIfExists: true });
      }
      setActiveTab("terminal");
      return;
    }

    if (tab === "editor") {
      if (!cwd) return;
      setActiveTab("editor");
      return;
    }

    if (tab === "chat" && activeTab !== "chat" && currentSessionId) {
      markChatTabReentry(currentSessionId);
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!currentSessionId) {
      resetQuickTerminal();
    }
  }, [currentSessionId, resetQuickTerminal]);

  useEffect(() => {
    if (!showWorkspaceControls) return;

    const measure = () => {
      setSampledTabColors((prev) => {
        const next: Partial<Record<WorkspaceTab, string>> = {};
        const chatColor = sampleColorBelowTab(chatTabRef.current);
        const diffColor = sampleColorBelowTab(diffTabRef.current);
        const terminalColor = sampleColorBelowTab(terminalTabRef.current);
        const editorColor = sampleColorBelowTab(editorTabRef.current);
        if (chatColor) next.chat = chatColor;
        if (diffColor) next.diff = diffColor;
        if (terminalColor) next.terminal = terminalColor;
        if (editorColor) next.editor = editorColor;
        if (
          prev.chat === next.chat &&
          prev.diff === next.diff &&
          prev.terminal === next.terminal &&
          prev.editor === next.editor
        ) {
          return prev;
        }
        return next;
      });
    };

    let scheduled = false;
    const scheduleMeasure = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        measure();
      });
    };

    const raf = window.requestAnimationFrame(measure);
    const interval = window.setInterval(scheduleMeasure, 5000);
    window.addEventListener("resize", scheduleMeasure);
    document.addEventListener("scroll", scheduleMeasure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
      window.removeEventListener("resize", scheduleMeasure);
      document.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [showWorkspaceControls, activeTab, currentSessionId, taskPanelOpen, sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "j") return;
      if (!showWorkspaceControls) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      const currentIndex = Math.max(0, workspaceTabs.indexOf(activeTab as WorkspaceTab));
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + workspaceTabs.length) % workspaceTabs.length;
      activateWorkspaceTab(workspaceTabs[nextIndex]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showWorkspaceControls, workspaceTabs, activeTab, cwd, quickTerminalOpen, quickTerminalTabs.length, openQuickTerminal, defaultTerminalOpts, setActiveTab, markChatTabReentry, currentSessionId]);

  return (
    <header className="relative shrink-0 h-12 px-2 sm:px-4 bg-cc-sidebar border-b border-cc-border">
      <div className="h-full flex items-end gap-2 min-w-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mb-px flex items-center justify-center w-8 h-8 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer shrink-0"
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        {showWorkspaceControls && (
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-1 min-w-0">
              <button
                ref={chatTabRef}
                onClick={() => activateWorkspaceTab("chat")}
                className={`h-9 px-3.5 border text-[12px] font-semibold transition-colors cursor-pointer min-w-0 max-w-[44vw] sm:max-w-[30vw] truncate ${
                  activeTab === "chat"
                    ? "relative z-10 h-9 -mb-px text-cc-fg border-cc-border/80 border-b-transparent rounded-[14px_14px_0_0]"
                    : "h-8 mb-px bg-transparent text-cc-muted border-transparent rounded-[8px_8px_0_0] hover:bg-cc-hover/70 hover:text-cc-fg"
                }`}
                style={activeTab === "chat" ? { backgroundColor: sampledTabColors.chat || activeTabSurfaceColor } : undefined}
                title={sessionName || "Session"}
                aria-label="Session tab"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    !isConnected
                      ? "bg-cc-muted opacity-45"
                      : status === "running"
                        ? "bg-cc-primary"
                        : status === "compacting"
                          ? "bg-cc-warning"
                          : "bg-cc-success"
                  }`} />
                  <span className="truncate">{sessionName || "Session"}</span>
                </span>
              </button>
              <button
                ref={diffTabRef}
                onClick={() => activateWorkspaceTab("diff")}
                className={`px-3.5 border text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "diff"
                    ? "relative z-10 h-9 -mb-px text-cc-fg border-cc-border/80 border-b-transparent rounded-[14px_14px_0_0]"
                    : "h-8 mb-px bg-transparent text-cc-muted border-transparent rounded-[8px_8px_0_0] hover:bg-cc-hover/70 hover:text-cc-fg"
                }`}
                style={activeTab === "diff" ? { backgroundColor: sampledTabColors.diff || activeTabSurfaceColor } : undefined}
                aria-label="Diffs tab"
              >
                Diffs
                {changedFilesCount > 0 && (
                  <span className="text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold leading-none border border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                    {changedFilesCount}
                  </span>
                )}
              </button>
              <button
                ref={terminalTabRef}
                onClick={() => activateWorkspaceTab("terminal")}
                disabled={!cwd}
                className={`px-3.5 border text-[12px] font-semibold transition-colors ${
                  !cwd
                    ? "h-8 mb-px bg-transparent text-cc-muted/50 border-transparent rounded-[8px_8px_0_0] cursor-not-allowed"
                    : activeTab === "terminal"
                      ? "relative z-10 h-9 -mb-px text-cc-fg border-cc-border/80 border-b-transparent rounded-[14px_14px_0_0] cursor-pointer"
                      : "h-8 mb-px bg-transparent text-cc-muted border-transparent rounded-[8px_8px_0_0] hover:bg-cc-hover/70 hover:text-cc-fg cursor-pointer"
                }`}
                style={activeTab === "terminal" ? { backgroundColor: sampledTabColors.terminal || activeTabSurfaceColor } : undefined}
                title={terminalButtonTitle}
                aria-label="Shell tab"
              >
                Shell
              </button>
              <button
                ref={editorTabRef}
                onClick={() => activateWorkspaceTab("editor")}
                disabled={!cwd}
                className={`px-3.5 border text-[12px] font-semibold transition-colors ${
                  !cwd
                    ? "h-8 mb-px bg-transparent text-cc-muted/50 border-transparent rounded-[8px_8px_0_0] cursor-not-allowed"
                    : activeTab === "editor"
                      ? "relative z-10 h-9 -mb-px text-cc-fg border-cc-border/80 border-b-transparent rounded-[14px_14px_0_0] cursor-pointer"
                      : "h-8 mb-px bg-transparent text-cc-muted border-transparent rounded-[8px_8px_0_0] hover:bg-cc-hover/70 hover:text-cc-fg cursor-pointer"
                }`}
                style={activeTab === "editor" ? { backgroundColor: sampledTabColors.editor || activeTabSurfaceColor } : undefined}
                title={!cwd ? "Editor unavailable while session is reconnecting" : "VS Code editor"}
                aria-label="Editor tab"
              >
                Editor
              </button>
              {editorUrl && (
                <a
                  href={editorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 mb-px px-1.5 flex items-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover/70 transition-colors"
                  title="Open editor in new window"
                  aria-label="Open editor in new window"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M6.22 8.72a.75.75 0 001.06 1.06l5.22-5.22v1.69a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75h-3.5a.75.75 0 000 1.5h1.69L6.22 8.72z" />
                    <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 007 4H4.75A2.75 2.75 0 002 6.75v4.5A2.75 2.75 0 004.75 14h4.5A2.75 2.75 0 0012 11.25V9a.75.75 0 00-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5z" />
                  </svg>
                </a>
              )}
              {openSkills.map((slug) => (
                <TabBtn
                  key={slug}
                  label={slug}
                  active={activeTab === `skill:${slug}`}
                  onClick={() => setActiveTab(`skill:${slug}`)}
                  onClose={() => closeSkill(slug)}
                />
              ))}
              <SkillPicker />
              <div
                className="hidden lg:flex h-8 mb-px items-center ml-1 pl-2 border-l border-cc-border/40"
                title="Switch tabs with Ctrl/Cmd + J"
                aria-label="Tab switch shortcut"
              >
                <span className="inline-flex items-center gap-1 text-[10px] text-cc-muted/50">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-3 h-3">
                    <rect x="1.75" y="3" width="12.5" height="10" rx="1.75" />
                    <path d="M4.5 6.5h7M4.5 9h5.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-mono-code text-[10px] leading-none">J</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Folder + Branch display (non-workspace-controls path) */}
        {!showWorkspaceControls && currentSessionId && sessionTitle && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-medium text-cc-fg truncate max-w-[320px]">{sessionTitle}</span>
          </div>
        )}

        {/* Right side */}
        <div className="mb-px flex items-center gap-1.5 shrink-0">
        {/* Folder + Branch info */}
        {currentSessionId && isSessionView && cwd && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-cc-muted">
            <span className="opacity-30">|</span>
            <span title={cwd} className="truncate max-w-[120px] cursor-default">
              {cwd.split("/").filter(Boolean).pop() || "/"}
            </span>
            {gitBranch && (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 opacity-50">
                  <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.116.862a2.25 2.25 0 10-.862.862A4.48 4.48 0 007.25 7.5h-1.5A2.25 2.25 0 003.5 9.75v.318a2.25 2.25 0 101.5 0V9.75a.75.75 0 01.75-.75h1.5a5.98 5.98 0 003.884-1.435A2.25 2.25 0 109.634 3.362zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                </svg>
                <span className="truncate max-w-[140px]">{gitBranch}</span>
              </>
            )}
          </div>
        )}

        {/* Copy conversation button */}
        {currentSessionId && isSessionView && messages.length > 0 && (
          <CopyButton getText={getConversationText} size="md" title="Copy entire conversation" />
        )}

        {/* Reconnect button */}
        {currentSessionId && isSessionView && !isConnected && (
          <button
            onClick={() => currentSessionId && api.relaunchSession(currentSessionId).catch(console.error)}
            className="text-[11px] text-cc-warning hover:text-cc-warning/80 font-medium cursor-pointer hidden sm:inline"
          >
            Reconnect
          </button>
        )}

        {cwd && (
          <button
            onClick={() => setClaudeMdOpen(true)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer ${
              claudeMdOpen
                ? "text-cc-primary bg-cc-active"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
            }`}
            title="Edit CLAUDE.md"
            aria-label="Edit CLAUDE.md"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13zm1 .5v12h8V4h-1.5a.5.5 0 01-.5-.5V2H5zm6 0v1h1l-1-1zM6.5 7a.5.5 0 000 1h5a.5.5 0 000-1h-5zm0 2a.5.5 0 000 1h5a.5.5 0 000-1h-5zm0 2a.5.5 0 000 1h3a.5.5 0 000-1h-3z" />
            </svg>
          </button>
        )}
        {showContextToggle && (
          <button
            onClick={() => setTaskPanelOpen(!taskPanelOpen)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg transition-colors cursor-pointer ${
              taskPanelOpen
                ? "text-cc-primary bg-cc-active"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
            }`}
            title="Toggle context panel"
            aria-label="Toggle context panel"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 3a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline text-[11px] font-medium">Context</span>
          </button>
        )}
        </div>
      </div>

      {/* CLAUDE.md editor modal */}
      {cwd && (
        <ClaudeMdEditor
          cwd={cwd}
          open={claudeMdOpen}
          onClose={() => setClaudeMdOpen(false)}
        />
      )}
    </header>
  );
}

function TabBtn({ label, active, onClick, onClose, badge }: {
  label: string; active: boolean; onClick: () => void;
  onClose?: () => void; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
        active ? "bg-cc-card text-cc-fg shadow-sm" : "text-cc-muted hover:text-cc-fg"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="text-[9px] bg-cc-warning text-white rounded-full w-4 h-4 flex items-center justify-center font-semibold leading-none">
          {badge}
        </span>
      )}
      {onClose && (
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="ml-0.5 text-cc-muted hover:text-cc-fg"
        >
          &times;
        </span>
      )}
    </button>
  );
}
