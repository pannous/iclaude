// LOCAL: useCallback for conversation copy, useState for CLAUDE.md editor
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useStore } from "../store.js";
// LOCAL: Additional features
import { api } from "../api.js";
import { CopyButton } from "./CopyButton.js";
import { ClaudeMdEditor } from "./ClaudeMdEditor.js";
import { conversationToText } from "../utils/message-text.js";
import { parseHash } from "../utils/routing.js";

const EMPTY_MESSAGES: import("../types.js").ChatMessage[] = [];

type WorkspaceTab = "chat" | "diff" | "terminal" | "processes" | "editor";

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
  const markChatTabReentry = useStore((s) => s.markChatTabReentry);
  const quickTerminalOpen = useStore((s) => s.quickTerminalOpen);
  const quickTerminalTabs = useStore((s) => s.quickTerminalTabs);
  const openQuickTerminal = useStore((s) => s.openQuickTerminal);
  const resetQuickTerminal = useStore((s) => s.resetQuickTerminal);
  const changedFilesCount = useStore((s) =>
    currentSessionId ? (s.gitChangedFilesCount.get(currentSessionId) ?? 0) : 0
  );

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
  // LOCAL: CLAUDE.md editor state
  const [claudeMdOpen, setClaudeMdOpen] = useState(false);
  const sessionName = currentSessionId
    ? (sessionTitle ||
      sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
      `Session ${currentSessionId.slice(0, 8)}`)
    : null;
  const showWorkspaceControls = !!(currentSessionId && isSessionView);
  const showContextToggle = route.page === "session" && !!currentSessionId;
  const workspaceTabs: WorkspaceTab[] = ["chat", "diff", "terminal", "processes", "editor"];

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
    <header className="relative shrink-0 h-11 px-4 bg-cc-bg">
      <div className="h-full flex items-center gap-1 min-w-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer shrink-0 ${
            sidebarOpen
              ? "text-cc-primary bg-cc-active"
              : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
          }`}
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[15px] h-[15px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          </svg>
        </button>

        {showWorkspaceControls && (
          <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => {
                  if (activeTab === "chat" && currentSessionId) {
                    window.dispatchEvent(new CustomEvent("companion:scroll-to-top", { detail: { sessionId: currentSessionId } }));
                  } else {
                    activateWorkspaceTab("chat");
                  }
                }}
                className={`h-full px-3 text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 border-b-[1.5px] shrink-0 ${
                  activeTab === "chat"
                    ? "text-cc-fg border-cc-primary"
                    : "text-cc-muted hover:text-cc-fg border-transparent"
                }`}
                title={sessionName || "Session"}
                aria-label="Session tab"
              >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    !isConnected
                      ? "bg-cc-muted opacity-45"
                      : status === "running"
                        ? "bg-cc-primary"
                        : status === "compacting"
                          ? "bg-cc-warning"
                          : "bg-cc-success"
                  }`} />
                  Session
              </button>
              <button
                onClick={() => activateWorkspaceTab("diff")}
                className={`h-full px-3 text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 border-b-[1.5px] shrink-0 ${
                  activeTab === "diff"
                    ? "text-cc-fg border-cc-primary"
                    : "text-cc-muted hover:text-cc-fg border-transparent"
                }`}
                aria-label="Diffs tab"
              >
                Diffs
                {changedFilesCount > 0 && (
                  <span className="text-[9px] rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center font-semibold leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                    {changedFilesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => activateWorkspaceTab("terminal")}
                disabled={!cwd}
                className={`h-full px-3 text-[12px] font-medium transition-colors flex items-center border-b-[1.5px] shrink-0 ${
                  !cwd
                    ? "text-cc-muted/50 border-transparent cursor-not-allowed"
                    : activeTab === "terminal"
                      ? "text-cc-fg border-cc-primary cursor-pointer"
                      : "text-cc-muted hover:text-cc-fg border-transparent cursor-pointer"
                }`}
                title={terminalButtonTitle}
                aria-label="Shell tab"
              >
                Shell
              </button>
              <button
                onClick={() => activateWorkspaceTab("editor")}
                disabled={!cwd}
                className={`h-full px-3 text-[12px] font-medium transition-colors flex items-center border-b-[1.5px] shrink-0 ${
                  !cwd
                    ? "text-cc-muted/50 border-transparent cursor-not-allowed"
                    : activeTab === "editor"
                      ? "text-cc-fg border-cc-primary cursor-pointer"
                      : "text-cc-muted hover:text-cc-fg border-transparent cursor-pointer"
                }`}
                title={!cwd ? "Editor unavailable while session is reconnecting" : "Editor"}
                aria-label="Editor tab"
              >
                Editor
              </button>
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
        {/* LOCAL: Folder + Branch info */}
        {currentSessionId && isSessionView && cwd && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-cc-muted mr-1">
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

        {/* LOCAL: Copy conversation button */}
        {currentSessionId && isSessionView && messages.length > 0 && (
          <CopyButton getText={getConversationText} size="md" title="Copy entire conversation" />
        )}

        {/* LOCAL: Reconnect button */}
        {currentSessionId && isSessionView && !isConnected && (
          <button
            onClick={() => currentSessionId && api.relaunchSession(currentSessionId).catch(console.error)}
            className="text-[11px] text-cc-warning hover:text-cc-warning/80 font-medium cursor-pointer hidden sm:inline"
          >
            Reconnect
          </button>
        )}

        {/* LOCAL: CLAUDE.md editor button */}
        {cwd && (
          <button
            onClick={() => setClaudeMdOpen(true)}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer ${
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
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
                taskPanelOpen
                  ? "text-cc-primary bg-cc-active"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
              title="Toggle context panel"
              aria-label="Toggle context panel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-[15px] h-[15px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* LOCAL: CLAUDE.md editor modal */}
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

/** Theme toggle — styled as sidebar nav grid item */
export function ThemeToggle() {
  const darkMode = useStore((s) => s.darkMode);
  const toggle = useCallback(() => useStore.getState().toggleDarkMode(), []);

  return (
    <button
      onClick={toggle}
      className="flex flex-col items-center justify-center gap-0.5 py-2.5 px-1.5 min-h-[44px] rounded-lg transition-colors cursor-pointer text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      )}
      <span className="text-[10px] font-medium leading-none">Theme</span>
    </button>
  );
}
