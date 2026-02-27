#!/usr/bin/env bash
lsof -ti :3456 | xargs -r kill -9
bun run dev
