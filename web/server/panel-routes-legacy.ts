/**
 * Legacy panel routes — extracted from routes.ts before upstream merge removed panel-manager
 * Kept for reference if we want to re-integrate HTML Panels system
 */

import type { Hono } from "hono";
import * as panelManager from "./panel-manager-legacy.js";

export function registerPanelRoutes(api: Hono) {
  // ─── Panels (~/.companion/panels/) ────────────────────────────────────────

  api.get("/panels", (c) => {
    try {
      return c.json(panelManager.listPanels());
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/panels/:slug", (c) => {
    const panel = panelManager.getPanel(c.req.param("slug"));
    if (!panel) return c.json({ error: "Panel not found" }, 404);
    return c.json(panel);
  });

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
}
