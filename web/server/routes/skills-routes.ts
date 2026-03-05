import type { Hono } from "hono";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const SKILLS_DIR = join(homedir(), ".claude", "skills");
const SKILL_FILE = "SKILL.md";

interface SkillMeta {
  slug: string;
  name: string;
  description: string;
  path: string;
}

/** Convert a display name to a URL-safe slug. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validate a slug: no path traversal characters. */
function isValidSlug(slug: string): boolean {
  return !slug.includes("..") && !slug.includes("/") && !slug.includes("\\");
}

/** Parse YAML-style front matter for `name:` and `description:` fields. */
function parseFrontMatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const nameMatch = block.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const descMatch = block.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
  };
}

/** Build the SKILL.md file content from parts. */
function buildSkillMd(slug: string, description: string, body: string): string {
  return `---\nname: ${slug}\ndescription: "${description}"\n---\n\n${body}`;
}

export function registerSkillRoutes(api: Hono): void {
  /** List all skills */
  api.get("/skills", async (c) => {
    if (!existsSync(SKILLS_DIR)) return c.json([]);

    try {
      const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
      const skills: SkillMeta[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const mdPath = join(SKILLS_DIR, entry.name, SKILL_FILE);
        if (!existsSync(mdPath)) continue;

        const content = await readFile(mdPath, "utf-8");
        const { name, description } = parseFrontMatter(content);
        skills.push({
          slug: entry.name,
          name: name ?? entry.name,
          description: description ?? "",
          path: mdPath,
        });
      }

      return c.json(skills);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  /** Get a single skill's raw content */
  api.get("/skills/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!isValidSlug(slug)) return c.json({ error: "Invalid slug" }, 400);

    const mdPath = join(SKILLS_DIR, slug, SKILL_FILE);
    if (!existsSync(mdPath)) return c.json({ error: "Skill not found" }, 404);

    try {
      const content = await readFile(mdPath, "utf-8");
      return c.json({ slug, path: mdPath, content });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  /** Create a new skill */
  api.post("/skills", async (c) => {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const rawName = body.name;
    if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    const name = rawName.trim();
    const slug = toSlug(name);
    if (!slug) return c.json({ error: "Invalid name" }, 400);

    const description = typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : `Skill: ${name}`;
    const content = typeof body.content === "string"
      ? body.content
      : `# ${name}\n\nDescribe what this skill does and how to use it.`;

    const mdPath = join(SKILLS_DIR, slug, SKILL_FILE);
    if (existsSync(mdPath)) {
      return c.json({ error: `Skill '${slug}' already exists` }, 409);
    }

    try {
      await mkdir(SKILLS_DIR, { recursive: true });
      await mkdir(join(SKILLS_DIR, slug), { recursive: true });
      await writeFile(mdPath, buildSkillMd(slug, description, content), "utf-8");
      return c.json({ slug, name, description, path: mdPath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  /** Update a skill's content */
  api.put("/skills/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!isValidSlug(slug)) return c.json({ error: "Invalid slug" }, 400);

    const mdPath = join(SKILLS_DIR, slug, SKILL_FILE);
    if (!existsSync(mdPath)) return c.json({ error: "Skill not found" }, 404);

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    if (typeof body.content !== "string") return c.json({ error: "content is required" }, 400);

    try {
      await writeFile(mdPath, body.content, "utf-8");
      return c.json({ ok: true, slug, path: mdPath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  /** Delete a skill */
  api.delete("/skills/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!isValidSlug(slug)) return c.json({ error: "Invalid slug" }, 400);

    const skillDir = join(SKILLS_DIR, slug);
    if (!existsSync(skillDir)) return c.json({ error: "Skill not found" }, 404);

    try {
      await rm(skillDir, { recursive: true, force: true });
      return c.json({ ok: true, slug });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });
}
