<p align="center">
  <img src="screenshot.png" alt="The Companion" width="100%" />
</p>

<h1 align="center">The Companion</h1>
<p align="center"><strong>Web UI for Claude Code and Codex sessions.</strong></p>
<p align="center">Run multiple agents, inspect every tool call, and gate risky actions with explicit approvals.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/iclaude"><img src="https://img.shields.io/npm/v/iclaude.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/iclaude"><img src="https://img.shields.io/npm/dm/iclaude.svg" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
</p>

## Quick start

**Requirements:** [Bun](https://bun.sh) + [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and/or [Codex](https://github.com/openai/codex) CLI.

### Try it instantly

```bash
bunx iclaude
```

Open [localhost:3456](http://localhost:3456). In production, the backend serves the built frontend on this port. In dev mode, open [localhost:2345](http://localhost:2345) for the Vite dev server with HMR.

### Install globally


```bash
bun install -g iclaude

# Register as a background service (launchd on macOS, systemd on Linux)
iclaude install

# Start the service
iclaude start
```

Open [http://localhost:3456](http://localhost:3456). The server runs in the background and survives reboots.

## CLI commands

| Command | Description |
|---|---|
| `iclaude` | Start server in foreground (default) |
| `iclaude serve` | Start server in foreground (explicit) |
| `iclaude install` | Register as a background service (launchd/systemd) |
| `iclaude start` | Start the background service |
| `iclaude stop` | Stop the background service |
| `iclaude restart` | Restart the background service |
| `iclaude uninstall` | Remove the background service |
| `iclaude status` | Show service status |
| `iclaude logs` | Tail service log files |

**Options:** `--port <n>` overrides the default port (3456).

## Why this is useful
- **Parallel sessions**: work on multiple tasks without juggling terminals.
- **Full visibility**: see streaming output, tool calls, and tool results in one timeline.
- **Permission control**: approve/deny sensitive operations from the UI.
- **Session recovery**: restore work after process/server restarts.
- **Dual-engine support**: designed for both Claude Code and Codex-backed flows.

## Screenshots
| Chat + tool timeline | Permission flow |
|---|---|
| <img src="screenshot.png" alt="Main workspace" width="100%" /> | <img src="web/docs/screenshots/notification-section.png" alt="Permission and notifications" width="100%" /> |

## Architecture (simple)
```text
Browser (React)
  <-> ws://localhost:3456/ws/browser/:session
Companion server (Bun + Hono)
  <-> ws://localhost:3456/ws/cli/:session
Claude Code / Codex CLI
```

The bridge uses the CLI `--sdk-url` websocket path and NDJSON events.

## Authentication

The server auto-generates an auth token on first start, stored at `~/.companion/auth.json`. You can also manage tokens manually:

```bash
# Show the current token (or auto-generate one)
cd web && bun run generate-token

# Force-regenerate a new token
cd web && bun run generate-token --force
```

Or set a token via environment variable (takes priority over the file):

```bash
COMPANION_AUTH_TOKEN="my-secret-token" bunx iclaude
```

## Development
```bash
make dev
```

Manual:
```bash
cd web
bun install
bun run dev       # backend on :3456 + Vite HMR on :2345
```

The dev server runs two ports: backend API/WebSocket on `:3456`, frontend with HMR on `:2345`.

Production: `bun run build && bun run start` serves frontend + backend on a single port (`:3456`).

Checks:
```bash
cd web
bun run typecheck
bun run test
```

## Preview / Prerelease

Every push to `main` publishes a preview artifact:

| Artifact | Tag / dist-tag | Example |
|---|---|---|
| Docker image (moving) | `preview-main` | `docker.io/pannous/iclaude:preview-main` |
| Docker image (immutable) | `preview-<sha>` | `docker.io/pannous/iclaude:preview-abc1234...` |
| npm package | `next` | `bunx iclaude@next` |

Preview builds use a patch-core bump (e.g. `0.68.1-preview.*` when stable is `0.68.0`) so the in-app update checker can detect them as semver-ahead of the current stable release. They are **not** production-stable — use `latest` / semver tags for stable releases.

### Tracking prerelease updates in-app

In **Settings > Updates**, switch the update channel to **Prerelease** to receive preview builds. The default channel is **Stable** (semver releases only). Switching channels takes effect immediately on the next update check.

## Fork features (not yet in upstream)

This fork adds several features and UX improvements on top of the upstream Companion:

### Inline HTML fragments
Output HTML in a ` ```html ` code block and it auto-renders as an interactive iframe in the chat. Fragments can push state back to the agent via `window.vibeReportState()` and the agent can query it via REST. Console output (`log/warn/error/info`) is captured automatically.

### Protocol recordings
All raw WebSocket messages (NDJSON from Claude Code, JSON-RPC from Codex) are recorded to `~/.companion/recordings/` as JSONL files. Useful for debugging and building replay-based tests. Controllable via `COMPANION_RECORD=0` env var or per-session REST endpoints.

### Built-in tunnel manager
One-click toggle in Settings to expose the server over an SSH tunnel (`companion.pannous.com`). Auto-injects auth tokens so remote access is seamless.

### AI-powered input completion
Ghost text suggestions in the Composer, powered by OpenAI `gpt-4o-mini` (or OpenRouter). Accept with Tab, dismiss with Escape or Ctrl+Z. Double-tap to accept on iOS.

### Session forking
Fork button in the Composer creates a new independent session seeded with the current conversation history. The forked session auto-loads prior transcript and shows a "(fork)" suffix.

### AI session auto-namer
After the first assistant turn, sessions are automatically renamed using an AI summary (via OpenRouter or OpenAI fallback). The AI-generated title takes priority in the sidebar.

### Slash command auto-discovery
Root-level scripts (`.claude/commands/*.md`, project scripts) are auto-discovered and surfaced as slash commands in the HomePage and Composer menu. Global prompts from `~/.claude/prompts/*.md` are also available.

### File-based prompt manager
Prompts are stored as individual Markdown files (`~/.claude/prompts/*.md` for global, `{cwd}/.claude/commands/*.md` for project), diverging from upstream's single JSON file approach.

### Built-in code editor pane
`SessionEditorPane` — an in-browser file editor tab with syntax highlighting, file size gates for large files, and the ability to open files directly from chat by clicking paths.

### Desktop notifications
Background sessions send native desktop notifications on permission requests and when they finish.

### CLAUDE.md editor
Edit the project's `CLAUDE.md` directly from the TopBar without leaving the UI.

### Per-project session grouping
Sidebar groups sessions by project folder. Clicking a folder label opens a new session in that folder. Per-project resume dropdown lets you quickly resume recent sessions.

### Ghost session filter
Sidebar filters out "ghost" sessions — those with no title, no history, and no meaningful state. Upstream shows everything.

### Direct action buttons in sidebar
Archive, restore, delete, and rename actions are exposed as direct buttons on session rows instead of upstream's three-dot context menu. Rename is triggered by double-click.

### 3-column grid navigation
Sidebar footer uses a compact 3-column grid layout for navigation instead of upstream's vertical Workbench/Workspace grouped sections. No external links section.

### YOLO mode by default
Permission mode defaults to `bypassPermissions` (agent mode). Upstream defaults to `"default"` which requires explicit approvals.

### Smarter session pruning
Sessions are only pruned if genuinely abandoned (no cwd, no history, no title). Upstream is more aggressive. Exited sessions are only restored if resumable, named, or archived.

### Message deduplication
User messages are deduplicated on reconnect by preserving client-generated IDs. Extended-thinking assistant messages sharing the same ID are also deduplicated.

### System tag stripping
XML system-injected tags (`<system-reminder>`, etc.) are stripped from session titles and message displays at all layers.

### Clickable paths and URLs
Inline-code URLs in chat are clickable. Bare filenames are searched in the project directory and linked if found.

### Message queue management
Send-now button to bypass the pending-input queue. Cancel queued messages before they reach the CLI. Clear-input event support.

### Scroll behavior
Auto-scroll disables when the scroll-to-bottom button is visible. Clicking the TopBar session tab scrolls to top.

### iOS/iPad improvements
Text selection enabled in shell output. Double-tap to accept ghost completion. Auth cookie uses `SameSite=Lax` to fix cross-site navigation issues. WKWebView reload loop eliminated.

### Siri Shortcuts / Apple Watch API
`/api/ask` endpoint for sending prompts via Siri Shortcuts or Apple Watch.

### Compacting context indicator
Visual indicator in the message feed when Claude's context is being compacted.

### Draft persistence
Composer input drafts persist across HMR and server restarts.

### Auth improvements
Auth is disabled by default (`COMPANION_AUTH=1` to enable). When disabled, all API calls skip authentication. Auto-auth on startup prevents login-page flash. Unified login page replaces separate token page.

### OpenRouter / AI provider toggle
Settings toggle between OpenRouter and direct Claude API for features like auto-naming and completion.

### Image serving route
`/api/images/*` route with tilde expansion for serving local images (used for iMessage integration).

## Docs
- **Full documentation**: [`docs/`](docs/) (Mintlify — run `cd docs && mint dev` to preview locally)
- Protocol reverse engineering: [`WEBSOCKET_PROTOCOL_REVERSED.md`](WEBSOCKET_PROTOCOL_REVERSED.md)
- Contributor and architecture guide: [`CLAUDE.md`](CLAUDE.md)

## License
MIT
