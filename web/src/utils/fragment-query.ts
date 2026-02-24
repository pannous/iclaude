/**
 * Fragment query mechanism — postMessage-based request/response to query
 * the state of HTML fragment iframes rendered in chat.
 */

import { useStore } from "../store.js";

const pendingQueries = new Map<string, {
  resolve: (state: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/**
 * Query the state of an HTML fragment iframe.
 * Sends a postMessage and waits for the iframe to respond via vibeGetState().
 * Returns null on timeout or if the fragment has no state.
 */
export function queryFragmentState(fragmentId: string, timeoutMs = 3000): Promise<unknown> {
  const iframe = useStore.getState().fragmentIframes.get(fragmentId);
  if (!iframe?.contentWindow) return Promise.resolve(null);

  const requestId = `fq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingQueries.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pendingQueries.set(requestId, { resolve, timer });

    iframe.contentWindow!.postMessage({
      type: "vibe:query_state",
      fragmentId,
      requestId,
    }, "*");
  });
}

/**
 * Resolve a pending state query from a fragment's postMessage response.
 */
export function resolveStateQuery(requestId: string, state: unknown): void {
  const pending = pendingQueries.get(requestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingQueries.delete(requestId);
  pending.resolve(state);
}
