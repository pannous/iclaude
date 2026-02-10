/**
 * Safe localStorage wrapper that falls back to in-memory storage
 * when cookies/storage are disabled by the browser.
 */

const memoryStore = new Map<string, string>();

let _detected: boolean | null = null;

function canUseLocalStorage(): boolean {
  if (_detected !== null) return _detected;
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      _detected = false;
      return false;
    }
    const key = "__storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    _detected = true;
  } catch {
    _detected = false;
  }
  return _detected;
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (canUseLocalStorage()) return localStorage.getItem(key);
    return memoryStore.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    if (canUseLocalStorage()) {
      localStorage.setItem(key, value);
    } else {
      memoryStore.set(key, value);
    }
  },

  removeItem(key: string): void {
    if (canUseLocalStorage()) {
      localStorage.removeItem(key);
    } else {
      memoryStore.delete(key);
    }
  },
};
