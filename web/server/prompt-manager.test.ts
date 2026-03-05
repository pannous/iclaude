import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let globalTempDir: string;
let projectTempDir: string;
let promptManager: typeof import("./prompt-manager.js");

const mockHomedir = vi.hoisted(() => {
  let dir = "";
  return {
    get: () => dir,
    set: (d: string) => { dir = d; },
  };
});

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => mockHomedir.get() };
});

beforeEach(async () => {
  globalTempDir = mkdtempSync(join(tmpdir(), "prompt-global-"));
  projectTempDir = mkdtempSync(join(tmpdir(), "prompt-project-"));
  mockHomedir.set(globalTempDir);
  vi.resetModules();
  promptManager = await import("./prompt-manager.js");
});

afterEach(() => {
  rmSync(globalTempDir, { recursive: true, force: true });
  rmSync(projectTempDir, { recursive: true, force: true });
});

describe("createPrompt", () => {
  it("creates a global prompt as a .md file in ~/.claude/prompts/", () => {
    // Validates global prompts are written to the user-level prompts directory.
    const prompt = promptManager.createPrompt("Review PR", "Review this PR and summarize risks", "global");
    expect(prompt.scope).toBe("global");
    expect(prompt.id).toBe("Review PR");
    expect(prompt.content).toBe("Review this PR and summarize risks");
    expect(prompt.projectPath).toBeUndefined();
    expect(prompt.projectPaths).toBeUndefined();
  });

  it("creates a project prompt as a .md file in {cwd}/.claude/commands/", () => {
    // Validates project prompts are written into the project's .claude/commands/ directory.
    const prompt = promptManager.createPrompt("Plan", "Plan this feature", "project", projectTempDir);
    expect(prompt.scope).toBe("project");
    expect(prompt.id).toBe("Plan");
    expect(prompt.projectPath).toBe(projectTempDir);
    expect(prompt.projectPaths).toEqual([projectTempDir]);
  });

  it("creates a project prompt with projectPaths parameter (uses cwd for storage)", () => {
    // Validates that projectPaths param is accepted but cwd is used for actual file storage.
    const prompt = promptManager.createPrompt(
      "Multi",
      "Multi-project prompt",
      "project",
      projectTempDir,
      ["/tmp/repo-a/", "/tmp/repo-b"],
    );
    expect(prompt.scope).toBe("project");
    // File is stored in cwd, projectPath reflects actual storage location
    expect(prompt.projectPath).toBe(projectTempDir);
  });

  it("overwrites an existing file (upsert behaviour)", () => {
    // Validates that creating a prompt with the same name replaces the existing file.
    promptManager.createPrompt("Plan", "Original", "project", projectTempDir);
    const updated = promptManager.createPrompt("Plan", "Updated", "project", projectTempDir);
    expect(updated.content).toBe("Updated");
  });

  it("rejects project prompts without a cwd", () => {
    expect(() => promptManager.createPrompt("Plan", "x", "project")).toThrow(
      "Project path is required for project prompts",
    );
  });

  it("rejects project prompts with empty projectPaths array", () => {
    // An empty array is not valid for project scope when no cwd provided.
    expect(() => promptManager.createPrompt("Plan", "x", "project", undefined, [])).toThrow(
      "Project path is required for project prompts",
    );
  });
});

describe("listPrompts", () => {
  it("returns global prompts only when scope=global", () => {
    // Validates scope filtering returns only global prompts.
    promptManager.createPrompt("Global", "Global text", "global");
    promptManager.createPrompt("Project", "Project text", "project", projectTempDir);

    const prompts = promptManager.listPrompts({ scope: "global" });
    expect(prompts.map((p) => p.name)).toContain("Global");
    expect(prompts.map((p) => p.name)).not.toContain("Project");
  });

  it("returns project prompts for the given cwd", () => {
    // Validates cwd filtering returns project prompts scoped to that directory.
    promptManager.createPrompt("Global", "Global text", "global");
    promptManager.createPrompt("Project", "Project text", "project", projectTempDir);

    const prompts = promptManager.listPrompts({ cwd: projectTempDir, scope: "all" });
    expect(prompts.map((p) => p.name)).toContain("Global");
    expect(prompts.map((p) => p.name)).toContain("Project");
  });

  it("returns empty array for missing directories", () => {
    // Validates graceful handling of non-existent prompt directories.
    const prompts = promptManager.listPrompts({ cwd: projectTempDir });
    expect(prompts).toEqual([]);
  });
});

describe("getPrompt", () => {
  it("retrieves a global prompt by name", () => {
    // Validates reading a specific global prompt file.
    promptManager.createPrompt("Review PR", "Review content", "global");
    const prompt = promptManager.getPrompt("Review PR", "global");
    expect(prompt).not.toBeNull();
    expect(prompt!.content).toBe("Review content");
  });

  it("returns null for a non-existent prompt", () => {
    expect(promptManager.getPrompt("nonexistent", "global")).toBeNull();
  });
});

describe("updatePrompt", () => {
  it("updates content of an existing prompt file", () => {
    // Ensures content update overwrites the file while preserving name and scope.
    promptManager.createPrompt("Plan", "Old content", "project", projectTempDir);
    const updated = promptManager.updatePrompt("Plan", "New content", "project", projectTempDir);
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe("New content");
    expect(updated!.scope).toBe("project");
  });

  it("returns null when prompt file does not exist", () => {
    // Validates that updating a non-existent prompt returns null rather than creating a file.
    const result = promptManager.updatePrompt("nonexistent", "content", "global");
    expect(result).toBeNull();
  });
});

describe("deletePrompt", () => {
  it("deletes a project prompt file", () => {
    // Ensures a deleted prompt is no longer retrievable.
    promptManager.createPrompt("Delete me", "tmp", "project", projectTempDir);
    expect(promptManager.deletePrompt("Delete me", "project", projectTempDir)).toBe(true);
    expect(promptManager.getPrompt("Delete me", "project", projectTempDir)).toBeNull();
  });

  it("returns false for a non-existent prompt", () => {
    expect(promptManager.deletePrompt("nonexistent", "global")).toBe(false);
  });
});
