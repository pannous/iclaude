/**
 * Regression test: app must work when cookies/localStorage are disabled.
 *
 * This has broken twice before (commits 6658637, 8bbb2f4) because new code
 * used raw `localStorage` instead of the `safeStorage` wrapper.
 *
 * The test approach:
 * 1. Verify safeStorage itself falls back to in-memory when localStorage throws.
 * 2. Scan all non-test source files for raw `localStorage` usage outside of
 *    safe-storage.ts — any hit is a future regression.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("safeStorage", () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it("falls back to in-memory storage when localStorage throws", async () => {
    // Simulate a browser with cookies disabled: all localStorage calls throw
    const brokenStorage = {
      getItem: () => { throw new DOMException("access denied"); },
      setItem: () => { throw new DOMException("access denied"); },
      removeItem: () => { throw new DOMException("access denied"); },
      clear: () => { throw new DOMException("access denied"); },
      get length() { return 0; },
      key: () => null,
    } as Storage;

    Object.defineProperty(globalThis, "localStorage", {
      value: brokenStorage,
      writable: true,
      configurable: true,
    });

    // Re-import to reset detection cache
    const { safeStorage } = await import("./safe-storage.js");

    // Should not throw — falls back to in-memory
    expect(() => safeStorage.setItem("test-key", "test-value")).not.toThrow();
    expect(safeStorage.getItem("test-key")).toBe("test-value");

    safeStorage.removeItem("test-key");
    expect(safeStorage.getItem("test-key")).toBeNull();
  });

  it("works when localStorage is undefined (e.g. SSR)", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { safeStorage } = await import("./safe-storage.js");

    expect(() => safeStorage.setItem("key", "val")).not.toThrow();
    expect(safeStorage.getItem("key")).toBe("val");
    safeStorage.removeItem("key");
    expect(safeStorage.getItem("key")).toBeNull();
  });

  it("getItem returns null for missing keys", async () => {
    const { safeStorage } = await import("./safe-storage.js");

    expect(safeStorage.getItem("nonexistent")).toBeNull();
  });

  it("setItem/getItem/removeItem round-trips correctly", async () => {
    const { safeStorage } = await import("./safe-storage.js");

    safeStorage.setItem("round-trip", "value123");
    expect(safeStorage.getItem("round-trip")).toBe("value123");

    // Overwrite
    safeStorage.setItem("round-trip", "updated");
    expect(safeStorage.getItem("round-trip")).toBe("updated");

    safeStorage.removeItem("round-trip");
    expect(safeStorage.getItem("round-trip")).toBeNull();
  });
});

/**
 * Static analysis guard: scan source files to ensure no raw `localStorage`
 * usage has crept in outside of safe-storage.ts and test files.
 */
describe("no raw localStorage in source files", () => {
  const SRC_DIR = path.resolve(__dirname, "..");
  const ALLOWED_FILES = new Set([
    "utils/safe-storage.ts", // the wrapper itself
    "test-setup.ts",         // test polyfills
    "analytics.ts",          // upstream telemetry uses raw localStorage intentionally
    "api.ts",                // auth token storage (upstream auth system)
    "store.ts",              // auth state persistence (upstream auth system)
    "ws.ts",                 // WS auth token for connection (upstream auth system)
    "terminal-ws.ts",        // terminal WS auth token (upstream auth system)
    "components/UpdateOverlay.tsx", // auth token for update check (upstream auth system)
  ]);

  function collectSourceFiles(dir: string, base: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      const rel = path.join(base, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectSourceFiles(full, rel));
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
        results.push(rel);
      }
    }
    return results;
  }

  // Matches `localStorage.xxx` but not inside comments or string literals
  // (good enough for a guard — not a full parser but catches real usage)
  const RAW_LOCALSTORAGE = /(?<!\w)(?:window\.)?localStorage\s*\./;

  it("no source file uses raw localStorage (must use safeStorage)", () => {
    const files = collectSourceFiles(SRC_DIR, "");
    const violations: string[] = [];

    for (const rel of files) {
      if (ALLOWED_FILES.has(rel)) continue;
      const content = fs.readFileSync(path.join(SRC_DIR, rel), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment-only lines
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (RAW_LOCALSTORAGE.test(line)) {
          violations.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
