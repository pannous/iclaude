import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let panelManager: typeof import("./panel-manager.js");

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
  panelManager = await import("./panel-manager.js");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function globalPanelsDir(): string {
  return join(tempDir, ".companion", "panels");
}

function projectDir(): string {
  return join(tempDir, "project");
}

function projectPanelsDir(): string {
  return join(projectDir(), "panels");
}

function createPanelInDir(baseDir: string, slug: string, manifest: object, panelHtml?: string): void {
  const dir = join(baseDir, slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "panel.json"), JSON.stringify(manifest), "utf-8");
  if (panelHtml !== undefined) {
    writeFileSync(join(dir, "panel.html"), panelHtml, "utf-8");
  }
}

function createPanelOnDisk(slug: string, manifest: object, panelHtml?: string): void {
  createPanelInDir(globalPanelsDir(), slug, manifest, panelHtml);
}

function createProjectPanel(slug: string, manifest: object, panelHtml?: string): void {
  createPanelInDir(projectPanelsDir(), slug, manifest, panelHtml);
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
// listPanels
// ===========================================================================
describe("listPanels", () => {
  it("returns empty array when no panels exist", () => {
    expect(panelManager.listPanels()).toEqual([]);
  });

  it("discovers panels from directories with panel.json", () => {
    createPanelOnDisk("htop", { name: "Process Monitor", description: "View processes" });
    createPanelOnDisk("docker", { name: "Docker", description: "Manage containers" });

    const result = panelManager.listPanels();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.name)).toEqual(["Docker", "Process Monitor"]);
  });

  it("skips directories without panel.json", () => {
    mkdirSync(join(globalPanelsDir(), "empty-dir"), { recursive: true });
    createPanelOnDisk("valid", { name: "Valid" });

    const result = panelManager.listPanels();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("valid");
  });

  it("skips directories with malformed panel.json", () => {
    const dir = join(globalPanelsDir(), "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "panel.json"), "NOT JSON{{{", "utf-8");
    createPanelOnDisk("good", { name: "Good" });

    const result = panelManager.listPanels();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("good");
  });

  it("uses slug as fallback name when name is missing", () => {
    createPanelOnDisk("my-skill", { description: "No name field" });

    const result = panelManager.listPanels();
    expect(result[0].name).toBe("my-skill");
  });

  it("defaults icon to terminal and refreshInterval to null", () => {
    createPanelOnDisk("basic", { name: "Basic" });

    const result = panelManager.listPanels();
    expect(result[0].icon).toBe("terminal");
    expect(result[0].refreshInterval).toBeNull();
  });

  it("reads refreshInterval from manifest", () => {
    createPanelOnDisk("polling", { name: "Poller", refreshInterval: 2000 });

    const result = panelManager.listPanels();
    expect(result[0].refreshInterval).toBe(2000);
  });
});

// ===========================================================================
// getPanel
// ===========================================================================
describe("getPanel", () => {
  it("returns panel info for existing panel", () => {
    createPanelOnDisk("htop", { name: "Process Monitor", description: "View procs", icon: "cpu" });

    const panel = panelManager.getPanel("htop");
    expect(panel).not.toBeNull();
    expect(panel!.slug).toBe("htop");
    expect(panel!.name).toBe("Process Monitor");
    expect(panel!.icon).toBe("cpu");
  });

  it("returns null for non-existent panel", () => {
    expect(panelManager.getPanel("nope")).toBeNull();
  });

  it("returns null for invalid slug (path traversal)", () => {
    expect(panelManager.getPanel("../etc")).toBeNull();
    expect(panelManager.getPanel("foo/bar")).toBeNull();
  });
});

// ===========================================================================
// getPanelHtml
// ===========================================================================
describe("getPanelHtml", () => {
  it("returns panel HTML content", () => {
    const html = "<html><body>Hello</body></html>";
    createPanelOnDisk("test", { name: "Test" }, html);

    expect(panelManager.getPanelHtml("test")).toBe(html);
  });

  it("returns null when panel.html is missing", () => {
    createPanelOnDisk("no-panel", { name: "No Panel" });

    expect(panelManager.getPanelHtml("no-panel")).toBeNull();
  });

  it("returns null for invalid slug", () => {
    expect(panelManager.getPanelHtml("../../bad")).toBeNull();
  });
});

// ===========================================================================
// getPanelState / setPanelState
// ===========================================================================
describe("panel state persistence", () => {
  it("returns empty object when no state exists", () => {
    createPanelOnDisk("fresh", { name: "Fresh" });
    expect(panelManager.getPanelState("fresh")).toEqual({});
  });

  it("round-trips state through set/get", () => {
    createPanelOnDisk("stateful", { name: "Stateful" });

    panelManager.setPanelState("stateful", { sortBy: "cpu", ascending: false });
    const state = panelManager.getPanelState("stateful");
    expect(state).toEqual({ sortBy: "cpu", ascending: false });
  });

  it("overwrites previous state", () => {
    createPanelOnDisk("overwrite", { name: "Overwrite" });

    panelManager.setPanelState("overwrite", { a: 1 });
    panelManager.setPanelState("overwrite", { b: 2 });
    expect(panelManager.getPanelState("overwrite")).toEqual({ b: 2 });
  });

  it("ignores setPanelState for non-existent panel", () => {
    panelManager.setPanelState("ghost", { x: 1 });
    expect(panelManager.getPanelState("ghost")).toEqual({});
  });

  it("ignores invalid slug for state operations", () => {
    panelManager.setPanelState("../bad", { x: 1 });
    expect(panelManager.getPanelState("../bad")).toEqual({});
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

    const result = panelManager.listProjectSlashCommands(join(tempDir, "project"));
    expect(result).toEqual(["catch-time", "dev/review", "ignore"]);
  });

  it("returns [] when project has no command directory", () => {
    const result = panelManager.listProjectSlashCommands(join(tempDir, "missing"));
    expect(result).toEqual([]);
  });

  it("loads command markdown template by name", () => {
    createCommandOnDisk("catch-time", "---\nname: catch-time\n---\nRun `date`");
    const result = panelManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "catch-time");
    expect(result).toContain("name: catch-time");
    expect(result).toContain("Run `date`");
  });

  it("returns null for invalid command names", () => {
    createCommandOnDisk("safe", "ok");
    expect(panelManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "../safe")).toBeNull();
    expect(panelManager.getProjectSlashCommandTemplate(join(tempDir, "project"), "safe/../x")).toBeNull();
  });
});

// ===========================================================================
// root script discovery (listProjectRootScripts)
// ===========================================================================
describe("root script discovery", () => {
  function createScript(name: string): void {
    const projDir = projectDir();
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, name), "#!/bin/bash\necho hello", "utf-8");
  }

  it("discovers .sh files at project root", () => {
    createScript("install.sh");
    createScript("test.sh");
    createScript("start.sh");

    const result = panelManager.listProjectRootScripts(projectDir());
    expect(result).toEqual(["install", "start", "test"]);
  });

  it("ignores non-.sh files", () => {
    createScript("deploy.sh");
    const projDir = projectDir();
    writeFileSync(join(projDir, "README.md"), "# hi", "utf-8");
    writeFileSync(join(projDir, "app.ts"), "console.log(1)", "utf-8");

    const result = panelManager.listProjectRootScripts(projectDir());
    expect(result).toEqual(["deploy"]);
  });

  it("recurses into subdirectories", () => {
    createScript("root.sh");
    const subDir = join(projectDir(), "scripts");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, "nested.sh"), "#!/bin/bash", "utf-8");

    const result = panelManager.listProjectRootScripts(projectDir());
    expect(result).toEqual(["nested", "root"]);
  });

  it("skips node_modules and dot-directories", () => {
    createScript("good.sh");
    for (const skip of ["node_modules", ".git", ".hidden"]) {
      const dir = join(projectDir(), skip);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "bad.sh"), "#!/bin/bash", "utf-8");
    }

    const result = panelManager.listProjectRootScripts(projectDir());
    expect(result).toEqual(["good"]);
  });

  it("deduplicates scripts with same name in different directories", () => {
    createScript("deploy.sh");
    const subDir = join(projectDir(), "scripts");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, "deploy.sh"), "#!/bin/bash", "utf-8");

    const result = panelManager.listProjectRootScripts(projectDir());
    expect(result).toEqual(["deploy"]);
  });

  it("returns [] for missing directory", () => {
    expect(panelManager.listProjectRootScripts("/nonexistent/path")).toEqual([]);
  });

  it("returns [] when cwd is undefined", () => {
    expect(panelManager.listProjectRootScripts(undefined)).toEqual([]);
  });
});

