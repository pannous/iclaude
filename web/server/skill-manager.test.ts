import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let skillManager: typeof import("./skill-manager.js");

const mockHomedir = vi.hoisted(() => {
  let dir = "";
  return {
    get: () => dir,
    set: (d: string) => { dir = d; },
  };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => mockHomedir.get(),
  };
});

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "skill-test-"));
  mockHomedir.set(tempDir);
  vi.resetModules();
  skillManager = await import("./skill-manager.js");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function skillsDir(): string {
  return join(tempDir, ".companion", "skills");
}

function createSkillOnDisk(slug: string, manifest: object, panelHtml?: string): void {
  const dir = join(skillsDir(), slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "skill.json"), JSON.stringify(manifest), "utf-8");
  if (panelHtml !== undefined) {
    writeFileSync(join(dir, "panel.html"), panelHtml, "utf-8");
  }
}

function commandsDir(): string {
  return join(tempDir, "project", ".claude", "commands");
}

function createCommandOnDisk(name: string, markdown: string): void {
  const filePath = join(commandsDir(), `${name}.md`);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, markdown, "utf-8");
}

// ===========================================================================
// listSkills
// ===========================================================================
describe("listSkills", () => {
  it("returns empty array when no skills exist", () => {
    expect(skillManager.listSkills()).toEqual([]);
  });

  it("discovers skills from directories with skill.json", () => {
    createSkillOnDisk("htop", { name: "Process Monitor", description: "View processes" });
    createSkillOnDisk("docker", { name: "Docker", description: "Manage containers" });

    const result = skillManager.listSkills();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.name)).toEqual(["Docker", "Process Monitor"]);
  });

  it("skips directories without skill.json", () => {
    mkdirSync(join(skillsDir(), "empty-dir"), { recursive: true });
    createSkillOnDisk("valid", { name: "Valid" });

    const result = skillManager.listSkills();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("valid");
  });

  it("skips directories with malformed skill.json", () => {
    const dir = join(skillsDir(), "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "skill.json"), "NOT JSON{{{", "utf-8");
    createSkillOnDisk("good", { name: "Good" });

    const result = skillManager.listSkills();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("good");
  });

  it("uses slug as fallback name when name is missing", () => {
    createSkillOnDisk("my-skill", { description: "No name field" });

    const result = skillManager.listSkills();
    expect(result[0].name).toBe("my-skill");
  });

  it("defaults icon to terminal and refreshInterval to null", () => {
    createSkillOnDisk("basic", { name: "Basic" });

    const result = skillManager.listSkills();
    expect(result[0].icon).toBe("terminal");
    expect(result[0].refreshInterval).toBeNull();
  });

  it("reads refreshInterval from manifest", () => {
    createSkillOnDisk("polling", { name: "Poller", refreshInterval: 2000 });

    const result = skillManager.listSkills();
    expect(result[0].refreshInterval).toBe(2000);
  });
});

// ===========================================================================
// getSkill
// ===========================================================================
describe("getSkill", () => {
  it("returns skill info for existing skill", () => {
    createSkillOnDisk("htop", { name: "Process Monitor", description: "View procs", icon: "cpu" });

    const skill = skillManager.getSkill("htop");
    expect(skill).not.toBeNull();
    expect(skill!.slug).toBe("htop");
    expect(skill!.name).toBe("Process Monitor");
    expect(skill!.icon).toBe("cpu");
  });

  it("returns null for non-existent skill", () => {
    expect(skillManager.getSkill("nope")).toBeNull();
  });

  it("returns null for invalid slug (path traversal)", () => {
    expect(skillManager.getSkill("../etc")).toBeNull();
    expect(skillManager.getSkill("foo/bar")).toBeNull();
  });
});

// ===========================================================================
// getSkillPanel
// ===========================================================================
describe("getSkillPanel", () => {
  it("returns panel HTML content", () => {
    const html = "<html><body>Hello</body></html>";
    createSkillOnDisk("test", { name: "Test" }, html);

    expect(skillManager.getSkillPanel("test")).toBe(html);
  });

  it("returns null when panel.html is missing", () => {
    createSkillOnDisk("no-panel", { name: "No Panel" });

    expect(skillManager.getSkillPanel("no-panel")).toBeNull();
  });

  it("returns null for invalid slug", () => {
    expect(skillManager.getSkillPanel("../../bad")).toBeNull();
  });
});

// ===========================================================================
// getSkillState / setSkillState
// ===========================================================================
describe("skill state persistence", () => {
  it("returns empty object when no state exists", () => {
    createSkillOnDisk("fresh", { name: "Fresh" });
    expect(skillManager.getSkillState("fresh")).toEqual({});
  });

  it("round-trips state through set/get", () => {
    createSkillOnDisk("stateful", { name: "Stateful" });

    skillManager.setSkillState("stateful", { sortBy: "cpu", ascending: false });
    const state = skillManager.getSkillState("stateful");
    expect(state).toEqual({ sortBy: "cpu", ascending: false });
  });

  it("overwrites previous state", () => {
    createSkillOnDisk("overwrite", { name: "Overwrite" });

    skillManager.setSkillState("overwrite", { a: 1 });
    skillManager.setSkillState("overwrite", { b: 2 });
    expect(skillManager.getSkillState("overwrite")).toEqual({ b: 2 });
  });

  it("ignores setSkillState for non-existent skill", () => {
    skillManager.setSkillState("ghost", { x: 1 });
    expect(skillManager.getSkillState("ghost")).toEqual({});
  });

  it("ignores invalid slug for state operations", () => {
    skillManager.setSkillState("../bad", { x: 1 });
    expect(skillManager.getSkillState("../bad")).toEqual({});
  });
});

// ===========================================================================
// slash commands (.claude/commands)
// ===========================================================================
describe("slash command discovery", () => {
  it("lists .md commands from project .claude/commands", () => {
    createCommandOnDisk("catch-time", "# Catch time");
    createCommandOnDisk("dev/review", "# Review");
    createCommandOnDisk("ignore", "not markdown");
    writeFileSync(join(commandsDir(), "plain.txt"), "nope", "utf-8");

    const result = skillManager.listProjectSlashCommands(join(tempDir, "project"));
    expect(result).toEqual(["catch-time", "dev/review", "ignore"]);
  });

  it("returns [] when project has no command directory", () => {
    const result = skillManager.listProjectSlashCommands(join(tempDir, "missing"));
    expect(result).toEqual([]);
  });

  it("loads command markdown template by name", () => {
    createCommandOnDisk("catch-time", "---\nname: catch-time\n---\nRun `date`");
    const result = skillManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "catch-time");
    expect(result).toContain("name: catch-time");
    expect(result).toContain("Run `date`");
  });

  it("returns null for invalid command names", () => {
    createCommandOnDisk("safe", "ok");
    expect(skillManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "../safe")).toBeNull();
    expect(skillManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "safe/../x")).toBeNull();
  });
});

