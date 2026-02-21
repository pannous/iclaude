import { useStore } from "../store.js";
import { connectSession } from "../ws.js";
import { disconnectSession } from "../ws.js";
import { api } from "../api.js";

// --- Shared actions ---

export function navigateSession(direction: "prev" | "next") {
  const store = useStore.getState();
  const { sdkSessions, currentSessionId } = store;

  const activeSessions = sdkSessions
    .filter((s) => !s.archived)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (activeSessions.length === 0) return;

  const currentIndex = activeSessions.findIndex(
    (s) => s.sessionId === currentSessionId,
  );

  let targetIndex: number;
  if (currentIndex === -1) {
    targetIndex = 0;
  } else if (direction === "prev") {
    targetIndex =
      (currentIndex - 1 + activeSessions.length) % activeSessions.length;
  } else {
    targetIndex = (currentIndex + 1) % activeSessions.length;
  }

  const targetSession = activeSessions[targetIndex];
  if (targetSession && targetSession.sessionId !== currentSessionId) {
    if (currentSessionId) disconnectSession(currentSessionId);
    store.setCurrentSession(targetSession.sessionId);
    connectSession(targetSession.sessionId);
  }
}

export function archiveCurrentSession() {
  const store = useStore.getState();
  const currentId = store.currentSessionId;
  if (!currentId) return;

  disconnectSession(currentId);
  api.archiveSession(currentId).catch((e) => console.warn("[keybindings] archiveSession", e));
  store.newSession();
  api
    .listSessions()
    .then((list) => store.setSdkSessions(list))
    .catch((e) => console.warn("[keybindings] listSessions", e));
}

export function newSession() {
  const store = useStore.getState();
  const currentId = store.currentSessionId;
  if (currentId) disconnectSession(currentId);
  store.newSession();
}

// --- Keyboard shortcut definitions ---

type KeyBinding = {
  match: (e: KeyboardEvent) => boolean;
  action: () => void;
};

const keyBindings: KeyBinding[] = [
  {
    // Alt+X or Ctrl/Cmd+Delete → archive current session
    match: (e) =>
      (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === "x") ||
      ((e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key === "Delete"),
    action: archiveCurrentSession,
  },
  {
    // Ctrl/Cmd+S or Ctrl/Cmd+T → new session
    match: (e) =>
      (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "t"),
    action: newSession,
  },
  {
    // BrowserBack/Back key
    match: (e) => e.key === "BrowserBack" || e.key === "Back",
    action: () => navigateSession("prev"),
  },
  {
    // BrowserForward/Forward key
    match: (e) => e.key === "BrowserForward" || e.key === "Forward",
    action: () => navigateSession("next"),
  },
  {
    // Alt+Ctrl+PageUp → prev session
    match: (e) => e.altKey && e.ctrlKey && e.key === "PageUp",
    action: () => navigateSession("prev"),
  },
  {
    // Alt+Ctrl+PageDown → next session
    match: (e) => e.altKey && e.ctrlKey && e.key === "PageDown",
    action: () => navigateSession("next"),
  },
  {
    // Modifier combos + ArrowUp/ArrowLeft → prev session
    match: (e) =>
      isNavigationCombo(e) &&
      (e.key === "ArrowUp" || e.key === "ArrowLeft"),
    action: () => navigateSession("prev"),
  },
  {
    // Modifier combos + ArrowDown/ArrowRight → next session
    match: (e) =>
      isNavigationCombo(e) &&
      (e.key === "ArrowDown" || e.key === "ArrowRight"),
    action: () => navigateSession("next"),
  },
];

function isNavigationCombo(e: KeyboardEvent): boolean {
  return (
    (e.ctrlKey && e.altKey) ||
    (e.altKey && e.metaKey) ||
    (e.ctrlKey && e.altKey && e.metaKey)
  );
}

// --- Mouse shortcut definitions ---

type MouseBinding = {
  match: (e: MouseEvent) => boolean;
  action: (callbacks: MouseCallbacks) => void;
};

export type MouseCallbacks = {
  onArchiveAll: () => void;
};

const mouseBindings: MouseBinding[] = [
  {
    // Ctrl+Shift+Middle Click → archive all (with confirmation)
    match: (e) =>
      e.button === 1 && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey,
    action: (cb) => cb.onArchiveAll(),
  },
  {
    // Ctrl+Middle Click → archive current session
    match: (e) =>
      e.button === 1 && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey,
    action: () => archiveCurrentSession(),
  },
  {
    // Mouse button 3 = Back
    match: (e) => e.button === 3,
    action: () => navigateSession("prev"),
  },
  {
    // Mouse button 4 = Forward
    match: (e) => e.button === 4,
    action: () => navigateSession("next"),
  },
];

// --- Event handlers to attach to window ---

export function handleKeyDown(e: KeyboardEvent) {
  for (const binding of keyBindings) {
    if (binding.match(e)) {
      e.preventDefault();
      binding.action();
      return;
    }
  }
}

export function createMouseHandler(callbacks: MouseCallbacks) {
  return function handleMouseButton(e: MouseEvent) {
    for (const binding of mouseBindings) {
      if (binding.match(e)) {
        e.preventDefault();
        binding.action(callbacks);
        return;
      }
    }
  };
}
