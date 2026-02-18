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
    const prompt = promptManager.createPrompt(tempDir, "Review", "Review this PR");
    expect(prompt).toEqual({ name: "Review", content: "Review this PR" });

    // Verify it's on disk by listing
    const all = promptManager.listPrompts(tempDir);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Review");
  });

  it("trims whitespace from name and content", () => {
    const prompt = promptManager.createPrompt(tempDir, "  Plan  ", "  Plan feature  ");
    expect(prompt.name).toBe("Plan");
    expect(prompt.content).toBe("Plan feature");
  });

  it("rejects empty name", () => {
    expect(() => promptManager.createPrompt(tempDir, "", "content")).toThrow("Prompt name is required");
  });

  it("rejects empty content", () => {
    expect(() => promptManager.createPrompt(tempDir, "Name", "")).toThrow("Prompt content is required");
  });

  it("rejects names with path separators", () => {
    expect(() => promptManager.createPrompt(tempDir, "a/b", "content")).toThrow("path separators");
    expect(() => promptManager.createPrompt(tempDir, "a\\b", "content")).toThrow("path separators");
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
    expect(all.map((p) => p.name)).toEqual(["Alpha", "Zulu"]);
  });
});

describe("deletePrompt", () => {
  it("deletes an existing prompt and returns true", () => {
    promptManager.createPrompt(tempDir, "ToDelete", "temporary");
    expect(promptManager.deletePrompt(tempDir, "ToDelete")).toBe(true);
    expect(promptManager.listPrompts(tempDir)).toHaveLength(0);
  });

  it("returns false for non-existent prompt", () => {
    expect(promptManager.deletePrompt(tempDir, "nope")).toBe(false);
  });
});
