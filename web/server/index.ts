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
import { cacheControlMiddleware } from "./cache-headers.js";
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
import { AgentExecutor } from "./agent-executor.js";
import { migrateCronJobsToAgents } from "./agent-cron-migrator.js";

import { startPeriodicCheck, setServiceMode } from "./update-checker.js";
import { imagePullManager } from "./image-pull-manager.js";
import { isRunningAsService } from "./service.js";
import { getToken, verifyToken, isAuthEnabled } from "./auth-manager.js";
import { getCookie } from "hono/cookie";
import type { SocketData } from "./ws-bridge.js";
import type { ServerWebSocket } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = process.env.__COMPANION_PACKAGE_ROOT || resolve(__dirname, "..");

import { DEFAULT_PORT_DEV, DEFAULT_PORT_PROD, DEFAULT_FRONTEND_PORT_DEV } from "./constants.js";

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
const agentExecutor = new AgentExecutor(launcher, wsBridge);

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

// When the CLI reports its internal session_id, store it for --resume on relaunch
// and reset any relaunch backoff since the CLI is now healthy
wsBridge.onCLISessionIdReceived((sessionId, cliSessionId) => {
  launcher.setCLISessionId(sessionId, cliSessionId);
  relaunchCooldowns.delete(sessionId);
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
  // Fall back to resumeSessionAt: for resumed sessions, cliSessionId isn't set until
  // system.init arrives (which requires user input), but we need the ID now to load history.
  return { cliSessionId: info.cliSessionId || info.resumeSessionAt, cwd: info.cwd };
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
        cliSessionId: bridgeSession.cliSessionId,
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
  // Don't overwrite a name that was already set via manual rename
  if (sessionNames.getName(sessionId)) return;
  const s = getSettings();
  if (!s.anthropicApiKey.trim() && !s.openaiApiKey.trim()) return;
  console.log(`[server] Auto-naming session ${sessionId}...`);
  const title = await generateSessionTitle(firstUserMessage);
  // Re-check: a manual rename may have occurred while we were generating
  if (title && !sessionNames.getName(sessionId)) {
    console.log(`[server] Auto-named session ${sessionId}: "${title}"`);
    sessionNames.setName(sessionId, title);
    // Use setTitle (not broadcastNameUpdate) so the browser updates sdkSessions[i].title,
    // which takes priority over sessionName in SessionItem rendering.
    launcher.setTitle(sessionId, title);
    wsBridge.setTitle(sessionId, title);
  }
});

console.log(`[server] Session persistence: ${sessionStore.directory}`);
if (recorder.isGloballyEnabled()) {
  console.log(`[server] Recording enabled (dir: ${recorder.getRecordingsDir()}, max: ${recorder.getMaxLines()} lines)`);
}

const app = new Hono();

