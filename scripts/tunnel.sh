#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# tunnel.sh — Expose the Companion dev/prod server through a public URL
#
# Usage:
#   ./scripts/tunnel.sh            Start tunnel (auto-detects port)
#   ./scripts/tunnel.sh --stop     Stop the running tunnel
#   ./scripts/tunnel.sh --status   Show tunnel URL if running
#   ./scripts/tunnel.sh --port N   Tunnel a specific port
#
# Prefers cloudflared (no account needed), falls back to ngrok.
# Auto-detects dev mode (Vite :2345) vs prod mode (backend :3456).
# =============================================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/.tunnel.pid"
URL_FILE="$ROOT_DIR/.tunnel.url"
LOG_FILE="$ROOT_DIR/.tunnel.log"
VITE_CONFIG="$ROOT_DIR/web/vite.config.ts"

VITE_PORT=2345
BACKEND_PORT=3456

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $*"; }
die()   { echo -e "${RED}[xx]${NC} $*" >&2; exit 1; }
step()  { echo -e "${CYAN}-->>${NC} $*"; }

is_port_listening() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null
}

# Add a wildcard host entry to vite.config.ts allowedHosts (idempotent).
# Vite dev server watches vite.config.ts and auto-restarts on change.
vite_add_host() {
  local host="$1"
  grep -qF "\"$host\"" "$VITE_CONFIG" && return 0  # already present
  sed -i '' "s/allowedHosts: \[/allowedHosts: [\"$host\",/" "$VITE_CONFIG"
  step "Added \"$host\" to vite.config.ts allowedHosts (Vite will auto-restart)"
}

# Remove the wildcard entry added by vite_add_host.
vite_remove_host() {
  local host="$1"
  grep -qF "\"$host\"" "$VITE_CONFIG" || return 0  # not present
  sed -i '' "s/\"$host\",//" "$VITE_CONFIG"
  info "Removed \"$host\" from vite.config.ts allowedHosts"
}

pick_port() {
  if is_port_listening "$VITE_PORT"; then
    echo "$VITE_PORT"
  elif is_port_listening "$BACKEND_PORT"; then
    echo "$BACKEND_PORT"
  else
    echo ""
  fi
}

cmd_stop() {
  # Remove any hosts we added to vite.config.ts
  vite_remove_host ".trycloudflare.com"
  vite_remove_host ".ngrok-free.app"
  vite_remove_host ".ngrok.io"

  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      info "Tunnel stopped (PID $pid)"
    else
      info "Tunnel was not running"
    fi
    rm -f "$PID_FILE" "$URL_FILE"
  else
    info "No tunnel PID file found"
  fi
}

cmd_status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    local url
    url=$(cat "$URL_FILE" 2>/dev/null || echo "URL not yet known")
    info "Tunnel is running (PID $(cat "$PID_FILE"))"
    echo -e "  ${BOLD}${CYAN}${url}${NC}"
    return 0
  else
    warn "No tunnel running"
    rm -f "$PID_FILE" "$URL_FILE" 2>/dev/null || true
    return 1
  fi
}

# Extract URL from cloudflared output (looks for https://*.trycloudflare.com)
wait_for_cloudflare_url() {
  local log="$1"
  local max_wait=20
  local waited=0
  while [ $waited -lt $max_wait ]; do
    local url
    url=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$log" 2>/dev/null | head -1 || true)
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# Extract URL from ngrok output via its local API
wait_for_ngrok_url() {
  local max_wait=15
  local waited=0
  while [ $waited -lt $max_wait ]; do
    local url
    url=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -oE '"public_url":"https://[^"]*"' \
      | head -1 \
      | grep -oE 'https://[^"]*' || true)
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

start_cloudflared() {
  local port="$1"
  vite_add_host ".trycloudflare.com"
  step "Starting cloudflared tunnel on port $port..."
  nohup cloudflared tunnel --url "http://localhost:$port" \
    --no-autoupdate \
    >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  printf "  Waiting for URL"
  local url
  if url=$(wait_for_cloudflare_url "$LOG_FILE"); then
    echo ""
    echo "$url" >"$URL_FILE"
    info "Tunnel active!"
    echo -e "\n  ${BOLD}${CYAN}$url${NC}\n"
    echo -e "  Run ${YELLOW}./scripts/tunnel.sh --stop${NC} to shut down"
  else
    echo ""
    warn "cloudflared started but URL not detected within timeout."
    warn "Check $LOG_FILE for details."
    warn "PID stored in $PID_FILE — run --stop to clean up."
    exit 1
  fi
}

start_ngrok() {
  local port="$1"
  vite_add_host ".ngrok-free.app"
  vite_add_host ".ngrok.io"
  step "Starting ngrok tunnel on port $port..."
  # Kill any existing ngrok on port 4040
  pkill -f "ngrok http $port" 2>/dev/null || true
  sleep 1
  nohup ngrok http "$port" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"

  printf "  Waiting for URL"
  local url
  if url=$(wait_for_ngrok_url); then
    echo ""
    echo "$url" >"$URL_FILE"
    info "Tunnel active!"
    echo -e "\n  ${BOLD}${CYAN}$url${NC}\n"
    echo -e "  Dashboard: ${CYAN}http://localhost:4040${NC}"
    echo -e "  Run ${YELLOW}./scripts/tunnel.sh --stop${NC} to shut down"
  else
    echo ""
    warn "ngrok started but URL not detected. Check http://localhost:4040"
    warn "PID stored in $PID_FILE — run --stop to clean up."
    exit 1
  fi
}

cmd_start() {
  local port="${1:-}"

  # Already running?
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    local existing_url
    existing_url=$(cat "$URL_FILE" 2>/dev/null || echo "unknown")
    warn "Tunnel already running (PID $(cat "$PID_FILE"))"
    echo -e "  URL: ${CYAN}$existing_url${NC}"
    echo -e "  Run ${YELLOW}./scripts/tunnel.sh --stop${NC} first to restart."
    exit 0
  fi
  rm -f "$PID_FILE" "$URL_FILE"

  # Pick port
  if [ -z "$port" ]; then
    port=$(pick_port)
    if [ -z "$port" ]; then
      die "No server detected on port $VITE_PORT or $BACKEND_PORT. Start the dev server first:\n  make dev"
    fi
    if [ "$port" = "$VITE_PORT" ]; then
      step "Detected dev mode — tunneling Vite frontend (port $VITE_PORT)"
    else
      step "Detected backend (port $BACKEND_PORT)"
    fi
  fi

  # Try cloudflared first, then ngrok
  if command -v cloudflared &>/dev/null; then
    start_cloudflared "$port"
  elif command -v ngrok &>/dev/null; then
    start_ngrok "$port"
  else
    die "No tunnel tool found. Install one:\n  brew install cloudflared\n  brew install ngrok/ngrok/ngrok"
  fi
}

# --------------- main ---------------

case "${1:-}" in
  --stop)    cmd_stop ;;
  --status)  cmd_status ;;
  --port)    cmd_start "${2:-}" ;;
  *)         cmd_start ;;
esac
