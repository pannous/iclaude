import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock speechSynthesis before importing module
const mockCancel = vi.fn();
const mockSpeak = vi.fn();
Object.defineProperty(globalThis, "speechSynthesis", {
  value: { cancel: mockCancel, speak: mockSpeak, speaking: false },
  writable: true,
});
Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
  value: class { text: string; rate = 1; constructor(t: string) { this.text = t; } },
  writable: true,
});

describe("readback", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCancel.mockClear();
    mockSpeak.mockClear();
  });

  it("does not speak when disabled", async () => {
    const { speakText, isReadbackEnabled } = await import("./readback.js");
    expect(isReadbackEnabled()).toBe(false);
    speakText("hello");
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it("speaks after toggle enables readback", async () => {
    const { speakText, toggleReadback } = await import("./readback.js");
    toggleReadback(); // enable
    speakText("hello");
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it("toggleReadback returns new state", async () => {
    const { toggleReadback } = await import("./readback.js");
    expect(toggleReadback()).toBe(true);
    expect(toggleReadback()).toBe(false);
  });

  it("stopReadback cancels speechSynthesis", async () => {
    const { stopReadback } = await import("./readback.js");
    stopReadback();
    expect(mockCancel).toHaveBeenCalled();
  });

  it("does not speak empty/whitespace text", async () => {
    const { speakText, toggleReadback } = await import("./readback.js");
    toggleReadback();
    speakText("   ");
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});
