import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock readback module
vi.mock("./readback.js", () => ({
  stopReadback: vi.fn(),
  toggleReadback: vi.fn(),
}));

// Mock store
const mockNewSession = vi.fn();
vi.mock("../store.js", () => ({
  useStore: {
    getState: () => ({ newSession: mockNewSession }),
  },
}));

import { tryClientCommand, getClientCommands } from "./client-commands.js";
import { stopReadback, toggleReadback } from "./readback.js";

describe("client-commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for non-command messages", () => {
    expect(tryClientCommand("hello world")).toBe(false);
    expect(tryClientCommand("some text")).toBe(false);
  });

  it("returns false for unknown slash commands", () => {
    expect(tryClientCommand("/unknowncommand")).toBe(false);
  });

  it("handles /readback command silently", () => {
    expect(tryClientCommand("/readback")).toBe(true);
    expect(toggleReadback).toHaveBeenCalled();
  });

  it("handles /clear command — stops readback and resets session", () => {
    expect(tryClientCommand("/clear")).toBe(true);
    expect(stopReadback).toHaveBeenCalled();
    expect(mockNewSession).toHaveBeenCalled();
  });

  it("is case-insensitive", () => {
    expect(tryClientCommand("/Readback")).toBe(true);
    expect(tryClientCommand("/CLEAR")).toBe(true);
  });

  it("getClientCommands returns registered commands", () => {
    const cmds = getClientCommands();
    const names = cmds.map((c) => c.name);
    expect(names).toContain("readback");
    expect(names).toContain("clear");
  });
});
