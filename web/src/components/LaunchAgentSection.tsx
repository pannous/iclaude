import { useState, useEffect, useCallback } from "react";
import { api, type LaunchAgentEntry } from "../api.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortenPath(p: string): string {
  return p.replace(/\/Users\/\w+\//g, "~/");
}

function humanizeInterval(seconds: number): string {
  if (seconds < 60) return `Every ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `Every ${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins ? `Every ${hours}h ${remainMins}m` : `Every ${hours}h`;
}

function describeSchedule(agent: LaunchAgentEntry): string {
  if (agent.startInterval) return humanizeInterval(agent.startInterval);
  if (agent.startCalendarInterval) {
    const cal = agent.startCalendarInterval;
    const h = cal.Hour ?? cal.hour;
    const m = cal.Minute ?? cal.minute;
    if (h !== undefined) {
      const period = h >= 12 ? "PM" : "AM";
      const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `Daily at ${dh}:${(m ?? 0).toString().padStart(2, "0")} ${period}`;
    }
  }
  if (agent.keepAlive) return "Keep alive (daemon)";
  if (agent.runAtLoad) return "Run at login";
  return "Manual";
}

function commandSummary(program: string[]): string {
  if (program.length === 0) return "";
  const bin = program[0].split("/").pop() || program[0];
  const args = program.slice(1).join(" ");
  return args ? `${bin} ${args}` : bin;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LaunchAgentSection() {
  const [agents, setAgents] = useState<LaunchAgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [togglingLabels, setTogglingLabels] = useState<Set<string>>(new Set());
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const resp = await api.listLaunchAgents();
      setAgents(resp.agents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleToggle(agent: LaunchAgentEntry) {
    setError("");
    setTogglingLabels((prev) => new Set(prev).add(agent.label));
    try {
      if (agent.loaded) {
        await api.unloadLaunchAgent(agent.label);
      } else {
        await api.loadLaunchAgent(agent.label);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTogglingLabels((prev) => {
        const next = new Set(prev);
        next.delete(agent.label);
        return next;
      });
    }
  }

  if (loading) return null;
  if (agents.length === 0) return null;

  const loadedCount = agents.filter((a) => a.loaded).length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 cursor-pointer group"
      >
        <svg
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
          className={`w-3 h-3 text-cc-muted transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-cc-muted">
          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-xs font-medium text-cc-muted group-hover:text-cc-fg transition-colors">
          LaunchAgents
        </span>
        <span className="text-[10px] text-cc-muted/60">{loadedCount}/{agents.length} loaded</span>
      </button>

      {!expanded ? null : (
        <div className="space-y-1" style={{ animation: "fadeSlideIn 150ms ease-out" }}>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-cc-error/10 text-xs text-cc-error mb-2">{error}</div>
          )}

          {agents.map((agent) => (
            <LaunchAgentRow
              key={agent.label}
              agent={agent}
              toggling={togglingLabels.has(agent.label)}
              isExpanded={expandedAgent === agent.label}
              onToggleExpand={() => setExpandedAgent(expandedAgent === agent.label ? null : agent.label)}
              onToggleLoad={() => handleToggle(agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface LaunchAgentRowProps {
  agent: LaunchAgentEntry;
  toggling: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleLoad: () => void;
}

function LaunchAgentRow({ agent, toggling, isExpanded, onToggleExpand, onToggleLoad }: LaunchAgentRowProps) {
  // Derive a friendly name from the label
  const friendlyName = agent.label
    .replace(/^com\.(pannous|github|google|jetbrains|valvesoftware|cloudflare)\./, "")
    .replace(/^homebrew\.mxcl\./, "")
    .replace(/^jp\.plentycom\.boa\./, "");

  const running = agent.loaded && agent.pid !== null;
  const schedule = describeSchedule(agent);

  return (
    <div className="group rounded-lg hover:bg-cc-hover/60 transition-colors">
      <div className="flex items-start gap-3 px-3 py-2.5 cursor-pointer" onClick={onToggleExpand}>
        {/* Status icon */}
        <div className={`shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center ${
          running ? "bg-green-500/10" : agent.loaded ? "bg-amber-500/10" : "bg-cc-hover"
        }`}>
          {running ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
              <circle cx="12" cy="12" r="6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-3.5 h-3.5 ${agent.loaded ? "text-amber-500" : "text-cc-muted/40"}`}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-cc-fg truncate">{friendlyName}</span>
            {running && (
              <span className="text-[9px] font-medium px-1.5 rounded-full leading-[16px] text-green-500 bg-green-500/10">
                PID {agent.pid}
              </span>
            )}
            {agent.loaded && !running && (
              <span className="text-[9px] font-medium px-1.5 rounded-full leading-[16px] text-amber-500 bg-amber-500/10">
                loaded
              </span>
            )}
            {!agent.loaded && (
              <span className="text-[9px] font-medium px-1.5 rounded-full leading-[16px] text-cc-muted bg-cc-hover">
                unloaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-cc-muted">
            <span>{schedule}</span>
            {agent.workingDirectory && (
              <>
                <span className="text-cc-border">·</span>
                <span className="font-mono-code truncate max-w-[200px]">{shortenPath(agent.workingDirectory)}</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-xs text-cc-muted font-mono-code truncate">
            {commandSummary(agent.program)}
          </p>
        </div>

        {/* Toggle */}
        <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleLoad}
            disabled={toggling}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${
              toggling ? "opacity-50 cursor-wait" : ""
            } ${agent.loaded ? "bg-cc-primary" : "bg-cc-border"}`}
            title={agent.loaded ? "Unload" : "Load"}
          >
            <span className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-transform ${agent.loaded ? "left-[17px]" : "left-[2px]"}`} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 ml-10 space-y-1.5 text-[11px] text-cc-muted" style={{ animation: "fadeSlideIn 100ms ease-out" }}>
          <div className="flex gap-2">
            <span className="text-cc-muted/60 w-14 shrink-0">Label</span>
            <span className="font-mono-code break-all">{agent.label}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-cc-muted/60 w-14 shrink-0">File</span>
            <span className="font-mono-code break-all">{shortenPath(agent.filepath)}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-cc-muted/60 w-14 shrink-0">Command</span>
            <span className="font-mono-code break-all">{agent.program.map(shortenPath).join(" ")}</span>
          </div>
          {agent.stdoutPath && (
            <div className="flex gap-2">
              <span className="text-cc-muted/60 w-14 shrink-0">Logs</span>
              <span className="font-mono-code break-all">{shortenPath(agent.stdoutPath)}</span>
            </div>
          )}
          {agent.exitCode !== null && agent.exitCode !== 0 && (
            <div className="flex gap-2">
              <span className="text-cc-muted/60 w-14 shrink-0">Exit</span>
              <span className="text-cc-error">{agent.exitCode}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
