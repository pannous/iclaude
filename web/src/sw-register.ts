/**
 * Service Worker registration for production builds.
 *
 * Uses vite-plugin-pwa's prompt mode: when a new SW is detected,
 * onNeedRefresh fires but the page is NOT reloaded automatically.
 * The user must explicitly trigger the update (via the update banner).
 *
 * In dev mode the virtual:pwa-register module is a no-op, so importing
 * this file has no effect during development.
 *
 * Edge cases:
 * - Multiple tabs: the new SW activates across all tabs when the user
 *   accepts the update. WebSocket connections are unaffected (/ws/* excluded).
 * - First-time visitors: app loads from network; SW installs in background.
 * - SW update during active session: only static assets are cached. API calls
 *   and WebSocket connections go directly to network.
 */
import { registerSW } from "virtual:pwa-register";

let pendingUpdate: (() => Promise<void>) | null = null;

const updateSW = registerSW({
  onNeedRefresh() {
    console.log("[SW] New content available — update ready (page will not auto-reload)");
    pendingUpdate = () => updateSW(true);
  },
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (registration) {
      // Check for SW updates every 60 minutes while the app is open.
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.log("[SW] Offline-ready: all assets precached");
  },
});

/** Accept the pending SW update and reload the page. */
export function acceptSwUpdate() {
  if (pendingUpdate) pendingUpdate();
}

/** Whether there is a pending SW update waiting to be accepted. */
export function hasSwUpdate(): boolean {
  return pendingUpdate !== null;
}

export { updateSW };
