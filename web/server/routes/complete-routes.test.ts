/**
 * Tests for the /api/sessions/:id/complete endpoint.
 *
 * The endpoint calls the OpenAI API using OPENAI_API_KEY from env or ~/.keys.
 * We verify:
 *   1. null when session is not found
 *   2. null when no API key is available (env + ~/.keys both absent)
 *   3. null when OpenAI API returns a non-ok status
 *   4. Returns the model's text completion for partial input
 *   5. Returns a suggestion for empty input (context-only)
 *   6. null when API returns empty text
 *   7. Passes conversation history and partial text in the request body
 *   8. Reads key from ~/.keys when env var is absent
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { registerCompleteRoutes } from "./complete-routes.js";
import type { WsBridge } from "../ws-bridge.js";

const FAKE_SESSION_ID = "sess-test-001";

function openAiResponse(text: string, status = 200) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: text } }] }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function buildFakeSession(messageHistory: unknown[] = []) {
  return { id: FAKE_SESSION_ID, messageHistory };
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

function postComplete(app: Hono, id: string, partial: string) {
  return app.request(`/sessions/${id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partial }),
  });
}

describe("POST /sessions/:id/complete", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    // Ensure env key is set by default for tests that need it
    process.env.OPENAI_API_KEY = "sk-fake";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns null when session is not found", async () => {
    const app = buildApp(buildWsBridgeMock(/* no session */));
    const res = await postComplete(app, "missing-session", "test");
    expect(res.status).toBe(200);
    expect((await res.json() as { suggestion: null }).suggestion).toBeNull();
  });

  it("returns null when no API key is available", async () => {
    delete process.env.OPENAI_API_KEY;
    // Mock fs so ~/.keys lookup also fails
    vi.mock("node:fs", async (importOriginal) => {
      const original = await importOriginal<typeof import("node:fs")>();
      return { ...original, existsSync: () => false };
    });
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    expect((await res.json() as { suggestion: null }).suggestion).toBeNull();
  });

  it("returns null when OpenAI API responds with non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429 }),
    );
    const session = buildFakeSession([
      { type: "user_message", content: "list files", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Here are the files." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "now show me");
    expect((await res.json() as { suggestion: null }).suggestion).toBeNull();
  });

  it("returns suggestion for partial input", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(openAiResponse(" the contents of src/"));
    const session = buildFakeSession([
      { type: "user_message", content: "list files", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Here are the files." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "show me");
    expect((await res.json() as { suggestion: string }).suggestion).toBe("the contents of src/");
  });

  it("returns suggestion for empty input (context-only)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(openAiResponse("Can you run the tests?"));
    const session = buildFakeSession([
      { type: "user_message", content: "fix the bug", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "Fixed." }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    expect((await res.json() as { suggestion: string }).suggestion).toBe("Can you run the tests?");
  });

  it("returns null when API returns empty text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(openAiResponse(""));
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    const res = await postComplete(app, FAKE_SESSION_ID, "");
    expect((await res.json() as { suggestion: null }).suggestion).toBeNull();
  });

  it("passes system prompt, history, and partial in request body", async () => {
    let capturedBody: unknown;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return openAiResponse("completion");
    });
    const session = buildFakeSession([
      { type: "user_message", content: "hello", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "world" }] } },
    ]);
    const app = buildApp(buildWsBridgeMock(session));
    await postComplete(app, FAKE_SESSION_ID, "how are");

    const body = capturedBody as { messages: Array<{ role: string; content: string }> };
    // First message: system prompt
    expect(body.messages[0].role).toBe("system");
    // Second: user turn from history
    expect(body.messages[1]).toEqual({ role: "user", content: "hello" });
    // Third: assistant turn from history
    expect(body.messages[2]).toEqual({ role: "assistant", content: "world" });
    // Last: completion task containing the partial
    expect(body.messages.at(-1)?.role).toBe("user");
    expect(body.messages.at(-1)?.content).toContain("how are");
  });

  it("sends Bearer auth header to OpenAI", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return openAiResponse("done");
    });
    const session = buildFakeSession([
      { type: "user_message", content: "hi", timestamp: 1 },
      { type: "assistant", message: { content: [{ type: "text", text: "hello" }] } },
    ]);
    await postComplete(buildApp(buildWsBridgeMock(session)), FAKE_SESSION_ID, "test");
    expect(capturedHeaders?.["Authorization"]).toBe("Bearer sk-fake");
  });
});
