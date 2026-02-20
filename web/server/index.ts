process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";

// Enrich process PATH at startup so binary resolution and `which` calls can find
// binaries installed via version managers (nvm, volta, fnm, etc.).
// Critical when running as a launchd/systemd service with a restricted PATH.
import { getEnrichedPath } from "./path-resolver.js";
process.env.PATH = getEnrichedPath();

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { createRoutes } from "./routes.js";
import { CliLauncher } from "./cli-launcher.js";
import { WsBridge } from "./ws-bridge.js";
import { SessionStore } from "./session-store.js";
import { WorktreeTracker } from "./worktree-tracker.js";
import { containerManager } from "./container-manager.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { TerminalManager } from "./terminal-manager.js";
import { generateSessionTitle } from "./auto-namer.js";
import * as sessionNames from "./session-names.js";
import { getSettings } from "./settings-manager.js";
import { PRPoller } from "./pr-poller.js";
import { RecorderManager } from "./recorder.js";
import { CronScheduler } from "./cron-scheduler.js";

import { startPeriodicCheck, setServiceMode } from "./update-checker.js";
import { imagePullManager } from "./image-pull-manager.js";
import { isRunningAsService } from "./service.js";
import type { SocketData } from "./ws-bridge.js";
import type { ServerWebSocket } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = process.env.__COMPANION_PACKAGE_ROOT || resolve(__dirname, "..");

import { DEFAULT_PORT_DEV, DEFAULT_PORT_PROD } from "./constants.js";

const defaultPort = process.env.NODE_ENV === "production" ? DEFAULT_PORT_PROD : DEFAULT_PORT_DEV;
const port = Number(process.env.PORT) || defaultPort;
const idleTimeoutSeconds = Number(process.env.COMPANION_IDLE_TIMEOUT_SECONDS || "120");
const sessionStore = new SessionStore(process.env.COMPANION_SESSION_DIR);
const wsBridge = new WsBridge();
const launcher = new CliLauncher(port);
const worktreeTracker = new WorktreeTracker();
const CONTAINER_STATE_PATH = join(homedir(), ".companion", "containers.json");
const terminalManager = new TerminalManager();
const prPoller = new PRPoller(wsBridge);
const recorder = new RecorderManager();
const cronScheduler = new CronScheduler(launcher, wsBridge);

// ── Restore persisted sessions from disk ────────────────────────────────────
wsBridge.setStore(sessionStore);
wsBridge.setRecorder(recorder);
launcher.setStore(sessionStore);
launcher.setRecorder(recorder);
launcher.restoreFromDisk();
wsBridge.restoreFromDisk();
sessionStore.purgeGhosts();
containerManager.restoreState(CONTAINER_STATE_PATH);

// Auto-relaunch CLI when a browser connects to a session with no CLI.
// Uses exponential backoff to prevent rapid relaunch loops when a CLI keeps crashing.
const relaunchCooldowns = new Map<string, { until: number; attempts: number }>();
const MAX_RELAUNCH_COOLDOWN = 60_000;

// When the CLI reports its real session_id, re-key the session from temp token
// to the real CLI session ID and reset any relaunch backoff
wsBridge.onCLISessionIdReceived((sessionId, cliSessionId) => {
  // Re-key ws-bridge session if this is a temp token
  if (launcher.isTempToken(sessionId) || sessionId !== cliSessionId) {
    wsBridge.rekeySession(sessionId, cliSessionId);
  }
  // Re-key launcher session and resolve pending launch() Promise
  launcher.setCLISessionId(sessionId, cliSessionId);
  // Update cooldown map key
  const cooldown = relaunchCooldowns.get(sessionId);
  relaunchCooldowns.delete(sessionId);
  if (cooldown && cliSessionId !== sessionId) {
    relaunchCooldowns.set(cliSessionId, cooldown);
  }
});

// When a title is auto-generated from the first user message, update the session
wsBridge.onTitleGeneratedCallback((sessionId, title) => {
  launcher.setTitle(sessionId, title);
  wsBridge.setTitle(sessionId, title);
});

// When a Codex adapter is created, attach it to the WsBridge
launcher.onCodexAdapterCreated((sessionId, adapter) => {
  wsBridge.attachCodexAdapter(sessionId, adapter);
});

