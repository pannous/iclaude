import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillInfo {
  slug: string;
  name: string;
  description: string;
  icon: string;
  refreshInterval: number | null;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const SKILLS_DIR = join(homedir(), ".companion", "skills");

function ensureDir(): void {
  mkdirSync(SKILLS_DIR, { recursive: true });
}

function skillDir(slug: string): string {
  return join(SKILLS_DIR, slug);
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug);
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export function listSkills(): SkillInfo[] {
  ensureDir();
  try {
    const entries = readdirSync(SKILLS_DIR);
    const skills: SkillInfo[] = [];
    for (const entry of entries) {
      const dir = join(SKILLS_DIR, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
        const manifestPath = join(dir, "skill.json");
        if (!existsSync(manifestPath)) continue;
        const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
        skills.push({
          slug: entry,
          name: raw.name || entry,
          description: raw.description || "",
          icon: raw.icon || "terminal",
          refreshInterval: typeof raw.refreshInterval === "number" ? raw.refreshInterval : null,
        });
      } catch {
        // Skip malformed skills
      }
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    return skills;
  } catch {
    return [];
  }
}

export function getSkill(slug: string): SkillInfo | null {
  if (!isValidSlug(slug)) return null;
  const manifestPath = join(skillDir(slug), "skill.json");
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

export function getSkillPanel(slug: string): string | null {
  if (!isValidSlug(slug)) return null;
  const panelPath = join(skillDir(slug), "panel.html");
  try {
    return readFileSync(panelPath, "utf-8");
  } catch {
    return null;
  }
}

export function getSkillState(slug: string): Record<string, unknown> {
  if (!isValidSlug(slug)) return {};
  const statePath = join(skillDir(slug), "state.json");
  try {
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return {};
  }
}

export function setSkillState(slug: string, state: Record<string, unknown>): void {
  if (!isValidSlug(slug)) return;
  const dir = skillDir(slug);
  if (!existsSync(dir)) return;
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

// ─── Vibe API Injection ─────────────────────────────────────────────────────

export function wrapWithVibeApi(html: string, slug: string): string {
  const apiScript = `<script>
(function() {
  var SKILL_SLUG = ${JSON.stringify(slug)};

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
        var res = await fetch('/api/skills/' + encodeURIComponent(SKILL_SLUG) + '/state');
        var state = await res.json();
        return key !== undefined ? state[key] : state;
      },
      async set(key, value) {
        var current = await this.get();
        current[key] = value;
        await fetch('/api/skills/' + encodeURIComponent(SKILL_SLUG) + '/state', {
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
