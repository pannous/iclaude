#!/bin/bash
# Auto-reload iClaude monitor when source file changes

SCRIPT="iclaude-imessages-monitor.py"
PID=""

cleanup() {
    echo -e "\n👋 Stopping..."
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null
        wait "$PID" 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

start_monitor() {
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "🔄 Restarting monitor..."
        kill "$PID" 2>/dev/null
        wait "$PID" 2>/dev/null
    else
        echo "🚀 Starting monitor..."
    fi

    python3 "$SCRIPT" &
    PID=$!
    echo "📝 PID: $PID"
}

# Start initially
start_monitor

# Watch for changes and restart
fswatch -o "$SCRIPT" | while read -r; do
    echo -e "\n📂 File changed detected!"
    start_monitor
done
