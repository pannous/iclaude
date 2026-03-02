// Setup file for jsdom-based tests
// Polyfills that must be available before any module import

// ---------------------------------------------------------------------------
// Suppress noisy console output during tests
// ---------------------------------------------------------------------------

// Known server-side log prefixes that clutter test output
const noisyPrefixes = [
  "[cli-launcher]", "[codex-adapter]", "[routes]", "[app]", "[ws-bridge]",
  "[session-store]", "[env-manager]", "[recorder]", "[panel-manager]",
];

// Suppress React act() warnings — these are informational in testing-library
// and not actionable at the setup level.
const suppressedPatterns = [
  "An update to",
  "inside a test was not wrapped in act",
  "fatal: not a git repository",
  "Not implemented: HTMLCanvasElement",
];

function shouldSuppress(args: unknown[]): boolean {
  const msg = String(args[0] ?? "");
  return noisyPrefixes.some((p) => msg.startsWith(p))
    || suppressedPatterns.some((p) => msg.includes(p));
}

for (const method of ["log", "warn", "error", "debug"] as const) {
  const original = console[method];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console[method] = (...args: any[]) => {
    if (shouldSuppress(args)) return;
    original.apply(console, args);
  };
}

// ---------------------------------------------------------------------------
// Mock HTMLCanvasElement.getContext (jsdom doesn't implement canvas)
// ---------------------------------------------------------------------------
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

// Register vitest-axe matchers (toHaveNoViolations) in jsdom environments.
// The vitest-axe/extend-expect entry is an empty file in some builds, so we
// manually import the matcher and extend expect ourselves.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchers = await import("vitest-axe/matchers") as any;
  expect.extend({ toHaveNoViolations: matchers.toHaveNoViolations });
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Node.js 22+ ships native localStorage that requires --localstorage-file.
  // Vitest may provide an invalid path, leaving a broken global that shadows
  // jsdom's working implementation. Polyfill when getItem is missing.
  if (
    typeof globalThis.localStorage === "undefined" ||
    typeof globalThis.localStorage.getItem !== "function"
  ) {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, String(value)); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    });
  }
}


// LOCAL: Node 25+ exposes a broken localStorage stub (no getItem/setItem/clear)
// when --localstorage-file is not configured. Replace it with an in-memory
// implementation so tests that call localStorage.clear() etc. work correctly.
if (typeof localStorage !== "undefined" && typeof localStorage.clear !== "function") {
  const store = new Map<string, string>();
  const memStorage: Storage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.get(key) ?? null; },
    setItem(key: string, value: string) { store.set(key, String(value)); },
    removeItem(key: string) { store.delete(key); },
    key(index: number) {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => memStorage,
  });
}

export {};
