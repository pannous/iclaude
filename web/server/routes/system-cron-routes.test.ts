import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { registerSystemCronRoutes } from "./system-cron-routes.js";

// Mock filesystem and child_process to avoid touching real system state
let mockCrontab = "";
const mockPlistFiles: Record<string, string> = {};
let mockLaunchctlOutput = "";

vi.mock("node:child_process", () => ({
  execSync: vi.fn((cmd: string, opts?: { input?: string }) => {
    if (cmd === "crontab -l 2>/dev/null") {
      if (!mockCrontab) throw new Error("no crontab for user");
      return mockCrontab;
    }
    if (cmd === "crontab -") {
      mockCrontab = opts?.input || "";
      return "";
    }
    if (cmd === "launchctl list 2>/dev/null") {
      return mockLaunchctlOutput;
    }
    if (cmd.startsWith("launchctl load") || cmd.startsWith("launchctl unload")) {
      return "";
    }
    throw new Error(`Unexpected command: ${cmd}`);
  }),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readdirSync: vi.fn((dir: string) => {
      if (dir.endsWith("Library/LaunchAgents")) {
        return Object.keys(mockPlistFiles);
      }
      return actual.readdirSync(dir);
    }),
    readFileSync: vi.fn((filepath: string, encoding?: string) => {
      const basename = String(filepath).split("/").pop() || "";
      if (mockPlistFiles[basename] !== undefined) {
        return mockPlistFiles[basename];
      }
      return actual.readFileSync(filepath, encoding as any);
    }),
  };
});

