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
import { COMPANION_HOME } from "./paths.js";
import { TerminalManager } from "./terminal-manager.js";
import { PRPoller } from "./pr-poller.js";
import { RecorderManager } from "./recorder.js";
import { CronScheduler } from "./cron-scheduler.js";
import { AgentExecutor } from "./agent-executor.js";
import { SessionOrchestrator } from "./session-orchestrator.js";
import { migrateCronJobsToAgents } from "./agent-cron-migrator.js";
import { migrateLinearCredentialsToAgents } from "./linear-credential-migration.js";
import { authenticateManagedWebSocket } from "./ws-auth.js";
import { LinearAgentBridge } from "./linear-agent-bridge.js";
import { NoVncProxy } from "./novnc-proxy.js";

import { TunnelManager, getTunnelPort } from "./tunnel-manager.js";
import { getSettings } from "./settings-manager.js";
import * as sessionNames from "./session-names.js";
import { generateSessionTitle } from "./auto-namer.js";
import QRCode from "qrcode";
import { startPeriodicCheck, setServiceMode } from "./update-checker.js";
import { imagePullManager } from "./image-pull-manager.js";
import { restoreIfNeeded as restoreTailscaleFunnel, cleanup as cleanupTailscaleFunnel } from "./tailscale-manager.js";
import { isRunningAsService } from "./service.js";
import { getToken, verifyToken, isAuthEnabled, getLanAddress } from "./auth-manager.js";
import { getCookie, setCookie } from "hono/cookie";
import type { SocketData } from "./ws-bridge.js";
import type { ServerWebSocket } from "bun";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = process.env.__COMPANION_PACKAGE_ROOT || resolve(__dirname, "..");

import { DEFAULT_PORT_DEV, DEFAULT_PORT_PROD, DEFAULT_FRONTEND_PORT_DEV } from "./constants.js";

const defaultPort = process.env.NODE_ENV === "production" ? DEFAULT_PORT_PROD : DEFAULT_PORT_DEV;
const port = Number(process.env.PORT) || defaultPort;
const host = process.env.HOST || "0.0.0.0";
const sessionStore = new SessionStore(process.env.COMPANION_SESSION_DIR);
const wsBridge = new WsBridge();
const launcher = new CliLauncher(port);
const worktreeTracker = new WorktreeTracker();
const CONTAINER_STATE_PATH = join(COMPANION_HOME, "containers.json");
const terminalManager = new TerminalManager();
const noVncProxy = new NoVncProxy();
const prPoller = new PRPoller(wsBridge);
const recorder = new RecorderManager();
const cronScheduler = new CronScheduler(launcher, wsBridge);
const agentExecutor = new AgentExecutor(launcher, wsBridge);
const tunnelManager = new TunnelManager();
const linearAgentBridge = new LinearAgentBridge(agentExecutor, wsBridge);

const orchestrator = new SessionOrchestrator({
  launcher, wsBridge, sessionStore, worktreeTracker,
  prPoller, agentExecutor,
});

// ── Cloud relay connection (for receiving webhooks behind a firewall) ────────
// The relay forwards platform webhooks (e.g. GitHub, Slack) to the Companion
// instance via an outbound WebSocket. Currently no webhook handlers are
// registered (Chat SDK was removed). The relay is left disabled until handlers
// are wired up (e.g. LinearAgentBridge or future platform integrations).
if (process.env.COMPANION_RELAY_URL && process.env.COMPANION_RELAY_SECRET) {
  console.warn(
    "[server] COMPANION_RELAY_URL is set but no relay webhook handlers are registered. " +
    "The relay client will not be started. Remove COMPANION_RELAY_URL/COMPANION_RELAY_SECRET " +
    "or wire up webhook handlers to use relay mode.",
  );
}

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
const MAX_AUTO_RELAUNCHES = 3;
const autoRelaunchCounts = new Map<string, number>();
const relaunchingSet = new Set<string>();

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

