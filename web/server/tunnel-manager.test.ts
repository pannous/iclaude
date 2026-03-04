import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";

// Mock child_process.spawn to avoid spawning real tunnel processes
// Keep execSync real so detectProvider() works with `which`
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "node:child_process";
import { TunnelManager } from "./tunnel-manager.js";

const mockSpawn = vi.mocked(spawn);

/** Create a fake ChildProcess that emits data on stderr after a delay */
function createFakeProc(opts: { stderrData?: string; exitCode?: number } = {}) {
  const proc = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn>; stdout: EventEmitter; stderr: EventEmitter };
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  Object.assign(proc, { stdout, stderr, stdin: null, pid: 99999, killed: false });
  proc.kill = vi.fn(() => { (proc as unknown as Record<string, unknown>).killed = true; return true; });

  setTimeout(() => {
    if (opts.stderrData) {
      stderr.emit("data", opts.stderrData);
    } else if (opts.exitCode !== undefined) {
      proc.emit("exit", opts.exitCode);
    }
  }, 20);

  return proc as unknown as ReturnType<typeof spawn>;
}

describe("tunnel-manager", () => {
  let manager: TunnelManager;
  const originalAuth = process.env.COMPANION_AUTH;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("extracts cloudflared URL from stderr and force-enables auth", async () => {
    mockSpawn.mockReturnValue(
      createFakeProc({ stderrData: "INF | https://test-abc.trycloudflare.com\n" }),
    );

    const result = await manager.start(3456);

    expect(result.url).toBe("https://test-abc.trycloudflare.com");
    expect(result.provider).toMatch(/cloudflared|ngrok/);
    expect(process.env.COMPANION_AUTH).toBe("1");
    expect(manager.getStatus().state).toBe("running");
  });

  it("idempotent start returns existing URL without re-spawning", async () => {
    mockSpawn.mockReturnValue(
      createFakeProc({ stderrData: "https://test-abc.trycloudflare.com\n" }),
    );

    const first = await manager.start(3456);
    const second = await manager.start(3456);

    expect(second.url).toBe(first.url);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("stop() kills the process and clears state", async () => {
    const fakeProc = createFakeProc({ stderrData: "https://test-abc.trycloudflare.com\n" });
    mockSpawn.mockReturnValue(fakeProc);

    await manager.start(3456);
    await manager.stop();

    expect(fakeProc.kill).toHaveBeenCalled();
    expect(manager.getStatus()).toEqual({
      state: "stopped",
      url: null,
      provider: null,
      error: null,
    });
  });

  it("transitions to error state when process exits before URL is found", async () => {
    mockSpawn.mockReturnValue(createFakeProc({ exitCode: 1 }));

    await expect(manager.start(3456)).rejects.toThrow("exited with code 1");
    expect(manager.getStatus().state).toBe("error");
    expect(manager.getStatus().error).toContain("exited with code 1");
  });
});
