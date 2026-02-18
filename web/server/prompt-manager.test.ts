import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let promptManager: typeof import("./prompt-manager.js");

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "prompt-test-"));
  vi.resetModules();
  promptManager = await import("./prompt-manager.js");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("createPrompt", () => {
  it("creates a prompt as a .md file in {cwd}/prompts/", () => {
    // Validates that createPrompt persists to disk and returns correct shape.
    const prompt = promptManager.createPrompt(tempDir, "Review PR", "Review this PR");
    expect(prompt).toEqual({ name: "review-pr", content: "Review this PR" });

    const all = promptManager.listPrompts(tempDir);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("review-pr");
  });

  it("slugifies the name to a filesystem-safe format", () => {
    // Validates title → slug conversion: lowercase, hyphens, no special chars.
    const prompt = promptManager.createPrompt(tempDir, "My Cool Prompt!", "content");
    expect(prompt.name).toBe("my-cool-prompt");
  });

  it("trims whitespace from content", () => {
    const prompt = promptManager.createPrompt(tempDir, "plan", "  Plan feature  ");
    expect(prompt.content).toBe("Plan feature");
  });

  it("rejects empty name", () => {
    expect(() => promptManager.createPrompt(tempDir, "", "content")).toThrow("Prompt name is required");
  });

  it("rejects empty content", () => {
    expect(() => promptManager.createPrompt(tempDir, "Name", "")).toThrow("Prompt content is required");
  });

  it("rejects names that slugify to empty string", () => {
    expect(() => promptManager.createPrompt(tempDir, "!!!", "content")).toThrow("alphanumeric");
  });
});

describe("listPrompts", () => {
  it("returns empty array when prompts dir does not exist", () => {
    expect(promptManager.listPrompts(tempDir)).toEqual([]);
  });

  it("returns all prompts sorted by name", () => {
    promptManager.createPrompt(tempDir, "Zulu", "Last");
    promptManager.createPrompt(tempDir, "Alpha", "First");
    const all = promptManager.listPrompts(tempDir);
    expect(all.map((p) => p.name)).toEqual(["alpha", "zulu"]);
  });
});

describe("deletePrompt", () => {
  it("deletes an existing prompt and returns true", () => {
    promptManager.createPrompt(tempDir, "to-delete", "temporary");
    expect(promptManager.deletePrompt(tempDir, "to-delete")).toBe(true);
    expect(promptManager.listPrompts(tempDir)).toHaveLength(0);
  });

  it("returns false for non-existent prompt", () => {
    expect(promptManager.deletePrompt(tempDir, "nope")).toBe(false);
  });
});