// ===========================================================================
// root script template fallback
// ===========================================================================
describe("root script template fallback", () => {
  function createScript(name: string): void {
    const projDir = projectDir();
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, name), "#!/bin/bash\necho hello", "utf-8");
  }

  it("getProjectSlashCommandTemplate falls back to root script when no .md exists", () => {
    createScript("install.sh");

    const template = panelManager.getProjectSlashCommandTemplate(projectDir(), "install");
    expect(template).toContain("install.sh");
    expect(template).toContain("$ARGUMENTS");
  });

  it("prefers .md command file over root script", () => {
    createScript("test.sh");
    createCommandOnDisk("test", "---\nname: test\n---\nCustom test command");

    const template = panelManager.getProjectSlashCommandTemplate(projectDir(), "test");
    expect(template).toContain("Custom test command");
    expect(template).not.toContain("test.sh");
  });

  it("returns null when neither .md nor script exists", () => {
    mkdirSync(projectDir(), { recursive: true });
    const template = panelManager.getProjectSlashCommandTemplate(projectDir(), "nonexistent");
    expect(template).toBeNull();
  });

  it("generates correct relative path for scripts in subdirectories", () => {
    const subDir = join(projectDir(), "scripts");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, "tunnel.sh"), "#!/bin/bash\necho tunnel", "utf-8");

    const template = panelManager.getProjectSlashCommandTemplate(projectDir(), "tunnel");
    expect(template).toContain("scripts/tunnel.sh");
    expect(template).toContain("$ARGUMENTS");
  });
});