// When a CLI/Codex process exits, mark the corresponding agent execution as completed
// and surface startup errors (e.g. consent not accepted) to the browser.
launcher.onSessionExited((sessionId, exitCode, stderr) => {
  agentExecutor.handleSessionExited(sessionId, exitCode);
  // Surface non-zero exits to browsers so users see why their session failed to start
  if (exitCode !== 0 && exitCode !== null) {
    wsBridge.handleSessionStartupError(sessionId, exitCode, stderr);
  }
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

  // Add to set BEFORE the grace period to block concurrent browser connections
  relaunchingSet.add(sessionId);

  // Grace period: CLI does normal code-1000 WS reconnection cycles (~30s).
  // Wait 10s, then check if CLI reconnected or process is still alive.
  await new Promise(r => setTimeout(r, 10000));
  if (wsBridge.isCliConnected(sessionId)) { relaunchingSet.delete(sessionId); return; }
  const freshInfo = launcher.getSession(sessionId);
  if (freshInfo && (freshInfo.state === "connected" || freshInfo.state === "running")) {
    relaunchingSet.delete(sessionId); return;
  }
  // PID liveness check — session state/WS can be stale, but signal 0 is definitive
  if (freshInfo?.pid) {
    try { process.kill(freshInfo.pid, 0); relaunchingSet.delete(sessionId); return; } catch {}
  }
  const count = autoRelaunchCounts.get(sessionId) ?? 0;
  if (count >= MAX_AUTO_RELAUNCHES) {
    console.warn(`[server] Auto-relaunch limit (${MAX_AUTO_RELAUNCHES}) reached for session ${sessionId}, giving up`);
    wsBridge.broadcastToSession(sessionId, {
      type: "error",
      message: "Session keeps crashing. Please relaunch manually.",
    });
    relaunchingSet.delete(sessionId);
    return;
  }

  if (freshInfo && freshInfo.state !== "starting") {
    const attempts = (cooldown?.attempts ?? 0) + 1;
    const backoff = Math.min(5_000 * 2 ** (attempts - 1), MAX_RELAUNCH_COOLDOWN);
    relaunchCooldowns.set(sessionId, { until: now + backoff, attempts });
    autoRelaunchCounts.set(sessionId, count + 1);
    console.log(`[server] Auto-relaunching CLI for session ${sessionId} (attempt ${attempts}, cooldown ${backoff}ms)`);

    try {
      const result = await launcher.relaunch(sessionId);
      if (!result.ok && result.error) {
        wsBridge.broadcastToSession(sessionId, { type: "error", message: result.error });
      } else {
        autoRelaunchCounts.delete(sessionId);
      }
    } catch (err) {
      console.error(`[server] Relaunch failed for session ${sessionId}:`, err);
    }
  } else {
    relaunchingSet.delete(sessionId);
  }
});

// Kill orphaned CLI processes (idle + no browsers for ORPHAN_KILL_MS)
wsBridge.onSessionOrphanedCallback(async (sessionId) => {
  const info = launcher.getSession(sessionId);
  if (info?.archived) return; // already archived
  console.log(`[server] Killing orphaned session ${sessionId}`);
  await launcher.kill(sessionId);
  launcher.setArchived(sessionId, true);
  sessionStore.setArchived(sessionId, true);
});

// Kill CLI when idle with no browsers for 20 minutes
wsBridge.onIdleKillCallback(async (sessionId) => {
  const info = launcher.getSession(sessionId);
  if (!info || info.archived) return;
  console.log(`[server] Idle-killing CLI for session ${sessionId} (no browsers, no activity)`);
  await launcher.kill(sessionId);
});