describe("system-cron-routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    registerSystemCronRoutes(app);
    mockCrontab = "";
    Object.keys(mockPlistFiles).forEach((k) => delete mockPlistFiles[k]);
    mockLaunchctlOutput = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /system-cron", () => {
    it("returns empty when no crontab", async () => {
      const res = await app.request("/system-cron");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toEqual([]);
      expect(body.raw).toBe("");
    });

    it("parses crontab entries correctly", async () => {
      mockCrontab = [
        "# Jobs project - scan every hour",
        "0 * * * * cd /Users/me/jobs && python3 main.py scan",
        "",
        "*/20 * * * * cd /Users/me/jobs && python3 scripts/auto_work.py",
      ].join("\n") + "\n";

      const res = await app.request("/system-cron");
      expect(res.status).toBe(200);
      const body = await res.json();

      // Should have 4 entries: comment, job, empty, job
      expect(body.entries).toHaveLength(4);

      // First is a comment
      expect(body.entries[0].isComment).toBe(true);
      expect(body.entries[0].comment).toBe("Jobs project - scan every hour");

      // Second is a cron job
      expect(body.entries[1].isComment).toBe(false);
      expect(body.entries[1].schedule).toBe("0 * * * *");
      expect(body.entries[1].command).toBe("cd /Users/me/jobs && python3 main.py scan");

      // Third is empty
      expect(body.entries[2].isEmpty).toBe(true);

      // Fourth is another cron job
      expect(body.entries[3].schedule).toBe("*/20 * * * *");
    });
  });

  describe("POST /system-cron", () => {
    it("rejects missing schedule or command", async () => {
      const res = await app.request("/system-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: "0 * * * *" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid cron schedule", async () => {
      const res = await app.request("/system-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: "every hour", command: "echo hello" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("5-field");
    });

    it("appends a new entry to an empty crontab", async () => {
      const res = await app.request("/system-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: "0 8 * * *",
          command: "echo hello",
          comment: "Daily greeting",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      const active = body.entries.filter((e: any) => !e.isComment && !e.isEmpty);
      expect(active).toHaveLength(1);
      expect(active[0].schedule).toBe("0 8 * * *");
      expect(active[0].command).toBe("echo hello");

      // Verify comment is present
      const comments = body.entries.filter((e: any) => e.isComment && e.comment.includes("Daily greeting"));
      expect(comments).toHaveLength(1);
    });

    it("preserves existing entries when appending", async () => {
      mockCrontab = "0 * * * * existing-job\n";

      const res = await app.request("/system-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule: "*/5 * * * *",
          command: "new-job",
        }),
      });
      expect(res.status).toBe(201);

      // Verify existing entry is preserved
      expect(mockCrontab).toContain("existing-job");
      expect(mockCrontab).toContain("new-job");
    });
  });

  describe("DELETE /system-cron/:index", () => {
    it("removes an entry by index", async () => {
      mockCrontab = [
        "# comment for first",
        "0 * * * * first-job",
        "*/5 * * * * second-job",
      ].join("\n") + "\n";

      // Delete the second job (index 2)
      const res = await app.request("/system-cron/2", { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Should still have the first job
      const active = body.entries.filter((e: any) => !e.isComment && !e.isEmpty);
      expect(active).toHaveLength(1);
      expect(active[0].command).toBe("first-job");
    });

    it("removes associated comment when deleting a job", async () => {
      mockCrontab = [
        "# label for the job",
        "0 * * * * the-job",
      ].join("\n") + "\n";

      // Delete at index 1 (the job line) — should also remove preceding comment
      const res = await app.request("/system-cron/1", { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json();
      // All active entries should be gone
      const active = body.entries.filter((e: any) => !e.isEmpty);
      expect(active).toHaveLength(0);
    });

    it("returns 404 for out-of-range index", async () => {
      mockCrontab = "0 * * * * job\n";
      const res = await app.request("/system-cron/99", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /system-cron/:index", () => {
    it("updates schedule and command", async () => {
      mockCrontab = "0 * * * * old-command\n";

      const res = await app.request("/system-cron/0", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: "*/30 * * * *", command: "new-command" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries[0].schedule).toBe("*/30 * * * *");
      expect(body.entries[0].command).toBe("new-command");
    });

    it("disables by commenting out", async () => {
      mockCrontab = "0 * * * * job\n";

      const res = await app.request("/system-cron/0", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      expect(res.status).toBe(200);
      // The raw crontab should now have a # prefix
      expect(mockCrontab).toContain("# 0 * * * * job");
    });

    it("re-enables by uncommenting", async () => {
      mockCrontab = "# 0 * * * * job\n";

      const res = await app.request("/system-cron/0", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(200);
      expect(mockCrontab.trim()).toBe("0 * * * * job");
    });
  });

  // ─── LaunchAgent routes ─────────────────────────────────────────────

  describe("GET /launch-agents", () => {
    it("returns empty when no plist files", async () => {
      const res = await app.request("/launch-agents");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agents).toEqual([]);
    });

    it("parses plist files correctly", async () => {
      mockPlistFiles["com.test.job.plist"] = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.test.job</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>main.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/me/project</string>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/tmp/test.log</string>
</dict>
</plist>`;

      mockLaunchctlOutput = "PID\tStatus\tLabel\n1234\t0\tcom.test.job\n";

      const res = await app.request("/launch-agents");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agents).toHaveLength(1);

      const agent = body.agents[0];
      expect(agent.label).toBe("com.test.job");
      expect(agent.program).toEqual(["/usr/bin/python3", "main.py"]);
      expect(agent.workingDirectory).toBe("/Users/me/project");
      expect(agent.startInterval).toBe(3600);
      expect(agent.stdoutPath).toBe("/tmp/test.log");
      expect(agent.loaded).toBe(true);
      expect(agent.pid).toBe(1234);
    });

    it("marks unloaded agents correctly", async () => {
      mockPlistFiles["com.test.idle.plist"] = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.test.idle</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/echo</string>
    <string>hello</string>
  </array>
</dict>
</plist>`;

      mockLaunchctlOutput = "PID\tStatus\tLabel\n";

      const res = await app.request("/launch-agents");
      const body = await res.json();
      expect(body.agents[0].loaded).toBe(false);
      expect(body.agents[0].pid).toBeNull();
    });

    it("skips empty dict plists", async () => {
      mockPlistFiles["com.google.empty.plist"] = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict/></plist>`;

      const res = await app.request("/launch-agents");
      const body = await res.json();
      expect(body.agents).toHaveLength(0);
    });
  });

  describe("POST /launch-agents/:label/load", () => {
    it("returns 404 for unknown label", async () => {
      const res = await app.request("/launch-agents/com.unknown/load", { method: "POST" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /launch-agents/:label/unload", () => {
    it("returns 404 for unknown label", async () => {
      const res = await app.request("/launch-agents/com.unknown/unload", { method: "POST" });
      expect(res.status).toBe(404);
    });
  });
});
