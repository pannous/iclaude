# Remote Tunnel Setup for companion.pannous.com

## Architecture

```
Browser → Apache (HTTPS :443) → SSH tunnel (server:14456) → Mac:2345 (Vite) → proxies /api,/ws to Hono:3456
```

## Critical: Tunnel Must Point to Vite (2345), NOT Hono (3456)

In dev mode, the tunnel **must** forward to the Vite dev server (port 2345), not directly to Hono (port 3456). Reason: the HTML served includes Vite HMR scripts (`/@react-refresh`, `/@vite/client`) that need a WebSocket connection to Vite. If the tunnel points to Hono, Vite HMR fails and enters an infinite page-reload loop.

Vite already proxies `/api/*` and `/ws/*` to Hono:3456, so everything works through a single port.

## Components

### 1. SSH Reverse Tunnel (Mac → Server)

**Plist**: `~/Library/LaunchAgents/com.pannous.claude-tunnel.plist`

```
autossh -M 0 -N \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=no \
  -R 14456:localhost:2345 root@81.169.181.160
```

Managed by launchd (`KeepAlive: true`, `RunAtLoad: true`).

Restart: `launchctl unload ~/Library/LaunchAgents/com.pannous.claude-tunnel.plist && launchctl load ~/Library/LaunchAgents/com.pannous.claude-tunnel.plist`

### 2. Apache Vhost (Server)

**File**: `/etc/apache2/sites-available/companion-le-ssl.conf`

Key config:
- `RequestHeader set X-Companion-Tunnel "1"` — signals auth middleware this is a tunnel request
- `SetEnvIfNoCase Upgrade websocket no-gzip` — prevents mod_deflate from corrupting WebSocket frames
- RewriteRule proxies WebSocket upgrades to `ws://127.0.0.1:14456`
- ProxyPass proxies HTTP to `http://127.0.0.1:14456`

### 3. Vite Config (Mac)

**File**: `web/vite.config.ts`

Must include `companion.pannous.com` in `server.allowedHosts` or Vite returns 403.

### 4. Dev Server (Mac)

Run `make dev` (or `cd web && bun run dev`) to start both Hono:3456 and Vite:2345.

## Auth Flow (Remote)

1. Browser loads SPA through tunnel (non-API paths pass through auth gate)
2. `autoAuth()` → `/api/auth/auto` → `{ok: false}` (not localhost)
3. Login page renders, user enters token
4. `verifyAuthToken()` → `/api/auth/verify` → sets cookie + returns `{ok: true}`
5. Token stored in localStorage, all subsequent API calls include `Authorization: Bearer` header

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank page + infinite reload | Tunnel points to Hono:3456 | Change tunnel to Vite:2345 |
| 403 Forbidden | Vite allowedHosts missing | Add domain to `vite.config.ts` |
| 502 Bad Gateway | Dev server not running | `make dev` on Mac |
| WebSocket "reserved bits" error | mod_deflate compressing WS frames | Add `SetEnvIfNoCase Upgrade websocket no-gzip` to Apache vhost |
| Pre-auth 401 spam | API calls before login | Gated behind `isAuthenticated` (fixed 2026-03-03) |

## Setup Checklist (from scratch)

1. Install autossh: `brew install autossh`
2. Copy plist to `~/Library/LaunchAgents/com.pannous.claude-tunnel.plist`
3. Load: `launchctl load ~/Library/LaunchAgents/com.pannous.claude-tunnel.plist`
4. On server: configure Apache vhost with WebSocket proxy + `X-Companion-Tunnel` header
5. Enable SSL: `certbot --apache -d companion.pannous.com`
6. Ensure `companion.pannous.com` is in `vite.config.ts` `allowedHosts`
7. Set `COMPANION_AUTH=1` on the server environment
8. Start dev server: `make dev`
