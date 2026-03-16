import type { Hono } from "hono";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SystemCronEntry {
  index: number;
  raw: string;
  comment: string;
  schedule: string;
  command: string;
  isComment: boolean;
  isEmpty: boolean;
}

export interface LaunchAgentEntry {
  label: string;
  filename: string;
  filepath: string;
  program: string[];
  workingDirectory: string;
  runAtLoad: boolean;
  keepAlive: boolean;
  startInterval: number | null;
  startCalendarInterval: Record<string, number> | null;
  stdoutPath: string;
  stderrPath: string;
  envVars: Record<string, string>;
  loaded: boolean;
  pid: number | null;
  exitCode: number | null;
  disabled: boolean;
}

// ─── Plist parsing (basic XML) ──────────────────────────────────────────────

/** Minimal plist XML parser using a token-based approach. */
function parsePlistXml(xml: string): Record<string, unknown> {
  // Extract all XML elements/tokens in order
  const tokens = [...xml.matchAll(/<key>([^<]*)<\/key>|<string>([^<]*)<\/string>|<integer>([^<]*)<\/integer>|<(true)\/>|<(false)\/>|<(array)>|<\/(array)>|<(dict)>|<\/(dict)>/g)];

  type Obj = Record<string, unknown>;
  const stack: { target: Obj | unknown[]; pendingKey: string | null }[] = [];
  let current: Obj = {};
  let pendingKey: string | null = null;
  let inArray = false;
  let arrayItems: unknown[] = [];
  let dictDepth = 0; // track how deep we are in the top-level dict

  for (const m of tokens) {
    const [, keyVal, strVal, intVal, trueVal, falseVal, arrayOpen, arrayClose, dictOpen, dictClose] = m;

    if (dictOpen !== undefined) {
      dictDepth++;
      if (dictDepth > 1 && pendingKey !== null) {
        // Nested dict
        stack.push({ target: current, pendingKey: null });
        const nested: Obj = {};
        current[pendingKey] = nested;
        current = nested;
        pendingKey = null;
      }
      continue;
    }
    if (dictClose !== undefined) {
      dictDepth--;
      if (stack.length > 0) {
        const prev = stack.pop()!;
        current = prev.target as Obj;
        pendingKey = prev.pendingKey;
      }
      continue;
    }
    if (arrayOpen !== undefined) {
      inArray = true;
      arrayItems = [];
      continue;
    }
    if (arrayClose !== undefined) {
      inArray = false;
      if (pendingKey !== null) {
        current[pendingKey] = arrayItems;
        pendingKey = null;
      }
      continue;
    }
    if (keyVal !== undefined) {
      pendingKey = keyVal;
      continue;
    }

    // Value tokens
    let value: unknown;
    if (strVal !== undefined) value = strVal;
    else if (intVal !== undefined) value = parseInt(intVal, 10);
    else if (trueVal !== undefined) value = true;
    else if (falseVal !== undefined) value = false;
    else continue;

    if (inArray) {
      arrayItems.push(value);
    } else if (pendingKey !== null) {
      current[pendingKey] = value;
      pendingKey = null;
    }
  }

  return current;
}

/** Parse a LaunchAgent plist file into a structured entry. */
function parseLaunchAgent(filepath: string, filename: string): LaunchAgentEntry | null {
  try {
    const xml = readFileSync(filepath, "utf-8");
    const plist = parsePlistXml(xml);

    const label = (plist.Label as string) || filename.replace(/\.plist$/, "");
    const programArgs = (plist.ProgramArguments as string[]) || [];
    const program = plist.Program as string | undefined;
    const args = program ? [program] : programArgs;

    if (args.length === 0) return null; // empty dict (e.g. google keystone stubs)

    const keepAliveRaw = plist.KeepAlive;
    const keepAlive = typeof keepAliveRaw === "boolean" ? keepAliveRaw :
      (typeof keepAliveRaw === "object" && keepAliveRaw !== null) ? true : false;

    const envVars = (plist.EnvironmentVariables as Record<string, string>) || {};

    // Calendar interval
    let calInterval: Record<string, number> | null = null;
    if (plist.StartCalendarInterval && typeof plist.StartCalendarInterval === "object") {
      calInterval = plist.StartCalendarInterval as Record<string, number>;
    }

    return {
      label,
      filename,
      filepath,
      program: args,
      workingDirectory: (plist.WorkingDirectory as string) || "",
      runAtLoad: (plist.RunAtLoad as boolean) ?? false,
      keepAlive,
      startInterval: (plist.StartInterval as number) ?? null,
      startCalendarInterval: calInterval,
      stdoutPath: (plist.StandardOutPath as string) || "",
      stderrPath: (plist.StandardErrorPath as string) || "",
      envVars,
      loaded: false,
      pid: null,
      exitCode: null,
      disabled: (plist.Disabled as boolean) ?? false,
    };
  } catch {
    return null;
  }
}

