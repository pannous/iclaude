/**
 * Legacy skill routes — extracted from routes.ts before upstream merge removed skill-manager
 * Kept for reference if we want to re-integrate HTML Skills system
 */

import type { Hono } from "hono";
import * as skillManager from "./skill-manager-legacy.js";

export function registerSkillRoutes(api: Hono) {
  // ─── Skills (~/.companion/skills/) ────────────────────────────────────────

  api.get("/skills", (c) => {
    try {
      return c.json(skillManager.listSkills());
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  api.get("/skills/:slug", (c) => {
    const skill = skillManager.getSkill(c.req.param("slug"));
    if (!skill) return c.json({ error: "Skill not found" }, 404);
    return c.json(skill);
  });

  api.get("/skills/:slug/panel", (c) => {
    const slug = c.req.param("slug");
    const skill = skillManager.getSkill(slug);
    if (!skill) return c.json({ error: "Skill not found" }, 404);
    const rawHtml = skillManager.getSkillPanel(slug);
    if (!rawHtml) return c.json({ error: "Panel HTML not found" }, 404);
    return new Response(skillManager.wrapWithVibeApi(rawHtml, slug), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  api.get("/skills/:slug/state", (c) => {
    return c.json(skillManager.getSkillState(c.req.param("slug")));
  });

  api.put("/skills/:slug/state", async (c) => {
    const slug = c.req.param("slug");
    if (!skillManager.getSkill(slug)) return c.json({ error: "Skill not found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    skillManager.setSkillState(slug, body);
    return c.json({ ok: true });
  });
}
