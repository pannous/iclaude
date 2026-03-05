import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getToken } from "./auth-manager.js";
import { DEFAULT_PORT_DEV, DEFAULT_PORT_PROD, DEFAULT_FRONTEND_PORT_DEV } from "./constants.js";
import { getSettings, updateSettings } from "./settings-manager.js";

export interface TunnelStatus {
  state: "stopped" | "starting" | "running" | "error";
  url: string | null;
  provider: "cloudflared" | "ngrok" | null;
  mode: "quick" | "named";
  error: string | null;
}

export interface NamedTunnelInfo {
  loggedIn: boolean;
  tunnelId: string | null;
  hostname: string | null;
  credentialsPath: string | null;
}

const CLOUDFLARE_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
const NGROK_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/;
const URL_TIMEOUT_MS = 25_000;
const CONNECTED_RE = /Registered tunnel connection/;
const COMPANION_TUNNEL_DIR = join(homedir(), ".companion", "tunnel");
const CLOUDFLARED_CERT = join(homedir(), ".cloudflared", "cert.pem");

/**
 * Manages a tunnel subprocess (cloudflared or ngrok) that exposes the local
 * Companion server to the internet. Supports two modes:
 * - "quick": ephemeral tunnel with random URL (no account needed)
 * - "named": persistent tunnel with fixed hostname (requires Cloudflare login + domain)
 */
export class TunnelManager {
  private proc: ChildProcess | null = null;
  private _url: string | null = null;
  private _provider: "cloudflared" | "ngrok" | null = null;
  private _state: TunnelStatus["state"] = "stopped";
  private _error: string | null = null;
  private _mode: "quick" | "named" = "quick";

  getStatus(): TunnelStatus {
    return {
      state: this._state,
      url: this._url,
      provider: this._provider,
      mode: this._mode,
      error: this._error,
    };
  }

  getNamedTunnelInfo(): NamedTunnelInfo {
    const s = getSettings();
    return {
      loggedIn: existsSync(CLOUDFLARED_CERT),
      tunnelId: s.tunnelId || null,
      hostname: s.tunnelHostname || null,
      credentialsPath: s.tunnelCredentialsPath || null,
    };
  }

