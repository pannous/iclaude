// LOCAL: File-based prompt storage, diverging from upstream's ~/.companion/prompts.json approach.
// Global prompts:  ~/.claude/prompts/<name>.md
// Project prompts: {cwd}/.claude/commands/<name>.md

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";

export type PromptScope = "global" | "project";

export interface SavedPrompt {
  id: string;
  name: string;
  content: string;
  scope: PromptScope;
}

const globalPromptsDir = () => join(homedir(), ".claude", "prompts");
const projectCommandsDir = (cwd: string) => join(resolve(cwd), ".claude", "commands");

function promptDir(scope: PromptScope, cwd?: string): string {
  return scope === "global" ? globalPromptsDir() : projectCommandsDir(cwd!);
}

function readPromptsFromDir(dir: string, scope: PromptScope): SavedPrompt[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const name = basename(f, ".md");
      const content = readFileSync(join(dir, f), "utf-8").trim();
      return { id: name, name, content, scope };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPrompts(opts?: { cwd?: string; scope?: "global" | "project" | "all" }): SavedPrompt[] {
  const scope = opts?.scope ?? "all";
  const results: SavedPrompt[] = [];
  if (scope !== "project") results.push(...readPromptsFromDir(globalPromptsDir(), "global"));
  if (scope !== "global" && opts?.cwd) results.push(...readPromptsFromDir(projectCommandsDir(opts.cwd), "project"));
  return results;
}

export function getPrompt(name: string, scope: PromptScope, cwd?: string): SavedPrompt | null {
  const filePath = join(promptDir(scope, cwd), `${name}.md`);
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8").trim();
  return { id: name, name, content, scope };
}

export function createPrompt(name: string, content: string, scope: PromptScope, cwd?: string): SavedPrompt {
  const cleanName = name?.trim();
  const cleanContent = content?.trim();
  if (!cleanName) throw new Error("Prompt name is required");
  if (!cleanContent) throw new Error("Prompt content is required");
  if (scope === "project" && !cwd?.trim()) throw new Error("Project path is required for project prompts");

  const dir = promptDir(scope, cwd);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${cleanName}.md`), cleanContent, "utf-8");
  return { id: cleanName, name: cleanName, content: cleanContent, scope };
}

export function updatePrompt(name: string, content: string, scope: PromptScope, cwd?: string): SavedPrompt | null {
  const filePath = join(promptDir(scope, cwd), `${name}.md`);
  if (!existsSync(filePath)) return null;
  const cleanContent = content?.trim();
  if (!cleanContent) throw new Error("Prompt content cannot be empty");
  writeFileSync(filePath, cleanContent, "utf-8");
  return { id: name, name, content: cleanContent, scope };
}

export function deletePrompt(name: string, scope: PromptScope, cwd?: string): boolean {
  const filePath = join(promptDir(scope, cwd), `${name}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
