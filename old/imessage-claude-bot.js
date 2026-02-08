#!/usr/bin/env node

/**
 * iMessage Claude Bot
 * Automatically responds to messages from +4917664638989 using Claude API
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { watch } from 'fs';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const execAsync = promisify(exec);

const DB_PATH = `${homedir()}/Library/Messages/chat.db`;
const STATE_FILE = '/tmp/imessage_claude_bot_state.json';
const YOUR_NUMBER = '+4917664638989';

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

// Decode attributedBody
function decodeAttributedBody(hexString) {
  try {
    const buffer = Buffer.from(hexString, 'hex');
    const content = buffer.toString();

    const patterns = [
      /NSString">(.*?)</,
      /NSString">([^<]+)/,
      /NSNumber">\d+<.*?NSString">(.*?)</,
      /NSArray">.*?NSString">(.*?)</,
      /"string":\s*"([^"]+)"/,
    ];

    let text = '';
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1] && match[1].length > 5) {
        text = match[1].replace(/\s+/g, ' ').trim();
        break;
      }
    }

    return text || '[Rich content]';
  } catch (error) {
    return '[Message not readable]';
  }
}

// Get state
function getState() {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  }
  return { lastMessageId: 0 };
}

// Save state
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Query new messages from yourself
async function getNewMessagesFromSelf(lastMessageId) {
  const query = `
    SELECT
      m.ROWID as message_id,
      CASE
        WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
        WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
        ELSE NULL
      END as content,
      datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
      h.id as sender,
      m.is_from_me,
      CASE
        WHEN m.text IS NOT NULL AND m.text != '' THEN 0
        WHEN m.attributedBody IS NOT NULL THEN 1
        ELSE 2
      END as content_type
    FROM message m
    INNER JOIN handle h ON h.ROWID = m.handle_id
    WHERE m.ROWID > ${lastMessageId}
      AND h.id = '${YOUR_NUMBER}'
      AND m.is_from_me = 0
      AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL)
      AND m.item_type = 0
    ORDER BY m.date ASC
  `;

  try {
    const { stdout } = await execAsync(`sqlite3 -json "${DB_PATH}" "${query}"`);

    if (!stdout.trim()) {
      return [];
    }

    const messages = JSON.parse(stdout);

    return messages.map(msg => {
      let content = msg.content || '';

      if (msg.content_type === 1) {
        content = decodeAttributedBody(content);
      }

      return {
        id: msg.message_id,
        content,
        date: msg.date,
        sender: msg.sender
      };
    });
  } catch (error) {
    console.error('Error querying messages:', error.message);
    return [];
  }
}

// Call Claude API
async function askClaude(message) {
  try {
    console.log(`${colors.cyan}🤖 Asking Claude...${colors.reset}`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    const reply = response.content[0].text;
    console.log(`${colors.green}✓ Got response (${reply.length} chars)${colors.reset}`);
    return reply;
  } catch (error) {
    console.error(`${colors.yellow}⚠ Claude API error: ${error.message}${colors.reset}`);
    return `Sorry, I encountered an error: ${error.message}`;
  }
}

// Send iMessage via AppleScript
async function sendMessage(phoneNumber, text) {
  // Escape quotes and backslashes for AppleScript
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

  const script = `
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${phoneNumber}" of targetService
      send "${escapedText}" to targetBuddy
    end tell
  `;

  try {
    await execAsync(`osascript -e '${script}'`);
    console.log(`${colors.blue}📤 Sent response to ${phoneNumber}${colors.reset}\n`);
    return true;
  } catch (error) {
    console.error(`${colors.yellow}⚠ Failed to send message: ${error.message}${colors.reset}`);
    return false;
  }
}

// Process message and respond
async function processMessage(msg) {
  const timestamp = new Date(msg.date).toLocaleTimeString();

  console.log(`\n${colors.gray}[${timestamp}]${colors.reset} ${colors.magenta}${msg.sender}${colors.reset}: ${msg.content}`);

  // Get Claude's response
  const response = await askClaude(msg.content);

  // Send response back
  await sendMessage(msg.sender, response);

  // Show what was sent
  console.log(`${colors.gray}Response:${colors.reset} ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
}

// Main monitoring function
async function checkForNewMessages() {
  const state = getState();
  const messages = await getNewMessagesFromSelf(state.lastMessageId);

  if (messages.length > 0) {
    console.log(`${colors.green}📨 ${messages.length} new message(s) from yourself${colors.reset}`);

    for (const msg of messages) {
      await processMessage(msg);
    }

    // Update state
    state.lastMessageId = messages[messages.length - 1].id;
    saveState(state);
  }
}

// Initialize
async function initialize() {
  // Check API key
  if (!anthropic.apiKey) {
    console.error('❌ ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable not set');
    console.error('   Set it with: export ANTHROPIC_API_KEY=your-api-key');
    process.exit(1);
  }

  // Check database access
  try {
    await execAsync(`sqlite3 "${DB_PATH}" "SELECT 1;"`);
  } catch (error) {
    console.error('❌ Cannot access Messages database. Grant Full Disk Access to Terminal.');
    process.exit(1);
  }

  // Initialize state if needed
  const state = getState();
  if (state.lastMessageId === 0) {
    const { stdout } = await execAsync(`sqlite3 "${DB_PATH}" "SELECT MAX(ROWID) FROM message;"`);
    state.lastMessageId = parseInt(stdout.trim()) || 0;
    saveState(state);
  }

  console.log(`${colors.green}✅ iMessage Claude Bot Started${colors.reset}`);
  console.log(`${colors.cyan}📱 Monitoring messages from: ${YOUR_NUMBER}${colors.reset}`);
  console.log(`${colors.gray}   Press Ctrl+C to stop${colors.reset}\n`);
}

// Start monitoring
async function main() {
  await initialize();

  let debounceTimer;

  watch(DB_PATH, async (eventType) => {
    if (eventType === 'change') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await checkForNewMessages();
      }, 500);
    }
  });
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopped Claude bot');
  process.exit(0);
});

main().catch(console.error);
