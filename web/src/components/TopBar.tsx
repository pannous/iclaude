import { useCallback } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { CopyButton } from "./CopyButton.js";
import { conversationToText } from "../utils/message-text.js";

const EMPTY_MESSAGES: import("../types.js").ChatMessage[] = [];

export function TopBar() {
  const currentSessionId = useStore((s) => s.currentSessionId);
  const cliConnected = useStore((s) => s.cliConnected);
  const sessionStatus = useStore((s) => s.sessionStatus);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const taskPanelOpen = useStore((s) => s.taskPanelOpen);
  const setTaskPanelOpen = useStore((s) => s.setTaskPanelOpen);
  const messages = useStore((s) => currentSessionId ? s.messages.get(currentSessionId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES);
  const getConversationText = useCallback(() => conversationToText(messages), [messages]);

  const sessionTitle = useStore((s) => {
    if (!currentSessionId) return undefined;
    const sdkTitle = s.sdkSessions.find((ss) => ss.sessionId === currentSessionId)?.title;
    return sdkTitle || s.sessionNames.get(currentSessionId);
  });
  const sessionSubtitle = useStore((s) =>
    currentSessionId ? s.sessionSubtitles.get(currentSessionId) : undefined
  );
  const isConnected = currentSessionId ? (cliConnected.get(currentSessionId) ?? false) : false;
  const status = currentSessionId ? (sessionStatus.get(currentSessionId) ?? null) : null;

  return (
    <header className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-cc-card border-b border-cc-border">
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
            <div className="flex flex-col min-w-0">
              {sessionTitle && (
                <span className="text-[13px] font-medium text-cc-fg truncate max-w-[200px] sm:max-w-[300px]">{sessionTitle}</span>
              )}
              {sessionSubtitle && (
                <span className="text-[11px] text-cc-muted truncate max-w-[200px] sm:max-w-[300px]">{sessionSubtitle}</span>
              )}
            </div>
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
          </div>
        )}
      </div>

      {/* Right side */}
      {currentSessionId && (
        <div className="flex items-center gap-3 text-[12px] text-cc-muted">
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
    </header>
  );
}
