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
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const PANELS_DIR = join(homedir(), ".companion", "panels");

function ensureDir(): void {
  mkdirSync(PANELS_DIR, { recursive: true });
}

function panelDir(slug: string): string {
  return join(PANELS_DIR, slug);
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

export function listPanels(): PanelInfo[] {
  ensureDir();
  try {
    const entries = readdirSync(PANELS_DIR);
    const panels: PanelInfo[] = [];
    for (const entry of entries) {
      const dir = join(PANELS_DIR, entry);
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
        });
      } catch {
        // Skip malformed panels
      }
    }
    panels.sort((a, b) => a.name.localeCompare(b.name));
    return panels;
  } catch {
    return [];
  }
}

export function getPanel(slug: string): PanelInfo | null {
  if (!isValidSlug(slug)) return null;
  const manifestPath = join(panelDir(slug), "panel.json");
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
    return {
      slug,
      name: raw.name || slug,
      description: raw.description || "",
      icon: raw.icon || "terminal",
      refreshInterval: typeof raw.refreshInterval === "number" ? raw.refreshInterval : null,
    };
  } catch {
    return null;
  }
}

export function getPanelHtml(slug: string): string | null {
  if (!isValidSlug(slug)) return null;
  const panelPath = join(panelDir(slug), "panel.html");
  try {
    return readFileSync(panelPath, "utf-8");
  } catch {
    return null;
  }
}

export function getPanelState(slug: string): Record<string, unknown> {
  if (!isValidSlug(slug)) return {};
  const statePath = join(panelDir(slug), "state.json");
  try {
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return {};
  }
}

export function setPanelState(slug: string, state: Record<string, unknown>): void {
  if (!isValidSlug(slug)) return;
  const dir = panelDir(slug);
  if (!existsSync(dir)) return;
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
    return null;
  }
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
    return res.json();
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
