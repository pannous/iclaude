#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# error-monitor.sh — Watches dev server logs for errors and spawns a Claude
# agent to fix them. Only one agent runs at a time to prevent explosion.
#
# Usage:
#   ./scripts/error-monitor.sh              Watch .dev-backend.log + .dev-vite.log
#   ./scripts/error-monitor.sh --pipe       Read from stdin (pipe dev output into it)
#   ./scripts/error-monitor.sh --log FILE   Watch a specific log file
#
# Examples:
#   # Watch log files produced by dev-start.sh
#   ./scripts/error-monitor.sh
#
#   # Pipe dev output directly
#   bun run dev 2>&1 | ./scripts/error-monitor.sh --pipe
# =============================================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_LOG="$ROOT_DIR/.dev-backend.log"
VITE_LOG="$ROOT_DIR/.dev-vite.log"
LOCK_FILE="$ROOT_DIR/.error-monitor.lock"
AGENT_PID_FILE="$ROOT_DIR/.error-monitor-agent.pid"
AGENT_LOG_DIR="$ROOT_DIR/.error-monitor-logs"
COOLDOWN_FILE="$ROOT_DIR/.error-monitor-cooldown"

DRY_RUN=false

# Cooldown: don't re-trigger on the same error within this window (seconds)
COOLDOWN_SECONDS=120
# Max lines of context to capture around an error
CONTEXT_LINES=30

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${GREEN}[monitor]${NC} $*"; }
warn()  { echo -e "${YELLOW}[monitor]${NC} $*"; }
error() { echo -e "${RED}[monitor]${NC} $*"; }
dim()   { echo -e "${DIM}[monitor]${NC} $*"; }

mkdir -p "$AGENT_LOG_DIR"

# --------------- Error detection patterns ---------------
# Matches TypeScript/Bun/Node errors, stack traces, and common failure modes
is_error_line() {
  local line="$1"
  # Skip lines that are just ANSI color codes or empty
  local stripped
  stripped=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g' | xargs)
  [[ -z "$stripped" ]] && return 1

  # Match real errors — be selective to avoid false positives
  echo "$stripped" | grep -qiE \
    '(^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError)|error:.*at |ENOENT|EACCES|EADDRINUSE|ECONNREFUSED|Cannot find module|Module not found|failed to|Build failed|Compilation failed|TypeScript.*error|TS[0-9]+:|panic|Segmentation fault|FATAL|Unhandled|uncaught|throw new|\.ts\([0-9]+,[0-9]+\):.*error)' 2>/dev/null
}

