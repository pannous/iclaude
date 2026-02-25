/**
 * HTML Skills routes — serves panel.html skills from ~/.companion/skills/
 * with window.vibe API injection for tab-based skill panels.
 *
 * Also provides /api/exec for vibe.command() from skill iframes.
 */

import { execSync } from "node:child_process";
import type { Hono } from "hono";
import * as skillManager from "../skill-manager.js";

export function registerSkillRoutes(api: Hono): void {
  // ─── List all HTML skills ──────────────────────────────────────────────────
  api.get("/skills", (c) => {
    try {
      return c.json(skillManager.listSkills());
    } catch (e: unknown) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // ─── Get skill metadata ────────────────────────────────────────────────────
  api.get("/skills/:slug", (c) => {
    const skill = skillManager.getSkill(c.req.param("slug"));
    if (!skill) return c.json({ error: "Skill not found" }, 404);
    return c.json(skill);
  });

  // ─── Serve panel.html with injected window.vibe API ────────────────────────
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

  // ─── Skill persistent state ────────────────────────────────────────────────
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
