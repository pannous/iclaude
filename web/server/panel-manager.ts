import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { homedir } from "node:os";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PanelInfo {
  slug: string;
  name: string;
  description: string;
  icon: string;
  refreshInterval: number | null;
  type: "html" | "markdown";
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const GLOBAL_PANELS_DIR = join(homedir(), ".companion", "panels");
const CLAUDE_SKILLS_DIR = join(homedir(), ".claude", "skills");

function projectPanelsDir(cwd: string): string {
  return join(cwd, "panels");
}

function ensureGlobalDir(): void {
  mkdirSync(GLOBAL_PANELS_DIR, { recursive: true });
}

/** Resolve the directory for a panel slug, checking project-local first. */
function resolvePanelDir(slug: string, cwd?: string): string | null {
  if (!isValidSlug(slug)) return null;
  if (cwd) {
    const local = join(projectPanelsDir(cwd), slug);
    if (existsSync(join(local, "panel.json"))) return local;
  }
  const global = join(GLOBAL_PANELS_DIR, slug);
  if (existsSync(join(global, "panel.json"))) return global;
  return null;
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug);
}

function commandsDir(cwd: string): string {
  return join(cwd, ".claude", "commands");
}

function isValidCommandName(command: string): boolean {
  if (!/^[A-Za-z0-9._/-]+$/.test(command)) return false;
  const segments = command.split("/");
  if (segments.length === 0) return false;
  return segments.every((seg) => seg.length > 0 && seg !== "." && seg !== "..");
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

function scanPanelsDir(baseDir: string): PanelInfo[] {
  if (!existsSync(baseDir)) return [];
  try {
    const entries = readdirSync(baseDir);
    const panels: PanelInfo[] = [];
    for (const entry of entries) {
      const dir = join(baseDir, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
        const manifestPath = join(dir, "panel.json");
        if (!existsSync(manifestPath)) continue;
        const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
        panels.push({
          slug: entry,
          name: raw.name || entry,
          description: raw.description || "",
          icon: raw.icon || "terminal",
          refreshInterval: typeof raw.refreshInterval === "number" ? raw.refreshInterval : null,
          type: "html",
        });
      } catch {
        // Skip malformed panels
      }
    }
    return panels;
  } catch {
    return [];
  }
}

/** Scan ~/.claude/skills/ for SKILL.md markdown skills (YAML frontmatter). */
function scanMarkdownPanelsDir(baseDir: string): PanelInfo[] {
  if (!existsSync(baseDir)) return [];
  try {
    const entries = readdirSync(baseDir);
    const panels: PanelInfo[] = [];
    for (const entry of entries) {
      const dir = join(baseDir, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
        const mdPath = join(dir, "SKILL.md");
        if (!existsSync(mdPath)) continue;
        const content = readFileSync(mdPath, "utf-8");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let name = entry;
        let description = "";
        if (fmMatch) {
          for (const line of fmMatch[1].split("\n")) {
            const nm = line.match(/^name:\s*["']?(.+?)["']?\s*$/);
            if (nm) name = nm[1];
            const dm = line.match(/^description:\s*["']?(.+?)["']?\s*$/);
            if (dm) description = dm[1];
          }
        }
        panels.push({ slug: entry, name, description, icon: "file-text", refreshInterval: null, type: "markdown" });
      } catch {
        // Skip malformed entries
      }
    }
    return panels;
  } catch {
    return [];
  }
}

/** List panels from ~/.claude/skills/ (markdown), ~/.companion/panels/ (HTML), and optionally project-local (<cwd>/panels/). HTML panels take priority on slug collision. */
export function listPanels(cwd?: string): PanelInfo[] {
  ensureGlobalDir();
  const bySlug = new Map<string, PanelInfo>();
  // Markdown skills from ~/.claude/skills/ (lowest priority)
  for (const panel of scanMarkdownPanelsDir(CLAUDE_SKILLS_DIR)) {
    bySlug.set(panel.slug, panel);
  }
  // HTML panels from ~/.companion/panels/ (higher priority)
  for (const panel of scanPanelsDir(GLOBAL_PANELS_DIR)) {
    bySlug.set(panel.slug, panel);
  }
  // Project-local panels (highest priority)
  if (cwd) {
    for (const panel of scanPanelsDir(projectPanelsDir(cwd))) {
      bySlug.set(panel.slug, panel);
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getPanel(slug: string, cwd?: string): PanelInfo | null {
  const dir = resolvePanelDir(slug, cwd);
  if (!dir) return null;
  try {
    const raw = JSON.parse(readFileSync(join(dir, "panel.json"), "utf-8"));
    return {
      slug,
      name: raw.name || slug,
      description: raw.description || "",
      icon: raw.icon || "terminal",
      refreshInterval: typeof raw.refreshInterval === "number" ? raw.refreshInterval : null,
      type: "html",
    };
  } catch {
    return null;
  }
}

export function getPanelHtml(slug: string, cwd?: string): string | null {
  const dir = resolvePanelDir(slug, cwd);
  if (!dir) return null;
  const panelPath = join(dir, "panel.html");
  try {
    return readFileSync(panelPath, "utf-8");
  } catch {
    return null;
  }
}

export function getPanelState(slug: string, cwd?: string): Record<string, unknown> {
  const dir = resolvePanelDir(slug, cwd);
  if (!dir) return {};
  try {
    return JSON.parse(readFileSync(join(dir, "state.json"), "utf-8"));
  } catch {
    return {};
  }
}

export function setPanelState(slug: string, state: Record<string, unknown>, cwd?: string): void {
  const dir = resolvePanelDir(slug, cwd);
  if (!dir) return;
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

// ─── Slash Commands (.claude/commands) ──────────────────────────────────────

/** List slash command names from markdown files under `<cwd>/.claude/commands`. */
export function listProjectSlashCommands(cwd?: string): string[] {
  if (!cwd) return [];
  const root = commandsDir(cwd);
  if (!existsSync(root)) return [];

  const found = new Set<string>();
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      const relPath = full.slice(root.length + 1).split(sep).join("/");
      const command = relPath.replace(/\.md$/i, "");
      if (isValidCommandName(command)) found.add(command);
    }
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

/** Load raw markdown template for a slash command from `<cwd>/.claude/commands`. */
export function getProjectSlashCommandTemplate(cwd: string | undefined, command: string): string | null {
  if (!cwd || !isValidCommandName(command)) return null;
  const root = resolve(commandsDir(cwd));
  const filePath = resolve(root, `${command}.md`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;

  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    // Fall back to auto-generated template for root scripts
    return getRootScriptTemplate(cwd, command);
  }
}

// ─── Project Script Discovery ───────────────────────────────────────────────

const SCRIPT_EXTENSIONS = [".sh"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".claude", "vendor", ".venv", "__pycache__"]);

/** Recursively find all .sh scripts in the project, returning {name, relativePath} pairs. */
function findProjectScripts(cwd: string): { name: string; relPath: string }[] {
  const results: { name: string; relPath: string }[] = [];
  const seen = new Set<string>();
  const stack = [cwd];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          stack.push(join(dir, entry.name));
        }
        continue;
      }
      if (!entry.isFile() || !SCRIPT_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
      const name = entry.name.replace(/\.[^.]+$/, "");
      if (!isValidCommandName(name) || seen.has(name)) continue;
      seen.add(name);
      const full = join(dir, entry.name);
      results.push({ name, relPath: full.slice(cwd.length + 1) });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** List executable scripts anywhere in the project as slash command names. */
export function listProjectRootScripts(cwd?: string): string[] {
  if (!cwd) return [];
  return findProjectScripts(cwd).map((s) => s.name);
}

/** Generate a synthetic template for a project script (used when no .md command file exists). */
export function getRootScriptTemplate(cwd: string, command: string): string | null {
  const scripts = findProjectScripts(cwd);
  const match = scripts.find((s) => s.name === command);
  if (match) {
    return `Run the script: \`bash ./${match.relPath} $ARGUMENTS\`\nReport the output to the user.`;
  }
  return null;
}

// ─── Vibe API Injection ─────────────────────────────────────────────────────

export function wrapWithVibeApi(html: string, slug: string): string {
  const apiScript = `<script>
(function() {
  var PANEL_SLUG = ${JSON.stringify(slug)};

  async function vibeExec(command, options) {
    var res = await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: command, cwd: options && options.cwd })
    });
    var r = await res.json();
    return { success: r.ok, output: r.stdout || '', error: r.stderr || '', exitCode: r.exitCode };
  }

  window.vibe = {
    command: vibeExec,
    store: {
      async get(key) {
        var res = await fetch('/api/panels/' + encodeURIComponent(PANEL_SLUG) + '/state');
        var state = await res.json();
        return key !== undefined ? state[key] : state;
      },
      async set(key, value) {
        var current = await this.get();
        current[key] = value;
        await fetch('/api/panels/' + encodeURIComponent(PANEL_SLUG) + '/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(current)
        });
      }
    },
    notify: function(title, body) {
      window.parent.postMessage({ type: 'vibe:notify', title: title, body: body }, '*');
    },
    playSound: function(sound) {
      return vibeExec('afplay /System/Library/Sounds/' + (sound || 'Ping') + '.aiff');
    }
  };
  window.vibeCommand = vibeExec;
})();
</script>`;

  if (html.includes("</head>")) return html.replace("</head>", apiScript + "\n</head>");
  if (html.includes("<head>")) return html.replace("<head>", "<head>\n" + apiScript);
  return apiScript + "\n" + html;
}
