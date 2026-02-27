/**
 * Stub for posthog-js during vitest runs.
 * posthog-js reads navigator.userAgent at module init time, which crashes in
 * jsdom environments that don't fully implement the browser UA string.
 * This no-op stub prevents those crashes while letting analytics.js load safely.
 * Tests that need to assert on analytics calls should use vi.mock("./analytics.js", ...).
 */
const posthogStub = {
  init: () => {},
  capture: () => {},
  captureException: () => {},
  opt_in_capturing: () => {},
  opt_out_capturing: () => {},
};

export default posthogStub;
