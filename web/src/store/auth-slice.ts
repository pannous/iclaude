import type { StateCreator } from "zustand";
import type { AppState } from "./index.js";
import { safeStorage } from "../utils/safe-storage.js";

const AUTH_STORAGE_KEY = "companion_auth_token";

function getInitialAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return safeStorage.getItem(AUTH_STORAGE_KEY) || null;
}

export interface AuthSlice {
  authToken: string | null;
  isAuthenticated: boolean;
  // LOCAL: true while autoAuth is in flight — prevents login-page flash when auth is disabled
  authChecking: boolean;

  setAuthToken: (token: string) => void;
  setAuthChecking: (checking: boolean) => void;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  authToken: getInitialAuthToken(),
  isAuthenticated: getInitialAuthToken() !== null,
  // LOCAL: if no stored token, start in "checking" state to avoid login-page flash
  authChecking: getInitialAuthToken() === null,

  setAuthToken: (token) => {
    safeStorage.setItem(AUTH_STORAGE_KEY, token);
    set({ authToken: token, isAuthenticated: true, authChecking: false });
  },
  setAuthChecking: (checking) => set({ authChecking: checking }),
  logout: () => {
    safeStorage.removeItem(AUTH_STORAGE_KEY);
    set({ authToken: null, isAuthenticated: false });
  },
});
