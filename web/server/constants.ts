import { hostname } from "node:os";

export const DEFAULT_PORT_DEV = 3456;
export const DEFAULT_PORT_PROD = 3456;
// In dev mode, Vite serves the frontend on a separate port
export const DEFAULT_FRONTEND_PORT_DEV = 2345;

/** True when running on the author's home server (pannous tunnel, auto-tunnel, etc.) */
export function isHomeServer(): boolean {
  return hostname().endsWith(".fritz.box");
}
