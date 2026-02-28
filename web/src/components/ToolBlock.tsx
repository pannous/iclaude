import { useState, useCallback } from "react";
import { useStore } from "../store.js";
import { BashDisplay, EditDisplay, WriteDisplay, ReadDisplay, GlobDisplay, GrepDisplay } from "./ToolDisplays.js";
import { execCode, PlayIcon, SpinnerIcon, RunOutput, type ExecResult } from "./RunCodeButton.js";

const TOOL_ICONS: Record<string, string> = {
  Bash: "terminal",
  Read: "file",
  Write: "file-plus",
  Edit: "file-edit",
  Glob: "search",
  Grep: "search",
  WebFetch: "globe",
  WebSearch: "globe",
  NotebookEdit: "notebook",
  Task: "agent",
  TodoWrite: "checklist",
  TaskCreate: "list",
  TaskUpdate: "list",
  SendMessage: "message",
  // Codex tool types (mapped by codex-adapter)
  web_search: "globe",
  mcp_tool_call: "tool",
};

export function getToolIcon(name: string): string {
  return TOOL_ICONS[name] || "tool";
}

export function getToolLabel(name: string): string {
  if (name === "Bash") return "Terminal";
  if (name === "Read") return "Read File";
  if (name === "Write") return "Write File";
  if (name === "Edit") return "Edit File";
  if (name === "Glob") return "Find Files";
  if (name === "Grep") return "Search Content";
  if (name === "WebSearch") return "Web Search";
  if (name === "WebFetch") return "Web Fetch";
  if (name === "Task") return "Subagent";
  if (name === "TodoWrite") return "Tasks";
  if (name === "NotebookEdit") return "Notebook";
  if (name === "SendMessage") return "Message";
  if (name === "web_search") return "Web Search";
  if (name === "mcp_tool_call") return "MCP Tool";
  // Codex MCP tools come as "mcp:server:tool"
  if (name.startsWith("mcp:")) return name.split(":").slice(1).join(":");
  return name;
}

export function ToolBlock({
  name,
  input,
  toolUseId,
}: {
  name: string;
  input: Record<string, unknown>;
  toolUseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [runState, setRunState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [runResult, setRunResult] = useState<ExecResult | null>(null);
  const iconType = getToolIcon(name);
  const label = getToolLabel(name);
  const isBash = name === "Bash";

  // Extract the most useful preview
  const preview = getPreview(name, input);

  // Resolve clickable path from file_path (Read/Write/Edit), path (Grep/Glob), or notebook_path
  const clickablePath = (input.file_path || input.path || input.notebook_path) as string | undefined;

  const handleRun = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRunState("running");
    setRunResult(null);
    setOpen(true);
    try {
      const res = await execCode(String(input.command || "").trim());
      setRunResult(res);
      setRunState(res.ok ? "success" : "error");
    } catch {
      setRunResult({ ok: false, stderr: "Failed to reach /api/exec", exitCode: 1 });
      setRunState("error");
    }
  }, [input.command]);

  return (
    <div className="border border-cc-border rounded-[10px] overflow-hidden bg-cc-card">
      <div
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-cc-hover/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-cc-muted transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-cc-fg whitespace-nowrap">{label}</span>
        {preview && clickablePath ? (
          <button
            type="button"
            className="text-xs text-cc-muted truncate flex-1 font-mono-code hover:text-cc-primary cursor-pointer underline decoration-cc-muted/30 hover:decoration-cc-primary/50 transition-colors text-left min-w-0"
            onClick={(e) => {
              e.stopPropagation();
              useStore.getState().openFileInEditor(String(clickablePath));
            }}
            title={`Open ${String(clickablePath)} in editor`}
          >
            {preview}
          </button>
        ) : preview ? (
          <span className="text-xs text-cc-muted truncate flex-1 font-mono-code min-w-0">
            {preview}
          </span>
        ) : null}
        {isBash && (
          <button
            onClick={handleRun}
            disabled={runState === "running"}
            title="Run"
            className="ml-auto shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-5 sm:h-5 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover active:scale-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runState === "running" ? (
              <SpinnerIcon className="w-3 h-3" />
            ) : (
              <PlayIcon className={`w-3 h-3 ${runState === "success" ? "text-cc-success" : runState === "error" ? "text-red-400" : ""}`} />
            )}
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-cc-border">
          <div className="mt-2">
            <ToolDetail name={name} input={input} />
          </div>
        </div>
      )}
      {runResult && (
        <RunOutput result={runResult} onDismiss={() => { setRunResult(null); setRunState("idle"); }} />
      )}
    </div>
  );
}

