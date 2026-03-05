# HTML Panels Plugin System

## What It Is
Dynamically loadable panels (like Process Monitor with kill buttons) that render in sandboxed iframes with a pre-wired `window.vibe` API for system interaction.

## How It Works
```
~/.companion/panels/<slug>/
  panel.json     ← { name, description, icon }
  panel.html     ← Self-contained HTML+JS using window.vibe
  state.json     ← Auto-generated for persistence
```

Server injects `window.vibe` bridge when serving panel.html → works without YOLO mode.

## API Surface

### Backend Endpoints
- `GET /api/panels` — list discovered panels
- `GET /api/panels/:slug` — panel metadata
- `GET /api/panels/:slug/panel` — HTML with injected vibe bridge
- `GET/PUT /api/panels/:slug/state` — persistent key-value store

### window.vibe API (inside panel iframes)
```js
vibe.command(cmd, {cwd})      // Execute bash command
vibe.store.get(key?)          // Read persistent state
vibe.store.set(key, value)    // Write persistent state
vibe.notify(title, body)      // Desktop notification
vibe.playSound(name?)         // macOS system sound
```

## Key Files
- `web/server/panel-manager.ts` — Backend CRUD + vibe API injection
- `web/server/routes/panels-routes.ts` — `/api/panels/*` routes
- `web/src/components/Panel.tsx` — iframe wrapper
- `web/src/components/PanelPicker.tsx` — "+" dropdown in TopBar
- `web/src/components/TopBar.tsx` — Dynamic tab bar with panel tabs

## Security
- Panels are trusted LOCAL files, not AI-generated → no YOLO dependency
- iframe sandbox: `allow-scripts allow-same-origin allow-forms`
- Slug validated against path traversal
- `/api/exec` has 30s timeout + 1MB buffer

## Example Panel: ~/.companion/panels/htop/
Process Monitor that polls `ps aux` every 3s with sortable columns, filter, and kill buttons.

## Future Ideas
- SSE endpoint for streaming exec (real `top` output)
- `vibe.session.sendMessage()` to interact with Claude sessions
- File watcher for hot-reload when panel files change
- Panel marketplace / git-based panel installation
