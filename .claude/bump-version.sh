#!/usr/bin/env bash
# Auto-increment patch version once per Claude Code session.
# Called by PreToolUse hook; uses a marker file to run only once.

MARKER="/tmp/companion-bump-${CLAUDE_SESSION_ID:-unknown}"
PKG="$(dirname "$0")/../web/package.json"

[ -f "$MARKER" ] && exit 0
[ -f "$PKG" ] || exit 0

# Bump patch: 0.69.0 → 0.69.1, 0.69.1 → 0.69.2, etc.
current=$(grep -m1 '"version"' "$PKG" | sed 's/.*"\([0-9.]*\)".*/\1/')
major=$(echo "$current" | cut -d. -f1)
minor=$(echo "$current" | cut -d. -f2)
patch=$(echo "$current" | cut -d. -f3)
new="$major.$minor.$((patch + 1))"

sed -i '' "s/\"version\": \"$current\"/\"version\": \"$new\"/" "$PKG"
touch "$MARKER"

echo "Companion version bumped: $current → $new" >&2
