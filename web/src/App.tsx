import { lazy, Suspense, useEffect, useState, useMemo, useRef, useSyncExternalStore, type ComponentType } from "react";
import { useStore } from "./store.js";
import { connectSession, disconnectSession, sendToSession } from "./ws.js";
import { api, autoAuth } from "./api.js";
import { parseHash, navigateToSession, navigateHome, type Route } from "./utils/routing.js";
import { handleKeyDown, createMouseHandler } from "./utils/keybindings.js";
import { LoginPage } from "./components/LoginPage.js";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import { TopBar } from "./components/TopBar.js";
import { HomePage } from "./components/HomePage.js";
import { TaskPanel } from "./components/TaskPanel.js";
import { DiffPanel } from "./components/DiffPanel.js";
import { UpdateBanner } from "./components/UpdateBanner.js";
import { SessionLaunchOverlay } from "./components/SessionLaunchOverlay.js";
import { SessionTerminalDock } from "./components/SessionTerminalDock.js";
import { SessionEditorPane } from "./components/SessionEditorPane.js";
import { UpdateOverlay } from "./components/UpdateOverlay.js";

// Extract named export as lazy component — eliminates repetitive .then() boilerplate
function lazyNamed<T extends Record<string, ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}

// Lazy-loaded route-level pages (not needed for initial render)
const Playground = lazyNamed(() => import("./components/Playground.js"), "Playground");
const SettingsPage = lazyNamed(() => import("./components/SettingsPage.js"), "SettingsPage");
const IntegrationsPage = lazyNamed(() => import("./components/IntegrationsPage.js"), "IntegrationsPage");
const LinearSettingsPage = lazyNamed(() => import("./components/LinearSettingsPage.js"), "LinearSettingsPage");
const TailscalePage = lazyNamed(() => import("./components/TailscalePage.js"), "TailscalePage");
const PromptsPage = lazyNamed(() => import("./components/PromptsPage.js"), "PromptsPage");
const EnvManager = lazyNamed(() => import("./components/EnvManager.js"), "EnvManager");
const DockerBuilderPage = lazyNamed(() => import("./components/DockerBuilderPage.js"), "DockerBuilderPage");
const CronManager = lazyNamed(() => import("./components/CronManager.js"), "CronManager");
const AgentsPage = lazyNamed(() => import("./components/AgentsPage.js"), "AgentsPage");
const RunsPage = lazyNamed(() => import("./components/RunsPage.js"), "RunsPage");
const TerminalPage = lazyNamed(() => import("./components/TerminalPage.js"), "TerminalPage");
// LOCAL: Panel, panels page, and file editor lazy loads
const Panel = lazyNamed(() => import("./components/Panel.js"), "Panel");
const PanelsPage = lazyNamed(() => import("./components/PanelsPage.js"), "PanelsPage");
const ProcessPanel = lazyNamed(() => import("./components/ProcessPanel.js"), "ProcessPanel");

// Route → lazy component map for simple full-page routes rendered inside <Suspense>
const PAGE_MAP: Partial<Record<Route["page"], { component: ComponentType<any>; props?: Record<string, unknown> }>> = {
  settings: { component: SettingsPage, props: { embedded: true } },
  prompts: { component: PromptsPage, props: { embedded: true } },
  integrations: { component: IntegrationsPage, props: { embedded: true } },
  "integration-linear": { component: LinearSettingsPage, props: { embedded: true } },
  "integration-tailscale": { component: TailscalePage, props: { embedded: true } },
  terminal: { component: TerminalPage },
  environments: { component: EnvManager, props: { embedded: true } },
  "docker-builder": { component: DockerBuilderPage },
  scheduled: { component: CronManager, props: { embedded: true } },
  panels: { component: PanelsPage },
};


function LazyFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-sm text-cc-muted">Loading...</div>
    </div>
  );
}


function useHash() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); },
    () => window.location.hash,
  );
}