/** Route to custom detail renderer per tool type */
function ToolDetail({ name, input }: { name: string; input: Record<string, unknown> }) {
  switch (name) {
    case "Bash":
      return <BashDisplay input={input} />;
    case "Edit":
      return <EditDisplay input={input} />;
    case "Write":
      return <WriteDisplay input={input} />;
    case "Read":
      return <ReadDisplay input={input} />;
    case "Glob":
      return <GlobDisplay input={input} />;
    case "Grep":
      return <GrepDisplay input={input} />;
    case "WebSearch":
    case "web_search":
      return <WebSearchDetail input={input} />;
    case "WebFetch":
      return <WebFetchDetail input={input} />;
    case "Task":
      return <TaskDetail input={input} />;
    case "TodoWrite":
      return <TodoWriteDetail input={input} />;
    case "NotebookEdit":
      return <NotebookEditDetail input={input} />;
    case "SendMessage":
      return <SendMessageDetail input={input} />;
    default:
      return (
        <pre className="text-[11px] text-cc-muted font-mono-code whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      );
  }
}

// ─── ToolBlock-specific detail components ───────────────────────────────────

function WebSearchDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-cc-fg font-medium">{String(input.query || "")}</div>
      {Array.isArray(input.allowed_domains) && input.allowed_domains.length > 0 && (
        <div className="text-[10px] text-cc-muted">
          domains: {(input.allowed_domains as string[]).join(", ")}
        </div>
      )}
    </div>
  );
}

function WebFetchDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {!!input.url && (
        <div className="text-xs font-mono-code text-cc-primary truncate">{String(input.url)}</div>
      )}
      {!!input.prompt && (
        <div className="text-[11px] text-cc-muted italic line-clamp-2">{String(input.prompt)}</div>
      )}
    </div>
  );
}

function TaskDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {!!input.description && (
        <div className="text-xs text-cc-fg font-medium">{String(input.description)}</div>
      )}
      {!!input.subagent_type && (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-cc-primary/10 text-cc-primary">
          {String(input.subagent_type)}
        </span>
      )}
      {!!input.prompt && (
        <pre className="text-[11px] text-cc-muted font-mono-code whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
          {String(input.prompt)}
        </pre>
      )}
    </div>
  );
}

