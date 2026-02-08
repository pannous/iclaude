# iMessage Monitor Scripts

Two scripts for monitoring Apple Messages in real-time.

## Scripts

### 1. `monitor-imessages.sh` (Bash version)
Simple bash script using fswatch and sqlite3.

**Usage:**
```bash
~/dev/bin/monitor-imessages.sh
```

**Requirements:**
- fswatch (auto-installed via brew)
- jq (for JSON parsing)

### 2. `monitor-imessages.js` (Node.js version)
Advanced version with rich message parsing, based on Anthropic's iMessage MCP server.

**Usage:**
```bash
~/dev/bin/monitor-imessages.js
```

**Requirements:**
- Node.js 16+

**Features:**
- ✅ Decodes attributedBody rich messages
- ✅ Shows attachments (📎)
- ✅ Handles URLs
- ✅ macOS notifications
- ✅ Color-coded output
- ✅ Persistent state (tracks last seen message)

## Setup

### First time setup:

1. **Grant Full Disk Access** to Terminal/iTerm:
   ```
   System Settings → Privacy & Security → Full Disk Access → Add Terminal
   ```

2. **Install dependencies** (for bash version):
   ```bash
   brew install fswatch jq
   ```

3. **Test access**:
   ```bash
   sqlite3 ~/Library/Messages/chat.db "SELECT COUNT(*) FROM message;"
   ```

## Examples

### Start monitoring:
```bash
# Bash version (simple)
monitor-imessages.sh

# Node.js version (recommended)
monitor-imessages.js
```

### Run in background:
```bash
# Run in background and log to file
monitor-imessages.js > /tmp/imessage-monitor.log 2>&1 &

# View log
tail -f /tmp/imessage-monitor.log
```

### Stop monitoring:
Press `Ctrl+C` or kill the process.

## Output Format

```
[12:34 PM] John Doe ← Hey, how are you?
[12:35 PM] You → I'm good, thanks! 📎
[12:36 PM] +1234567890 ← Check this out [https://example.com]
```

## Troubleshooting

**"Cannot access Messages database"**
- Grant Full Disk Access to Terminal in System Settings

**No messages appearing**
- Send yourself a test message
- Check that Messages.app is running
- Verify database access: `ls -l ~/Library/Messages/chat.db`

## Implementation Details

Based on the Anthropic iMessage MCP server:
- Database: `~/Library/Messages/chat.db`
- Tables: `message`, `handle`, `attachment`
- Date format: Nanoseconds since 2001-01-01
- Rich content: Binary attributedBody requires hex decoding

## See Also

- Full MCP server: `/Users/me/Library/Application Support/Claude/Claude Extensions/ant.dir.ant.anthropic.imessage/server/index.js`
