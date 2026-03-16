import type { Hono } from "hono";
import { execSync } from "node:child_process";

export interface SystemCronEntry {
  index: number;
  raw: string;
  comment: string;
  schedule: string;
  command: string;
  isComment: boolean;
  isEmpty: boolean;
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