// Start watching PRs when git info is resolved for a session
wsBridge.onSessionGitInfoReadyCallback((sessionId, cwd, branch) => {
  prPoller.watch(sessionId, cwd, branch);
});

// Provide session info from the launcher so WsBridge can load CLI history
// for sessions that lost their messageHistory (e.g. after server restart with unflushed writes)
wsBridge.onSessionInfoLookupCallback((sessionId) => {
  const info = launcher.getSession(sessionId);
  if (!info) return null;
  return { cliSessionId: info.cliSessionId, cwd: info.cwd };
});

// Auto-relaunch CLI when a browser connects to a session with no CLI
wsBridge.onCLIRelaunchNeededCallback(async (sessionId) => {
  const now = Date.now();
  const cooldown = relaunchCooldowns.get(sessionId);
  if (cooldown && now < cooldown.until) return;
  let info = launcher.getSession(sessionId);
  if (info?.archived) return;

  // Session exists in ws-bridge but launcher lost track of it (e.g. launcher.json deleted).
  // Adopt it so the relaunch below can proceed.
  if (!info) {
    const bridgeSession = wsBridge.getSession(sessionId);
    if (bridgeSession) {
      launcher.adoptOrphan(sessionId, {
        backendType: bridgeSession.backendType,
        model: bridgeSession.state.model || undefined,
        cwd: bridgeSession.state.cwd || undefined,
        permissionMode: bridgeSession.state.permissionMode || undefined,
      });
      info = launcher.getSession(sessionId);
    }
  }

  if (info && info.state !== "starting") {
    const attempts = (cooldown?.attempts ?? 0) + 1;
    const backoff = Math.min(5_000 * 2 ** (attempts - 1), MAX_RELAUNCH_COOLDOWN);
    relaunchCooldowns.set(sessionId, { until: now + backoff, attempts });
    console.log(`[server] Auto-relaunching CLI for session ${sessionId} (attempt ${attempts}, cooldown ${backoff}ms)`);
    try {
      const result = await launcher.relaunch(sessionId);
      if (!result.ok && result.error) {
        wsBridge.broadcastToSession(sessionId, { type: "error", message: result.error });
      }
    } catch (err) {
      console.error(`[server] Relaunch failed for session ${sessionId}:`, err);
    }
  }
});

// Auto-generate session title after first turn completes
wsBridge.onFirstTurnCompletedCallback(async (sessionId, firstUserMessage) => {
  // Don't overwrite a name that was already set (manual rename or prior auto-name)
  if (sessionNames.getName(sessionId)) return;
  if (!getSettings().openrouterApiKey.trim()) return;
  const info = launcher.getSession(sessionId);
  const model = info?.model || "claude-sonnet-4-6";
  console.log(`[server] Auto-naming session ${sessionId} via OpenRouter with model ${model}...`);
  const title = await generateSessionTitle(firstUserMessage, model);
  // Re-check: a manual rename may have occurred while we were generating
  if (title && !sessionNames.getName(sessionId)) {
    console.log(`[server] Auto-named session ${sessionId}: "${title}"`);
    sessionNames.setName(sessionId, title);
    wsBridge.broadcastNameUpdate(sessionId, title);
  }
});

console.log(`[server] Session persistence: ${sessionStore.directory}`);
if (recorder.isGloballyEnabled()) {
  console.log(`[server] Recording enabled (dir: ${recorder.getRecordingsDir()}, max: ${recorder.getMaxLines()} lines)`);
}

const app = new Hono();

app.use("/api/*", cors());
app.route("/api", createRoutes(launcher, wsBridge, sessionStore, worktreeTracker, terminalManager, prPoller, recorder, cronScheduler));

// In production, serve built frontend using absolute path (works when installed as npm package)
if (process.env.NODE_ENV === "production") {
  const distDir = resolve(packageRoot, "dist");
  app.use("/*", serveStatic({ root: distDir }));
  app.get("/*", serveStatic({ path: resolve(distDir, "index.html") }));
}

