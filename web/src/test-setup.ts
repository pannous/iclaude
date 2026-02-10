// Setup file for jsdom-based tests
// Polyfills that must be available before any module import

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
}

// Node 25+ exposes a broken localStorage stub (no getItem/setItem/clear)
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
