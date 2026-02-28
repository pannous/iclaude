import { useState, useCallback, type ReactNode } from "react";

/** Shell languages that show a Run button */
export const RUNNABLE_LANGS = new Set(["bash", "sh", "shell", "zsh", "fish", "terminal"]);

type RunState = "idle" | "running" | "success" | "error";

export interface ExecResult {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export async function execCode(code: string, cwd?: string): Promise<ExecResult> {
  const res = await fetch("/api/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: code, cwd }),
  });
  return res.json();
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M4 2.5L13 8 4 13.5V2.5z" />
    </svg>
  );
}

export function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={`animate-spin ${className}`}>
      <circle cx="8" cy="8" r="5.5" strokeOpacity="0.25" />
      <path d="M13.5 8A5.5 5.5 0 008 2.5" strokeLinecap="round" />
    </svg>
  );
}

export function RunOutput({ result, onDismiss }: { result: ExecResult; onDismiss: () => void }) {
  const hasStdout = result.stdout?.trim();
  const hasStderr = result.stderr?.trim();

  return (
    <div className="border-t border-cc-border bg-cc-bg/60">
      <div className="flex items-center justify-between px-3 py-1 border-b border-cc-border/50">
        <span className={`text-[10px] font-mono-code uppercase tracking-wider ${result.ok ? "text-cc-success" : "text-red-400"}`}>
          {result.ok ? "✓ exited 0" : `✗ exited ${result.exitCode ?? 1}`}
        </span>
        <button
          onClick={onDismiss}
          title="Dismiss output"
          className="text-cc-muted hover:text-cc-fg text-[11px] leading-none cursor-pointer"
        >
          ✕
        </button>
      </div>
      {!hasStdout && !hasStderr ? (
        <p className="px-3 py-2 text-[12px] text-cc-muted font-mono-code italic">no output</p>
      ) : (
        <>
          {hasStdout && (
            <pre className="px-3 py-2 text-[12px] font-mono-code text-cc-code-fg whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
              {result.stdout!.trimEnd()}
            </pre>
          )}
          {hasStderr && (
            <pre className={`px-3 py-2 text-[12px] font-mono-code whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto text-red-400 ${hasStdout ? "border-t border-cc-border/50" : ""}`}>
              {result.stderr!.trimEnd()}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Wraps a bash/shell code block with a Run button in the header
 * and an inline output panel that appears after execution.
 */
export function RunnableCodeBlock({
  lang,
  code,
  cwd,
  children,
}: {
  lang: string;
  code: string;
  cwd?: string;
  children: ReactNode; // the <pre> block
}) {
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState<ExecResult | null>(null);

  const handleRun = useCallback(async () => {
    setState("running");
    setResult(null);
    try {
      const res = await execCode(code.trim(), cwd);
      setResult(res);
      setState(res.ok ? "success" : "error");
    } catch {
      setResult({ ok: false, stderr: "Failed to reach /api/exec", exitCode: 1 });
      setState("error");
    }
  }, [code, cwd]);

  const iconDim = "w-3 h-3";

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-cc-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-cc-code-bg/80 border-b border-cc-border">
        <span className="text-[10px] text-cc-muted font-mono-code uppercase tracking-wider">
          {lang}
        </span>
        <button
          onClick={handleRun}
          disabled={state === "running"}
          title="Run"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:w-5 sm:h-5 flex items-center justify-center rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover active:scale-90 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "running" ? (
            <SpinnerIcon className={iconDim} />
          ) : (
            <PlayIcon className={`${iconDim} ${state === "success" ? "text-cc-success" : state === "error" ? "text-red-400" : ""}`} />
          )}
        </button>
      </div>
      {children}
      {result && (
        <RunOutput result={result} onDismiss={() => { setResult(null); setState("idle"); }} />
      )}
    </div>
  );
}
