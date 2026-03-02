#!/usr/bin/env bash
# Auto-increment patch version once per Claude Code session.
cd "$(dirname "$0")/../web" || exit 0
npm version patch --no-git-tag-version 2>&1
