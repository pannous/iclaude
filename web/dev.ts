#!/usr/bin/env bun
/**
 * Unified dev server — runs both the Hono backend and Vite frontend
 * in a single terminal. Typechecks server code before restarting.
 * Ctrl+C kills both.
 */
import { spawn, type Subprocess } from "bun";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { watch as fsWatch } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(__dirname);

const DEBOUNCE_MS = 300;

// ── Logging ──────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const COLORS = { info: "\x1b[36m", ok: "\x1b[32m", warn: "\x1b[33m" } as const;

function log(level: keyof typeof COLORS, msg: string) {
  process.stdout.write(`${COLORS[level]}[dev]${RESET} ${msg}\n`);
}

function prefix(name: string, color: string, stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.trim()) {
          process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
        }
      }
    }
  })();
}

// ── Port cleanup ─────────────────────────────────────────────────────

async function killPortIfUsed(port: number) {
  const result = await spawn(["lsof", "-ti", `:${port}`], { stdout: "pipe", stderr: "pipe" }).stdout
    .text()
    .catch(() => "");
  const pids = result.trim().split("\n").filter(Boolean);
  if (pids.length === 0) return;
  log("warn", `Port ${port} in use by PID(s) ${pids.join(", ")} — killing...`);
  await spawn(["kill", ...pids]).exited.catch(() => {});
  // Give them a moment to release the port
  await new Promise((r) => setTimeout(r, 300));
}

// ── Backend process management ───────────────────────────────────────

let backend: Subprocess | null = null;

function startBackend(): Subprocess {
  const proc = spawn(["bun", "server/index.ts"], {
    cwd: webDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NODE_ENV: "development" },
  });
  prefix("api", "\x1b[36m", proc.stdout);
  prefix("api", "\x1b[31m", proc.stderr);
  proc.exited.then((code) => {
    if (code !== null && code !== 0) {
      log("warn", `Backend exited with code ${code}, waiting for next file change to restart`);
    }
  });
  return proc;
}

function restartBackend() {
  if (backend) {
    backend.kill();
    backend = null;
  }
  backend = startBackend();
}

// ── Typecheck ────────────────────────────────────────────────────────

async function runTypecheck(): Promise<boolean> {
  const tsc = spawn(["tsc", "--noEmit", "-p", "tsconfig.dev.json"], {
    cwd: webDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  prefix("tsc", "\x1b[33m", tsc.stdout);
  prefix("tsc", "\x1b[31m", tsc.stderr);
  const code = await tsc.exited;
  return code === 0;
}

// ── File watcher ─────────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let typecheckInProgress = false;

async function handleChange(filename: string) {
  if (typecheckInProgress) return;
  typecheckInProgress = true;

  log("info", `Change detected in ${filename}, typechecking...`);
  const passed = await runTypecheck();

  if (passed) {
    log("ok", "Typecheck passed, restarting backend...");
    restartBackend();
  } else {
    log("warn", "Typecheck failed, keeping old server running");
  }

  typecheckInProgress = false;
}

function startWatcher() {
  fsWatch(resolve(webDir, "server"), { recursive: true }, (_event, filename) => {
    if (!filename || !filename.endsWith(".ts")) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleChange(filename), DEBOUNCE_MS);
  });
}

// ── Vite (frontend HMR) ─────────────────────────────────────────────

const vite = spawn(["bun", "run", "dev:vite"], {
  cwd: webDir,
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, NODE_ENV: "development" },
});
prefix("vite", "\x1b[35m", vite.stdout);
prefix("vite", "\x1b[31m", vite.stderr);

// ── Startup ──────────────────────────────────────────────────────────

await killPortIfUsed(3457);
backend = startBackend();
startWatcher();
log("info", "Watching server/ for changes (typecheck-gated restarts)");

// ── Cleanup ──────────────────────────────────────────────────────────

async function cleanup() {
  const waits: Promise<unknown>[] = [];
  if (backend) { backend.kill(); waits.push(backend.exited); }
  vite.kill(); waits.push(vite.exited);
  await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 2000))]);
  process.exit(0);
}

process.on("SIGINT", () => { cleanup(); });
process.on("SIGTERM", () => { cleanup(); });

// Only Vite crashing kills the dev server — backend restarts are managed by the watcher
vite.exited.then((code) => {
  console.error(`\x1b[31mVite exited with code ${code}, shutting down...\x1b[0m`);
  cleanup();
});
