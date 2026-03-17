import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { execSync } from "node:child_process";
import { resolveBinary } from "./path-resolver.js";
import { getTunnelPort } from "./tunnel-manager.js";
import { readdir, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { COMPANION_HOME } from "./paths.js";
import { existsSync, readFileSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { SessionOrchestrator } from "./session-orchestrator.js";
import type { CliLauncher } from "./cli-launcher.js";
import type { WsBridge } from "./ws-bridge.js";
import { stripSystemTags } from "./ws-bridge.js";
import type { SessionStore } from "./session-store.js";
import type { WorktreeTracker } from "./worktree-tracker.js";
import type { TerminalManager } from "./terminal-manager.js";
import * as gitUtils from "./git-utils.js";
import * as sessionNames from "./session-names.js";
import * as sessionLinearIssues from "./session-linear-issues.js";
import { containerManager } from "./container-manager.js";
import { registerFsRoutes } from "./routes/fs-routes.js";
import { registerPanelRoutes } from "./routes/panels-routes.js";
import { registerEnvRoutes } from "./routes/env-routes.js";
import { registerSandboxRoutes } from "./routes/sandbox-routes.js";
import { registerCronRoutes } from "./routes/cron-routes.js";
import { registerAgentRoutes } from "./routes/agent-routes.js";
import { registerSystemCronRoutes } from "./routes/system-cron-routes.js";
import { registerMetricsRoutes } from "./routes/metrics-routes.js";
import { registerLinearAgentWebhookRoute, registerLinearAgentProtectedRoutes } from "./routes/linear-agent-routes.js";
import { registerPromptRoutes } from "./routes/prompt-routes.js";
import { registerSettingsRoutes } from "./routes/settings-routes.js";
import { registerProxyRoutes } from "./routes/proxy-routes.js";
import { registerTailscaleRoutes } from "./routes/tailscale-routes.js";
import { registerGitRoutes } from "./routes/git-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerLinearRoutes, transitionLinearIssue, fetchLinearTeamStates } from "./routes/linear-routes.js";
import { registerCompleteRoutes } from "./routes/complete-routes.js";
import { registerLinearConnectionRoutes } from "./routes/linear-connection-routes.js";
import { getConnection, listConnections, resolveApiKey } from "./linear-connections.js";
import { getSettings, updateSettings } from "./settings-manager.js";
import { discoverClaudeSessions } from "./claude-session-discovery.js";
import { getClaudeSessionHistoryPage } from "./claude-session-history.js";
import { verifyToken, getToken, getLanAddress, regenerateToken, getAllAddresses, isAuthEnabled } from "./auth-manager.js";
import QRCode from "qrcode";
import { isHomeServer, VSCODE_EDITOR_CONTAINER_PORT, NOVNC_CONTAINER_PORT } from "./constants.js";

const UPDATE_CHECK_STALE_MS = 5 * 60 * 1000;
const ROUTES_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = dirname(ROUTES_DIR);
const VSCODE_EDITOR_HOST_PORT = Number(process.env.COMPANION_EDITOR_PORT || "13338");

function shellEscapeArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createRoutes(
  orchestrator: SessionOrchestrator,
  launcher: CliLauncher,
  wsBridge: WsBridge,
  sessionStore: SessionStore,
  worktreeTracker: WorktreeTracker,
  terminalManager: TerminalManager,
  prPoller?: import("./pr-poller.js").PRPoller,
  recorder?: import("./recorder.js").RecorderManager,
  cronScheduler?: import("./cron-scheduler.js").CronScheduler,
  agentExecutor?: import("./agent-executor.js").AgentExecutor,
  tunnelManager?: import("./tunnel-manager.js").TunnelManager,
  linearAgentBridge?: import("./linear-agent-bridge.js").LinearAgentBridge,
  port?: number,
) {
  const api = new Hono();

  // ─── Health check (used by dev.ts auto-restart) ────────────────────
  api.get("/health", (c) => c.json({ ok: true }));

  // ─── Auth endpoints (exempt from auth middleware) ──────────────────

  api.post("/auth/verify", async (c) => {
    const body = await c.req.json().catch(() => ({} as { token?: string }));
    if (verifyToken(body.token)) {
      setCookie(c, "companion_auth", body.token!, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 365 * 24 * 60 * 60,
      });
      return c.json({ ok: true });
    }
    return c.json({ error: "Invalid token" }, 401);
  });

  // DONE: /auth/token-page removed — unified into LoginPage.tsx (shows QR on localhost)

  async function buildQrCodes(port: number, authToken: string) {
    const addresses = getAllAddresses().filter((a) => a.ip !== "localhost");
    const qrCodes = await Promise.all(
      addresses.map(async (a) => {
        const loginUrl = `http://${a.ip}:${port}/?token=${authToken}`;
        const qrDataUrl = await QRCode.toDataURL(loginUrl, { width: 256, margin: 2 });
        return { label: a.label, url: `http://${a.ip}:${port}`, qrDataUrl };
      }),
    );
    if (isHomeServer()) {
      const universalUrl = `https://claude.pannous.com/auth?token=${authToken}`;
      const universalQr = await QRCode.toDataURL(universalUrl, { width: 256, margin: 2 });
      qrCodes.unshift({ label: "Listen App / Browser", url: "https://claude.pannous.com", qrDataUrl: universalQr });
    }
    return { qrCodes };
  }

  api.get("/auth/qr", async (c) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!isLocalhostRequest(c) && !verifyToken(token)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json(await buildQrCodes(Number(process.env.PORT) || 3456, getToken()));
  });

  // ─── Localhost auto-auth (exempt from auth middleware) ────────────
  function isLocalhostRequest(c: { env: unknown; req: { raw: Request; header: (name: string) => string | undefined } }): boolean {
    if (c.req.header("X-Companion-Tunnel")) return false;
    const bunServer = c.env as { requestIP?: (req: Request) => { address: string } | null };
    const ip = bunServer?.requestIP?.(c.req.raw);
    const addr = ip?.address ?? "";
    return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  }

  api.get("/auth/auto", (c) => {
    if (!isAuthEnabled() || isLocalhostRequest(c)) {
      const token = getToken();
      setCookie(c, "companion_auth", token, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 365 * 24 * 60 * 60,
      });
      return c.json({ ok: true, token });
    }
    const cookieToken = getCookie(c, "companion_auth");
    if (cookieToken && verifyToken(cookieToken)) {
      return c.json({ ok: true, token: cookieToken });
    }
    return c.json({ ok: false });
  });

  api.get("/auth/status", (c) => {
    return c.json({ enabled: isAuthEnabled() });
  });

  // ─── Linear Agent SDK webhook route (exempt from auth middleware) ────────
  if (linearAgentBridge) {
    registerLinearAgentWebhookRoute(api, linearAgentBridge);
  }

  // ─── Auth middleware (protects all routes below) ───────────────────

  api.use("/*", async (c, next) => {
    if (!isAuthEnabled()) return next();

    if (c.req.path === "/auth/verify") {
      return next();
    }

    if (isLocalhostRequest(c)) {
      return next();
    }

    const authHeader = c.req.header("Authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieToken = getCookie(c, "companion_auth") ?? null;
    const queryToken = new URL(c.req.url).searchParams.get("token") ?? null;
    if (!verifyToken(bearer) && !verifyToken(cookieToken) && !verifyToken(queryToken)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  });

  // ─── Linear Agent SDK protected routes (status, authorize URL, disconnect) ─────
  registerLinearAgentProtectedRoutes(api);

  // ─── Auth management (protected) ──────────────────────────────────

  api.get("/auth/token", (c) => {
    return c.json({ token: getToken() });
  });

  api.post("/auth/regenerate", (c) => {
    const token = regenerateToken();
    return c.json({ token });
  });

  // ─── SDK Sessions (--sdk-url) ─────────────────────────────────────

  api.post("/sessions/create", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await orchestrator.createSession(body);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }
    wsBridge.broadcastGlobal({ type: "sessions_updated" });
    return c.json(result.session);
  });

  // ─── SSE Session Creation (with progress streaming) ─────────────────────

  api.post("/sessions/create-stream", async (c) => {
    const body = await c.req.json().catch(() => ({}));

    return streamSSE(c, async (stream) => {
      const result = await orchestrator.createSessionStreaming(
        body,
        async (step, label, status, detail) => {
          await stream.writeSSE({
            event: "progress",
            data: JSON.stringify({ step, label, status, detail }),
          });
        },
      );

      if (!result.ok) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: result.error }),
        });
        return;
      }

      wsBridge.broadcastGlobal({ type: "sessions_updated" });

      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          sessionId: result.session.sessionId,
          state: result.session.state,
          cwd: result.session.cwd,
          backendType: result.session.backendType,
          resumeSessionAt: result.session.resumeSessionAt,
          forkSession: result.session.forkSession,
        }),
      });
    });
  });

  api.get("/sessions", (c) => {
    const allSessions = launcher.listSessions();
    const names = sessionNames.getAllNames();
    const bridgeStates = wsBridge.getAllSessions();
    const bridgeMap = new Map(bridgeStates.map((s) => [s.session_id, s]));
    const now = Date.now();
    const sessions = allSessions.filter((s) => {
      if (s.state === "connected" && !s.name && !s.title && !names[s.sessionId]) {
        if (wsBridge.hasBrowsers(s.sessionId)) return true;
        const bridge = bridgeMap.get(s.sessionId);
        if ((bridge?.num_turns ?? 0) === 0 && now - s.createdAt > 120_000) return false;
      }
      return true;
    });
    const enriched = sessions.map((s) => {
      const bridge = bridgeMap.get(s.sessionId);
      return {
        ...s,
        cwd: bridge?.cwd || s.cwd,
        name: names[s.sessionId] ?? s.name,
        title: s.title ? stripSystemTags(s.title) : s.title,
        gitBranch: bridge?.git_branch || "",
        gitAhead: bridge?.git_ahead || 0,
        gitBehind: bridge?.git_behind || 0,
        totalLinesAdded: bridge?.total_lines_added || 0,
        totalLinesRemoved: bridge?.total_lines_removed || 0,
      };
    });
    return c.json(enriched);
  });

  api.get("/sessions/resumable", async (c) => {
    try {
      const discovered = discoverClaudeSessions({ limit: 40 });

      const TARGET = 16;
      const results: { sessionId: string; project: string; lastModified: number; title: string }[] = [];
      for (const session of discovered) {
        if (results.length >= TARGET) break;
        const title = await extractSessionTitle(session.sourceFile);
        results.push({
          sessionId: session.sessionId,
          project: session.cwd,
          lastModified: session.lastActivityAt,
          title: title || session.sessionId.slice(0, 12),
        });
      }

      return c.json(results);
    } catch (e: unknown) {
      console.error("[routes] Failed to list resumable sessions:", e);
      return c.json([], 500);
    }
  });

  api.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const wsBridgeSession = wsBridge.getSession(id);
    const enriched = {
      ...session,
      messageHistory: wsBridgeSession?.messageHistory || []
    };
    return c.json(enriched);
  });

  api.get("/sessions/:id/tool-result/:toolUseId", (c) => {
    const id = c.req.param("id");
    const toolUseId = c.req.param("toolUseId");
    const result = wsBridge.getToolResult(id, toolUseId);
    if (!result) return c.json({ error: "Tool result not found" }, 404);
    return c.json(result);
  });

  api.get("/claude/sessions/discover", (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const sessions = discoverClaudeSessions({ limit });
    return c.json({ sessions });
  });

  api.get("/claude/sessions/:id/history", (c) => {
    const sessionId = c.req.param("id");
    const limitRaw = c.req.query("limit");
    const cursorRaw = c.req.query("cursor");
    const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
    const cursor = cursorRaw !== undefined ? Number(cursorRaw) : undefined;

    const page = getClaudeSessionHistoryPage({
      sessionId,
      limit,
      cursor,
    });
    if (!page) {
      return c.json({ error: "Claude session history not found" }, 404);
    }
    return c.json(page);
  });

  api.post("/sessions/:id/editor/start", async (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    let hostFallbackCwd = session.cwd;

    if (session.containerId) {
      const container = containerManager.getContainer(id);
      const hasContainerCodeServer = container
        && containerManager.hasBinaryInContainer(container.containerId, "code-server");

      if (container && hasContainerCodeServer) {
        const editorPathSuffix = `?folder=${encodeURIComponent("/workspace")}`;
        const portMapping = container.portMappings.find(
          (p) => p.containerPort === VSCODE_EDITOR_CONTAINER_PORT,
        );
        if (!portMapping) {
          return c.json({
            available: false,
            installed: true,
            mode: "container",
            message: "Container editor port is missing. Start a new session to enable the VS Code editor.",
          });
        }

        try {
          const alive = containerManager.isContainerAlive(container.containerId);
          if (alive === "stopped") {
            containerManager.startContainer(container.containerId);
          } else if (alive === "missing") {
            return c.json({
              available: false,
              installed: true,
              mode: "container",
              message: "Session container no longer exists. Start a new session to use the editor.",
            });
          }

          const startCmd = [
            `if ! pgrep -f ${shellEscapeArg(`code-server.*--bind-addr 0.0.0.0:${VSCODE_EDITOR_CONTAINER_PORT}`)} >/dev/null 2>&1; then`,
            `nohup code-server --auth none --disable-telemetry --bind-addr 0.0.0.0:${VSCODE_EDITOR_CONTAINER_PORT} /workspace >/tmp/companion-code-server.log 2>&1 &`,
            "fi",
          ].join(" ");
          containerManager.execInContainer(container.containerId, ["sh", "-lc", startCmd], 10_000);

          const containerEditorUrl = `http://localhost:${portMapping.hostPort}${editorPathSuffix}`;
          for (let i = 0; i < 25; i++) {
            try {
              const res = await fetch(`http://127.0.0.1:${portMapping.hostPort}/healthz`);
              if (res.ok || res.status === 302 || res.status === 200) break;
            } catch {
              // not ready yet
            }
            await new Promise((r) => setTimeout(r, 200));
          }

          return c.json({
            available: true,
            installed: true,
            mode: "container",
            url: containerEditorUrl,
          });
        } catch (e) {
          const message = getErrorMessage(e);
          return c.json({
            available: false,
            installed: true,
            mode: "container",
            message: `Failed to start VS Code editor in container: ${message}`,
          });
        }
      }

      if (container) {
        hostFallbackCwd = container.hostCwd;
      }
    }

    const hostCodeServer = resolveBinary("code-server");
    if (!hostCodeServer) {
      return c.json({
        available: false,
        installed: false,
        mode: "host",
        message: "VS Code editor is not installed. Install it with: brew install code-server",
      });
    }

    const editorPathSuffix = `?folder=${encodeURIComponent(hostFallbackCwd)}`;

    try {
      const logFile = join(COMPANION_HOME, "code-server-host.log");
      const startCmd = [
        `if ! pgrep -f ${shellEscapeArg(`code-server.*--bind-addr 127.0.0.1:${VSCODE_EDITOR_HOST_PORT}`)} >/dev/null 2>&1; then`,
        `nohup ${shellEscapeArg(hostCodeServer)} --auth none --disable-telemetry --bind-addr 127.0.0.1:${VSCODE_EDITOR_HOST_PORT} ${shellEscapeArg(hostFallbackCwd)} >> ${shellEscapeArg(logFile)} 2>&1 &`,
        "fi",
      ].join(" ");
      const startHostCmd = `mkdir -p ${shellEscapeArg(COMPANION_HOME)} && ${startCmd}`;
      execSync(startHostCmd, { encoding: "utf-8", timeout: 10_000 });

      const editorUrl = `http://localhost:${VSCODE_EDITOR_HOST_PORT}${editorPathSuffix}`;
      for (let i = 0; i < 25; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${VSCODE_EDITOR_HOST_PORT}/healthz`);
          if (res.ok || res.status === 302 || res.status === 200) break;
        } catch {
          // not ready yet
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      return c.json({
        available: true,
        installed: true,
        mode: "host",
        url: editorUrl,
      });
    } catch (e) {
      const message = getErrorMessage(e);
      return c.json({
        available: false,
        installed: true,
        mode: "host",
        message: `Failed to start VS Code editor: ${message}`,
      });
    }
  });

  // ── Browser preview ──────────────────────────────────────────────────────

  api.post("/sessions/:id/browser/start", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({} as { url?: string }));
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    if (!session.containerId) {
      return c.json({
        available: true,
        mode: "host" as const,
      });
    }

    const container = containerManager.getContainer(id);
    if (!container) {
      return c.json({
        available: false,
        mode: "container" as const,
        message: "Container not found for this session.",
      });
    }

    const alive = containerManager.isContainerAlive(container.containerId);
    if (alive === "stopped") {
      containerManager.startContainer(container.containerId);
    } else if (alive === "missing") {
      return c.json({
        available: false,
        mode: "container" as const,
        message: "Session container no longer exists.",
      });
    }

    const portMapping = container.portMappings.find(
      (p) => p.containerPort === NOVNC_CONTAINER_PORT,
    );
    if (!portMapping) {
      return c.json({
        available: false,
        mode: "container" as const,
        message: "Browser preview port not mapped. Start a new session to enable browser preview.",
      });
    }

    const hasXvfb = containerManager.hasBinaryInContainer(container.containerId, "Xvfb");
    const hasWebsockify = containerManager.hasBinaryInContainer(container.containerId, "websockify");
    if (!hasXvfb || !hasWebsockify) {
      return c.json({
        available: false,
        mode: "container" as const,
        message: "Browser preview requires Xvfb and noVNC in the container image. Rebuild with the latest iclaude image.",
      });
    }

    try {
      const startScript = [
        "export DISPLAY=:99",
        'if ! pgrep -f "Xvfb :99" >/dev/null 2>&1; then',
        "  Xvfb :99 -screen 0 1280x720x24 -ac -nolisten tcp &",
        "  sleep 0.5",
        "  fluxbox -display :99 &>/dev/null &",
        "  sleep 0.3",
        "  x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -noxdamage -wait 20 &>/dev/null &",
        "  sleep 0.3",
        "  websockify --web /usr/share/novnc/ 6080 localhost:5900 &>/dev/null &",
        "  sleep 1.0",
        "fi",
      ].join("\n");

      await containerManager.execInContainerAsync(
        container.containerId,
        ["sh", "-c", startScript],
        { timeout: 15_000 },
      );

      let targetUrl = "about:blank";
      if (body.url && typeof body.url === "string") {
        try {
          const parsed = new URL(body.url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return c.json({
              available: false,
              mode: "container" as const,
              message: "Only http:// and https:// URLs are allowed.",
            });
          }
          targetUrl = body.url;
        } catch {
          return c.json({
            available: false,
            mode: "container" as const,
            message: "Invalid URL provided.",
          });
        }
      }
      const launchChrome = [
        "export DISPLAY=:99",
        'if ! pgrep -f "chromium.*--user-data-dir=/tmp/companion-chrome" >/dev/null 2>&1; then',
        `  nohup chromium --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/companion-chrome --window-size=1280,720 --window-position=0,0 ${shellEscapeArg(targetUrl)} &>/dev/null &`,
        "fi",
      ].join("\n");

      await containerManager.execInContainerAsync(
        container.containerId,
        ["sh", "-c", launchChrome],
        { timeout: 10_000 },
      );

      let noVncReady = false;
      for (let i = 0; i < 50; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${portMapping.hostPort}/`);
          if (res.ok || res.status === 200) {
            noVncReady = true;
            break;
          }
        } catch {
          // not ready yet
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      if (!noVncReady) {
        return c.json({
          available: false,
          mode: "container" as const,
          message: "Browser preview timed out waiting for noVNC to start.",
        });
      }

      const proxyBase = `/api/sessions/${encodeURIComponent(id)}/browser/proxy`;
      const noVncUrl = `${proxyBase}/vnc.html?autoconnect=true&resize=scale&path=ws/novnc/${encodeURIComponent(id)}`;

      return c.json({
        available: true,
        mode: "container" as const,
        url: noVncUrl,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return c.json({
        available: false,
        mode: "container" as const,
        message: `Failed to start browser preview: ${message}`,
      });
    }
  });

  api.post("/sessions/:id/browser/navigate", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({} as { url?: string }));
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    if (!session.containerId) return c.json({ error: "Not a container session" }, 400);

    const url = body.url;
    if (!url || typeof url !== "string") return c.json({ error: "url is required" }, 400);

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return c.json({ error: "Only http:// and https:// URLs are allowed" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid URL" }, 400);
    }

    const container = containerManager.getContainer(id);
    if (!container) return c.json({ error: "Container not found" }, 404);

    try {
      const navScript = [
        "export DISPLAY=:99",
        'xdotool search --onlyvisible --name "Chromium" windowactivate --sync key --clearmodifiers ctrl+l',
        "sleep 0.1",
        `xdotool type --clearmodifiers ${shellEscapeArg(url)}`,
        "xdotool key --clearmodifiers Return",
      ].join(" && ");
      await containerManager.execInContainerAsync(
        container.containerId,
        ["sh", "-c", navScript],
        { timeout: 10_000 },
      );
      return c.json({ ok: true, url });
    } catch {
      return c.json({ error: "Navigation failed" }, 500);
    }
  });

  api.get("/sessions/:id/browser/proxy/*", async (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    if (!session.containerId) return c.json({ error: "Not a container session" }, 400);

    const container = containerManager.getContainer(id);
    if (!container) return c.json({ error: "Container not found" }, 404);

    const portMapping = container.portMappings.find(
      (p) => p.containerPort === NOVNC_CONTAINER_PORT,
    );
    if (!portMapping) return c.json({ error: "Browser preview port not mapped" }, 400);

    const fullPath = c.req.path;
    const proxyPrefix = `/api/sessions/${id}/browser/proxy/`;
    const subPath = fullPath.startsWith(proxyPrefix) ? fullPath.slice(proxyPrefix.length) : "";

    if (subPath.includes("..")) {
      return c.json({ error: "Invalid path" }, 400);
    }

    const queryString = new URL(c.req.url).search;

    try {
      const targetUrl = `http://127.0.0.1:${portMapping.hostPort}/${subPath}${queryString}`;
      const upstream = await fetch(targetUrl);
      const headers = new Headers();
      const ct = upstream.headers.get("content-type");
      if (ct) headers.set("Content-Type", ct);
      const cl = upstream.headers.get("content-length");
      if (cl) headers.set("Content-Length", cl);
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch {
      return c.json({ error: "Proxy failed: upstream unreachable" }, 502);
    }
  });


  const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection", "te", "trailer"]);
  api.all("/sessions/:id/browser/host-proxy/:port/*", async (c) => {
    const id = c.req.param("id");
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const portStr = c.req.param("port");
    const portNum = parseInt(portStr, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return c.json({ error: "Invalid port" }, 400);
    }

    const BLOCKED_PORTS = new Set([22, 23, 25, 110, 143, 3306, 5432, 6379, 27017, 11211]);
    const serverPort = port || (process.env.NODE_ENV === "production" ? 3456 : 3457);
    if (portNum === serverPort || BLOCKED_PORTS.has(portNum)) {
      return c.json({ error: "Port not allowed" }, 400);
    }

    const fullPath = c.req.path;
    const proxyPrefix = `/api/sessions/${id}/browser/host-proxy/${portNum}/`;
    const subPath = fullPath.startsWith(proxyPrefix) ? fullPath.slice(proxyPrefix.length) : "";

    if (subPath.includes("..")) {
      return c.json({ error: "Invalid path" }, 400);
    }

    const queryString = new URL(c.req.url).search;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const targetUrl = `http://127.0.0.1:${portNum}/${subPath}${queryString}`;
      const upstream = await fetch(targetUrl, {
        method: c.req.method,
        headers: { "accept": c.req.header("accept") || "*/*" },
        body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const headers = new Headers();
      upstream.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) {
          headers.set(key, value);
        }
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch {
      clearTimeout(timeout);
      return c.json({ error: "Proxy failed: upstream unreachable" }, 502);
    }
  });

  api.patch("/sessions/:id/name", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.name !== "string" || !body.name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    const session = launcher.getSession(id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    sessionNames.setName(id, body.name.trim());
    wsBridge.broadcastNameUpdate(id, body.name.trim());
    return c.json({ ok: true, name: body.name.trim() });
  });

  api.post("/sessions/:id/kill", async (c) => {
    const id = c.req.param("id");
    const result = await orchestrator.killSession(id);
    if (!result.ok) return c.json({ error: "Session not found or already exited" }, 404);
    return c.json({ ok: true });
  });

  api.post("/sessions/:id/relaunch", async (c) => {
    const id = c.req.param("id");
    const result = await orchestrator.relaunchSession(id);
    if (!result.ok) {
      const status = result.error?.includes("not found") || result.error?.includes("Session not found") ? 404 : 503;
      return c.json({ error: result.error || "Relaunch failed" }, status);
    }
    return c.json({ ok: true });
  });

  api.post("/sessions/:id/processes/:taskId/kill", async (c) => {
    const sessionId = c.req.param("id");
    const taskId = c.req.param("taskId");

    if (!/^[a-f0-9]+$/i.test(taskId)) {
      return c.json({ error: "Invalid task ID format" }, 400);
    }

    const session = launcher.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);
    if (!session.pid) return c.json({ error: "Session PID unknown" }, 503);

    try {
      const { execFileSync } = await import("node:child_process");
      if (session.containerId) {
        containerManager.execInContainer(
          session.containerId,
          ["pkill", "-f", taskId],
          5_000,
        );
      } else {
        try {
          execFileSync("pkill", ["-f", taskId], {
            timeout: 5_000,
            encoding: "utf-8",
          });
        } catch {
          // pkill returns non-zero when no processes matched — that's fine
        }
      }
      return c.json({ ok: true, taskId });
    } catch (e) {
      const msg = getErrorMessage(e);
      return c.json({ error: `Kill failed: ${msg}` }, 500);
    }
  });

  api.post("/sessions/:id/processes/kill-all", async (c) => {
    const sessionId = c.req.param("id");
    const body = await c.req.json().catch(() => ({} as { taskIds?: string[] }));
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds : [];

    const session = launcher.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);
    if (!session.pid) return c.json({ error: "Session PID unknown" }, 503);

    const results: { taskId: string; ok: boolean; error?: string }[] = [];
    const { execSync } = await import("node:child_process");

    for (const taskId of taskIds) {
      if (!/^[a-f0-9]+$/i.test(taskId)) {
        results.push({ taskId, ok: false, error: "Invalid task ID" });
        continue;
      }
      try {
        if (session.containerId) {
          containerManager.execInContainer(
            session.containerId,
            ["sh", "-c", `pkill -f ${shellEscapeArg(taskId)} 2>/dev/null; true`],
            5_000,
          );
        } else {
          execSync(`pkill -f ${shellEscapeArg(taskId)} 2>/dev/null; true`, {
            timeout: 5_000,
            encoding: "utf-8",
          });
        }
        results.push({ taskId, ok: true });
      } catch (e) {
        results.push({ taskId, ok: false, error: getErrorMessage(e) });
      }
    }

    return c.json({ ok: true, results });
  });

  const DEV_COMMANDS = new Set([
    "node", "bun", "deno", "ts-node", "tsx",
    "python", "python3", "uvicorn", "gunicorn", "flask",
    "ruby", "rails", "puma",
    "go", "air",
    "java", "gradle", "mvn",
    "cargo",
    "php", "php-fpm",
    "dotnet",
    "vite", "next", "nuxt", "remix", "astro",
    "webpack", "esbuild", "rollup", "parcel",
    "tsc",
  ]);
  const EXCLUDE_COMMANDS = new Set([
    "launchd", "mDNSResponder", "rapportd", "systemd",
    "sshd", "cupsd", "httpd", "nginx", "postgres", "mysqld",
    "Cursor", "Code", "Electron", "WindowServer", "BetterDisplay",
    "com.docker", "Docker", "docker-proxy", "vpnkit",
    "Dropbox", "Creative Cloud", "zoom.us",
    "ControlCenter", "Finder", "loginwindow", "SystemUIServer",
  ]);

  function parseLsofCwd(raw: string): string | undefined {
    const match = raw.match(/^n(.+)$/m);
    const cwd = match?.[1]?.trim();
    return cwd || undefined;
  }

  function parsePsStartTime(raw: string): number | undefined {
    const text = raw.trim();
    if (!text) return undefined;
    const ts = Date.parse(text);
    if (!Number.isFinite(ts)) return undefined;
    return ts;
  }

  api.get("/sessions/:id/processes/system", async (c) => {
    const sessionId = c.req.param("id");
    const session = launcher.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    try {
      let raw: string;
      if (session.containerId) {
        raw = containerManager.execInContainer(
          session.containerId,
          ["sh", "-c", "lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || ss -tlnp 2>/dev/null || true"],
          5_000,
        );
      } else {
        raw = execSync("lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || true", {
          timeout: 5_000,
          encoding: "utf-8",
        });
      }

      const lines = raw.trim().split("\n").slice(1);
      const pidMap = new Map<number, { command: string; ports: Set<number> }>();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;
        const command = parts[0];
        const pid = parseInt(parts[1], 10);
        if (isNaN(pid)) continue;
        if (EXCLUDE_COMMANDS.has(command)) continue;

        const portMatch = line.match(/:(\d+)\s+\(LISTEN\)\s*$/) ?? line.match(/:(\d+)\s*$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);

        const existing = pidMap.get(pid);
        if (existing) {
          existing.ports.add(port);
        } else {
          pidMap.set(pid, { command, ports: new Set([port]) });
        }
      }

      const processes: {
        pid: number;
        command: string;
        fullCommand: string;
        ports: number[];
        cwd?: string;
        startedAt?: number;
      }[] = [];

      for (const [pid, info] of pidMap) {
        const lowerCmd = info.command.toLowerCase();
        const isDev = DEV_COMMANDS.has(lowerCmd)
          || DEV_COMMANDS.has(info.command)
          || [...DEV_COMMANDS].some((d) => lowerCmd.startsWith(d));

        if (!isDev) continue;

        let fullCommand = info.command;
        let cwd: string | undefined;
        let startedAt: number | undefined;
        try {
          if (session.containerId) {
            fullCommand = containerManager.execInContainer(
              session.containerId,
              ["ps", "-p", String(pid), "-o", "args="],
              2_000,
            ).trim();
          } else {
            fullCommand = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, {
              timeout: 2_000,
              encoding: "utf-8",
            }).trim();
          }
        } catch {
          // Fall back to short command name
        }

        try {
          if (session.containerId) {
            const cwdRaw = containerManager.execInContainer(
              session.containerId,
              ["sh", "-c", `readlink /proc/${pid}/cwd 2>/dev/null || true`],
              2_000,
            ).trim();
            cwd = cwdRaw || undefined;
          } else {
            const cwdRaw = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null || true`, {
              timeout: 2_000,
              encoding: "utf-8",
            });
            cwd = parseLsofCwd(cwdRaw);
          }
        } catch {
          // Best-effort only
        }

        try {
          if (session.containerId) {
            const startRaw = containerManager.execInContainer(
              session.containerId,
              ["sh", "-c", `ps -p ${pid} -o lstart= 2>/dev/null || true`],
              2_000,
            );
            startedAt = parsePsStartTime(startRaw);
          } else {
            const startRaw = execSync(`ps -p ${pid} -o lstart= 2>/dev/null || true`, {
              timeout: 2_000,
              encoding: "utf-8",
            });
            startedAt = parsePsStartTime(startRaw);
          }
        } catch {
          // Best-effort only
        }

        processes.push({
          pid,
          command: info.command,
          fullCommand: fullCommand || info.command,
          ports: [...info.ports].sort((a, b) => a - b),
          cwd,
          startedAt,
        });
      }

      processes.sort((a, b) => (a.ports[0] || 0) - (b.ports[0] || 0));

      return c.json({ ok: true, processes });
    } catch (e) {
      const msg = getErrorMessage(e);
      return c.json({ error: `Scan failed: ${msg}` }, 500);
    }
  });

  api.post("/sessions/:id/processes/system/:pid/kill", async (c) => {
    const sessionId = c.req.param("id");
    const pidStr = c.req.param("pid");
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid) || pid <= 0) {
      return c.json({ error: "Invalid PID" }, 400);
    }

    const session = launcher.getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    if (pid === process.pid) {
      return c.json({ error: "Cannot kill iClaude server" }, 403);
    }
    if (session.pid === pid) {
      return c.json({ error: "Use the session kill endpoint to terminate Claude" }, 403);
    }

    try {
      if (session.containerId) {
        containerManager.execInContainer(
          session.containerId,
          ["kill", "-TERM", String(pid)],
          5_000,
        );
      } else {
        process.kill(pid, "SIGTERM");
      }
      return c.json({ ok: true, pid });
    } catch (e) {
      const msg = getErrorMessage(e);
      return c.json({ error: `Kill failed: ${msg}` }, 500);
    }
  });

  api.delete("/sessions/:id/pending-input/:msgId", (c) => {
    const sessionId = c.req.param("id");
    const msgId = c.req.param("msgId");
    const removed = wsBridge.cancelPendingUserInput(sessionId, msgId);
    return removed ? c.json({ ok: true }) : c.json({ ok: false, error: "not found" }, 404);
  });

  api.post("/sessions/:id/pending-input/:msgId/flush", (c) => {
    const sessionId = c.req.param("id");
    const msgId = c.req.param("msgId");
    const sent = wsBridge.flushPendingUserInputNow(sessionId, msgId);
    return sent ? c.json({ ok: true }) : c.json({ ok: false, error: "not found" }, 404);
  });

  api.delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    const result = await orchestrator.deleteSession(id);
    wsBridge.broadcastGlobal({ type: "sessions_updated" });
    return c.json({ ok: true, worktree: result.worktree });
  });

  api.get("/sessions/:id/archive-info", async (c) => {
    const id = c.req.param("id");
    const linkedIssue = sessionLinearIssues.getLinearIssue(id);

    if (!linkedIssue) {
      return c.json({ hasLinkedIssue: false, issueNotDone: false });
    }

    const stateType = (linkedIssue.stateType || "").toLowerCase();
    const isDone = stateType === "completed" || stateType === "canceled" || stateType === "cancelled";

    if (isDone) {
      return c.json({
        hasLinkedIssue: true,
        issueNotDone: false,
        issue: {
          id: linkedIssue.id,
          identifier: linkedIssue.identifier,
          stateName: linkedIssue.stateName,
          stateType: linkedIssue.stateType,
          teamId: linkedIssue.teamId,
        },
      });
    }

    const resolved = resolveApiKey(linkedIssue.connectionId);
    let hasBacklogState = false;
    if (resolved && linkedIssue.teamId) {
      const teams = await fetchLinearTeamStates(resolved.apiKey);
      const team = teams.find((t) => t.id === linkedIssue.teamId);
      if (team) {
        hasBacklogState = team.states.some((s) => s.type === "backlog");
      }
    }

    const settings = getSettings();
    const conn = resolved && resolved.connectionId !== "legacy" ? getConnection(resolved.connectionId) : null;
    const archiveTransitionConfigured = conn
      ? conn.archiveTransition && !!conn.archiveTransitionStateId.trim()
      : settings.linearArchiveTransition && !!settings.linearArchiveTransitionStateId.trim();
    const archiveTransitionStateName = conn
      ? conn.archiveTransitionStateName || undefined
      : settings.linearArchiveTransitionStateName || undefined;

    return c.json({
      hasLinkedIssue: true,
      issueNotDone: true,
      issue: {
        id: linkedIssue.id,
        identifier: linkedIssue.identifier,
        stateName: linkedIssue.stateName,
        stateType: linkedIssue.stateType,
        teamId: linkedIssue.teamId,
      },
      hasBacklogState,
      archiveTransitionConfigured,
      archiveTransitionStateName,
    });
  });

  api.post("/sessions/:id/archive", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await orchestrator.archiveSession(id, {
      force: body.force,
      linearTransition: body.linearTransition,
    });
    wsBridge.broadcastToSession(id, { type: "session_archived" });
    wsBridge.broadcastGlobal({ type: "sessions_updated" });
    return c.json({ ok: true, worktree: result.worktree, linearTransition: result.linearTransition });
  });

  api.post("/sessions/:id/unarchive", (c) => {
    const id = c.req.param("id");
    orchestrator.unarchiveSession(id);
    wsBridge.broadcastGlobal({ type: "sessions_updated" });
    return c.json({ ok: true });
  });

  // ─── Recording Management ──────────────────────────────────

  api.post("/sessions/:id/recording/start", (c) => {
    const id = c.req.param("id");
    if (!recorder) return c.json({ error: "Recording not available" }, 501);
    recorder.enableForSession(id);
    return c.json({ ok: true, recording: true });
  });

  api.post("/sessions/:id/recording/stop", (c) => {
    const id = c.req.param("id");
    if (!recorder) return c.json({ error: "Recording not available" }, 501);
    recorder.disableForSession(id);
    return c.json({ ok: true, recording: false });
  });

  api.get("/sessions/:id/recording/status", (c) => {
    const id = c.req.param("id");
    if (!recorder) return c.json({ recording: false, available: false });
    return c.json({
      recording: recorder.isRecording(id),
      available: true,
      ...recorder.getRecordingStatus(id),
    });
  });

  api.get("/recordings", (c) => {
    if (!recorder) return c.json({ recordings: [] });
    return c.json({ recordings: recorder.listRecordings() });
  });

  // ─── HTML Fragment bridge (state + console) ──────────────────

  api.get("/sessions/:id/fragments", (c) => {
    const session = wsBridge.resolveSession(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(wsBridge.getAllFragmentStates(session.id));
  });

  api.get("/sessions/:id/fragments/:fid/state", (c) => {
    const session = wsBridge.resolveSession(c.req.param("id"));
    const fid = c.req.param("fid");
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json({ fragmentId: fid, state: wsBridge.getFragmentState(session.id, fid) });
  });

  api.get("/sessions/:id/fragments/console", (c) => {
    const session = wsBridge.resolveSession(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(wsBridge.getAllFragmentConsole(session.id));
  });

  api.get("/sessions/:id/fragments/:fid/console", (c) => {
    const session = wsBridge.resolveSession(c.req.param("id"));
    const fid = c.req.param("fid");
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json({ fragmentId: fid, logs: wsBridge.getFragmentConsole(session.id, fid) });
  });

  // ─── Available backends ─────────────────────────────────────

  api.get("/backends", (c) => {
    const backends: Array<{ id: string; name: string; available: boolean }> = [];

    backends.push({ id: "claude", name: "Claude Code", available: resolveBinary("claude") !== null });
    backends.push({ id: "codex", name: "Codex", available: resolveBinary("codex") !== null });

    return c.json(backends);
  });

  api.get("/backends/:id/models", (c) => {
    const backendId = c.req.param("id");

    if (backendId === "codex") {
      const cachePath = join(homedir(), ".codex", "models_cache.json");
      if (!existsSync(cachePath)) {
        return c.json({ error: "Codex models cache not found. Run codex once to populate it." }, 404);
      }
      try {
        const raw = readFileSync(cachePath, "utf-8");
        const cache = JSON.parse(raw) as {
          models: Array<{
            slug: string;
            display_name?: string;
            description?: string;
            visibility?: string;
            priority?: number;
          }>;
        };
        const models = cache.models
          .filter((m) => m.visibility === "list")
          .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
          .map((m) => ({
            value: m.slug,
            label: m.display_name || m.slug,
            description: m.description || "",
          }));
        return c.json(models);
      } catch (e) {
        return c.json({ error: "Failed to parse Codex models cache" }, 500);
      }
    }

    return c.json({ error: "Use frontend defaults for this backend" }, 404);
  });

  // ─── Containers ─────────────────────────────────────────────────

  api.get("/containers/status", (c) => {
    const available = containerManager.checkDocker();
    const version = available ? containerManager.getDockerVersion() : null;
    return c.json({ available, version });
  });

  api.get("/containers/images", (c) => {
    const images = containerManager.listImages();
    return c.json(images);
  });

  // ─── Simple ask endpoint (for Siri Shortcuts / Apple Watch) ────────

  const claudeAsk = async (text: string, cwd?: string): Promise<string> => {
    const binary = resolveBinary("claude");
    if (!binary) throw new Error("Claude binary not found");
    const env = { ...process.env, CLAUDECODE: undefined };
    return execSync(
      `${binary} -p ${shellEscapeArg(text)} --dangerously-skip-permissions`,
      { cwd: cwd ?? homedir(), encoding: "utf-8", timeout: 120_000, env }
    ).trim();
  };

  const shortcutSessions = new Map<string, string>();

  const claudeAskWithSession = async (text: string, sessionKey: string, cwd?: string): Promise<string> => {
    const binary = resolveBinary("claude");
    if (!binary) throw new Error("Claude binary not found");
    const env = { ...process.env, CLAUDECODE: undefined };
    const cliSessionId = shortcutSessions.get(sessionKey);
    const resumeFlag = cliSessionId ? `--resume ${shellEscapeArg(cliSessionId)}` : "";
    const raw = execSync(
      `${binary} -p ${shellEscapeArg(text)} ${resumeFlag} --output-format stream-json --dangerously-skip-permissions`,
      { cwd: cwd ?? homedir(), encoding: "utf-8", timeout: 120_000, env }
    ).trim();
    let response = "";
    let newCliSessionId = cliSessionId;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "system" && msg.subtype === "init" && msg.session_id)
          newCliSessionId = msg.session_id;
        else if (msg.type === "result" && msg.result)
          response = msg.result;
      } catch { /* skip malformed lines */ }
    }
    if (newCliSessionId) shortcutSessions.set(sessionKey, newCliSessionId);
    return response || raw;
  };

  const extractSessionParam = (form: FormData | null, body: Record<string, string | undefined> | null, key: string) =>
    ((form ? (form.get(key) as string ?? "") : (body?.[key] ?? "")) || "default").trim();

  api.get("/ask/text", async (c) => {
    const text = (c.req.query("text") ?? c.req.query("q") ?? "").trim();
    if (!text) return c.text("Missing text parameter", 400);
    const sessionKey = (c.req.query("session") || "default").trim();
    try { return c.text(await claudeAskWithSession(text, sessionKey, c.req.query("cwd"))); }
    catch (err) { return c.text(getErrorMessage(err), 500); }
  });

  api.post("/ask/text", async (c) => {
    const ct = c.req.header("content-type") ?? "";
    const form = ct.includes("form") ? await c.req.formData() : null;
    const body = form ? null : await c.req.json<Record<string, string>>().catch(() => ({} as Record<string, string>));
    const text = ((form ? (form.get("text") as string ?? "") : (body?.text ?? ""))).trim();
    if (!text) return c.text("Missing text parameter", 400);
    const sessionKey = extractSessionParam(form, body, "session");
    try { return c.text(await claudeAskWithSession(text, sessionKey)); }
    catch (err) { return c.text(getErrorMessage(err), 500); }
  });

  api.get("/ask", async (c) => {
    const text = (c.req.query("text") ?? "").trim();
    if (!text) return c.json({ error: "text is required" }, 400);
    try { return c.json({ response: await claudeAsk(text, c.req.query("cwd")) }); }
    catch (err) { return c.json({ error: getErrorMessage(err) }, 500); }
  });

  api.post("/ask", async (c) => {
    const body = await c.req.json<{ text: string; cwd?: string }>();
    const text = body?.text?.trim() ?? "";
    if (!text) return c.json({ error: "text is required" }, 400);
    try { return c.json({ response: await claudeAsk(text, body?.cwd) }); }
    catch (err) { return c.json({ error: getErrorMessage(err) }, 500); }
  });

  registerFsRoutes(api);
  registerEnvRoutes(api, { webDir: WEB_DIR });
  registerSandboxRoutes(api);

  registerPromptRoutes(api);
  registerSettingsRoutes(api);
  registerProxyRoutes(api);

  // ─── Tailscale ──────────────────────────────────────────────────────

  if (port !== undefined) registerTailscaleRoutes(api, port);

  // ─── Linear ────────────────────────────────────────────────────────

  registerLinearRoutes(api);
  registerLinearConnectionRoutes(api);

  registerCompleteRoutes(api, { wsBridge });

  registerGitRoutes(api, prPoller);
  registerSystemRoutes(api, {
    launcher,
    wsBridge,
    terminalManager,
    updateCheckStaleMs: UPDATE_CHECK_STALE_MS,
  });

  registerPanelRoutes(api);
  registerCronRoutes(api, cronScheduler);
  registerAgentRoutes(api, agentExecutor);
  registerSystemCronRoutes(api);
  registerMetricsRoutes(api, { gaugeProvider: wsBridge });

  // ─── Tunnel management ────────────────────────────────────────────────
  api.get("/tunnel/status", (c) => {
    if (!tunnelManager) return c.json({ state: "stopped", url: null, provider: null, error: "Tunnel manager not available" });
    return c.json(tunnelManager.getStatus());
  });

  api.post("/tunnel/start", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    try {
      const result = await tunnelManager.start(getTunnelPort());
      updateSettings({ tunnelEnabled: true });
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/tunnel/stop", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    await tunnelManager.stop();
    updateSettings({ tunnelEnabled: false });
    return c.json({ ok: true });
  });

  api.get("/tunnel/qr", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    const status = tunnelManager.getStatus();
    if (status.state !== "running" || !status.url) {
      return c.json({ error: "No active tunnel" }, 400);
    }
    const token = getToken();
    const loginUrl = `${status.url}/?token=${token}`;
    const qrDataUrl = await QRCode.toDataURL(loginUrl, { width: 256, margin: 2 });
    return c.json({ url: status.url, qrDataUrl });
  });

  api.get("/tunnel/named/info", (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    return c.json(tunnelManager.getNamedTunnelInfo());
  });

  api.post("/tunnel/named/setup", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    const body = await c.req.json<{ name: string; hostname: string }>();
    if (!body.name || !body.hostname) {
      return c.json({ error: "Both 'name' and 'hostname' are required" }, 400);
    }
    try {
      const result = await tunnelManager.setupNamedTunnel(body.name, body.hostname);
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.post("/tunnel/named/delete", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    try {
      await tunnelManager.deleteNamedTunnel();
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  api.get("/tunnel/shortcut", async (c) => {
    if (!tunnelManager) return c.json({ error: "Tunnel manager not available" }, 500);
    const status = tunnelManager.getStatus();
    if (status.state !== "running" || !status.url) {
      return c.json({ error: "No active tunnel" }, 400);
    }
    const token = getToken();
    const loginUrl = `${status.url}/?token=${token}`;
    const plist = generateShortcutPlist("Companion", loginUrl);
    c.header("Content-Type", "application/x-apple-shortcut");
    c.header("Content-Disposition", 'attachment; filename="Companion.shortcut"');
    return c.body(plist);
  });

  return api;
}

function generateShortcutPlist(name: string, url: string): string {
  const escaped = url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>WFWorkflowActions</key>
\t<array>
\t\t<dict>
\t\t\t<key>WFWorkflowActionIdentifier</key>
\t\t\t<string>is.workflow.actions.openurl</string>
\t\t\t<key>WFWorkflowActionParameters</key>
\t\t\t<dict>
\t\t\t\t<key>WFInput</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Value</key>
\t\t\t\t\t<dict>
\t\t\t\t\t\t<key>attachmentsByRange</key>
\t\t\t\t\t\t<dict/>
\t\t\t\t\t\t<key>string</key>
\t\t\t\t\t\t<string>${escaped}</string>
\t\t\t\t\t</dict>
\t\t\t\t\t<key>WFSerializationType</key>
\t\t\t\t\t<string>WFTextTokenString</string>
\t\t\t\t</dict>
\t\t\t</dict>
\t\t</dict>
\t</array>
\t<key>WFWorkflowClientVersion</key>
\t<string>2302.0.4</string>
\t<key>WFWorkflowHasOutputFallback</key>
\t<false/>
\t<key>WFWorkflowHasShortcutInputVariables</key>
\t<false/>
\t<key>WFWorkflowIcon</key>
\t<dict>
\t\t<key>WFWorkflowIconGlyphNumber</key>
\t\t<integer>59511</integer>
\t\t<key>WFWorkflowIconStartColor</key>
\t\t<integer>4282601983</integer>
\t</dict>
\t<key>WFWorkflowImportQuestions</key>
\t<array/>
\t<key>WFWorkflowInputContentItemClasses</key>
\t<array>
\t\t<string>WFAppStoreAppContentItem</string>
\t\t<string>WFArticleContentItem</string>
\t\t<string>WFContactContentItem</string>
\t\t<string>WFDateContentItem</string>
\t\t<string>WFEmailAddressContentItem</string>
\t\t<string>WFGenericFileContentItem</string>
\t\t<string>WFImageContentItem</string>
\t\t<string>WFiTunesProductContentItem</string>
\t\t<string>WFLocationContentItem</string>
\t\t<string>WFDCMapsLinkContentItem</string>
\t\t<string>WFAVAssetContentItem</string>
\t\t<string>WFPDFContentItem</string>
\t\t<string>WFPhoneNumberContentItem</string>
\t\t<string>WFRichTextContentItem</string>
\t\t<string>WFSafariWebPageContentItem</string>
\t\t<string>WFStringContentItem</string>
\t\t<string>WFURLContentItem</string>
\t</array>
\t<key>WFWorkflowMinimumClientVersion</key>
\t<integer>900</integer>
\t<key>WFWorkflowMinimumClientVersionString</key>
\t<string>900</string>
\t<key>WFWorkflowName</key>
\t<string>${name}</string>
\t<key>WFWorkflowOutputContentItemClasses</key>
\t<array/>
\t<key>WFWorkflowTypes</key>
\t<array>
\t\t<string>NCWidget</string>
\t\t<string>WatchKit</string>
\t</array>
</dict>
</plist>`;
}

const TITLE_GEN_PREFIX = "Generate a concise 3-5 word session title";

function stripTitleGenPrompt(text: string): string {
  if (!text.startsWith(TITLE_GEN_PREFIX)) return text;
  return "";
}

async function extractSessionTitle(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    let found = false;
    rl.on("line", (line) => {
      if (found) return;
      try {
        const data = JSON.parse(line);
        if (data.type === "summary") {
          found = true;
          rl.close();
          resolve(stripTitleGenPrompt(data.summary?.slice(0, 120) || ""));
          return;
        }
        if (data.type !== "user" || data.isMeta === true) return;
        const msg = data.message;
        if (!msg) return;
        const content = msg.content;
        let rawText = "";
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "text" && block.text) {
              rawText = block.text;
              break;
            }
          }
        } else if (typeof content === "string") {
          rawText = content;
        }
        if (!rawText) return;
        const clean = stripTitleGenPrompt(stripSystemTags(rawText.slice(0, 500)));
        if (!clean) return;
        found = true;
        rl.close();
        resolve(clean.slice(0, 120));
      } catch { /* skip malformed lines */ }
    });
    rl.on("close", () => { if (!found) resolve(""); });
    rl.on("error", () => resolve(""));
  });
}
