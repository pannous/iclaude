# HTML Skills Plugin System

## What It Is
Dynamically loadable panels (like Process Monitor with kill buttons) that render in sandboxed iframes with a pre-wired `window.vibe` API for system interaction.

## How It Works
```
~/.companion/skills/<slug>/
  skill.json     ← { name, description, icon }
  panel.html     ← Self-contained HTML+JS using window.vibe
  state.json     ← Auto-generated for persistence
```

Server injects `window.vibe` bridge when serving panel.html → works without YOLO mode.

## API Surface

### Backend Endpoints
- `GET /api/skills` — list discovered skills
- `GET /api/skills/:slug` — skill metadata
- `GET /api/skills/:slug/panel` — HTML with injected vibe bridge
- `GET/PUT /api/skills/:slug/state` — persistent key-value store

### window.vibe API (inside skill iframes)
```js
vibe.command(cmd, {cwd})      // Execute bash command
vibe.store.get(key?)          // Read persistent state
vibe.store.set(key, value)    // Write persistent state
vibe.notify(title, body)      // Desktop notification
vibe.playSound(name?)         // macOS system sound
```

## Key Files
- `web/server/skill-manager.ts` — Backend CRUD + vibe API injection
- `web/server/routes.ts` — 5 new `/api/skills/*` routes
- `web/src/components/SkillPanel.tsx` — iframe wrapper
- `web/src/components/SkillPicker.tsx` — "+" dropdown in TopBar
- `web/src/components/TopBar.tsx` — Dynamic tab bar with skill tabs

## Security
- Skills are trusted LOCAL files, not AI-generated → no YOLO dependency
- iframe sandbox: `allow-scripts allow-same-origin allow-forms`
- Slug validated against path traversal
- `/api/exec` has 30s timeout + 1MB buffer

## Example Skill: ~/.companion/skills/htop/
Process Monitor that polls `ps aux` every 3s with sortable columns, filter, and kill buttons.

## Future Ideas
- SSE endpoint for streaming exec (real `top` output)
- `vibe.session.sendMessage()` to interact with Claude sessions
- File watcher for hot-reload when skill files change
- Skill marketplace / git-based skill installation
