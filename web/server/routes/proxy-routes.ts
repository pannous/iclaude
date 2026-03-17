import type { Hono, Context } from "hono";
import { getSettings, updateSettings, type ProxyForward } from "../settings-manager.js";

async function proxyRequest(c: Context, fwd: ProxyForward): Promise<Response> {
  const rest = c.req.path.replace(`/api/proxy/${fwd.prefix}`, "") || "/";
  const query = c.req.query();
  const qs = new URLSearchParams(query).toString();
  const target = `http://localhost:${fwd.port}${rest}${qs ? `?${qs}` : ""}`;

  try {
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host");

    const resp = await fetch(target, {
      method: c.req.method,
      headers,
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
      // @ts-expect-error Bun supports duplex
      duplex: "half",
    });

    const contentType = resp.headers.get("content-type") || "";
    const respHeaders = new Headers(resp.headers);
    respHeaders.delete("transfer-encoding");

    // For HTML responses, rewrite absolute paths so the proxied app's
    // requests (e.g. fetch('/api/data')) route through our proxy prefix
    if (contentType.includes("text/html")) {
      let html = await resp.text();
      const proxyBase = `/api/proxy/${fwd.prefix}`;
      // Rewrite '/path' and "/path" references to go through the proxy
      // but skip protocol-relative URLs (//...) and already-proxied paths
      html = html.replace(
        /(["'])(\/(?!\/|api\/proxy\/))/g,
        `$1${proxyBase}$2`,
      );
      respHeaders.delete("content-length");
      return new Response(html, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Proxy to localhost:${fwd.port} failed: ${msg}` }, 502);
  }
}

function resolveForward(c: Context): ProxyForward | null {
  const prefix = c.req.param("prefix");
  return getSettings().proxyForwards.find((f) => f.prefix === prefix) || null;
}

/**
 * Configurable reverse-proxy routes that forward requests through the
 * Companion server (and thus through any active tunnel) to local services.
 *
 * A forward { prefix: "jobs", port: 8777, name: "Jobs App" }
 * proxies /api/proxy/jobs/* -> http://localhost:8777/*
 */
export function registerProxyRoutes(api: Hono): void {
  api.get("/proxy-forwards", (c) => c.json(getSettings().proxyForwards));

  api.put("/proxy-forwards", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!Array.isArray(body)) {
      return c.json({ error: "Body must be an array of proxy forwards" }, 400);
    }
    const forwards: ProxyForward[] = [];
    for (const entry of body) {
      const prefix = typeof entry.prefix === "string" ? entry.prefix.trim().replace(/^\/+|\/+$/g, "") : "";
      const port = typeof entry.port === "number" ? entry.port : parseInt(entry.port, 10);
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!prefix || !/^[a-zA-Z0-9_-]+$/.test(prefix)) {
        return c.json({ error: `Invalid prefix "${entry.prefix}" — use alphanumeric, dash, or underscore` }, 400);
      }
      if (!port || port < 1 || port > 65535) {
        return c.json({ error: `Invalid port ${entry.port}` }, 400);
      }
      forwards.push({ prefix, port, name: name || prefix });
    }
    const settings = updateSettings({ proxyForwards: forwards });
    return c.json(settings.proxyForwards);
  });

  for (const pattern of ["/proxy/:prefix", "/proxy/:prefix/*"]) {
    api.all(pattern, async (c) => {
      const fwd = resolveForward(c);
      if (!fwd) {
        return c.json({ error: `No proxy forward configured for "${c.req.param("prefix")}"` }, 404);
      }
      return proxyRequest(c, fwd);
    });
  }
}
