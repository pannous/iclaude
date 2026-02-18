import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

export interface SavedPrompt {
  name: string;
  content: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function promptsDir(cwd: string): string {
  return join(cwd, "prompts");
}

function scanFolder(dir: string): SavedPrompt[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => {
      const fullPath = join(e.parentPath ?? dir, e.name);
      const relPath = relative(dir, fullPath);
      const name = relPath.replace(/\.md$/, "").replaceAll("/", ":");
      const content = readFileSync(fullPath, "utf-8").trim();
      return { name, content };
    })
    .filter((p) => p.name && p.content)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPrompts(cwd: string): SavedPrompt[] {
  return scanFolder(promptsDir(cwd));
}

export function createPrompt(cwd: string, name: string, content: string): SavedPrompt {
  const cleanContent = content?.trim();
  if (!name?.trim()) throw new Error("Prompt name is required");
  if (!cleanContent) throw new Error("Prompt content is required");

  const slug = slugify(name);
  if (!slug) throw new Error("Prompt name must contain at least one alphanumeric character");

  const dir = promptsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${slug}.md`);
  writeFileSync(filePath, cleanContent, "utf-8");
  return { name: slug, content: cleanContent };
}

export function deletePrompt(cwd: string, name: string): boolean {
  const filePath = join(promptsDir(cwd), `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
