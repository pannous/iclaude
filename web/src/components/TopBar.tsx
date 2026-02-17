import { useCallback, useState, useMemo, useSyncExternalStore } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { CopyButton } from "./CopyButton.js";
import { SkillPicker } from "./SkillPicker.js";
import { ClaudeMdEditor } from "./ClaudeMdEditor.js";
import { conversationToText } from "../utils/message-text.js";
import { parseHash } from "../utils/routing.js";

const EMPTY_MESSAGES: import("../types.js").ChatMessage[] = [];

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
  const assistantSessionId = useStore((s) => s.assistantSessionId);
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
  const [claudeMdOpen, setClaudeMdOpen] = useState(false);
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
  const sessionSubtitle = useStore((s) =>
    currentSessionId ? s.sessionSubtitles.get(currentSessionId) : undefined
  );
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
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;
  const isAssistant = !!(currentSessionId && assistantSessionId && currentSessionId === assistantSessionId);
  const sessionName = currentSessionId
    ? isAssistant
      ? "Companion"
      : (sessionNames?.get(currentSessionId) ||
        sdkSessions.find((s) => s.sessionId === currentSessionId)?.name ||
        `Session ${currentSessionId.slice(0, 8)}`)
    : null;

  return (
    <header className="shrink-0 flex items-center justify-between px-2 sm:px-4 py-2 sm:py-2.5 bg-cc-card border-b border-cc-border">
      <div className="flex items-center gap-3">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Session name + connection status */}
        {currentSessionId && (
          <div className="flex items-center gap-2">
            {isAssistant ? (
              <span className="text-[11px] font-medium text-cc-fg flex items-center gap-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-cc-primary shrink-0">
                  <path d="M8 0l1.5 5.2L14.8 4 9.8 6.5 14 11l-5.2-1.5L8 16l-1-6.5L1.2 11l5-4.5L1.2 4l5.3 1.2z" />
                </svg>
                Companion
              </span>
            ) : (
              <div className="flex flex-col min-w-0">
                {sessionTitle && (
                  <span className="text-[13px] font-medium text-cc-fg truncate">{sessionTitle}</span>
                )}
                {sessionSubtitle && (
                  <span className="text-[11px] text-cc-muted truncate">{sessionSubtitle}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-cc-success" : "bg-cc-muted opacity-40"
                }`}
              />
              {!isConnected && (
                <button
                  onClick={() => currentSessionId && api.relaunchSession(currentSessionId).catch(console.error)}
                  className="text-[11px] text-cc-warning hover:text-cc-warning/80 font-medium cursor-pointer hidden sm:inline"
                >
                  Reconnect
                </button>
              )}
            </div>
            {/* Folder + Branch */}
            {cwd && !isAssistant && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-cc-muted ml-1">
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
          </div>
        )}
      </div>

      {/* Right side */}
      {currentSessionId && isSessionView && (
        <div className="flex items-center gap-2 sm:gap-3 text-[12px] text-cc-muted">
          {status === "compacting" && (
            <span className="text-cc-warning font-medium animate-pulse">Compacting...</span>
          )}

          {status === "running" && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cc-primary animate-[pulse-dot_1s_ease-in-out_infinite]" />
              <span className="text-cc-primary font-medium">Thinking</span>
            </div>
          )}

          {messages.length > 0 && (
            <CopyButton getText={getConversationText} size="md" title="Copy entire conversation" />
          )}

          {/* Tab toggle: Chat / Diffs / Skills — hidden for assistant (no git/diffs) */}
          {!isAssistant && (
            <div className="flex items-center bg-cc-hover rounded-lg p-0.5">
              <TabBtn label="Chat" active={activeTab === "chat"} onClick={() => setActiveTab("chat")} />
              <TabBtn label="Diffs" active={activeTab === "diff"} onClick={() => setActiveTab("diff")} badge={changedFilesCount || undefined} />
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
            </div>
          )}

          {/* CLAUDE.md editor — hidden for assistant */}
          {cwd && !isAssistant && (
            <button
              onClick={() => setClaudeMdOpen(true)}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer ${
                claudeMdOpen
                  ? "text-cc-primary bg-cc-active"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
              title="Edit CLAUDE.md"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M4 1.5a.5.5 0 01.5-.5h7a.5.5 0 01.354.146l2 2A.5.5 0 0114 3.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-13zm1 .5v12h8V4h-1.5a.5.5 0 01-.5-.5V2H5zm6 0v1h1l-1-1zM6.5 7a.5.5 0 000 1h5a.5.5 0 000-1h-5zm0 2a.5.5 0 000 1h5a.5.5 0 000-1h-5zm0 2a.5.5 0 000 1h3a.5.5 0 000-1h-3z" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setTaskPanelOpen(!taskPanelOpen)}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer ${
              taskPanelOpen
                ? "text-cc-primary bg-cc-active"
                : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
            }`}
            title="Toggle session panel"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 3a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

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
