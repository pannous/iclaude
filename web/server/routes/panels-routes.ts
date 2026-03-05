/**
 * HTML Panel routes — serves panel.html panels from ~/.companion/panels/
 * with window.vibe API injection for tab-based panels.
 *
 * Also provides /api/exec for vibe.command() from panel iframes.
 */

import { execSync } from "node:child_process";
import type { Hono } from "hono";
import * as panelManager from "../panel-manager.js";

export function registerPanelRoutes(api: Hono): void {
  // ─── List all HTML panels ──────────────────────────────────────────────────
  api.get("/panels", (c) => {
    try {
      return c.json(panelManager.listPanels());
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // ─── Get panel metadata ────────────────────────────────────────────────────
  api.get("/panels/:slug", (c) => {
    const panel = panelManager.getPanel(c.req.param("slug"));
    if (!panel) return c.json({ error: "Panel not found" }, 404);
    return c.json(panel);
  });

  // ─── Serve panel.html with injected window.vibe API ────────────────────────
  api.get("/panels/:slug/panel", (c) => {
    const slug = c.req.param("slug");
    const panel = panelManager.getPanel(slug);
    if (!panel) return c.json({ error: "Panel not found" }, 404);
    const rawHtml = panelManager.getPanelHtml(slug);
    if (!rawHtml) return c.json({ error: "Panel HTML not found" }, 404);
    return new Response(panelManager.wrapWithVibeApi(rawHtml, slug), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  // ─── Panel persistent state ────────────────────────────────────────────────
  api.get("/panels/:slug/state", (c) => {
    return c.json(panelManager.getPanelState(c.req.param("slug")));
  });

  api.put("/panels/:slug/state", async (c) => {
    const slug = c.req.param("slug");
    if (!panelManager.getPanel(slug)) return c.json({ error: "Panel not found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    panelManager.setPanelState(slug, body);
    return c.json({ ok: true });
  });

  // ─── Shell exec for window.vibe.command() ──────────────────────────────────
  api.post("/exec", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { command, cwd } = body;
    if (!command || typeof command !== "string") {
      return c.json({ error: "command is required" }, 400);
    }
    try {
      const stdout = execSync(command, {
        cwd: cwd || undefined,
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
      });
      return c.json({ ok: true, stdout });
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; status?: number };
      return c.json({
        ok: false,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        exitCode: err.status ?? 1,
      });
    }
  });
}