export default function App() {
  const theme = useStore((s) => s.theme);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const authChecking = useStore((s) => s.authChecking);
  const setAuthToken = useStore((s) => s.setAuthToken);
  const setAuthChecking = useStore((s) => s.setAuthChecking);
  const darkMode = useStore((s) => s.darkMode);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const focusedFolder = useStore((s) => s.focusedFolder);
  const homeResetKey = useStore((s) => s.homeResetKey);
  const activeTab = useStore((s) => s.activeTab);
  const [showArchiveAllConfirm, setShowArchiveAllConfirm] = useState(false);
  const editorTabEnabled = useStore((s) => s.editorTabEnabled);
  const setEditorTabEnabled = useStore((s) => s.setEditorTabEnabled);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const sessionCreating = useStore((s) => s.sessionCreating);
  const sessionCreatingBackend = useStore((s) => s.sessionCreatingBackend);
  const creationProgress = useStore((s) => s.creationProgress);
  const creationError = useStore((s) => s.creationError);
  const updateOverlayActive = useStore((s) => s.updateOverlayActive);
  const hash = useHash();
  const route = useMemo(() => parseHash(hash), [hash]);
  const isRunsPage = route.page === "runs";
  const isSessionView = route.page === "session" || route.page === "home";

  // LOCAL: On startup, attempt autoAuth so the login page never flashes when auth is disabled
  useEffect(() => {
    if (isAuthenticated) return; // already logged in (token in localStorage)
    autoAuth().then((token) => {
      if (token) {
        setAuthToken(token);
      } else {
        setAuthChecking(false); // no auto-token — show login form
      }
    }).catch(() => setAuthChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // When theme is "system", track OS preference changes in real time
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      useStore.setState({ darkMode: e.matches });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Migrate legacy "files" tab to "editor"
  useEffect(() => {
    // Migrate legacy "files" tab to "editor"
    if ((activeTab as string) === "files") {
      setActiveTab("editor");
      return;
    }
    if (!isAuthenticated) return;
    api.getSettings().then((settings) => {
      setEditorTabEnabled(settings.editorTabEnabled);
    }).catch((e) => console.warn("[app] getSettings", e));
  }, [isAuthenticated, setEditorTabEnabled, activeTab, setActiveTab]);

  useEffect(() => {
    if (!editorTabEnabled && activeTab === "editor") {
      setActiveTab("chat");
    }
  }, [activeTab, setActiveTab]);

  // Capture the localStorage-restored session ID during render (before any effects run)
  // so the mount logic can use it even if the hash-sync branch would clear it.
  const restoredIdRef = useRef(useStore.getState().currentSessionId);

  // Sync hash → store. On mount, restore a localStorage session into the URL first.
  useEffect(() => {
    // On first mount with no session hash, restore from localStorage
    if (restoredIdRef.current !== null && route.page === "home") {
      navigateToSession(restoredIdRef.current, true);
      restoredIdRef.current = null;
      return; // navigateToSession triggers hashchange → this effect re-runs with the session route
    }
    restoredIdRef.current = null;

    if (route.page === "session") {
      const store = useStore.getState();
      if (store.currentSessionId !== route.sessionId) {
        store.setCurrentSession(route.sessionId);
      }
      connectSession(route.sessionId);
      // Validate session exists — try to relaunch if not in active list
      api.listSessions().then((list) => {
        const session = list.find((s: { sessionId: string; archived?: boolean }) => s.sessionId === route.sessionId);
        if (!session) {
          console.warn(`[app] Session ${route.sessionId} not in API list (${list.length} sessions), attempting relaunch`);
          api.relaunchSession(route.sessionId).then(() => {
            // Relaunch succeeded — reconnect WebSocket
            disconnectSession(route.sessionId);
            connectSession(route.sessionId);
          }).catch(() => {
            // Relaunch failed — session is truly gone, redirect home
            console.warn(`[app] Relaunch failed for ${route.sessionId}, redirecting home`);
            disconnectSession(route.sessionId);
            useStore.getState().newSession();
            navigateHome(true);
          });
        }
        // LOCAL: allow viewing archived sessions — do not redirect home
      }).catch((e) => console.warn("[app] listSessions", e));
    } else if (route.page === "home") {
      const store = useStore.getState();
      if (store.currentSessionId !== null) {
        store.setCurrentSession(null);
      }
    }
    // For other pages (settings, terminal, etc.), preserve currentSessionId
  }, [route]);

  // Keep git changed-files count in sync for the badge regardless of which tab is active.
  // DiffPanel does the same when mounted; this covers the case where the diff tab is closed.
  const changedFilesTick = useStore((s) => currentSessionId ? s.changedFilesTick.get(currentSessionId) ?? 0 : 0);
  const diffBase = useStore((s) => s.diffBase);
  const setGitChangedFilesCount = useStore((s) => s.setGitChangedFilesCount);
  const sessionCwd = useStore((s) => {
    if (!currentSessionId) return null;
    return s.sessions.get(currentSessionId)?.cwd
      || s.sdkSessions.find((sdk) => sdk.sessionId === currentSessionId)?.cwd
      || null;
  });
  useEffect(() => {
    if (!currentSessionId || !sessionCwd) return;
    let cancelled = false;
    api.getChangedFiles(sessionCwd, diffBase).then(({ files }) => {
      if (cancelled) return;
      const prefix = `${sessionCwd}/`;
      const count = files.filter((f) => f.path === sessionCwd || f.path.startsWith(prefix)).length;
      setGitChangedFilesCount(currentSessionId, count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentSessionId, sessionCwd, diffBase, changedFilesTick, setGitChangedFilesCount]);

  // Poll for updates (only after auth)
  useEffect(() => {
    if (!isAuthenticated) return;
    const check = () => {
      api.checkForUpdate().then((info) => {
        useStore.getState().setUpdateInfo(info);
      }).catch((e) => console.warn("[app] checkForUpdate", e));
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Listen for postMessage from HTML fragment iframes and panels
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const d = e.data;
      if (!d?.type) return;
      switch (d.type) {
        case "vibe:notify":
          if (Notification.permission === "granted") new Notification(d.title, { body: d.body });
          break;
        case "vibe:console": {
          useStore.getState().appendConsoleLog(d.fragmentId, { level: d.level, args: d.args, timestamp: Date.now() });
          const sid = useStore.getState().currentSessionId;
          if (sid) sendToSession(sid, { type: "fragment_console_log", fragmentId: d.fragmentId, level: d.level, args: d.args });
          break;
        }
        case "vibe:state_update": {
          useStore.getState().updateFragmentState(d.fragmentId, d.state);
          const sessionId = useStore.getState().currentSessionId;
          if (sessionId) sendToSession(sessionId, { type: "fragment_state_update", fragmentId: d.fragmentId, state: d.state });
          break;
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Global keyboard + mouse shortcuts
  useEffect(() => {
    const handleMouseButton = createMouseHandler({
      onArchiveAll: () => setShowArchiveAllConfirm(true),
    });

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseButton);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseButton);
    };
  }, []);

  async function handleArchiveAll() {
    const store = useStore.getState();
    const sdkSessions = store.sdkSessions;
    const activeSessions = sdkSessions.filter(s => !s.archived);
    for (const session of activeSessions) {
      disconnectSession(session.sessionId);
    }
    store.setSdkSessions(sdkSessions.map(s => s.archived ? s : { ...s, archived: true }));
    store.newSession();
    setShowArchiveAllConfirm(false);
    await Promise.allSettled(activeSessions.map(s => api.archiveSession(s.sessionId)));
    api.listSessions().then((list) => {
      store.setSdkSessions(list);
    }).catch(() => {});
  }

  // Load publicUrl from settings on mount (used for webhook URL generation)
  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.publicUrl) useStore.getState().setPublicUrl(s.publicUrl);
    }).catch(() => {});
  }, []);

  // LOCAL: auth gate — show nothing while autoAuth is in flight to avoid login-page flash
  if (authChecking) return null;
  if (!isAuthenticated) {
    return <LoginPage />;
  }


  if (route.page === "playground") {
    return <Suspense fallback={<LazyFallback />}><Playground /></Suspense>;
  }

  return (
    <div className="fixed inset-0 flex font-sans-ui bg-cc-bg text-cc-fg antialiased pt-safe overflow-hidden overscroll-none">
      {/* Archive All Confirmation Modal */}
      {showArchiveAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-cc-card border border-cc-border rounded-[14px] shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-cc-warning shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-cc-fg mb-1">Archive All Sessions?</h3>
                <p className="text-sm text-cc-muted leading-relaxed">
                  This will archive all active sessions. You can restore them later from the archived section.
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
                onClick={handleArchiveAll}
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
          fixed inset-y-0 left-0 md:relative md:inset-auto z-40 md:z-auto
          h-full shrink-0 transition-all duration-200 pt-safe md:pt-0
          ${sidebarOpen ? "w-full md:w-[260px] translate-x-0" : "w-0 -translate-x-full md:w-0 md:-translate-x-full"}
          overflow-hidden
        `}
      >
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <UpdateBanner />
        <div className="flex-1 overflow-hidden relative">
          {/* Mapped route pages (settings, prompts, integrations, etc.) */}
          {PAGE_MAP[route.page] && (() => {
            const { component: PageComponent, props } = PAGE_MAP[route.page]!;
            return (
              <div className="absolute inset-0">
                <Suspense fallback={<LazyFallback />}><PageComponent {...props} /></Suspense>
              </div>
            );
          })()}

          {/* Agents page — needs route prop for agent-detail subroute */}
          {(route.page === "agents" || route.page === "agent-detail") && (
            <div className="absolute inset-0">
              <Suspense fallback={<LazyFallback />}><AgentsPage route={route} /></Suspense>
            </div>
          )}

          {/* LOCAL: processes moved from TopBar workspace tab to sidebar nav page */}
          {route.page === "processes" && (currentSessionId ? (
            <div className="absolute inset-0">
              <Suspense fallback={<LazyFallback />}><ProcessPanel sessionId={currentSessionId} /></Suspense>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-cc-muted">
              Select a session to view its processes.
            </div>
          ))}

          {isRunsPage && (
            <div className="absolute inset-0">
              <Suspense fallback={<LazyFallback />}><RunsPage /></Suspense>
            </div>
          )}

          {isSessionView && (
            <>
              <div className="absolute inset-0">
                {currentSessionId ? (
                  activeTab === "terminal"
                    ? (
                      <SessionTerminalDock
                        sessionId={currentSessionId}
                        terminalOnly
                        onClosePanel={() => useStore.getState().setActiveTab("chat")}
                      />
                    )
                    : activeTab === "editor"
                        ? <SessionEditorPane sessionId={currentSessionId} />
                        : (
                        <SessionTerminalDock sessionId={currentSessionId} suppressPanel>
                          {activeTab === "diff"
                            ? <DiffPanel sessionId={currentSessionId} />
                            : <ChatView sessionId={currentSessionId} />}
                        </SessionTerminalDock>
                      )
                ) : (
                  <HomePage key={homeResetKey} />
                )}
              </div>

              {/* Panels — lazy-loaded, one per open panel */}
              {activeTab.startsWith("panel:") && (
                <div className="absolute inset-0">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-cc-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  }>
                    <Panel slug={activeTab.slice(6)} />
                  </Suspense>
                </div>
              )}


              {/* Session launch overlay — shown during creation */}
              {sessionCreating && creationProgress && creationProgress.length > 0 && (
                <SessionLaunchOverlay
                  steps={creationProgress}
                  error={creationError}
                  backend={sessionCreatingBackend ?? undefined}
                  onCancel={() => useStore.getState().clearCreation()}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Task panel — overlay on mobile, inline on desktop */}
      {/* Show when viewing a session, or when a folder is focused (home page) */}
      {(currentSessionId || focusedFolder) && isSessionView && (
        <>
          {!taskPanelOpen && (
            <button
              type="button"
              onClick={() => useStore.getState().setTaskPanelOpen(true)}
              className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-1 rounded-l-lg border border-r-0 border-cc-border bg-cc-card/95 backdrop-blur px-2 py-2 text-[11px] text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
              title="Open context panel"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M3 2.5A1.5 1.5 0 014.5 1h7A1.5 1.5 0 0113 2.5v11a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 13.5v-11zm2 .5v10h6V3H5z" />
              </svg>
              <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">Context</span>
            </button>
          )}

          {/* Mobile overlay backdrop */}
          {taskPanelOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => useStore.getState().setTaskPanelOpen(false)}
            />
          )}

          <div
            className={`
              fixed inset-y-0 right-0 lg:relative lg:inset-auto z-40 lg:z-auto
              h-full shrink-0 transition-all duration-200 pt-safe lg:pt-0
              ${taskPanelOpen ? "w-full lg:w-[320px] translate-x-0" : "w-0 translate-x-full lg:w-0 lg:translate-x-full"}
              overflow-hidden
            `}
          >
            <TaskPanel sessionId={currentSessionId} />
          </div>
        </>
      )}
      <UpdateOverlay active={updateOverlayActive} />
    </div>
  );
}
