import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WsBridge } from "./ws-bridge.js";

const BASE = "http://localhost:3456/api";

let serverAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE}/sessions/resumable`, { signal: AbortSignal.timeout(1000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
  }
});

describe("GET /sessions/resumable (integration)", () => {
  it("returns sessions without title-generation prompts", async () => {
    if (!serverAvailable) return; // skip when server not running
    const res = await fetch(`${BASE}/sessions/resumable`);
    expect(res.ok).toBe(true);
    const sessions = (await res.json()) as { sessionId: string; title: string; project: string }[];
    expect(Array.isArray(sessions)).toBe(true);

    for (const s of sessions) {
      expect(s.title).not.toMatch(/^Generate a concise.*session title/);
    }
  });

  it("includes the 'Do this in our config file' session", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE}/sessions/resumable`);
    const sessions = (await res.json()) as { sessionId: string; title: string }[];
    const match = sessions.find((s) => s.title.includes("Do this in our config file"));
    expect(match).toBeDefined();
    expect(match!.sessionId).toBe("86e1a694-b687-46aa-b4bd-940330102ea7");
  });

  it("each session has required fields", async () => {
    if (!serverAvailable) return;
    const res = await fetch(`${BASE}/sessions/resumable`);
    const sessions = (await res.json()) as { sessionId: string; title: string; project: string; lastModified: number }[];

    for (const s of sessions) {
      expect(s.sessionId).toBeTruthy();
      expect(typeof s.project).toBe("string");
      expect(typeof s.lastModified).toBe("number");
      expect(typeof s.title).toBe("string");
    }
  });
});

// ─── Real-data resume test ────────────────────────────────────────────────────
//
// Uses the most recently completed CLI session from the companion project folder
// to verify that WsBridge.getOrCreateSession loads message history from the
// Claude session JSONL file when a resumeCliSessionId is provided.
//
// The session picked is c935db97 ("get rid of the default option in the mode
// selector and make agent default") — it has 284 JSONL lines and 2 user messages,
// which gives a stable, predictable fixture to assert against.

const REAL_CLI_SESSION_ID = "c935db97-51b0-4004-9cf3-835cdddc8e2e";
const REAL_CWD = join(homedir(), "dev/apps/iClaude/companion");
const REAL_SESSION_FILE = join(
  homedir(),
  ".claude/projects/-Users-me-dev-apps-iClaude-companion",
  `${REAL_CLI_SESSION_ID}.jsonl`,
);

describe("WsBridge resume — real CLI session data", () => {
  let bridge: WsBridge;

  beforeEach(() => {
    bridge = new WsBridge();
  });

  it("skips gracefully when the CLI session file is absent", () => {
    // Sanity check: a random UUID produces no history
    const session = bridge.getOrCreateSession("new-1", "claude", {
      resumeCliSessionId: "00000000-0000-0000-0000-000000000000",
      cwd: REAL_CWD,
    });
    expect(session.messageHistory).toHaveLength(0);
  });

  it("loads message history from the real CLI session JSONL file on resume", () => {
    // Skip on CI or machines that don't have this local session
    if (!existsSync(REAL_SESSION_FILE)) return;

    // Simulate resuming the session: the bridge creates a new companion session
    // but pre-loads history from the existing CLI session file.
    const session = bridge.getOrCreateSession("resumed-companion-id", "claude", {
      resumeCliSessionId: REAL_CLI_SESSION_ID,
      cwd: REAL_CWD,
    });

    // The JSONL has 2 real user messages; history must not be empty
    expect(session.messageHistory.length).toBeGreaterThan(0);

    // The cliSessionId must be set so --resume works on the next spawn
    expect(session.cliSessionId).toBe(REAL_CLI_SESSION_ID);

    // The first user message must match the actual session content
    const firstUser = session.messageHistory.find((m) => m.type === "user_message");
    expect(firstUser).toBeDefined();
    expect((firstUser as any).content).toMatch(/get rid of the default option/i);

    // Both user messages must be present (no tool_result-only turns leaking through)
    const userMessages = session.messageHistory.filter((m) => m.type === "user_message");
    expect(userMessages).toHaveLength(2);
  });
});