# --------------- Agent management ---------------
is_agent_running() {
  if [[ -f "$AGENT_PID_FILE" ]]; then
    local pid
    pid=$(cat "$AGENT_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    # Stale PID file
    rm -f "$AGENT_PID_FILE"
  fi
  return 1
}

is_in_cooldown() {
  local error_hash="$1"
  if [[ -f "$COOLDOWN_FILE" ]]; then
    local last_hash last_time now
    last_hash=$(sed -n '1p' "$COOLDOWN_FILE")
    last_time=$(sed -n '2p' "$COOLDOWN_FILE")
    now=$(date +%s)
    if [[ "$last_hash" == "$error_hash" ]] && (( now - last_time < COOLDOWN_SECONDS )); then
      return 0
    fi
  fi
  return 1
}

set_cooldown() {
  local error_hash="$1"
  echo "$error_hash" > "$COOLDOWN_FILE"
  date +%s >> "$COOLDOWN_FILE"
}

spawn_fixer_agent() {
  local error_context="$1"
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  local agent_log="$AGENT_LOG_DIR/fix-$timestamp.log"

  info "Spawning Claude agent to fix error..."
  dim "Agent log: $agent_log"

  # Write prompt to a temp file to avoid heredoc-in-subshell issues
  local prompt_file="$AGENT_LOG_DIR/.prompt-$timestamp.txt"
  cat > "$prompt_file" <<PROMPT
You are an auto-fix agent monitoring the Vibe Companion dev server.

The dev server produced the following error output:

\`\`\`
$error_context
\`\`\`

Your job:
1. Identify the root cause of this error
2. Fix it by editing the relevant source files
3. The dev server uses bun --watch so your file edits will auto-reload
4. Verify your fix makes sense (don't introduce new bugs)
5. Keep changes minimal and focused

Project root: $ROOT_DIR
The code lives under web/ (web/server/ for backend, web/src/ for frontend).

Do NOT:
- Restart the dev server (it auto-reloads)
- Make unrelated changes
- Add debug console.logs (remove them if you add any temporarily)
- Modify tests or CLAUDE.md
PROMPT

  if $DRY_RUN; then
    info "[dry-run] Would spawn agent with prompt:"
    dim "$(head -5 "$prompt_file")"
    dim "..."
    rm -f "$prompt_file"
    return
  fi

  # Spawn claude in the background, working in the project directory
  (
    cd "$ROOT_DIR"
    claude --print -p "$(cat "$prompt_file")" > "$agent_log" 2>&1
    rm -f "$prompt_file"
  ) &

  local agent_pid=$!
  echo "$agent_pid" > "$AGENT_PID_FILE"
  info "Agent spawned (PID: $agent_pid)"
}

# --------------- Error accumulator ---------------
# Collects multi-line error output (stack traces etc.) before triggering
ERROR_BUFFER=""
ERROR_BUFFER_LINES=0
COLLECTING_ERROR=false
COLLECT_TIMER_PID=""

flush_error_buffer() {
  if [[ -z "$ERROR_BUFFER" ]]; then
    return
  fi

  local context="$ERROR_BUFFER"
  ERROR_BUFFER=""
  ERROR_BUFFER_LINES=0
  COLLECTING_ERROR=false

  # Kill any pending flush timer
  if [[ -n "$COLLECT_TIMER_PID" ]] && kill -0 "$COLLECT_TIMER_PID" 2>/dev/null; then
    kill "$COLLECT_TIMER_PID" 2>/dev/null || true
  fi
  COLLECT_TIMER_PID=""

  # Hash the first error line for dedup
  local first_line
  first_line=$(echo "$context" | head -1)
  local error_hash
  error_hash=$(echo "$first_line" | shasum -a 256 | cut -d' ' -f1 | head -c 16)

  # Check cooldown
  if is_in_cooldown "$error_hash"; then
    dim "Same error within cooldown window, skipping"
    return
  fi

  # Check if agent is already running
  if is_agent_running; then
    warn "Agent already running (PID: $(cat "$AGENT_PID_FILE")), queuing error for later"
    return
  fi

  set_cooldown "$error_hash"

  echo ""
  error "========== ERROR DETECTED =========="
  echo "$context" | head -20
  error "===================================="
  echo ""

  spawn_fixer_agent "$context"
}

start_flush_timer() {
  # After 2 seconds of no new error lines, flush the buffer
  if [[ -n "$COLLECT_TIMER_PID" ]] && kill -0 "$COLLECT_TIMER_PID" 2>/dev/null; then
    kill "$COLLECT_TIMER_PID" 2>/dev/null || true
  fi
  ( sleep 2 && kill -USR1 $$ 2>/dev/null ) &
  COLLECT_TIMER_PID=$!
}

trap flush_error_buffer USR1

process_line() {
  local line="$1"

  if is_error_line "$line"; then
    COLLECTING_ERROR=true
    ERROR_BUFFER+="$line"$'\n'
    ERROR_BUFFER_LINES=$((ERROR_BUFFER_LINES + 1))
    start_flush_timer
  elif $COLLECTING_ERROR; then
    # Continue collecting if this looks like a stack trace continuation or related output
    local stripped
    stripped=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
    if echo "$stripped" | grep -qE '^\s+(at |\.{3}|Caused by|from |→|[0-9]+\||\/.*\.(ts|js|tsx|jsx):[0-9])' 2>/dev/null; then
      ERROR_BUFFER+="$line"$'\n'
      ERROR_BUFFER_LINES=$((ERROR_BUFFER_LINES + 1))
      start_flush_timer
    else
      # Non-continuation line — flush what we have
      flush_error_buffer
    fi

    # Cap buffer size
    if (( ERROR_BUFFER_LINES >= CONTEXT_LINES )); then
      flush_error_buffer
    fi
  fi
}

# --------------- Cleanup ---------------
cleanup() {
  # Kill flush timer if running
  if [[ -n "$COLLECT_TIMER_PID" ]] && kill -0 "$COLLECT_TIMER_PID" 2>/dev/null; then
    kill "$COLLECT_TIMER_PID" 2>/dev/null || true
  fi
  rm -f "$LOCK_FILE"
  info "Monitor stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# --------------- Prevent duplicate monitors ---------------
if [[ -f "$LOCK_FILE" ]]; then
  existing_pid=$(cat "$LOCK_FILE")
  if kill -0 "$existing_pid" 2>/dev/null; then
    error "Monitor already running (PID: $existing_pid). Kill it first or remove $LOCK_FILE"
    exit 1
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"

# --------------- Main: choose input mode ---------------
MODE="logfiles"
CUSTOM_LOG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pipe)     MODE="pipe"; shift ;;
    --log)      MODE="custom"; CUSTOM_LOG="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--pipe | --log FILE]"
      echo "  (default)   Watch .dev-backend.log and .dev-vite.log"
      echo "  --pipe      Read from stdin"
      echo "  --log FILE  Watch a specific log file"
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

info "Error monitor started (PID: $$)"
info "Cooldown: ${COOLDOWN_SECONDS}s | Max context: ${CONTEXT_LINES} lines"

case "$MODE" in
  pipe)
    info "Reading from stdin (pipe mode)"
    while IFS= read -r line; do
      # Pass through to terminal
      echo "$line"
      process_line "$line"
    done
    ;;

  custom)
    if [[ ! -f "$CUSTOM_LOG" ]]; then
      warn "Log file not found yet: $CUSTOM_LOG (waiting...)"
    fi
    info "Watching: $CUSTOM_LOG"
    tail -n 0 -F "$CUSTOM_LOG" 2>/dev/null | while IFS= read -r line; do
      process_line "$line"
    done
    ;;

  logfiles)
    # Watch both dev-start.sh log files
    for f in "$BACKEND_LOG" "$VITE_LOG"; do
      if [[ ! -f "$f" ]]; then
        warn "Log file not found: $f (will watch when created)"
      fi
    done
    info "Watching: .dev-backend.log, .dev-vite.log"

    # Use tail -F on both files, merged into one stream
    tail -n 0 -F "$BACKEND_LOG" "$VITE_LOG" 2>/dev/null | while IFS= read -r line; do
      # Skip tail's "==> filename <==" headers
      if [[ "$line" =~ ^==\>.*/.*\<==$ ]]; then
        continue
      fi
      process_line "$line"
    done
    ;;
esac