  async start(port: number): Promise<{ url: string; provider: string; mode: string }> {
    if (this._state === "running" && this._url) {
      return { url: this._url, provider: this._provider!, mode: this._mode };
    }

    const s = getSettings();
    this._mode = s.tunnelMode === "named" && s.tunnelId && s.tunnelHostname ? "named" : "quick";

    this.killProc();
    this._state = "starting";
    this._error = null;

    try {
      let url: string;
      if (this._mode === "named") {
        this._provider = "cloudflared";
        url = await this.startNamedTunnel(port, s.tunnelId, s.tunnelHostname, s.tunnelCredentialsPath);
      } else {
        const provider = detectProvider();
        this._provider = provider;
        url = provider === "cloudflared"
          ? await this.startQuickCloudflared(port)
          : await this.startNgrok(port);
      }

      this._url = url;
      this._state = "running";
      process.env.COMPANION_AUTH = "1";

      console.log(`[tunnel] Public URL: ${url} (${this._mode})`);
      console.log(`[tunnel] Auth URL:   ${url}/?token=${getToken()}`);

      return { url, provider: this._provider!, mode: this._mode };
    } catch (err) {
      this._state = "error";
      this._error = err instanceof Error ? err.message : String(err);
      this.killProc();
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.killProc();
    this._state = "stopped";
    this._url = null;
    this._provider = null;
    this._error = null;
  }

  /**
   * Create a named Cloudflare tunnel. Requires prior `cloudflared tunnel login`.
   * Returns the tunnel ID and credentials path.
   */
  async createNamedTunnel(name: string): Promise<{ tunnelId: string; credentialsPath: string }> {
    if (!existsSync(CLOUDFLARED_CERT)) {
      throw new Error("Not logged in to Cloudflare. Run `cloudflared tunnel login` first.");
    }

    mkdirSync(COMPANION_TUNNEL_DIR, { recursive: true });

    // Check if tunnel already exists
    const existing = this.listTunnels().find(t => t.name === name);
    if (existing) {
      // Find credentials file
      const credPath = findCredentialsFile(existing.id);
      if (credPath) {
        return { tunnelId: existing.id, credentialsPath: credPath };
      }
      throw new Error(`Tunnel "${name}" exists (${existing.id}) but credentials file not found`);
    }

    const output = execSync(`cloudflared tunnel create ${name}`, {
      encoding: "utf-8",
      timeout: 30_000,
    });

    // Parse: "Created tunnel <name> with id <uuid>"
    const idMatch = output.match(/with id ([0-9a-f-]{36})/);
    if (!idMatch) throw new Error(`Failed to parse tunnel ID from: ${output}`);

    const tunnelId = idMatch[1];
    const credPath = findCredentialsFile(tunnelId);
    if (!credPath) throw new Error(`Tunnel created but credentials file not found for ${tunnelId}`);

    return { tunnelId, credentialsPath: credPath };
  }

  /**
   * Route a hostname to the named tunnel via DNS CNAME.
   */
  async routeDns(tunnelId: string, hostname: string): Promise<void> {
    execSync(`cloudflared tunnel route dns ${tunnelId} ${hostname}`, {
      encoding: "utf-8",
      timeout: 30_000,
    });
  }

  /**
   * Full setup: create tunnel + route DNS + persist to settings.
   */
  async setupNamedTunnel(name: string, hostname: string): Promise<{ tunnelId: string; hostname: string }> {
    const { tunnelId, credentialsPath } = await this.createNamedTunnel(name);

    try {
      await this.routeDns(tunnelId, hostname);
    } catch (err) {
      // DNS route might already exist — that's fine
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already exists")) throw err;
    }

    updateSettings({
      tunnelMode: "named",
      tunnelId,
      tunnelHostname: hostname,
      tunnelCredentialsPath: credentialsPath,
    });

    return { tunnelId, hostname };
  }

  /**
   * Delete a named tunnel and clear settings.
   */
  async deleteNamedTunnel(): Promise<void> {
    const s = getSettings();
    if (!s.tunnelId) return;

    this.killProc();

    try {
      execSync(`cloudflared tunnel cleanup ${s.tunnelId}`, { encoding: "utf-8", timeout: 30_000 });
    } catch { /* connections might already be cleaned up */ }

    try {
      execSync(`cloudflared tunnel delete ${s.tunnelId}`, { encoding: "utf-8", timeout: 30_000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("not found")) throw err;
    }

    updateSettings({
      tunnelMode: "quick",
      tunnelId: "",
      tunnelHostname: "",
      tunnelCredentialsPath: "",
    });
  }

  private listTunnels(): Array<{ id: string; name: string }> {
    try {
      const output = execSync("cloudflared tunnel list -o json", { encoding: "utf-8", timeout: 15_000 });
      const tunnels = JSON.parse(output);
      return tunnels.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
    } catch {
      return [];
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private killProc(): void {
    if (this.proc) {
      try { this.proc.kill(); } catch { /* already dead */ }
      this.proc = null;
    }
  }

  private startNamedTunnel(port: number, tunnelId: string, hostname: string, credentialsPath: string): Promise<string> {
    // Write a temporary config for this run
    const configPath = join(COMPANION_TUNNEL_DIR, "config.yml");
    mkdirSync(COMPANION_TUNNEL_DIR, { recursive: true });
    const config = [
      `tunnel: ${tunnelId}`,
      `credentials-file: ${credentialsPath}`,
      ``,
      `ingress:`,
      `  - hostname: ${hostname}`,
      `    service: http://localhost:${port}`,
      `  - service: http_status:404`,
    ].join("\n");
    writeFileSync(configPath, config, "utf-8");

    const proc = spawn(
      "cloudflared",
      ["tunnel", "--config", configPath, "--no-autoupdate", "run"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    this.proc = proc;

    const url = `https://${hostname}`;

    // For named tunnels we know the URL upfront — just wait for connection registration
    return new Promise((resolve, reject) => {
      let resolved = false;
      let lastOutput = "";

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const hint = lastOutput.trim().split("\n").slice(-3).join("\n");
          reject(new Error(`Timed out waiting for tunnel connection (${URL_TIMEOUT_MS / 1000}s)\n${hint}`));
        }
      }, URL_TIMEOUT_MS);

      const scan = (stream: NodeJS.ReadableStream | null) => {
        if (!stream) return;
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
          if (resolved) return;
          lastOutput += chunk;
          if (CONNECTED_RE.test(lastOutput)) {
            resolved = true;
            clearTimeout(timeout);
            resolve(url);
          }
        });
      };

      scan(proc.stdout);
      scan(proc.stderr);

      proc.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const lines = lastOutput.trim().split("\n").filter(Boolean);
          reject(new Error(lines.slice(-3).join("\n") || `Tunnel process exited with code ${code}`));
        }
      });
    });
  }

  private startQuickCloudflared(port: number): Promise<string> {
    const proc = spawn(
      "cloudflared", ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    this.proc = proc;
    return this.extractUrl(proc, CLOUDFLARE_URL_RE);
  }

  private startNgrok(port: number): Promise<string> {
    const proc = spawn(
      "ngrok", ["http", String(port), "--log", "stdout", "--log-format", "json"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    this.proc = proc;
    return this.extractUrl(proc, NGROK_URL_RE);
  }

  private extractUrl(proc: ChildProcess, pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let lastOutput = "";

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const hint = lastOutput ? `\n${lastOutput.trim().split("\n").slice(-3).join("\n")}` : "";
          reject(new Error(`Timed out waiting for tunnel URL (${URL_TIMEOUT_MS / 1000}s)${hint}`));
        }
      }, URL_TIMEOUT_MS);

      const scan = (stream: NodeJS.ReadableStream | null) => {
        if (!stream) return;
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
          if (resolved) return;
          lastOutput += chunk;
          const match = lastOutput.match(pattern);
          if (match) {
            resolved = true;
            clearTimeout(timeout);
            resolve(match[0]);
          }
        });
      };

      scan(proc.stdout);
      scan(proc.stderr);

      proc.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          const lines = lastOutput.trim().split("\n").filter(Boolean);
          const hint = lines.slice(-3).join("\n");
          reject(new Error(hint || `Tunnel process exited with code ${code}`));
        }
      });
    });
  }
}

/**
 * In dev mode, the tunnel must point to Vite (which proxies API/WS to Hono)
 * so that HMR works. In production, Hono serves everything directly.
 */
export function getTunnelPort(): number {
  if (process.env.NODE_ENV === "production") {
    return Number(process.env.PORT) || DEFAULT_PORT_PROD;
  }
  return Number(process.env.VITE_PORT) || DEFAULT_FRONTEND_PORT_DEV;
}

function detectProvider(): "cloudflared" | "ngrok" {
  for (const bin of ["cloudflared", "ngrok"] as const) {
    try {
      execSync(`which ${bin}`, { stdio: "ignore" });
      return bin;
    } catch { /* not found */ }
  }
  throw new Error(
    "No tunnel tool found. Install one:\n" +
    "  brew install cloudflared\n" +
    "  brew install ngrok/ngrok/ngrok",
  );
}

function findCredentialsFile(tunnelId: string): string | null {
  // cloudflared stores credentials in ~/.cloudflared/<tunnelId>.json
  const defaultPath = join(homedir(), ".cloudflared", `${tunnelId}.json`);
  if (existsSync(defaultPath)) return defaultPath;
  return null;
}
