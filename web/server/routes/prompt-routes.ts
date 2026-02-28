import type { Hono } from "hono";
import * as promptManager from "../prompt-manager.js";

function parseScope(raw: string | undefined): promptManager.PromptScope {
  return raw === "global" ? "global" : "project";
}

export function registerPromptRoutes(api: Hono): void {
  api.get("/prompts", (c) => {
    try {
      const cwd = c.req.query("cwd");
      const scope = c.req.query("scope");
      const normalizedScope =
        scope === "global" || scope === "project" || scope === "all" ? scope : undefined;
      return c.json(promptManager.listPrompts({ cwd, scope: normalizedScope }));
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/prompts/:name", (c) => {
    const scope = parseScope(c.req.query("scope"));
    const prompt = promptManager.getPrompt(c.req.param("name"), scope, c.req.query("cwd"));
    if (!prompt) return c.json({ error: "Prompt not found" }, 404);
    return c.json(prompt);
  });

  api.post("/prompts", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const scope = (body.scope ?? (body.cwd ? "project" : "global")) as promptManager.PromptScope;
      const prompt = promptManager.createPrompt(
        String(body.title || body.name || ""),
        String(body.content || ""),
        scope,
        body.cwd,
      );
      return c.json(prompt, 201);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.put("/prompts/:name", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const scope = parseScope(body.scope);
      const prompt = promptManager.updatePrompt(c.req.param("name"), String(body.content || ""), scope, body.cwd);
      if (!prompt) return c.json({ error: "Prompt not found" }, 404);
      return c.json(prompt);
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  api.delete("/prompts/:name", (c) => {
    const scope = parseScope(c.req.query("scope"));
    const deleted = promptManager.deletePrompt(c.req.param("name"), scope, c.req.query("cwd"));
    if (!deleted) return c.json({ error: "Prompt not found" }, 404);
    return c.json({ ok: true });
  });
}
