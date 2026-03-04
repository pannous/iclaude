import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { TunnelManager } from "./tunnel-manager.js";

function hasBinary(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasTunnelBinary = hasBinary("cloudflared") || hasBinary("ngrok");

describe("tunnel-manager", () => {
  let manager: TunnelManager;
  const originalAuth = process.env.COMPANION_AUTH;

  beforeEach(() => {
    manager = new TunnelManager();
    delete process.env.COMPANION_AUTH;
  });

  afterEach(async () => {
    await manager.stop().catch(() => {});
    if (originalAuth !== undefined) {
      process.env.COMPANION_AUTH = originalAuth;
    } else {
      delete process.env.COMPANION_AUTH;
    }
  });

  it("starts in stopped state", () => {
    const status = manager.getStatus();
    expect(status.state).toBe("stopped");
    expect(status.url).toBeNull();
    expect(status.provider).toBeNull();
    expect(status.error).toBeNull();
  });

  it("stop() on a stopped manager is a no-op", async () => {
    await manager.stop();
    expect(manager.getStatus().state).toBe("stopped");
  });

  // Integration tests — only run if a tunnel binary is installed
  it.skipIf(!hasTunnelBinary)("start() detects provider, spawns tunnel, and force-enables auth", async () => {
    const result = await manager.start(19999);
    expect(result.url).toMatch(/^https:\/\//);
    expect(result.provider).toMatch(/^(cloudflared|ngrok)$/);
    expect(process.env.COMPANION_AUTH).toBe("1");

    const status = manager.getStatus();
    expect(status.state).toBe("running");
    expect(status.url).toBe(result.url);
  }, 30_000);

  it.skipIf(!hasTunnelBinary)("idempotent start returns existing URL", async () => {
    const first = await manager.start(19999);
    const second = await manager.start(19999);
    expect(second.url).toBe(first.url);
  }, 35_000);

  it.skipIf(!hasTunnelBinary)("stop() clears state and resets to stopped", async () => {
    await manager.start(19999);
    await manager.stop();

    const status = manager.getStatus();
    expect(status.state).toBe("stopped");
    expect(status.url).toBeNull();
    expect(status.provider).toBeNull();
  }, 35_000);
});
