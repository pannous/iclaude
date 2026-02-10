import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "./store.js";
import { connectSession } from "./ws.js";
import { disconnectSession } from "./ws.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { TopBar } from "./components/TopBar.js";
import { HomePage } from "./components/HomePage.js";
import { TaskPanel } from "./components/TaskPanel.js";
import { EditorPanel } from "./components/EditorPanel.js";
import { Playground } from "./components/Playground.js";

function useHash() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => window.location.hash,
  );
}

export default function App() {
  const darkMode = useStore((s) => s.darkMode);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const homeResetKey = useStore((s) => s.homeResetKey);
  const activeTab = useStore((s) => s.activeTab);
  const hash = useHash();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Auto-connect to restored session on mount
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

  if (hash === "#/playground") {
    return <Playground />;
  }

  return (
    <div className="h-[100dvh] flex font-sans-ui bg-cc-bg text-cc-fg antialiased">
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

          {/* Editor tab */}
          {currentSessionId && activeTab === "editor" && (
            <div className="absolute inset-0">
              <EditorPanel sessionId={currentSessionId} />
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
