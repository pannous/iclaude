# iMessage Claude Bot

Automatically responds to messages you send yourself using Claude API.

## How It Works

1. **Monitors** for new messages from `+4917664638989` (you)
2. **Forwards** the message content to Claude API
3. **Sends** Claude's response back as an iMessage

## Setup

### 1. Set your API key

```bash
# Add to ~/.zshrc or ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-..."

# Or set for current session
export ANTHROPIC_API_KEY="sk-ant-..."
```

Get your API key from: https://console.anthropic.com/settings/keys

### 2. Grant Full Disk Access

System Settings → Privacy & Security → Full Disk Access → Add Terminal

### 3. Test Messages.app access

```bash
sqlite3 ~/Library/Messages/chat.db "SELECT COUNT(*) FROM message;"
```

## Usage

### Start the bot:

```bash
cd ~/dev/bin
./imessage-claude-bot.js
```

Or with explicit API key:
```bash
ANTHROPIC_API_KEY="sk-ant-..." ./imessage-claude-bot.js
```

### Run in background:

```bash
# Start in background
nohup ./imessage-claude-bot.js > /tmp/claude-bot.log 2>&1 &

# View log
tail -f /tmp/claude-bot.log

# Stop bot
pkill -f imessage-claude-bot
```

## Example Interaction

**You send yourself:** "What's the weather like in Berlin?"

**Bot automatically replies:** "I don't have access to real-time weather data, but you can check..."

## Configuration

Edit `imessage-claude-bot.js` to customize:

- **YOUR_NUMBER**: Your phone number (currently `+4917664638989`)
- **Model**: Change `claude-sonnet-4-20250514` to another model
- **Max tokens**: Adjust response length (currently 1024)
- **System prompt**: Add personality or instructions

### Example: Add a system prompt

```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: 'You are a helpful assistant. Keep responses concise for iMessage.',
  messages: [{ role: 'user', content: message }]
});
```

## Monitoring

The bot logs all activity:

```
✅ iMessage Claude Bot Started
📱 Monitoring messages from: +4917664638989

📨 1 new message(s) from yourself

[14:57:19] +4917664638989: What's 2+2?
🤖 Asking Claude...
✓ Got response (156 chars)
📤 Sent response to +4917664638989

Response: 2 + 2 = 4
```

## Troubleshooting

**"ANTHROPIC_API_KEY environment variable not set"**
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

**"Cannot access Messages database"**
- Grant Full Disk Access to Terminal in System Settings

**Messages not being detected**
- Check that YOUR_NUMBER matches your phone number format
- Try sending a test message to yourself
- View logs: `tail -f /tmp/claude-bot.log`

**AppleScript send errors**
- Ensure Messages.app is running
- Check that iMessage is enabled
- Test manual AppleScript:
  ```bash
  osascript -e 'tell application "Messages" to send "test" to buddy "+4917664638989"'
  ```

## Safety Notes

⚠️ This bot will:
- Automatically send messages without confirmation
- Use your Claude API credits
- Only respond to messages from YOUR_NUMBER

Consider adding:
- Rate limiting
- Cost tracking
- Message filtering
- Confirmation prompts

## Advanced Usage

### Rate limiting:

Add to the script:
```javascript
let lastResponse = 0;
const RATE_LIMIT_MS = 60000; // 1 minute

async function processMessage(msg) {
  if (Date.now() - lastResponse < RATE_LIMIT_MS) {
    console.log('⏱ Rate limited, skipping...');
    return;
  }
  lastResponse = Date.now();
  // ... rest of function
}
```

### Cost tracking:

```javascript
let totalTokens = 0;
totalTokens += response.usage.input_tokens + response.usage.output_tokens;
console.log(`💰 Total tokens used: ${totalTokens}`);
```

## Files

- `imessage-claude-bot.js` - Main bot script
- `monitor-imessages.js` - General message monitor (no auto-reply)
- `package.json` - Dependencies
- `node_modules/` - Installed packages