// ===========================================================================
// wrapWithVibeApi
// ===========================================================================
describe("wrapWithVibeApi", () => {
  it("injects script before </head>", () => {
    const html = "<html><head><title>Test</title></head><body></body></html>";
    const result = skillManager.wrapWithVibeApi(html, "test-skill");

    expect(result).toContain("window.vibe");
    expect(result).toContain("window.vibeCommand");
    expect(result).toContain('"test-skill"');
    expect(result.indexOf("window.vibe")).toBeLessThan(result.indexOf("</head>"));
  });

  it("injects after <head> when no </head> but <head> present", () => {
    const html = "<head><body>Content</body>";
    const result = skillManager.wrapWithVibeApi(html, "s");
    expect(result).toContain("window.vibe");
    expect(result.indexOf("window.vibe")).toBeGreaterThan(result.indexOf("<head>"));
  });

  it("prepends script when no head tags at all", () => {
    const html = "<div>Simple content</div>";
    const result = skillManager.wrapWithVibeApi(html, "s");
    expect(result).toContain("window.vibe");
    expect(result.indexOf("window.vibe")).toBeLessThan(result.indexOf("<div>"));
  });

  it("includes skill slug in the injected script", () => {
    const result = skillManager.wrapWithVibeApi("<html></html>", "my-htop");
    expect(result).toContain('"my-htop"');
  });

  it("includes vibe API surface: command, store, notify, playSound", () => {
    const result = skillManager.wrapWithVibeApi("<html><head></head></html>", "x");
    expect(result).toContain("window.vibe");
    expect(result).toContain("vibeExec");
    expect(result).toContain("store:");
    expect(result).toContain("notify:");
    expect(result).toContain("playSound:");
  });
});