// Global auth gate: block all tunnel traffic that lacks a valid token.
// Tunnel requests are identified by the X-Companion-Tunnel header injected by Apache.
// Direct localhost requests are always trusted (no header = not via tunnel).
app.use("/*", async (c, next) => {
  if (!isAuthEnabled()) return next();
  if (!c.req.header("X-Companion-Tunnel")) return next();

  // Auth endpoints must be reachable to complete login
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/verify" || path === "/api/auth/status") return next();

  // Accept token from cookie, query param (?token=...), or Authorization header
  const cookieToken = getCookie(c, "companion_auth");
  const queryToken = new URL(c.req.url).searchParams.get("token");
  const bearer = c.req.header("Authorization")?.replace(/^Bearer /, "") ?? null;
  const candidate = cookieToken || queryToken || bearer;

  if (verifyToken(candidate)) return next();

  // Unauthenticated tunnel request — show minimal login page (no-store so reload after login works)
  c.header("Cache-Control", "no-store");
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Companion — Login</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#1a1917;color:#e8e6e0;font-family:system-ui,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    form{background:#262624;border:1px solid #3a3835;border-radius:12px;
         padding:2rem;width:min(360px,90vw);display:flex;flex-direction:column;gap:1rem}
    h1{font-size:1.1rem;font-weight:600;color:#d97757}
    input{background:#1a1917;border:1px solid #3a3835;border-radius:6px;
          color:#e8e6e0;font-size:1rem;padding:.6rem .8rem;width:100%}
    input:focus{outline:2px solid #d97757;border-color:transparent}
    button{background:#d97757;border:none;border-radius:6px;color:#fff;
           cursor:pointer;font-size:1rem;font-weight:600;padding:.7rem}
    button:hover{background:#c4663e}
    #err{color:#e05c5c;font-size:.85rem;display:none}
    .hint{font-size:.8rem;color:#666;text-align:center}
    .hint a{color:#d97757;text-decoration:none}
    .hint a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <form id="f">
    <h1>The Companion</h1>
    <input id="t" type="password" placeholder="Auth token" autocomplete="current-password" autofocus>
    <button type="submit">Sign in</button>
    <div id="err">Invalid token</div>
    <p class="hint"><a href="http://localhost:3456/api/auth/token-page" target="_blank">Get token →</a></p>
  </form>
  <script>
    document.getElementById('f').onsubmit = async e => {
      e.preventDefault();
      const token = document.getElementById('t').value.trim();
      const r = await fetch('/api/auth/verify', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({token})
      });
      if (r.ok) location.reload();
      else { document.getElementById('err').style.display='block'; }
    };
  </script>
</body>
</html>`, 401);
});

app.use("/api/*", cors());
app.route("/api", createRoutes(launcher, wsBridge, sessionStore, worktreeTracker, terminalManager, prPoller, recorder, cronScheduler, agentExecutor));

// Dynamic manifest — embeds auth token in start_url so PWA auto-authenticates
// on first launch. iOS gives standalone PWAs isolated storage from Safari,
// so this is the only way to bridge auth across the install boundary.
app.get("/manifest.json", (c) => {
  const manifest = {
    name: "The Companion",
    short_name: "Companion",
    description: "Web UI for Claude Code and Codex",
    start_url: "/",
    scope: "/",
    display: "standalone" as const,
    background_color: "#262624",
    theme_color: "#d97757",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  // If the user has an auth cookie (set during login), embed token in start_url.
  // Safari sends this cookie when fetching the manifest at "Add to Home Screen" time.
  const authCookie = getCookie(c, "companion_auth");
  if (authCookie && verifyToken(authCookie)) {
    manifest.start_url = `/?token=${authCookie}`;
  } else {
    // Localhost bypass — always embed the token for same-machine installs
    const bunServer = c.env as { requestIP?: (req: Request) => { address: string } | null };
    const ip = bunServer?.requestIP?.(c.req.raw);
    const addr = ip?.address ?? "";
    if (addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1") {
      manifest.start_url = `/?token=${getToken()}`;
    }
  }

  c.header("Content-Type", "application/manifest+json");
  return c.json(manifest);
});

// In production, serve built frontend using absolute path (works when installed as npm package)
if (process.env.NODE_ENV === "production") {
  const distDir = resolve(packageRoot, "dist");
  app.use("/*", cacheControlMiddleware());
  app.use("/*", serveStatic({ root: distDir }));
  app.get("/*", serveStatic({ path: resolve(distDir, "index.html") }));
} else {
  // In dev mode, proxy all frontend requests to the Vite dev server so the API
  // port (3456) also serves the UI — enabling QR code access from phones on LAN.
  const vitePort = Number(process.env.VITE_PORT) || DEFAULT_FRONTEND_PORT_DEV;
  app.all("/*", async (c) => {
    const url = new URL(c.req.url);
    const viteUrl = `http://localhost:${vitePort}${url.pathname}${url.search}`;
    try {
      // Rewrite Host so Vite's allowedHosts check sees localhost (not the
      // phone's LAN IP), which would otherwise trigger a 403 → retry loop.
      const headers = new Headers(c.req.raw.headers);
      headers.set("Host", `localhost:${vitePort}`);
      const resp = await fetch(viteUrl, {
        method: c.req.method,
        headers,
        body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
      });
      return new Response(resp.body, { status: resp.status, headers: resp.headers });
    } catch {
      return c.text(`Vite dev server not reachable on port ${vitePort}`, 503);
    }
  });
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

    // Helper: check if request is from localhost (same machine)
    const reqIp = server.requestIP(req);
    const reqAddr = reqIp?.address ?? "";
    const isLocalhost = reqAddr === "127.0.0.1" || reqAddr === "::1" || reqAddr === "::ffff:127.0.0.1";

    // ── Browser WebSocket — connects to a specific session ─────────────
    const browserMatch = url.pathname.match(/^\/ws\/browser\/([a-f0-9-]+)$/);
    if (browserMatch) {
      const wsToken = url.searchParams.get("token");
      // LOCAL: skip auth when disabled
      if (isAuthEnabled() && !isLocalhost && !verifyToken(wsToken)) {
        return new Response("Unauthorized", { status: 401 });
      }
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
      const wsToken = url.searchParams.get("token");
      // LOCAL: skip auth when disabled
      if (isAuthEnabled() && !isLocalhost && !verifyToken(wsToken)) {
        return new Response("Unauthorized", { status: 401 });
      }
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
          // Same resumeSessionAt fallback: lets handleCLIOpen load history on CLI reconnect
          cliSessionId: info?.cliSessionId || info?.resumeSessionAt,
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
console.log();
if (isAuthEnabled()) {
  const authToken = getToken();
  console.log(`  Auth: ENABLED`);
  console.log(`  Auth token: ${authToken}`);
  if (process.env.COMPANION_AUTH_TOKEN) {
    console.log("  (using COMPANION_AUTH_TOKEN env var)");
  }
} else {
  console.log(`  Auth: DISABLED (set COMPANION_AUTH=1 to enable)`);
}
console.log();
console.log(`  CLI WebSocket:     ws://localhost:${server.port}/ws/cli/:sessionId`);
console.log(`  Browser WebSocket: ws://localhost:${server.port}/ws/browser/:sessionId`);

if (process.env.NODE_ENV !== "production") {
  const vitePort = Number(process.env.VITE_PORT) || DEFAULT_FRONTEND_PORT_DEV;
  console.log(`Dev mode: Vite at http://localhost:${vitePort} (proxied through :${server.port})`);
}

// ── Cron scheduler ──────────────────────────────────────────────────────────
cronScheduler.startAll();

// ── Agent system ────────────────────────────────────────────────────────────
migrateCronJobsToAgents();
agentExecutor.startAll();

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
