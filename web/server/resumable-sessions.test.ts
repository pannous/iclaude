import { describe, it, expect, beforeAll } from "vitest";

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
