#!/usr/bin/env bun
/**
 * Unified dev server — runs both the Hono backend and Vite frontend
 * in a single terminal. Typechecks server code before restarting.
 * Ctrl+C kills both.
 */
import { spawn, type Subprocess } from "bun";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(__dirname);

const procs: Subprocess[] = [];
let shuttingDown = false;

function prefix(
  name: string,
  color: string,
  stream: ReadableStream<Uint8Array>,
  onLine?: (line: string) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const reset = "\x1b[0m";
  (async () => {
    let remainder = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const last = remainder.trim();
        if (last) {
          process.stdout.write(`${color}[${name}]${reset} ${last}\n`);
          onLine?.(last);
        }
        break;
      }
      const text = remainder + decoder.decode(value);
      const lines = text.split("\n");
      remainder = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          process.stdout.write(`${color}[${name}]${reset} ${line}\n`);
          onLine?.(line);
        }
      }
    }
  })();
}

// ── Cleanup on exit ───────────────────────────────────────────────
function cleanup(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) p.kill();
  process.exit(exitCode);
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

const HEALTH_CHECK_INTERVAL = 10_000; // check every 10s
const HEALTH_CHECK_TIMEOUT = 3_000;   // 3s timeout per check
const BACKEND_PORT = Number(process.env.PORT) || 3456;

function spawnBackend(): Subprocess {
  const backend = spawn(["bun", "--watch", "server/index.ts"], {
    cwd: webDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NODE_ENV: "development" },
  });
  return backend;
}

function waitForReady(backend: Subprocess): {
  promise: Promise<boolean>;
  hookLine: (line: string) => void;
} {
  let markReady: ((line: string) => void) | null = null;
  const promise = new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    markReady = (line: string) => {
      if (line.includes("Server running on http://")) finish(true);
    };
    backend.exited.then(() => finish(false));
  });
  return { promise, hookLine: (line: string) => markReady?.(line) };
}

async function isBackendHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    const resp = await fetch(`http://localhost:${BACKEND_PORT}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

async function start() {
  // ── Backend (Hono on Bun) with auto-restart ────────────────────
  let backend = spawnBackend();
  procs.push(backend);

  const { promise: firstReady, hookLine } = waitForReady(backend);
  prefix("api", "\x1b[36m", backend.stdout, hookLine);
  prefix("api", "\x1b[31m", backend.stderr, hookLine);

  const ready = await firstReady;
  if (!ready) {
    console.error("\x1b[31mAPI server exited before becoming ready.\x1b[0m");
    cleanup(1);
    return;
  }

  // ── Vite (frontend HMR) ─────────────────────────────────────────
  const vite = spawn(["bun", "run", "dev:vite"], {
    cwd: webDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NODE_ENV: "development" },
  });
  procs.push(vite);
  prefix("vite", "\x1b[35m", vite.stdout);
  prefix("vite", "\x1b[31m", vite.stderr);

  // ── Health check loop — auto-restart backend if it stops responding ──
  let consecutiveFailures = 0;
  const healthTimer = setInterval(async () => {
    if (shuttingDown) return;
    const healthy = await isBackendHealthy();
    if (healthy) {
      consecutiveFailures = 0;
      return;
    }
    consecutiveFailures++;
    if (consecutiveFailures < 3) return; // tolerate transient failures during --watch restarts

    console.error("\x1b[33m[dev] Backend unresponsive after 3 checks, restarting...\x1b[0m");
    consecutiveFailures = 0;

    // Kill the old backend
    try { backend.kill(); } catch {}
    const idx = procs.indexOf(backend);
    if (idx !== -1) procs.splice(idx, 1);

    // Spawn a fresh one
    backend = spawnBackend();
    procs.push(backend);
    const { promise: restartReady, hookLine: restartHook } = waitForReady(backend);
    prefix("api", "\x1b[36m", backend.stdout, restartHook);
    prefix("api", "\x1b[31m", backend.stderr, restartHook);

    const ok = await restartReady;
    if (!ok) {
      console.error("\x1b[31m[dev] Backend failed to restart. Retrying on next health check.\x1b[0m");
    } else {
      console.log("\x1b[32m[dev] Backend restarted successfully.\x1b[0m");
    }
  }, HEALTH_CHECK_INTERVAL);

  // If Vite exits, shut down everything.
  // If backend exits, the health check loop will auto-restart it.
  backend.exited.then((code) => {
    console.error(`\x1b[33m[api] exited with code ${code}, health check will restart it...\x1b[0m`);
  });

  await vite.exited;
  clearInterval(healthTimer);
  console.error("\x1b[31m[vite] exited, shutting down...\x1b[0m");
  cleanup(1);
}

void start();
