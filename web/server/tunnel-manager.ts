import { spawn, execSync, type ChildProcess } from "node:child_process";
import { getToken } from "./auth-manager.js";

export interface TunnelStatus {
  state: "stopped" | "starting" | "running" | "error";
  url: string | null;
  provider: "cloudflared" | "ngrok" | null;
  error: string | null;
}

const CLOUDFLARE_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
const NGROK_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/;
const URL_TIMEOUT_MS = 25_000;

/**
 * Manages a tunnel subprocess (cloudflared or ngrok) that exposes the local
 * Companion server to the internet. Auth is auto-enabled when a tunnel starts.
 */
export class TunnelManager {
  private proc: ChildProcess | null = null;
  private _url: string | null = null;
  private _provider: "cloudflared" | "ngrok" | null = null;
  private _state: TunnelStatus["state"] = "stopped";
  private _error: string | null = null;

  getStatus(): TunnelStatus {
    return {
      state: this._state,
      url: this._url,
      provider: this._provider,
      error: this._error,
    };
  }

  async start(port: number): Promise<{ url: string; provider: string }> {
    if (this._state === "running" && this._url) {
      return { url: this._url, provider: this._provider! };
    }

    this._state = "starting";
    this._error = null;

    const provider = detectProvider();
    this._provider = provider;

    try {
      const url = provider === "cloudflared"
        ? await this.startCloudflared(port)
        : await this.startNgrok(port);

      this._url = url;
      this._state = "running";

      // Force-enable auth so tunnel traffic requires a token
      process.env.COMPANION_AUTH = "1";

      console.log(`[tunnel] Public URL: ${url}`);
      console.log(`[tunnel] Auth URL:   ${url}/?token=${getToken()}`);

      return { url, provider };
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

  // ── Private ──────────────────────────────────────────────────────────

  private killProc(): void {
    if (this.proc) {
      try { this.proc.kill(); } catch { /* already dead */ }
      this.proc = null;
    }
  }

  private startCloudflared(port: number): Promise<string> {
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

  /**
   * Read stdout+stderr until we find a URL matching the pattern, or time out.
   */
  private extractUrl(proc: ChildProcess, pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Timed out waiting for tunnel URL (${URL_TIMEOUT_MS / 1000}s)`));
        }
      }, URL_TIMEOUT_MS);

      const scan = (stream: NodeJS.ReadableStream | null) => {
        if (!stream) return;
        let buffer = "";
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
          if (resolved) return;
          buffer += chunk;
          const match = buffer.match(pattern);
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
          reject(new Error(`Tunnel process exited with code ${code} before URL was found`));
        }
      });
    });
  }
}

/**
 * Detect which tunnel binary is available.
 * Prefers cloudflared (no account needed) over ngrok.
 */
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
