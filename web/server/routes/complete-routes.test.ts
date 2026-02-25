/**
 * Tests for the /api/sessions/:id/complete endpoint.
 *
 * The endpoint calls the Anthropic API if ANTHROPIC_API_KEY is set.
 * We verify:
 *   1. 404-style null when session is not found
 *   2. null when ANTHROPIC_API_KEY is absent
 *   3. Passes conversation history and partial text to the API
 *   4. Returns the model's text completion
 *   5. Returns null when Anthropic API returns a non-ok status
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { registerCompleteRoutes } from "./complete-routes.js";
import type { WsBridge } from "../ws-bridge.js";

const FAKE_SESSION_ID = "sess-test-001";

function buildFakeSession(messageHistory: unknown[] = []) {
  return {
    id: FAKE_SESSION_ID,
    messageHistory,
  };
}

function buildWsBridgeMock(session?: ReturnType<typeof buildFakeSession>) {
  return {
    resolveSession: vi.fn((_id: string) => session ?? undefined),
  } as unknown as WsBridge;
}

function buildApp(wsBridge: WsBridge) {
  const app = new Hono();
  registerCompleteRoutes(app, { wsBridge });
  return app;
}

async function postComplete(app: Hono, id: string, partial: string) {
  return app.request(`/sessions/${id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partial }),
  });
}

describe("POST /sessions/:id/complete", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    // Restore env + global fetch
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
    vi.restoreAllMocks();
  });

  it("returns null when session is not found", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    const app = buildApp(buildWsBridgeMock(/* no session */));
    const res = await postComplete(app, "missing-session", "test");
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestion: null };
    expect(data.suggestion).toBeNull();
  });

  it("returns null when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestion: null };
    expect(data.suggestion).toBeNull();
  });

  it("returns null when API responds with non-ok status", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 }),
    );
    const session = buildFakeSession([
      { type: "user_message", content: "list files", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Here are the files." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "now show me");
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestion: null };
    expect(data.suggestion).toBeNull();
  });

  it("returns suggestion from API for partial input", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: " the contents of src/" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const session = buildFakeSession([
      { type: "user_message", content: "list files", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Here are the files." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "show me");
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestion: string };
    expect(data.suggestion).toBe("the contents of src/");
  });

  it("returns suggestion from API for empty input (context-only)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "Can you run the tests?" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const session = buildFakeSession([
      { type: "user_message", content: "fix the bug", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Fixed." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    expect(res.status).toBe(200);
    const data = await res.json() as { suggestion: string };
    expect(data.suggestion).toBe("Can you run the tests?");
  });

  it("returns null when API returns empty text", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    const data = await res.json() as { suggestion: null };
    expect(data.suggestion).toBeNull();
  });

  it("passes partial text and history in the API request body", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-fake";
    let capturedBody: unknown;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "completion" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "world" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    await postComplete(app, FAKE_SESSION_ID, "how are");

    const body = capturedBody as { messages: Array<{ role: string; content: string }> };
    // First message should be the user turn from history
    expect(body.messages[0]).toEqual({ role: "user", content: "hello" });
    // Second: assistant turn
    expect(body.messages[1]).toEqual({ role: "assistant", content: "world" });
    // Last: completion task prompt containing the partial
    expect(body.messages.at(-1)?.role).toBe("user");
    expect(body.messages.at(-1)?.content).toContain("how are");
  });
});
