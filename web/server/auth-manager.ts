import { randomBytes, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";

const TOKEN_BYTES = 32; // 64 hex characters

/**
 * Check if authentication is enabled.
 * Auth is disabled by default — set COMPANION_AUTH=1 to enable.
 * When disabled, all requests are trusted (localhost-like behavior for everyone).
 */
export function isAuthEnabled(): boolean {
  const val = process.env.COMPANION_AUTH;
  return val === "1" || val === "true";
}

// Token is generated fresh on each server start and held only in memory.
// The only way to obtain it remotely is via the QR code shown on localhost.
const envToken = process.env.COMPANION_AUTH_TOKEN?.trim();
let cachedToken: string = envToken || randomBytes(TOKEN_BYTES).toString("hex");

/**
 * Get the auth token.
 * Uses COMPANION_AUTH_TOKEN env var if set, otherwise the in-memory token
 * generated at startup. Never written to disk.
 */
export function getToken(): string {
  return cachedToken;
}

/**
 * Verify a candidate token using constant-time comparison.
 */
export function verifyToken(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const expected = getToken();
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);
  if (candidateBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(candidateBuf, expectedBuf);
}

/**
 * Get the primary LAN IP address for QR code URL generation.
 * Falls back to "localhost" if no LAN IP is found.
 */
export function getLanAddress(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "localhost";
}

/**
 * Get all available access addresses: localhost, LAN IP, and Tailscale IP.
 * Tailscale uses 100.x.x.x addresses (CGNAT range) on utun / tailscale interfaces.
 */
export function getAllAddresses(): { label: string; ip: string }[] {
  const result: { label: string; ip: string }[] = [
    { label: "Localhost", ip: "localhost" },
  ];

  const interfaces = networkInterfaces();
  let lanIp: string | null = null;
  let tailscaleIp: string | null = null;

  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== "IPv4" || addr.internal) continue;

      // Tailscale uses 100.64.0.0/10 (CGNAT) — detect by IP range
      if (addr.address.startsWith("100.")) {
        const second = parseInt(addr.address.split(".")[1], 10);
        if (second >= 64 && second <= 127) {
          tailscaleIp = addr.address;
          continue;
        }
      }

      if (!lanIp) lanIp = addr.address;
    }
  }

  if (lanIp) result.push({ label: "LAN", ip: lanIp });
  if (tailscaleIp) result.push({ label: "Tailscale", ip: tailscaleIp });

  return result;
}

/**
 * Regenerate the auth token in-memory.
 * Existing sessions using the old token will be invalidated on their next request.
 */
export function regenerateToken(): string {
  cachedToken = randomBytes(TOKEN_BYTES).toString("hex");
  return cachedToken;
}

/** Reset cached state — for testing only */
export function _resetForTest(): void {
  cachedToken = randomBytes(TOKEN_BYTES).toString("hex");
}
