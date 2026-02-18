import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

export interface SavedPrompt {
  name: string;
  content: string;
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
  const cleanName = name?.trim();
  const cleanContent = content?.trim();
  if (!cleanName) throw new Error("Prompt name is required");
  if (!cleanContent) throw new Error("Prompt content is required");
  if (cleanName.includes("/") || cleanName.includes("\\")) {
    throw new Error("Prompt name cannot contain path separators");
  }

  const dir = promptsDir(cwd);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${cleanName}.md`);
  writeFileSync(filePath, cleanContent, "utf-8");
  return { name: cleanName, content: cleanContent };
}

export function deletePrompt(cwd: string, name: string): boolean {
  const filePath = join(promptsDir(cwd), `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