function TodoWriteDetail({ input }: { input: Record<string, unknown> }) {
  const todos = input.todos as Array<{ content?: string; status?: string; activeForm?: string }> | undefined;
  if (!Array.isArray(todos)) {
    return (
      <pre className="text-[11px] text-cc-muted font-mono-code whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
        {JSON.stringify(input, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-0.5">
      {todos.map((todo, i) => {
        const status = todo.status || "pending";
        return (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <span className="shrink-0 mt-0.5">
              {status === "completed" ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-success">
                  <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.708L7 8.586 5.354 6.94a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : status === "in_progress" ? (
                <svg className="w-3.5 h-3.5 text-cc-primary animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-cc-muted">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </span>
            <span className={`text-[11px] leading-snug ${status === "completed" ? "text-cc-muted line-through" : "text-cc-fg"}`}>
              {todo.content || "Task"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NotebookEditDetail({ input }: { input: Record<string, unknown> }) {
  const path = String(input.notebook_path || "");
  const cellType = input.cell_type as string | undefined;
  const editMode = input.edit_mode as string | undefined;

  return (
    <div className="space-y-1">
      <div className="text-xs font-mono-code text-cc-muted">{path}</div>
      <div className="flex gap-2 text-[10px] text-cc-muted">
        {cellType && <span>type: {cellType}</span>}
        {editMode && <span>mode: {editMode}</span>}
        {input.cell_number != null && <span>cell: {String(input.cell_number)}</span>}
      </div>
      {!!input.new_source && (
        <pre className="px-2 py-1.5 rounded bg-cc-code-bg text-cc-code-fg text-[11px] font-mono-code leading-relaxed max-h-40 overflow-y-auto">
          {String(input.new_source)}
        </pre>
      )}
    </div>
  );
}

function SendMessageDetail({ input }: { input: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {!!input.recipient && (
        <div className="text-[11px] text-cc-muted">
          to: <span className="font-medium text-cc-fg">{String(input.recipient)}</span>
        </div>
      )}
      {!!input.content && (
        <div className="text-xs text-cc-fg whitespace-pre-wrap">{String(input.content)}</div>
      )}
    </div>
  );
}

// ─── Preview ────────────────────────────────────────────────────────────────

export function getPreview(name: string, input: Record<string, unknown>): string {
  if (name === "Bash" && typeof input.command === "string") {
    // Always prefer description in header; fall back to command
    if (input.description && typeof input.description === "string") {
      return input.description.length > 80 ? input.description.slice(0, 80) + "..." : input.description;
    }
    return input.command.length > 60 ? input.command.slice(0, 60) + "..." : input.command;
  }
  if ((name === "Read" || name === "Write" || name === "Edit") && input.file_path) {
    const path = String(input.file_path);
    return path.split("/").slice(-2).join("/");
  }
  if (name === "Edit" && Array.isArray(input.changes) && input.changes.length > 0) {
    const first = input.changes[0] as { path?: string };
    if (first?.path) {
      return String(first.path).split("/").slice(-2).join("/");
    }
  }
  if (name === "Glob" && input.pattern) return String(input.pattern);
  if (name === "Grep" && input.pattern) {
    const p = String(input.pattern);
    const suffix = input.path ? ` in ${String(input.path).split("/").slice(-2).join("/")}` : "";
    const full = p + suffix;
    return full.length > 60 ? full.slice(0, 60) + "..." : full;
  }
  if ((name === "WebSearch" || name === "web_search") && input.query) return String(input.query);
  if (name === "WebFetch" && input.url) {
    try {
      const u = new URL(String(input.url));
      return u.hostname + u.pathname;
    } catch {
      return String(input.url).slice(0, 60);
    }
  }
  if (name === "Task" && input.description) return String(input.description);
  if (name === "TodoWrite" && Array.isArray(input.todos)) {
    return `${input.todos.length} task${input.todos.length !== 1 ? "s" : ""}`;
  }
  if (name === "NotebookEdit" && input.notebook_path) {
    return String(input.notebook_path).split("/").pop() || "";
  }
  if (name === "SendMessage" && input.recipient) {
    return `\u2192 ${String(input.recipient)}`;
  }
  return "";
}

// ─── Icons ──────────────────────────────────────────────────────────────────

export function ToolIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5 text-cc-primary shrink-0";

  if (type === "terminal") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <polyline points="3 11 6 8 3 5" />
        <line x1="8" y1="11" x2="13" y2="11" />
      </svg>
    );
  }
  if (type === "file" || type === "file-plus" || type === "file-edit") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
        <polyline points="9 1 9 5 13 5" />
      </svg>
    );
  }
  if (type === "search") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <circle cx="7" cy="7" r="4" />
        <path d="M13 13l-3-3" />
      </svg>
    );
  }
  if (type === "globe") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <circle cx="8" cy="8" r="6" />
        <path d="M2 8h12M8 2c2 2 3 4 3 6s-1 4-3 6c-2-2-3-4-3-6s1-4 3-6z" />
      </svg>
    );
  }
  if (type === "message") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M14 10a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1h10a1 1 0 011 1v7z" />
      </svg>
    );
  }
  if (type === "list") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M3 4h10M3 8h10M3 12h6" />
      </svg>
    );
  }
  if (type === "agent") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <circle cx="8" cy="5" r="3" />
        <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "checklist") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <path d="M3 4l1.5 1.5L7 3M3 8l1.5 1.5L7 7M3 12l1.5 1.5L7 11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4h4M9 8h4M9 12h4" />
      </svg>
    );
  }
  if (type === "notebook") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
        <rect x="3" y="1" width="10" height="14" rx="1" />
        <path d="M6 1v14M3 5h3M3 9h3M3 13h3" />
      </svg>
    );
  }
  // Default tool icon
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cls}>
      <path d="M10.5 2.5l3 3-8 8H2.5v-3l8-8z" />
    </svg>
  );
}
