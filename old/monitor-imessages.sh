#!/bin/bash

# iMessage Monitor Script
# Monitors the Messages database for new messages and displays them

DB_PATH="$HOME/Library/Messages/chat.db"
STATE_FILE="/tmp/imessage_monitor_state.txt"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if fswatch is installed
if ! command -v fswatch &> /dev/null; then
    echo "Installing fswatch..."
    brew install fswatch
fi

# Initialize state file with current message count
if [ ! -f "$STATE_FILE" ]; then
    sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM message" > "$STATE_FILE"
    echo "Initialized. Monitoring for new messages..."
fi

# Function to get new messages
get_new_messages() {
    LAST_COUNT=$(cat "$STATE_FILE")
    CURRENT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM message")

    if [ "$CURRENT_COUNT" -gt "$LAST_COUNT" ]; then
        NUM_NEW=$((CURRENT_COUNT - LAST_COUNT))
        echo -e "${GREEN}📨 $NUM_NEW new message(s) detected!${NC}\n"

        # Query for the new messages
        sqlite3 -json "$DB_PATH" "
            SELECT
                m.ROWID as message_id,
                CASE
                    WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
                    ELSE '[Rich content or attachment]'
                END as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as sender,
                m.is_from_me
            FROM message m
            INNER JOIN handle h ON h.ROWID = m.handle_id
            WHERE m.ROWID > (SELECT MAX(ROWID) FROM message LIMIT 1 OFFSET $LAST_COUNT)
            ORDER BY m.date ASC
            LIMIT $NUM_NEW
        " | jq -r '.[] |
            if .is_from_me == 1 then
                "[\(.date)] ${BLUE}You${NC} -> \(.sender): \(.content)"
            else
                "[\(.date)] ${YELLOW}\(.sender)${NC}: \(.content)"
            end'

        echo ""

        # Update state file
        echo "$CURRENT_COUNT" > "$STATE_FILE"

        # Optional: Send macOS notification
        osascript -e "display notification \"$NUM_NEW new message(s)\" with title \"iMessage Monitor\""
    fi
}

# Main monitoring loop
echo "🔍 Monitoring Messages database for new messages..."
echo "Press Ctrl+C to stop"
echo ""

# Check for new messages every time the database is modified
fswatch -0 "$DB_PATH" | while read -d "" event; do
    # Small delay to let the database finish writing
    sleep 0.5
    get_new_messages
done