/** Get launchctl list output and parse PID/exit status per label. */
function getLaunchctlStatus(): Map<string, { pid: number | null; exitCode: number | null }> {
  const map = new Map<string, { pid: number | null; exitCode: number | null }>();
  try {
    const output = execSync("launchctl list 2>/dev/null", { encoding: "utf-8" });
    for (const line of output.split("\n").slice(1)) { // skip header
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const pid = parts[0] === "-" ? null : parseInt(parts[0], 10);
        const exitCode = parseInt(parts[1], 10);
        const label = parts[2];
        map.set(label, { pid, exitCode: isNaN(exitCode) ? null : exitCode });
      }
    }
  } catch { /* ignore */ }
  return map;
}

/** Read all LaunchAgents from ~/Library/LaunchAgents/. */
function readLaunchAgents(): LaunchAgentEntry[] {
  const dir = join(homedir(), "Library", "LaunchAgents");
  const status = getLaunchctlStatus();
  const agents: LaunchAgentEntry[] = [];

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".plist")).sort();
    for (const file of files) {
      const agent = parseLaunchAgent(join(dir, file), file);
      if (!agent) continue;
      const st = status.get(agent.label);
      if (st) {
        agent.loaded = true;
        agent.pid = st.pid;
        agent.exitCode = st.exitCode;
      }
      agents.push(agent);
    }
  } catch { /* dir doesn't exist */ }

  return agents;
}

/** Parse a single crontab line into a structured entry. */
function parseCronLine(line: string, index: number): SystemCronEntry {
  const trimmed = line.trim();

  if (trimmed === "") {
    return { index, raw: line, comment: "", schedule: "", command: "", isComment: true, isEmpty: true };
  }

  if (trimmed.startsWith("#")) {
    return { index, raw: line, comment: trimmed.slice(1).trim(), schedule: "", command: "", isComment: true, isEmpty: false };
  }

  // Standard cron: 5 schedule fields + command
  const match = trimmed.match(/^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/);
  if (match) {
    return { index, raw: line, comment: "", schedule: match[1], command: match[2], isComment: false, isEmpty: false };
  }

  // Env var or unknown line — treat as comment
  return { index, raw: line, comment: trimmed, schedule: "", command: trimmed, isComment: true, isEmpty: false };
}

/** Read the current crontab as raw text. Returns empty string if none. */
function readCrontab(): string {
  try {
    return execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
  } catch {
    return "";
  }
}

/** Write a full crontab from text. Preserves all existing content when called correctly. */
function writeCrontab(content: string): void {
  // Ensure trailing newline — cron requires it
  const normalized = content.endsWith("\n") ? content : content + "\n";
  execSync("crontab -", { input: normalized, encoding: "utf-8" });
}