const server = Bun.serve<SocketData>({
  port,
  idleTimeout: idleTimeoutSeconds,
  async fetch(req, server) {
    const url = new URL(req.url);

    // ── CLI WebSocket — Claude Code CLI connects here via --sdk-url ────
    const cliMatch = url.pathname.match(/^\/ws\/cli\/([a-f0-9-]+)$/);
    if (cliMatch) {
      const sessionId = cliMatch[1];
      const upgraded = server.upgrade(req, {
        data: { kind: "cli" as const, sessionId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ── Browser WebSocket — connects to a specific session ─────────────
    const browserMatch = url.pathname.match(/^\/ws\/browser\/([a-f0-9-]+)$/);
    if (browserMatch) {
      const sessionId = browserMatch[1];
      const upgraded = server.upgrade(req, {
        data: { kind: "browser" as const, sessionId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ── Terminal WebSocket — embedded terminal PTY connection ─────────
    const termMatch = url.pathname.match(/^\/ws\/terminal\/([a-f0-9-]+)$/);
    if (termMatch) {
      const terminalId = termMatch[1];
      const upgraded = server.upgrade(req, {
        data: { kind: "terminal" as const, terminalId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Hono handles the rest
    return app.fetch(req, server);
  },
  websocket: {
    open(ws: ServerWebSocket<SocketData>) {
      const data = ws.data;
      if (data.kind === "cli") {
        const info = launcher.getSession(data.sessionId);
        wsBridge.handleCLIOpen(ws, data.sessionId, {
          cliSessionId: info?.cliSessionId,
          cwd: info?.cwd,
        });
        launcher.markConnected(data.sessionId);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserOpen(ws, data.sessionId);
      } else if (data.kind === "terminal") {
        terminalManager.addBrowserSocket(ws);
      }
    },
    message(ws: ServerWebSocket<SocketData>, msg: string | Buffer) {
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIMessage(ws, msg);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserMessage(ws, msg);
      } else if (data.kind === "terminal") {
        terminalManager.handleBrowserMessage(ws, msg);
      }
    },
    close(ws: ServerWebSocket<SocketData>) {
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIClose(ws);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserClose(ws);
      } else if (data.kind === "terminal") {
        terminalManager.removeBrowserSocket(ws);
      }
    },
  },
});

console.log(`Server running on http://localhost:${server.port}`);
console.log(`  CLI WebSocket:     ws://localhost:${server.port}/ws/cli/:sessionId`);
console.log(`  Browser WebSocket: ws://localhost:${server.port}/ws/browser/:sessionId`);

if (process.env.NODE_ENV !== "production") {
  console.log("Dev mode: frontend at http://localhost:2345");
}

// ── Cron scheduler ──────────────────────────────────────────────────────────
cronScheduler.startAll();

// ── Image pull manager — pre-pull missing Docker images for environments ────
imagePullManager.initFromEnvironments();

// ── Update checker ──────────────────────────────────────────────────────────
startPeriodicCheck();
if (isRunningAsService()) {
  setServiceMode(true);
  console.log("[server] Running as background service (auto-update available)");
}

// ── Graceful shutdown — persist container state ──────────────────────────────
function gracefulShutdown() {
  console.log("[server] Persisting container state before shutdown...");
  containerManager.persistState(CONTAINER_STATE_PATH);
  process.exit(0);
}
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ── Reconnection watchdog ────────────────────────────────────────────────────
// After a server restart, restored CLI processes may not reconnect their
// WebSocket. Give them a grace period, then kill + relaunch any that are
// still in "starting" state (alive but no WS connection).
const RECONNECT_GRACE_MS = Number(process.env.COMPANION_RECONNECT_GRACE_MS || "30000");
const starting = launcher.getStartingSessions();
if (starting.length > 0) {
  console.log(`[server] Waiting ${RECONNECT_GRACE_MS / 1000}s for ${starting.length} CLI process(es) to reconnect...`);
  setTimeout(async () => {
    const stale = launcher.getStartingSessions();
    for (const info of stale) {
      if (info.archived) continue;
      console.log(`[server] CLI for session ${info.sessionId} did not reconnect, relaunching...`);
      await launcher.relaunch(info.sessionId);
    }
  }, RECONNECT_GRACE_MS);
}
