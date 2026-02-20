import { vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

// Mock randomUUID so session IDs are deterministic
vi.mock("node:crypto", () => ({ randomUUID: () => "test-session-id" }));

// Mock path-resolver for binary resolution
const mockResolveBinary = vi.hoisted(() => vi.fn((_name: string): string | null => "/usr/bin/claude"));
const mockGetEnrichedPath = vi.hoisted(() => vi.fn(() => "/usr/bin:/usr/local/bin"));
vi.mock("./path-resolver.js", () => ({ resolveBinary: mockResolveBinary, getEnrichedPath: mockGetEnrichedPath }));

// Mock container-manager for container validation in relaunch
const mockIsContainerAlive = vi.hoisted(() => vi.fn((): "running" | "stopped" | "missing" => "running"));
const mockHasBinaryInContainer = vi.hoisted(() => vi.fn((): boolean => true));
const mockStartContainer = vi.hoisted(() => vi.fn());
vi.mock("./container-manager.js", () => ({
  containerManager: {
    isContainerAlive: mockIsContainerAlive,
    hasBinaryInContainer: mockHasBinaryInContainer,
    startContainer: mockStartContainer,
  },
}));

// Mock fs operations for worktree guardrails (CLAUDE.md in .claude dirs)
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn((..._args: any[]) => false));
const mockReadFileSync = vi.hoisted(() => vi.fn((..._args: any[]) => ""));
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const isMockedPath = vi.hoisted(() => (path: string): boolean => {
  return path.includes(".claude") || path.startsWith("/tmp/worktrees/") || path.startsWith("/tmp/main-repo");
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    mkdirSync: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockMkdirSync(...args);
      }
      return actual.mkdirSync(...args);
    },
    existsSync: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockExistsSync(...args);
      }
      return actual.existsSync(...args);
    },
    readFileSync: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockReadFileSync(...args);
      }
      return actual.readFileSync(...args);
    },
    writeFileSync: (...args: any[]) => {
      if (typeof args[0] === "string" && isMockedPath(args[0])) {
        return mockWriteFileSync(...args);
      }
      return actual.writeFileSync(...args);
    },
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { SessionStore } from "./session-store.js";
import { CliLauncher } from "./cli-launcher.js";

// ─── Bun.spawn mock ─────────────────────────────────────────────────────────

let exitResolve: (code: number) => void;

function createMockProc(pid = 12345) {
  let resolve: (code: number) => void;
  const exitedPromise = new Promise<number>((r) => {
    resolve = r;
  });
  exitResolve = resolve!;
  return {
    pid,
    kill: vi.fn(),
    exited: exitedPromise,
    stdout: null,
    stderr: null,
  };
}

function createMockCodexProc(pid = 12345) {
  let resolve: (code: number) => void;
  const exitedPromise = new Promise<number>((r) => {
    resolve = r;
  });
  exitResolve = resolve!;
  return {
    pid,
    kill: vi.fn(),
    exited: exitedPromise,
    stdin: new WritableStream<Uint8Array>(),
    stdout: new ReadableStream<Uint8Array>(),
    stderr: new ReadableStream<Uint8Array>(),
  };
}

const mockSpawn = vi.fn();
vi.stubGlobal("Bun", { spawn: mockSpawn });

// ─── Helpers ─────────────────────────────────────────────────────────────────

// The temp token generated for new sessions (randomUUID mocked to "test-session-id")
const TEMP_ID = "_tmp_test-session-id";

/**
 * Launch a new session and resolve it to a real CLI session ID by calling setCLISessionId.
 * Returns the SdkSessionInfo after re-keying.
 */
async function launchAndResolve(
  launcher: CliLauncher,
  opts: Parameters<typeof launcher.launch>[0] = {},
  cliSessionId = "cli-real-id",
) {
  const promise = launcher.launch({ cwd: "/tmp", ...opts });
  // The session is created under the temp token; resolve it with a real CLI ID
  launcher.setCLISessionId(TEMP_ID, cliSessionId);
  return promise;
}

