import { useEffect, useState, lazy, Suspense } from "react";
import { useStore } from "./store.js";
import { connectSession } from "./ws.js";
import { disconnectSession } from "./ws.js";
import { api } from "./api.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { TopBar } from "./components/TopBar.js";
import { HomePage } from "./components/HomePage.js";
import { TaskPanel } from "./components/TaskPanel.js";

const EditorPanel = lazy(() => import("./components/EditorPanel.js").then(m => ({ default: m.EditorPanel })));

export default function App() {
  const darkMode = useStore((s) => s.darkMode);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const homeResetKey = useStore((s) => s.homeResetKey);
  const activeTab = useStore((s) => s.activeTab);
  const [showArchiveAllConfirm, setShowArchiveAllConfirm] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Restore last session from localStorage on mount
  useEffect(() => {
    const restoredId = useStore.getState().currentSessionId;
    if (restoredId) {
      connectSession(restoredId);
    }
  }, []);

  // Global keyboard shortcuts for starting a new session and navigating between sessions
  useEffect(() => {
    function navigateSession(direction: 'prev' | 'next') {
      const store = useStore.getState();
      const sdkSessions = store.sdkSessions;
      const currentId = store.currentSessionId;

      // Get active (non-archived) sessions sorted by creation time (newest first)
      const activeSessions = sdkSessions
        .filter(s => !s.archived)
        .sort((a, b) => b.createdAt - a.createdAt);

      if (activeSessions.length === 0) return;

      // Find current session index
      const currentIndex = activeSessions.findIndex(s => s.sessionId === currentId);

      let targetIndex: number;
      if (currentIndex === -1) {
        // No current session or session not found - go to first
        targetIndex = 0;
      } else if (direction === 'prev') {
        // Previous session (wrap around)
        targetIndex = (currentIndex - 1 + activeSessions.length) % activeSessions.length;
      } else {
        // Next session (wrap around)
        targetIndex = (currentIndex + 1) % activeSessions.length;
      }

      const targetSession = activeSessions[targetIndex];
      if (targetSession && targetSession.sessionId !== currentId) {
        // Disconnect current session
        if (currentId) {
          disconnectSession(currentId);
        }

        // Connect to new session
        store.setCurrentSession(targetSession.sessionId);
        connectSession(targetSession.sessionId);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Alt+X or Ctrl+Delete to archive current session
      const isArchiveShortcut =
        (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'x') ||
        ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === 'Delete');

      if (isArchiveShortcut) {
        e.preventDefault();

        const store = useStore.getState();
        const currentId = store.currentSessionId;

        if (currentId) {
          // Archive the current session
          disconnectSession(currentId);
          api.archiveSession(currentId).catch(() => {
            // best-effort
          });

          // Go back to home page
          store.newSession();

          // Refresh session list
          api.listSessions().then((list) => {
            store.setSdkSessions(list);
          }).catch(() => {
            // best-effort
          });
        }
        return;
      }

      // Ctrl+S or Ctrl+T to start a new session
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 't')) {
        e.preventDefault();

        const store = useStore.getState();
        const currentId = store.currentSessionId;

        // Disconnect current session if any
        if (currentId) {
          disconnectSession(currentId);
        }

        // Clear current session and reset home page
        store.newSession();

        // Navigate to home if on playground
        if (window.location.hash === "#/playground") {
          window.location.hash = "";
        }
        return;
      }

      // Browser Back/Forward keys (keyboard keys like on some keyboards/laptops)
      if (e.key === 'BrowserBack' || e.key === 'Back') {
        e.preventDefault();
        navigateSession('prev');
        return;
      }
      if (e.key === 'BrowserForward' || e.key === 'Forward') {
        e.preventDefault();
        navigateSession('next');
        return;
      }

      // Alt+Ctrl+PageUp/PageDown for session navigation
      if (e.altKey && e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        navigateSession('prev');
        return;
      }
      if (e.altKey && e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        navigateSession('next');
        return;
      }

      // Navigate between sessions with various modifier combinations + arrow keys
      // Supported: Ctrl+Alt+Arrow, Ctrl+Super+Arrow, Alt+Super+Arrow, Ctrl+Alt+Super+Arrow
      const isNavigationCombo = (
        (e.ctrlKey && e.altKey) ||
        ((e.ctrlKey || e.metaKey) && e.altKey) ||
        (e.altKey && e.metaKey) ||
        (e.ctrlKey && e.altKey && e.metaKey)
      );

      const isPrevKey = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      const isNextKey = e.key === 'ArrowDown' || e.key === 'ArrowRight';

      if (isNavigationCombo && (isPrevKey || isNextKey)) {
        e.preventDefault();
        navigateSession(isPrevKey ? 'prev' : 'next');
      }
    }

    function handleMouseButton(e: MouseEvent) {
      // Mouse button 1 = Middle (archive session or archive all if Shift is pressed)
      if (e.button === 1) {
        e.preventDefault();

        // Shift+Middle Click = Archive all sessions (with confirmation)
        if (e.shiftKey) {
          setShowArchiveAllConfirm(true);
          return;
        }

        // Middle Click = Archive current session
        const store = useStore.getState();
        const currentId = store.currentSessionId;

        if (currentId) {
          // Archive the current session
          disconnectSession(currentId);
          api.archiveSession(currentId).catch(() => {
            // best-effort
          });

          // Go back to home page
          store.newSession();

          // Refresh session list
          api.listSessions().then((list) => {
            store.setSdkSessions(list);
          }).catch(() => {
            // best-effort
          });
        }
        return;
      }

      // Mouse button 3 = Back, button 4 = Forward
      if (e.button === 3) {
        e.preventDefault();
        navigateSession('prev');
      } else if (e.button === 4) {
        e.preventDefault();
        navigateSession('next');
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseButton);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseButton);
    };
  }, []);

  async function handleArchiveSessions(inactiveOnly: boolean) {
    const store = useStore.getState();
    const sdkSessions = store.sdkSessions;
    const activeSessions = sdkSessions.filter(s => !s.archived);

    const toArchive = inactiveOnly
      ? activeSessions.filter(s => {
          const status = store.sessionStatus.get(s.sessionId);
          return !status || status === "idle";
        })
      : activeSessions;

    if (toArchive.length === 0) {
      setShowArchiveAllConfirm(false);
      return;
    }

    const currentId = store.currentSessionId;
    const archivingCurrent = currentId && toArchive.some(s => s.sessionId === currentId);

    if (archivingCurrent) {
      disconnectSession(currentId);
      store.newSession();
    }

    for (const session of toArchive) {
      api.archiveSession(session.sessionId).catch(() => {});
    }

    api.listSessions().then((list) => {
      store.setSdkSessions(list);
    }).catch(() => {});

    setShowArchiveAllConfirm(false);
  }

  return (
    <div className="h-[100dvh] flex font-sans-ui bg-cc-bg text-cc-fg antialiased">
      {/* Archive All Confirmation Modal */}
      {showArchiveAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-cc-card border border-cc-border rounded-[14px] shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-cc-warning shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-cc-fg mb-1">Archive Sessions</h3>
                <p className="text-sm text-cc-muted leading-relaxed">
                  Archive sessions to clean up your sidebar. You can restore them later from the archived section.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowArchiveAllConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-cc-hover text-cc-fg hover:bg-cc-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveSessions(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-cc-primary hover:bg-cc-primary-hover text-white transition-colors cursor-pointer"
              >
                Inactive Only
              </button>
              <button
                onClick={() => handleArchiveSessions(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-cc-warning hover:bg-amber-500 text-white transition-colors cursor-pointer"
              >
                Archive All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => useStore.getState().setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — overlay on mobile, inline on desktop */}
      <div
        className={`
          fixed md:relative z-40 md:z-auto
          h-full shrink-0 transition-all duration-200
          ${sidebarOpen ? "w-[260px] translate-x-0" : "w-0 -translate-x-full md:w-0 md:-translate-x-full"}
          overflow-hidden
        `}
      >
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-hidden relative">
          {/* Chat tab — visible when activeTab is "chat" or no session */}
          <div className={`absolute inset-0 ${activeTab === "chat" || !currentSessionId ? "" : "hidden"}`}>
            {currentSessionId ? (
              <ChatView sessionId={currentSessionId} />
            ) : (
              <HomePage key={homeResetKey} />
            )}
          </div>

          {/* Editor tab — lazy-loaded to reduce initial bundle */}
          {currentSessionId && activeTab === "editor" && (
            <div className="absolute inset-0">
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-cc-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <EditorPanel sessionId={currentSessionId} />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* Task panel — overlay on mobile, inline on desktop */}
      {currentSessionId && (
        <>
          {/* Mobile overlay backdrop */}
          {taskPanelOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => useStore.getState().setTaskPanelOpen(false)}
            />
          )}

          <div
            className={`
              fixed lg:relative z-40 lg:z-auto right-0 top-0
              h-full shrink-0 transition-all duration-200
              ${taskPanelOpen ? "w-[280px] translate-x-0" : "w-0 translate-x-full lg:w-0 lg:translate-x-full"}
              overflow-hidden
            `}
          >
            <TaskPanel sessionId={currentSessionId} />
          </div>
        </>
      )}
    </div>
  );
}
