# Competitive Analysis: yepanywhere vs companion

**Checked**: 2026-02-25
**Verdict**: No code theft in either direction.

## kzahel/yepanywhere

- URL: https://github.com/kzahel/yepanywhere
- Stars: 94 | Releases: 22 (latest v0.4.5) | Commits: 682
- License: MIT

### Timeline (yepanywhere is older)

| Event | Date | Repo |
|---|---|---|
| yepanywhere first commit | **2025-12-28** | kzahel/yepanywhere |
| The-Vibe-Company/companion created | **2026-02-07** | upstream |

yepanywhere predates companion by ~6 weeks — ruling out copying from companion.

### Architecture (fundamentally different)

| Aspect | companion (upstream) | yepanywhere |
|---|---|---|
| CLI integration | `--sdk-url` WS reverse-engineered NDJSON | Official `@anthropic-ai/claude-agent-sdk` |
| Runtime | Bun | Node.js |
| Package manager | bun | pnpm |
| Session persistence | Custom JSON in `$TMPDIR/vibe-sessions/` | Reads native `~/.claude/projects/` JSONL |
| Remote access | None | E2E encrypted relay (SRP-6a + NaCl) |
| Mobile | No | Yes (Tauri 2 + push notifications) |
| Auth | Simple token | SRP-6a password auth |
| Multi-provider | Claude Code + Codex | Claude + Codex + Gemini + OpenCode |
| File upload | No | Yes (chunked WS upload) |

### Why They Look Similar

Both target the same problem (browser UI for Claude Code), use the same popular stack (Hono, React, TypeScript), and implement patterns dictated by Claude's own API (tool approvals, session streaming, JSONL history). These are **convergent choices**, not copying.

Neither repo references the other. Both MIT licensed independently.