// ===========================================================================
// wrapWithVibeApi
// ===========================================================================
describe("wrapWithVibeApi", () => {
  it("injects script before </head>", () => {
    const html = "<html><head><title>Test</title></head><body></body></html>";
    const result = panelManager.wrapWithVibeApi(html, "test-skill");

    expect(result).toContain("window.vibe");
    expect(result).toContain("window.vibeCommand");
    expect(result).toContain('"test-skill"');
    expect(result.indexOf("window.vibe")).toBeLessThan(result.indexOf("</head>"));
  });

  it("injects after <head> when no </head> but <head> present", () => {
    const html = "<head><body>Content</body>";
    const result = panelManager.wrapWithVibeApi(html, "s");
    expect(result).toContain("window.vibe");
    expect(result.indexOf("window.vibe")).toBeGreaterThan(result.indexOf("<head>"));
  });

  it("prepends script when no head tags at all", () => {
    const html = "<div>Simple content</div>";
    const result = panelManager.wrapWithVibeApi(html, "s");
    expect(result).toContain("window.vibe");
    expect(result.indexOf("window.vibe")).toBeLessThan(result.indexOf("<div>"));
  });

  it("includes skill slug in the injected script", () => {
    const result = panelManager.wrapWithVibeApi("<html></html>", "my-htop");
    expect(result).toContain('"my-htop"');
  });

  it("includes vibe API surface: command, store, notify, playSound", () => {
    const result = panelManager.wrapWithVibeApi("<html><head></head></html>", "x");
    expect(result).toContain("window.vibe");
    expect(result).toContain("vibeExec");
    expect(result).toContain("store:");
    expect(result).toContain("notify:");
    expect(result).toContain("playSound:");
  });
});