// Auto-generate session title after first turn completes
wsBridge.onFirstTurnCompletedCallback(async (sessionId, firstUserMessage) => {
  // Don't overwrite a name that was already set via manual rename
  if (sessionNames.getName(sessionId)) return;
  const s = getSettings();
  if (!s.anthropicApiKey.trim() && !s.openaiApiKey.trim() && !s.openrouterApiKey.trim()) return;
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

// ── Health endpoint — always unauthenticated (used by Fly.io + control plane) ─
const startTime = Date.now();
app.get("/health", (c) => {
  return c.json({
    ok: true,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    sessions: launcher.listSessions().length,
  });
});

// ── Managed auth middleware — only active when COMPANION_AUTH_ENABLED=1 ────
const hasManagedAuthSecret = Boolean(process.env.COMPANION_AUTH_SECRET?.trim());
const managedAuthEnabled =
  process.env.COMPANION_AUTH_ENABLED === "1" ||
  (hasManagedAuthSecret && process.env.COMPANION_AUTH_ENABLED !== "0");

if (managedAuthEnabled) {
  const { managedAuth } = await import("./middleware/managed-auth.js");
  app.use("/*", managedAuth);
  console.log("[server] Managed auth enabled");
} else {
  console.log("[server] Managed auth disabled");
}

// Global auth gate: require a valid token for all non-localhost requests when auth is enabled.
// Works with any tunnel (built-in cloudflared/ngrok, SSH, Apache proxy, etc.).
app.use("/*", async (c, next) => {
  if (!isAuthEnabled()) return next();

  // Localhost requests are always trusted — check actual TCP source IP
  const bunServer = c.env as { requestIP?: (req: Request) => { address: string } | null };
  const ip = bunServer?.requestIP?.(c.req.raw);
  const addr = ip?.address ?? "";
  if (addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1") return next();

  // Auth endpoints and well-known must be reachable without login
  const path = new URL(c.req.url).pathname;
  if (path === "/api/auth/verify" || path === "/api/auth/status" || path === "/api/auth/auto") return next();
  if (path.startsWith("/.well-known/")) return next();
  if (path === "/auth") return next();

  // Accept token from cookie, query param (?token=...), or Authorization header
  const cookieToken = getCookie(c, "companion_auth");
  const queryToken = new URL(c.req.url).searchParams.get("token");
  const bearer = c.req.header("Authorization")?.replace(/^Bearer /, "") ?? null;
  const candidate = cookieToken || queryToken || bearer;

  if (verifyToken(candidate)) return next();

  // For API requests, return 401 so the SPA can handle auth via its own LoginPage.
  // For page loads (HTML), let them through — the SPA has its own auth gate and
  // returning an inline login page here causes reload loops on iOS WKWebView
  // (cookie loss on process termination → server returns different HTML → WKWebView
  // recreates view → cookie re-set → reload → loop).
  if (path.startsWith("/api/")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  // Non-API requests (SPA HTML, assets) — let through, the React app handles auth display
  return next();
});

app.use("/api/*", cors());
app.route("/api", createRoutes(orchestrator, launcher, wsBridge, sessionStore, worktreeTracker, terminalManager, prPoller, recorder, cronScheduler, agentExecutor, tunnelManager, linearAgentBridge, port));

// Universal Link handler: /auth?token=xxx
// If Listen app is installed, iOS opens it directly (app reads the token from the URL).
// If not installed, browser lands here and we verify + set cookie + redirect to home.
app.get("/auth", (c) => {
  const token = new URL(c.req.url).searchParams.get("token");
  if (token && verifyToken(token)) {
    setCookie(c, "companion_auth", token, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 365 * 24 * 60 * 60,
    });
    return c.redirect("/");
  }
  return c.redirect("/"); // invalid token → show login page
});

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
  hostname: host,
  port,
  idleTimeout: 0, // Disable top-level idle timeout — it kills idle browser WebSockets (code 1006)
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
      if (managedAuthEnabled) {
        const auth = await authenticateManagedWebSocket(req);
        if (!auth.ok) {
          return new Response(auth.body || "Unauthorized", { status: auth.status });
        }
      } else {
        const wsToken = url.searchParams.get("token");
        // LOCAL: skip auth when disabled
        if (isAuthEnabled() && !isLocalhost && !verifyToken(wsToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
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
      if (managedAuthEnabled) {
        const auth = await authenticateManagedWebSocket(req);
        if (!auth.ok) {
          return new Response(auth.body || "Unauthorized", { status: auth.status });
        }
      } else {
        const wsToken = url.searchParams.get("token");
        // LOCAL: skip auth when disabled
        if (isAuthEnabled() && !isLocalhost && !verifyToken(wsToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      const terminalId = termMatch[1];
      const upgraded = server.upgrade(req, {
        data: { kind: "terminal" as const, terminalId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // ── noVNC WebSocket — proxies VNC data to container's websockify ────
    const novncMatch = url.pathname.match(/^\/ws\/novnc\/([a-f0-9-]+)$/);
    if (novncMatch) {
      if (managedAuthEnabled) {
        const auth = await authenticateManagedWebSocket(req);
        if (!auth.ok) {
          return new Response(auth.body || "Unauthorized", { status: auth.status });
        }
      } else {
        const wsToken = url.searchParams.get("token");
        if (!isLocalhost && !verifyToken(wsToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
      }
      const sessionId = novncMatch[1];
      const upgraded = server.upgrade(req, {
        data: { kind: "novnc" as const, sessionId },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // In dev mode, proxy Vite HMR WebSocket so remote access works on the API port
    if (process.env.NODE_ENV !== "production" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const upgraded = server.upgrade(req, {
        data: { kind: "vite-hmr" as const, upstream: null },
      });
      if (upgraded) return undefined;
    }

    // Hono handles the rest
    return app.fetch(req, server);
  },
  websocket: {
    idleTimeout: 0,
    sendPings: false, // Disable Bun ping timeout that kills CLI connections (code 1006)
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
      } else if (data.kind === "novnc") {
        noVncProxy.handleOpen(ws, data.sessionId);
      } else if (data.kind === "vite-hmr") {
        // Proxy Vite HMR WebSocket: connect upstream to the real Vite dev server
        const vitePort = Number(process.env.VITE_PORT) || DEFAULT_FRONTEND_PORT_DEV;
        const upstream = new WebSocket(`ws://localhost:${vitePort}/`);
        data.upstream = upstream;
        upstream.addEventListener("message", (e) => {
          try { ws.send(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer)); } catch {}
        });
        upstream.addEventListener("close", () => { try { ws.close(); } catch {} });
        upstream.addEventListener("error", () => { try { ws.close(); } catch {} });
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
      } else if (data.kind === "novnc") {
        noVncProxy.handleMessage(ws, msg);
      } else if (data.kind === "vite-hmr" && data.upstream) {
        if (data.upstream.readyState === WebSocket.OPEN) {
          data.upstream.send(typeof msg === "string" ? msg : new Uint8Array(msg));
        }
      }
    },
    close(ws: ServerWebSocket<SocketData>, code?: number, reason?: string) {
      console.log("[ws-close]", ws.data.kind, "code=" + code);
      const data = ws.data;
      if (data.kind === "cli") {
        wsBridge.handleCLIClose(ws);
      } else if (data.kind === "browser") {
        wsBridge.handleBrowserClose(ws);
      } else if (data.kind === "terminal") {
        terminalManager.removeBrowserSocket(ws);
      } else if (data.kind === "novnc") {
        noVncProxy.handleClose(ws);
      } else if (data.kind === "vite-hmr" && data.upstream) {
        try { data.upstream.close(); } catch {}
      }
    },
  },
});

console.log(`Server running on http://${host}:${server.port}`);
console.log();
if (isAuthEnabled()) {
  const authToken = getToken();
  console.log(`  Auth: ENABLED`);
  console.log(`  Auth token: ${authToken}`);
  if (process.env.COMPANION_AUTH_TOKEN) {
    console.log("  (using COMPANION_AUTH_TOKEN env var)");
  }
} else {
  console.log(`  Auth: DISABLED (toggle in settings or set COMPANION_AUTH=1)`);
}
console.log();
console.log(`  CLI WebSocket:     ws://localhost:${server.port}/ws/cli/:sessionId`);
console.log(`  Browser WebSocket: ws://localhost:${server.port}/ws/browser/:sessionId`);

if (process.env.NODE_ENV !== "production") {
  const vitePort = Number(process.env.VITE_PORT) || DEFAULT_FRONTEND_PORT_DEV;
  console.log(`Dev mode: Vite at http://localhost:${vitePort} (proxied through :${server.port})`);
}

// ── QR code helper ───────────────────────────────────────────────────────────
async function printQR(url: string, label?: string): Promise<void> {
  try {
    const qr = await QRCode.toString(url, { type: "terminal", small: true });
    if (label) console.log(label);
    console.log(qr);
  } catch (err) {
    console.error("[qr] Failed to generate QR code:", err);
  }
}

// ── Auto-tunnel ─────────────────────────────────────────────────────────────
const tunnelEnv = process.env.COMPANION_TUNNEL;
const tunnelSetting = getSettings().tunnelEnabled;
if (tunnelEnv === "1" || tunnelEnv === "true" || tunnelSetting) {
  tunnelManager.start(getTunnelPort()).then(({ url }) => {
    const authUrl = `${url}/?token=${getToken()}`;
    printQR(authUrl, `\n  Scan to open (tunnel):`);
  }).catch((err) => {
    console.error(`[tunnel] Failed to start: ${err.message}`);
  });
} else if (isAuthEnabled()) {
  const lanIp = getLanAddress();
  if (lanIp !== "localhost") {
    const authUrl = `http://${lanIp}:${server.port}/auth?token=${getToken()}`;
    printQR(authUrl, `\n  Scan to open (LAN):`);
  }
}

// ── Cron scheduler ──────────────────────────────────────────────────────────
cronScheduler.startAll();

// ── Agent system ────────────────────────────────────────────────────────────
migrateCronJobsToAgents();
migrateLinearCredentialsToAgents();
agentExecutor.startAll();

// ── Image pull manager — pre-pull missing Docker images for environments ────
imagePullManager.initFromEnvironments();

// ── Tailscale Funnel restoration ────────────────────────────────────────────
restoreTailscaleFunnel(port).catch((err) => {
  console.warn("[server] Tailscale Funnel restoration failed:", err);
});

// ── Update checker ──────────────────────────────────────────────────────────
startPeriodicCheck();
if (isRunningAsService()) {
  setServiceMode(true);
  console.log("[server] Running as background service (auto-update available)");
}

// ── Memory diagnostics ───────────────────────────────────────────────────────
const MEMORY_LOG_INTERVAL_MS = 5 * 60_000; // every 5 minutes
setInterval(() => {
  const mem = process.memoryUsage();
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  const sessionStats = wsBridge.getSessionMemoryStats();
  const totalHistory = sessionStats.reduce((sum, s) => sum + s.historyLen, 0);
  const topSessions = sessionStats
    .sort((a, b) => b.historyLen - a.historyLen)
    .slice(0, 3)
    .map((s) => `${s.id.slice(0, 8)}(h=${s.historyLen},b=${s.browsers})`)
    .join(", ");
  console.log(
    `[mem] rss=${mb(mem.rss)}MB heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)}MB ` +
    `ext=${mb(mem.external)}MB | ${sessionStats.length} sessions, ${totalHistory} history msgs | top: ${topSessions || "none"}`,
  );
}, MEMORY_LOG_INTERVAL_MS);

// ── Graceful shutdown — persist container state ──────────────────────────────
function gracefulShutdown() {
  tunnelManager.stop().catch(() => {});
  console.log("[server] Persisting container state before shutdown...");
  containerManager.persistState(CONTAINER_STATE_PATH);
  cleanupTailscaleFunnel(port);
  process.exit(0);
}
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

