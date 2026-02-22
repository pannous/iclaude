import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const COMPANION_DIR = join(homedir(), ".companion");

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function companionDir(subdir: string): string {
  const dir = join(COMPANION_DIR, subdir);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function companionFilePath(subdir: string, id: string): string {
  return join(COMPANION_DIR, subdir, `${id}.json`);
}
