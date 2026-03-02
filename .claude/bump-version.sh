#!/usr/bin/env bash
# Auto-increment patch version once per Claude Code session.
# Called by SessionStart hook.

PKG="$(dirname "$0")/../web/package.json"
[ -f "$PKG" ] || exit 0

current=$(grep -m1 '"version"' "$PKG" | sed 's/.*"\([0-9.]*\)".*/\1/')
major=$(echo "$current" | cut -d. -f1)
minor=$(echo "$current" | cut -d. -f2)
patch=$(echo "$current" | cut -d. -f3)
new="$major.$minor.$((patch + 1))"

sed -i '' "s/\"version\": \"$current\"/\"version\": \"$new\"/" "$PKG"
echo "Companion version bumped: $current → $new" >&2
