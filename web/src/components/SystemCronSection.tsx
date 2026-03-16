import { useState, useEffect, useCallback } from "react";
import { api, type SystemCronEntry, type SystemCronResponse } from "../api.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function humanizeSchedule(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [minute, hour, dom, month, dow] = parts;

  if (schedule === "* * * * *") return "Every minute";
  if (hour === "*" && dom === "*" && month === "*" && dow === "*" && minute.startsWith("*/")) {
    const n = parseInt(minute.slice(2), 10);
    return n === 1 ? "Every minute" : `Every ${n} minutes`;
  }
  if (minute === "0" && dom === "*" && month === "*" && dow === "*") {
    if (hour === "*") return "Every hour";
    if (hour.startsWith("*/")) {
      const n = parseInt(hour.slice(2), 10);
      return n === 1 ? "Every hour" : `Every ${n} hours`;
    }
  }
  if (dom === "*" && month === "*" && !hour.includes("/") && !hour.includes(",") && !isNaN(+hour) && !isNaN(+minute)) {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
    if (dow === "*") return `Daily at ${timeStr}`;
    if (dow === "1-5") return `Weekdays at ${timeStr}`;
    if (dow === "0,6") return `Weekends at ${timeStr}`;
  }
  return schedule;
}

/** Shorten long paths for display (e.g. /Users/me/jobs → ~/jobs) */
function shortenPath(cmd: string): string {
  const home = "~";
  return cmd.replace(/\/Users\/\w+\//g, `${home}/`);
}

/** Extract the working directory from a cron command like "cd /foo && ..." */
function extractCwd(cmd: string): string | null {
  const match = cmd.match(/cd\s+(\/\S+|~\/\S+)/);
  return match ? match[1] : null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface NewEntryForm {
  schedule: string;
  command: string;
  comment: string;
}

const EMPTY_FORM: NewEntryForm = { schedule: "0 * * * *", command: "", comment: "" };

const SCHEDULE_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 20 min", value: "*/20 * * * *" },
  { label: "Daily 8 AM", value: "0 8 * * *" },
  { label: "Weekdays 9 AM", value: "0 9 * * 1-5" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function SystemCronSection() {
  const [entries, setEntries] = useState<SystemCronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewEntryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const resp = await api.listSystemCron();
      setEntries(resp.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const activeEntries = entries.filter((e) => !e.isComment && !e.isEmpty);
  const commentEntries = entries.filter((e) => e.isComment && !e.isEmpty);

  async function handleAdd() {
    if (!form.command.trim() || !form.schedule.trim()) return;
    setSaving(true);
    setError("");
    try {
      const resp = await api.addSystemCron({
        schedule: form.schedule.trim(),
        command: form.command.trim(),
        comment: form.comment.trim() || undefined,
      });
      setEntries(resp.entries);
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(index: number) {
    setError("");
    try {
      const resp = await api.deleteSystemCron(index);
      setEntries(resp.entries);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggle(entry: SystemCronEntry) {
    setError("");
    try {
      const resp = await api.updateSystemCron(entry.index, { enabled: entry.isComment });
      setEntries(resp.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) return null;
  if (entries.length === 0 && !showAdd) return null;

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
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M9 4v6" />
        </svg>
        <span className="text-xs font-medium text-cc-muted group-hover:text-cc-fg transition-colors">
          System Crontab
        </span>
        <span className="text-[10px] text-cc-muted/60">{activeEntries.length} job{activeEntries.length !== 1 ? "s" : ""}</span>
      </button>

      {!expanded ? null : (
        <div className="space-y-1.5" style={{ animation: "fadeSlideIn 150ms ease-out" }}>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-cc-error/10 text-xs text-cc-error mb-2">{error}</div>
          )}

          {/* Active cron entries */}
          {activeEntries.map((entry) => (
            <CronEntryRow
              key={`${entry.index}-${entry.raw}`}
              entry={entry}
              entries={entries}
              confirmDelete={confirmDelete}
              onToggle={() => handleToggle(entry)}
              onRequestDelete={() => setConfirmDelete(entry.index)}
              onConfirmDelete={() => handleDelete(entry.index)}
              onCancelDelete={() => setConfirmDelete(null)}
            />
          ))}

          {activeEntries.length === 0 && !showAdd && (
            <div className="text-xs text-cc-muted py-3 text-center">No active cron entries</div>
          )}

          {/* Add new entry form */}
          {showAdd && (
            <div
              className="rounded-xl bg-cc-card border border-cc-border p-4 space-y-3"
              style={{ animation: "fadeSlideIn 150ms ease-out" }}
            >
              <div className="text-xs font-medium text-cc-fg mb-1">Add Crontab Entry</div>

              {/* Comment / label */}
              <input
                type="text"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Description (optional, becomes # comment)"
                className="w-full px-3 py-2 text-sm bg-cc-bg rounded-lg text-cc-fg placeholder:text-cc-muted focus:outline-none focus:ring-1 focus:ring-cc-primary/40"
              />

              {/* Schedule presets */}
              <div className="flex flex-wrap gap-1.5">
                {SCHEDULE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm({ ...form, schedule: p.value })}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      form.schedule === p.value
                        ? "bg-cc-primary/20 text-cc-primary"
                        : "bg-cc-hover text-cc-muted hover:text-cc-fg"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Cron expression */}
              <div>
                <input
                  type="text"
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                  placeholder="Cron schedule (e.g. 0 * * * *)"
                  className="w-full px-3 py-2 text-sm font-mono-code bg-cc-bg rounded-lg text-cc-fg placeholder:text-cc-muted focus:outline-none focus:ring-1 focus:ring-cc-primary/40"
                />
                <div className="text-[10px] text-cc-muted mt-0.5 px-1">{humanizeSchedule(form.schedule)}</div>
              </div>

              {/* Command */}
              <textarea
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="Command (e.g. cd ~/project && PATH=/opt/homebrew/bin:$PATH claude -p '...' --allowedTools 'Bash,Read' >> ~/.companion/logs/task.log 2>&1)"
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono-code bg-cc-bg rounded-lg text-cc-fg placeholder:text-cc-muted focus:outline-none focus:ring-1 focus:ring-cc-primary/40 resize-y"
              />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}
                  className="px-3 py-1.5 text-xs rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!form.command.trim() || !form.schedule.trim() || saving}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    form.command.trim() && form.schedule.trim() && !saving
                      ? "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer"
                      : "bg-cc-hover text-cc-muted cursor-not-allowed"
                  }`}
                >
                  {saving ? "Adding..." : "Add Entry"}
                </button>
              </div>
            </div>
          )}

          {/* Add button */}
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-cc-muted hover:text-cc-fg hover:bg-cc-hover rounded-lg transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add crontab entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry Row ───────────────────────────────────────────────────────────────

interface CronEntryRowProps {
  entry: SystemCronEntry;
  entries: SystemCronEntry[];
  confirmDelete: number | null;
  onToggle: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function CronEntryRow({ entry, entries, confirmDelete, onToggle, onRequestDelete, onConfirmDelete, onCancelDelete }: CronEntryRowProps) {
  // Find preceding comment line for context
  const precedingComment = entry.index > 0 ? entries.find(e => e.index === entry.index - 1 && e.isComment && !e.isEmpty) : null;
  const cwd = extractCwd(entry.command);

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-cc-hover/60 transition-colors">
      {/* Clock icon */}
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-amber-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title from comment or inferred from command */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cc-fg truncate">
            {precedingComment?.comment || shortenPath(entry.command).slice(0, 60)}
          </span>
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-cc-muted">
          <span className="font-mono-code bg-cc-hover/80 px-1.5 py-0.5 rounded">{entry.schedule}</span>
          <span>{humanizeSchedule(entry.schedule)}</span>
        </div>

        {/* Command (abbreviated) */}
        <p className="mt-1 text-xs text-cc-muted font-mono-code line-clamp-2 leading-relaxed break-all">
          {shortenPath(entry.command)}
        </p>

        {/* Working directory */}
        {cwd && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-cc-muted">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 opacity-60">
              <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
            </svg>
            <span className="font-mono-code">{shortenPath(cwd)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {confirmDelete === entry.index ? (
          <>
            <span className="text-[10px] text-cc-error mr-1">Delete?</span>
            <button
              onClick={onConfirmDelete}
              className="px-2 py-1 text-[10px] rounded-md bg-cc-error/10 text-cc-error hover:bg-cc-error/20 transition-colors cursor-pointer"
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              className="px-2 py-1 text-[10px] rounded-md text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
            >
              No
            </button>
          </>
        ) : (
          <button
            onClick={onRequestDelete}
            className="p-1.5 rounded-md text-cc-muted hover:text-cc-error hover:bg-cc-error/10 transition-colors cursor-pointer"
            aria-label="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