export function registerSystemCronRoutes(api: Hono): void {
  // ─── LaunchAgent routes ─────────────────────────────────────────────

  api.get("/launch-agents", (c) => {
    const agents = readLaunchAgents();
    return c.json({ agents });
  });

  api.post("/launch-agents/:label/load", (c) => {
    const label = c.req.param("label");
    const agents = readLaunchAgents();
    const agent = agents.find((a) => a.label === label);
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    try {
      execSync(`launchctl load -w "${agent.filepath}" 2>&1`, { encoding: "utf-8" });
      return c.json({ ok: true });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.post("/launch-agents/:label/unload", (c) => {
    const label = c.req.param("label");
    const agents = readLaunchAgents();
    const agent = agents.find((a) => a.label === label);
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    try {
      execSync(`launchctl unload -w "${agent.filepath}" 2>&1`, { encoding: "utf-8" });
      return c.json({ ok: true });
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // ─── Crontab routes ─────────────────────────────────────────────────

  // List all system crontab entries
  api.get("/system-cron", (c) => {
    const raw = readCrontab();
    if (!raw.trim()) return c.json({ entries: [], raw: "" });
    const lines = raw.split("\n");
    // Remove trailing empty line from split
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    const entries = lines.map((line, i) => parseCronLine(line, i));
    return c.json({ entries, raw });
  });

  // Add a new crontab entry (appends to the end, never overwrites)
  api.post("/system-cron", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { schedule, command, comment } = body as { schedule?: string; command?: string; comment?: string };

    if (!schedule || !command) {
      return c.json({ error: "Both schedule and command are required" }, 400);
    }

    // Validate cron schedule format (5 fields)
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) {
      return c.json({ error: "Schedule must be a 5-field cron expression (min hour dom mon dow)" }, 400);
    }

    const existing = readCrontab();
    const lines: string[] = [];

    if (existing.trim()) {
      // Preserve existing content, ensure no trailing whitespace lines
      const existingLines = existing.split("\n");
      // Remove trailing empty lines
      while (existingLines.length > 0 && existingLines[existingLines.length - 1].trim() === "") {
        existingLines.pop();
      }
      lines.push(...existingLines);
      lines.push(""); // blank separator
    }

    if (comment) {
      lines.push(`# ${comment}`);
    }
    lines.push(`${schedule.trim()} ${command.trim()}`);
    lines.push(""); // trailing newline for cron

    writeCrontab(lines.join("\n"));

    // Return updated entries
    const updated = readCrontab();
    const updatedLines = updated.split("\n");
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") updatedLines.pop();
    const entries = updatedLines.map((line, i) => parseCronLine(line, i));
    return c.json({ entries, raw: updated }, 201);
  });

  // Delete a crontab entry by line index
  api.delete("/system-cron/:index", (c) => {
    const index = parseInt(c.req.param("index"), 10);
    if (isNaN(index)) return c.json({ error: "Invalid index" }, 400);

    const existing = readCrontab();
    if (!existing.trim()) return c.json({ error: "Crontab is empty" }, 404);

    const lines = existing.split("\n");
    // Remove trailing empty from split
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    if (index < 0 || index >= lines.length) {
      return c.json({ error: "Index out of range" }, 404);
    }

    // If the line above is a comment (likely describing this entry), offer to remove both
    // But for safety, only remove the exact requested line
    // Check if previous line is a comment associated with this entry
    const removedLine = lines[index];
    const indicesToRemove = new Set([index]);

    // Also remove the preceding comment line if it exists and looks like a label for this entry
    if (index > 0 && lines[index - 1].trim().startsWith("#") && !lines[index].trim().startsWith("#")) {
      indicesToRemove.add(index - 1);
    }

    const remaining = lines.filter((_, i) => !indicesToRemove.has(i));

    writeCrontab(remaining.join("\n"));

    // Return updated state
    const updated = readCrontab();
    const updatedLines = updated.split("\n");
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") updatedLines.pop();
    const entries = updatedLines.map((line, i) => parseCronLine(line, i));
    return c.json({ entries, raw: updated, removed: removedLine });
  });

  // Update a crontab entry by line index (replace in place)
  api.put("/system-cron/:index", async (c) => {
    const index = parseInt(c.req.param("index"), 10);
    if (isNaN(index)) return c.json({ error: "Invalid index" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { schedule, command, enabled } = body as { schedule?: string; command?: string; enabled?: boolean };

    const existing = readCrontab();
    if (!existing.trim()) return c.json({ error: "Crontab is empty" }, 404);

    const lines = existing.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    if (index < 0 || index >= lines.length) {
      return c.json({ error: "Index out of range" }, 404);
    }

    const currentLine = lines[index].trim();

    // Handle enable/disable by commenting/uncommenting
    if (typeof enabled === "boolean") {
      if (!enabled && !currentLine.startsWith("#")) {
        lines[index] = "# " + lines[index];
      } else if (enabled && currentLine.startsWith("#")) {
        // Remove the leading # (and optional space)
        lines[index] = lines[index].replace(/^#\s?/, "");
      }
    }

    // Handle schedule/command replacement
    if (schedule && command) {
      const fields = schedule.trim().split(/\s+/);
      if (fields.length !== 5) {
        return c.json({ error: "Schedule must be a 5-field cron expression" }, 400);
      }
      lines[index] = `${schedule.trim()} ${command.trim()}`;
    }

    writeCrontab(lines.join("\n"));

    const updated = readCrontab();
    const updatedLines = updated.split("\n");
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] === "") updatedLines.pop();
    const entries = updatedLines.map((line, i) => parseCronLine(line, i));
    return c.json({ entries, raw: updated });
  });
}