// ─── Test setup ──────────────────────────────────────────────────────────────

let tempDir: string;
let store: SessionStore;
let launcher: CliLauncher;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.COMPANION_CONTAINER_SDK_HOST;
  delete process.env.COMPANION_FORCE_BYPASS_IN_CONTAINER;
  tempDir = mkdtempSync(join(tmpdir(), "launcher-test-"));
  store = new SessionStore(tempDir);
  launcher = new CliLauncher(3456);
  launcher.setStore(store);
  mockSpawn.mockReturnValue(createMockProc());
  mockResolveBinary.mockReturnValue("/usr/bin/claude");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ─── launch ──────────────────────────────────────────────────────────────────

describe("launch", () => {
  it("creates a session with temp token for new sessions and resolves to real CLI ID", async () => {
    const info = await launchAndResolve(launcher, { cwd: "/tmp/project" }, "cli-abc-123");

    expect(info.sessionId).toBe("cli-abc-123");
    expect(info.state).toBe("starting");
    expect(info.cwd).toBe("/tmp/project");
    expect(info.createdAt).toBeGreaterThan(0);
  });

  it("uses resumeSessionId directly without waiting for system/init", async () => {
    const info = await launcher.launch({ cwd: "/tmp/project", resumeSessionId: "resume-id-1" });

    expect(info.sessionId).toBe("resume-id-1");
    expect(info.state).toBe("starting");
  });

  it("spawns CLI with correct --sdk-url using temp token", () => {
    // Don't await — just check spawn was called
    launcher.launch({ cwd: "/tmp/project" });

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [cmdAndArgs, options] = mockSpawn.mock.calls[0];

    // Binary should be resolved via execSync
    expect(cmdAndArgs[0]).toBe("/usr/bin/claude");

    // Core required flags — URL uses the temp token for routing
    expect(cmdAndArgs).toContain("--sdk-url");
    expect(cmdAndArgs).toContain(`ws://localhost:3456/ws/cli/${TEMP_ID}`);
    expect(cmdAndArgs).toContain("--print");
    expect(cmdAndArgs).toContain("--output-format");
    expect(cmdAndArgs).toContain("stream-json");
    expect(cmdAndArgs).toContain("--input-format");
    expect(cmdAndArgs).toContain("--verbose");

    // Headless prompt
    expect(cmdAndArgs).toContain("-p");
    expect(cmdAndArgs).toContain("");

    // Spawn options
    expect(options.cwd).toBe("/tmp/project");
    expect(options.stdout).toBe("pipe");
    expect(options.stderr).toBe("pipe");
  });

  it("passes --model when provided", () => {
    launcher.launch({ model: "claude-opus-4-20250514", cwd: "/tmp" });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    const modelIdx = cmdAndArgs.indexOf("--model");
    expect(modelIdx).toBeGreaterThan(-1);
    expect(cmdAndArgs[modelIdx + 1]).toBe("claude-opus-4-20250514");
  });

  it("passes --permission-mode when provided", () => {
    launcher.launch({ permissionMode: "bypassPermissions", cwd: "/tmp" });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    const modeIdx = cmdAndArgs.indexOf("--permission-mode");
    expect(modeIdx).toBeGreaterThan(-1);
    expect(cmdAndArgs[modeIdx + 1]).toBe("bypassPermissions");
  });

  it("downgrades bypassPermissions to acceptEdits for containerized Claude sessions", () => {
    launcher.launch({
      cwd: "/tmp/project",
      permissionMode: "bypassPermissions",
      containerId: "abc123def456",
      containerName: "companion-test",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    // With bash -lc wrapping, CLI args are in the last element as a single string
    const bashCmd = cmdAndArgs[cmdAndArgs.length - 1];
    expect(bashCmd).toContain("--permission-mode");
    expect(bashCmd).toContain("acceptEdits");
    expect(bashCmd).not.toContain("bypassPermissions");
  });

  it("uses COMPANION_CONTAINER_SDK_HOST for containerized sdk-url when set", () => {
    process.env.COMPANION_CONTAINER_SDK_HOST = "172.17.0.1";
    launcher.launch({
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-test",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    // With bash -lc wrapping, CLI args are in the last element as a single string
    const bashCmd = cmdAndArgs[cmdAndArgs.length - 1];
    expect(bashCmd).toContain("--sdk-url");
    expect(bashCmd).toContain(`ws://172.17.0.1:3456/ws/cli/${TEMP_ID}`);
  });

  it("passes --allowedTools for each tool", () => {
    launcher.launch({
      allowedTools: ["Read", "Write", "Bash"],
      cwd: "/tmp",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    // Each tool gets its own --allowedTools flag
    const toolFlags = cmdAndArgs.reduce(
      (acc: string[], arg: string, i: number) => {
        if (arg === "--allowedTools") acc.push(cmdAndArgs[i + 1]);
        return acc;
      },
      [],
    );
    expect(toolFlags).toEqual(["Read", "Write", "Bash"]);
  });

  it("resolves binary path via resolveBinary when not absolute", () => {
    mockResolveBinary.mockReturnValue("/usr/local/bin/claude-dev");
    launcher.launch({ claudeBinary: "claude-dev", cwd: "/tmp" });

    expect(mockResolveBinary).toHaveBeenCalledWith("claude-dev");
    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs[0]).toBe("/usr/local/bin/claude-dev");
  });

  it("passes absolute binary path directly to resolveBinary", () => {
    mockResolveBinary.mockReturnValue("/opt/bin/claude");
    launcher.launch({
      claudeBinary: "/opt/bin/claude",
      cwd: "/tmp",
    });

    expect(mockResolveBinary).toHaveBeenCalledWith("/opt/bin/claude");
    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs[0]).toBe("/opt/bin/claude");
  });

  it("rejects when claude binary not found", async () => {
    mockResolveBinary.mockReturnValue(null);

    // For binary-not-found, the session is created (exited) but the Promise
    // will never resolve (no system/init) — it'll timeout. Check the session state directly.
    const session = launcher.getSession(TEMP_ID);
    // Session might not exist yet since launch hasn't been called
    launcher.launch({ cwd: "/tmp" });

    const info = launcher.getSession(TEMP_ID);
    expect(info?.state).toBe("exited");
    expect(info?.exitCode).toBe(127);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("stores container metadata when containerId provided", () => {
    launcher.launch({
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-session-1",
      containerImage: "ubuntu:22.04",
    });

    const info = launcher.getSession(TEMP_ID);
    expect(info?.containerId).toBe("abc123def456");
    expect(info?.containerName).toBe("companion-session-1");
    expect(info?.containerImage).toBe("ubuntu:22.04");
    expect(info?.containerCwd).toBe("/workspace");
  });

  it("stores explicit containerCwd when provided", () => {
    mockSpawn.mockReturnValueOnce(createMockCodexProc());
    launcher.launch({
      cwd: "/tmp/project",
      backendType: "codex",
      containerId: "abc123def456",
      containerName: "companion-session-1",
      containerImage: "ubuntu:22.04",
      containerCwd: "/workspace/repo",
    });

    const info = launcher.getSession(TEMP_ID);
    expect(info?.containerCwd).toBe("/workspace/repo");
  });

  it("uses docker exec -i with bash -lc for containerized Claude sessions", () => {
    // bash -lc ensures ~/.bashrc is sourced so nvm-installed CLIs are on PATH
    launcher.launch({
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-session-1",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs[0]).toBe("docker");
    expect(cmdAndArgs[1]).toBe("exec");
    expect(cmdAndArgs[2]).toBe("-i");
    // Should wrap the CLI command in bash -lc for login shell PATH
    expect(cmdAndArgs).toContain("bash");
    expect(cmdAndArgs).toContain("-lc");
  });

  it("sets session pid from spawned process", () => {
    mockSpawn.mockReturnValue(createMockProc(99999));
    launcher.launch({ cwd: "/tmp" });
    const info = launcher.getSession(TEMP_ID);
    expect(info?.pid).toBe(99999);
  });

  it("unsets CLAUDECODE to avoid CLI nesting guard", () => {
    launcher.launch({ cwd: "/tmp" });

    const [, options] = mockSpawn.mock.calls[0];
    expect(options.env.CLAUDECODE).toBeUndefined();
  });

  it("merges custom env variables", () => {
    launcher.launch({
      cwd: "/tmp",
      env: { MY_VAR: "hello" },
    });

    const [, options] = mockSpawn.mock.calls[0];
    expect(options.env.MY_VAR).toBe("hello");
    expect(options.env.CLAUDECODE).toBeUndefined();
  });

  it("enables Codex web search when codexInternetAccess=true", () => {
    // Use a fake path where no sibling `node` exists, so the spawn uses
    // the codex binary directly (the explicit-node path is tested separately).
    mockResolveBinary.mockReturnValue("/opt/fake/codex");
    mockSpawn.mockReturnValueOnce(createMockCodexProc());

    launcher.launch({
      backendType: "codex",
      cwd: "/tmp/project",
      codexInternetAccess: true,
      codexSandbox: "danger-full-access",
    });

    const [cmdAndArgs, options] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs[0]).toBe("/opt/fake/codex");
    expect(cmdAndArgs).toContain("app-server");
    expect(cmdAndArgs).toContain("-c");
    expect(cmdAndArgs).toContain("tools.webSearch=true");
    expect(options.cwd).toBe("/tmp/project");
  });

  it("disables Codex web search when codexInternetAccess=false", () => {
    mockResolveBinary.mockReturnValue("/opt/fake/codex");
    mockSpawn.mockReturnValueOnce(createMockCodexProc());

    launcher.launch({
      backendType: "codex",
      cwd: "/tmp/project",
      codexInternetAccess: false,
      codexSandbox: "workspace-write",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    expect(cmdAndArgs).toContain("app-server");
    expect(cmdAndArgs).toContain("-c");
    expect(cmdAndArgs).toContain("tools.webSearch=false");
  });

  it("spawns codex via sibling node binary to bypass shebang issues", () => {
    // When a `node` binary exists next to the resolved `codex`, the launcher
    // should invoke `node <codex-script>` directly instead of relying on
    // the #!/usr/bin/env node shebang (which may resolve to system Node v12).
    // Create a temp dir with both `codex` and `node` files to simulate nvm layout.
    const tmpBinDir = mkdtempSync(join(tmpdir(), "codex-test-"));
    const fakeCodex = join(tmpBinDir, "codex");
    const fakeNode = join(tmpBinDir, "node");
    const { writeFileSync: realWriteFileSync } = require("node:fs");
    realWriteFileSync(fakeCodex, "#!/usr/bin/env node\n");
    realWriteFileSync(fakeNode, "#!/bin/sh\n");

    mockResolveBinary.mockReturnValue(fakeCodex);
    mockSpawn.mockReturnValueOnce(createMockCodexProc());

    launcher.launch({
      backendType: "codex",
      cwd: "/tmp/project",
      codexSandbox: "workspace-write",
    });

    const [cmdAndArgs] = mockSpawn.mock.calls[0];
    // Sibling node exists, so it should use explicit node invocation
    expect(cmdAndArgs[0]).toBe(fakeNode);
    // The codex script path should be arg 1
    expect(cmdAndArgs[1]).toContain("codex");
    expect(cmdAndArgs).toContain("app-server");

    // Cleanup
    rmSync(tmpBinDir, { recursive: true, force: true });
  });

  it("sets state=exited and exitCode=127 when codex binary not found", () => {
    mockResolveBinary.mockReturnValue(null);

    launcher.launch({
      backendType: "codex",
      cwd: "/tmp/project",
      codexSandbox: "workspace-write",
    });

    const info = launcher.getSession(TEMP_ID);
    expect(info?.state).toBe("exited");
    expect(info?.exitCode).toBe(127);
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});

// ─── state management ────────────────────────────────────────────────────────

describe("state management", () => {
  describe("markConnected", () => {
    it("sets state to connected", async () => {
      const info = await launchAndResolve(launcher);
      launcher.markConnected(info.sessionId);

      const session = launcher.getSession(info.sessionId);
      expect(session?.state).toBe("connected");
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.markConnected("nonexistent");
    });
  });

  describe("setCLISessionId", () => {
    it("re-keys temp session to real CLI session ID", async () => {
      const info = await launchAndResolve(launcher, {}, "cli-internal-abc");

      // Session should be accessible by the real CLI ID
      const session = launcher.getSession("cli-internal-abc");
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("cli-internal-abc");

      // Old temp ID should no longer exist
      expect(launcher.getSession(TEMP_ID)).toBeUndefined();
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.setCLISessionId("nonexistent", "cli-id");
    });
  });

  describe("isAlive", () => {
    it("returns true for non-exited session", async () => {
      const info = await launchAndResolve(launcher);
      expect(launcher.isAlive(info.sessionId)).toBe(true);
    });

    it("returns false for exited session", async () => {
      const info = await launchAndResolve(launcher);

      // Simulate process exit
      exitResolve(0);
      // Allow the .then callback in spawnCLI to run
      await new Promise((r) => setTimeout(r, 10));

      expect(launcher.isAlive(info.sessionId)).toBe(false);
    });

    it("returns false for unknown session", () => {
      expect(launcher.isAlive("nonexistent")).toBe(false);
    });
  });

  describe("listSessions", () => {
    it("returns all sessions", async () => {
      const info = await launchAndResolve(launcher);
      const sessions = launcher.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe(info.sessionId);
    });

    it("returns empty array when no sessions exist", () => {
      expect(launcher.listSessions()).toEqual([]);
    });
  });

  describe("getSession", () => {
    it("returns a specific session", async () => {
      const info = await launchAndResolve(launcher, { cwd: "/tmp/myproject" });

      const session = launcher.getSession(info.sessionId);
      expect(session).toBeDefined();
      expect(session?.cwd).toBe("/tmp/myproject");
    });

    it("returns undefined for unknown session", () => {
      expect(launcher.getSession("nonexistent")).toBeUndefined();
    });
  });

  describe("pruneExited", () => {
    it("removes exited sessions and returns count", async () => {
      const info = await launchAndResolve(launcher);

      // Simulate process exit
      exitResolve(0);
      await new Promise((r) => setTimeout(r, 10));

      expect(launcher.getSession(info.sessionId)?.state).toBe("exited");

      const pruned = launcher.pruneExited();
      expect(pruned).toBe(1);
      expect(launcher.listSessions()).toHaveLength(0);
    });

    it("returns 0 when no sessions are exited", async () => {
      await launchAndResolve(launcher);
      const pruned = launcher.pruneExited();
      expect(pruned).toBe(0);
      expect(launcher.listSessions()).toHaveLength(1);
    });
  });

  describe("setArchived", () => {
    it("sets the archived flag on a session", async () => {
      const info = await launchAndResolve(launcher);
      launcher.setArchived(info.sessionId, true);

      const session = launcher.getSession(info.sessionId);
      expect(session?.archived).toBe(true);
    });

    it("can unset the archived flag", async () => {
      const info = await launchAndResolve(launcher);
      launcher.setArchived(info.sessionId, true);
      launcher.setArchived(info.sessionId, false);

      const session = launcher.getSession(info.sessionId);
      expect(session?.archived).toBe(false);
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.setArchived("nonexistent", true);
    });
  });

  describe("removeSession", () => {
    it("deletes session from internal maps", async () => {
      const info = await launchAndResolve(launcher);
      expect(launcher.getSession(info.sessionId)).toBeDefined();

      launcher.removeSession(info.sessionId);
      expect(launcher.getSession(info.sessionId)).toBeUndefined();
      expect(launcher.listSessions()).toHaveLength(0);
    });

    it("does nothing for unknown session", () => {
      // Should not throw
      launcher.removeSession("nonexistent");
    });
  });
});

// ─── kill ────────────────────────────────────────────────────────────────────

describe("kill", () => {
  it("sends SIGTERM via proc.kill", async () => {
    const info = await launchAndResolve(launcher);

    // Grab the mock proc
    const mockProc = mockSpawn.mock.results[0].value;

    // Resolve the exit promise so kill() doesn't wait on the timeout
    setTimeout(() => exitResolve(0), 5);

    const result = await launcher.kill(info.sessionId);

    expect(result).toBe(true);
    expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("marks session as exited", async () => {
    const info = await launchAndResolve(launcher);

    setTimeout(() => exitResolve(0), 5);
    await launcher.kill(info.sessionId);

    const session = launcher.getSession(info.sessionId);
    expect(session?.state).toBe("exited");
    expect(session?.exitCode).toBe(-1);
  });

  it("returns false for unknown session", async () => {
    const result = await launcher.kill("nonexistent");
    expect(result).toBe(false);
  });
});

// ─── relaunch ────────────────────────────────────────────────────────────────

describe("relaunch", () => {
  it("kills old process and spawns new one with --resume using sessionId", async () => {
    // Create first proc whose exit resolves immediately when killed
    let resolveFirst: (code: number) => void;
    const firstProc = {
      pid: 12345,
      kill: vi.fn(() => { resolveFirst(0); }),
      exited: new Promise<number>((r) => { resolveFirst = r; }),
      stdout: null,
      stderr: null,
    };
    mockSpawn.mockReturnValueOnce(firstProc);

    // Launch and resolve to a real session ID
    const info = await launchAndResolve(launcher, { cwd: "/tmp/project", model: "claude-sonnet-4-6" }, "cli-resume-id");

    // Second proc for the relaunch — never exits during test
    const secondProc = createMockProc(54321);
    mockSpawn.mockReturnValueOnce(secondProc);

    const result = await launcher.relaunch(info.sessionId);
    expect(result).toEqual({ ok: true });

    // Old process should have been killed
    expect(firstProc.kill).toHaveBeenCalledWith("SIGTERM");

    // New process should be spawned with --resume using the session ID (which IS the CLI ID)
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    const [cmdAndArgs] = mockSpawn.mock.calls[1];
    expect(cmdAndArgs).toContain("--resume");
    expect(cmdAndArgs).toContain("cli-resume-id");

    // Session state should be reset to starting (set by relaunch before spawnCLI)
    // Allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 10));
    const session = launcher.getSession(info.sessionId);
    expect(session?.state).toBe("starting");
  });

  it("reuses launch env variables during relaunch", async () => {
    let resolveFirst: (code: number) => void;
    const firstProc = {
      pid: 12345,
      kill: vi.fn(() => { resolveFirst(0); }),
      exited: new Promise<number>((r) => { resolveFirst = r; }),
      stdout: null,
      stderr: null,
    };
    mockSpawn.mockReturnValueOnce(firstProc);

    const info = await launchAndResolve(launcher, {
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-test",
      env: { CLAUDE_CODE_OAUTH_TOKEN: "tok-test" },
    });

    const secondProc = createMockProc(54321);
    mockSpawn.mockReturnValueOnce(secondProc);

    const result = await launcher.relaunch(info.sessionId);
    expect(result).toEqual({ ok: true });

    const [relaunchCmd] = mockSpawn.mock.calls[1];
    expect(relaunchCmd).toContain("-e");
    expect(relaunchCmd).toContain("CLAUDE_CODE_OAUTH_TOKEN=tok-test");
  });

  it("returns error for unknown session", async () => {
    const result = await launcher.relaunch("nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Session not found");
  });

  it("returns error when container was removed externally", async () => {
    const info = await launchAndResolve(launcher, {
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-gone",
    });

    // Simulate container being removed
    mockIsContainerAlive.mockReturnValueOnce("missing");

    const result = await launcher.relaunch(info.sessionId);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("companion-gone");
    expect(result.error).toContain("removed externally");

    // Session should be marked as exited
    const session = launcher.getSession(info.sessionId);
    expect(session?.state).toBe("exited");
    expect(session?.exitCode).toBe(1);

    // Should NOT have spawned a new process
    expect(mockSpawn).toHaveBeenCalledTimes(1); // only the initial launch
  });

  it("restarts stopped container before spawning CLI", async () => {
    // Create initial proc that exits immediately when killed
    let resolveFirst: (code: number) => void;
    const firstProc = {
      pid: 12345,
      kill: vi.fn(() => { resolveFirst(0); }),
      exited: new Promise<number>((r) => { resolveFirst = r; }),
      stdout: null,
      stderr: null,
    };
    mockSpawn.mockReturnValueOnce(firstProc);

    const info = await launchAndResolve(launcher, {
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-stopped",
    });

    // Container is stopped but can be restarted
    mockIsContainerAlive.mockReturnValueOnce("stopped");
    mockHasBinaryInContainer.mockReturnValueOnce(true);

    const secondProc = createMockProc(54321);
    mockSpawn.mockReturnValueOnce(secondProc);

    const result = await launcher.relaunch(info.sessionId);
    expect(result).toEqual({ ok: true });
    expect(mockStartContainer).toHaveBeenCalledWith("abc123def456");
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });

  it("returns error when stopped container cannot be restarted", async () => {
    const info = await launchAndResolve(launcher, {
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-dead",
    });

    mockIsContainerAlive.mockReturnValueOnce("stopped");
    mockStartContainer.mockImplementationOnce(() => { throw new Error("container start failed"); });

    const result = await launcher.relaunch(info.sessionId);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("companion-dead");
    expect(result.error).toContain("stopped");
    expect(result.error).toContain("container start failed");
  });

  it("returns error when CLI binary not found in container", async () => {
    const info = await launchAndResolve(launcher, {
      cwd: "/tmp/project",
      containerId: "abc123def456",
      containerName: "companion-nobin",
    });

    mockIsContainerAlive.mockReturnValueOnce("running");
    mockHasBinaryInContainer.mockReturnValueOnce(false);

    const result = await launcher.relaunch(info.sessionId);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("claude");
    expect(result.error).toContain("not found");
    expect(result.error).toContain("companion-nobin");

    const session = launcher.getSession(info.sessionId);
    expect(session?.state).toBe("exited");
    expect(session?.exitCode).toBe(127);
  });

  it("skips container validation for non-containerized sessions", async () => {
    // Create initial proc that exits when killed
    let resolveFirst: (code: number) => void;
    const firstProc = {
      pid: 12345,
      kill: vi.fn(() => { resolveFirst(0); }),
      exited: new Promise<number>((r) => { resolveFirst = r; }),
      stdout: null,
      stderr: null,
    };
    mockSpawn.mockReturnValueOnce(firstProc);

    const info = await launchAndResolve(launcher, { cwd: "/tmp/project" });

    const secondProc = createMockProc(54321);
    mockSpawn.mockReturnValueOnce(secondProc);

    const result = await launcher.relaunch(info.sessionId);
    expect(result).toEqual({ ok: true });

    // Container validation methods should NOT have been called
    expect(mockIsContainerAlive).not.toHaveBeenCalled();
    expect(mockHasBinaryInContainer).not.toHaveBeenCalled();
  });
});

// ─── persistence ─────────────────────────────────────────────────────────────

describe("persistence", () => {
  describe("restoreFromDisk", () => {
    it("recovers sessions from the store", () => {
      // Sessions on disk use real CLI session IDs (already re-keyed)
      const savedSessions = [
        {
          sessionId: "restored-1",
          pid: 99999,
          state: "connected" as const,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      store.saveLauncher(savedSessions);

      // Mock process.kill(pid, 0) to succeed (process is alive)
      const origKill = process.kill;
      const killSpy = vi.spyOn(process, "kill").mockImplementation(((
        pid: number,
        signal?: string | number,
      ) => {
        if (signal === 0) return true;
        return origKill.call(process, pid, signal as any);
      }) as any);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = newLauncher.restoreFromDisk();

      expect(recovered).toBe(1);

      const session = newLauncher.getSession("restored-1");
      expect(session).toBeDefined();
      // Live PIDs get state reset to "starting" awaiting WS reconnect
      expect(session?.state).toBe("starting");

      killSpy.mockRestore();
    });

    it("marks dead PIDs as exited", () => {
      const savedSessions = [
        {
          sessionId: "dead-1",
          pid: 11111,
          state: "connected" as const,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      store.saveLauncher(savedSessions);

      // Mock process.kill(pid, 0) to throw (process is dead)
      const killSpy = vi.spyOn(process, "kill").mockImplementation(((
        _pid: number,
        signal?: string | number,
      ) => {
        if (signal === 0) throw new Error("ESRCH");
        return true;
      }) as any);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = newLauncher.restoreFromDisk();

      // Dead sessions don't count as recovered
      expect(recovered).toBe(0);

      const session = newLauncher.getSession("dead-1");
      expect(session).toBeDefined();
      expect(session?.state).toBe("exited");
      expect(session?.exitCode).toBe(-1);

      killSpy.mockRestore();
    });

    it("returns 0 when no store is set", () => {
      const newLauncher = new CliLauncher(3456);
      // No setStore call
      expect(newLauncher.restoreFromDisk()).toBe(0);
    });

    it("returns 0 when store has no launcher data", () => {
      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      // Store is empty, no launcher.json file
      expect(newLauncher.restoreFromDisk()).toBe(0);
    });

    it("preserves exited sessions with real CLI session IDs (resumable)", () => {
      const savedSessions = [
        {
          sessionId: "already-exited",
          pid: 22222,
          state: "exited" as const,
          exitCode: 0,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      store.saveLauncher(savedSessions);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      const recovered = newLauncher.restoreFromDisk();

      expect(recovered).toBe(0);
      const session = newLauncher.getSession("already-exited");
      expect(session).toBeDefined();
      expect(session?.state).toBe("exited");
    });

    it("prunes ghost sessions (temp token, no title, not archived)", () => {
      const savedSessions = [
        {
          sessionId: "_tmp_ghost-session",
          pid: 33333,
          state: "exited" as const,
          exitCode: 1,
          cwd: "/tmp/project",
          createdAt: Date.now(),
        },
      ];
      store.saveLauncher(savedSessions);

      const newLauncher = new CliLauncher(3456);
      newLauncher.setStore(store);
      newLauncher.restoreFromDisk();

      expect(newLauncher.getSession("_tmp_ghost-session")).toBeUndefined();
    });
  });
});

// ─── getStartingSessions ─────────────────────────────────────────────────────

describe("getStartingSessions", () => {
  it("returns only sessions in starting state", () => {
    // Use launch() without awaiting — session exists under temp ID in "starting" state
    launcher.launch({ cwd: "/tmp" });

    const starting = launcher.getStartingSessions();
    expect(starting).toHaveLength(1);
    expect(starting[0].state).toBe("starting");
  });

  it("excludes sessions that have been connected", async () => {
    const info = await launchAndResolve(launcher);
    launcher.markConnected(info.sessionId);

    const starting = launcher.getStartingSessions();
    expect(starting).toHaveLength(0);
  });

  it("returns empty array when no sessions exist", () => {
    expect(launcher.getStartingSessions()).toEqual([]);
  });
});
