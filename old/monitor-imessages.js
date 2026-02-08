#!/usr/bin/env node

/**
 * iMessage Monitor - Node.js version
 * Based on Anthropic's iMessage MCP server implementation
 * Monitors for new messages and displays them with rich content support
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { watch } from 'fs';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const execAsync = promisify(exec);

const DB_PATH = `${homedir()}/Library/Messages/chat.db`;
const STATE_FILE = '/tmp/imessage_monitor_state.json';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Decode attributedBody hex string (from Anthropic MCP server)
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
      /text[^>]*>(.*?)</,
      /message>(.*?)</
    ];

    let text = '';
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1] && match[1].length > 5) {
        text = match[1];
        break;
      }
    }

    const urlMatch = content.match(/(https?:\/\/[^\s<"]+)/);
    const url = urlMatch?.[1];

    if (!text && !url) {
      const readableText = content
        .replace(/streamtyped.*?NSString/g, '')
        .replace(/NSAttributedString.*?NSString/g, '')
        .replace(/NSDictionary.*?$/g, '')
        .replace(/\+[A-Za-z]+\s/g, '')
        .replace(/NSNumber.*?NSValue.*?\*/g, '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (readableText.length > 5) {
        text = readableText;
      } else {
        return { text: '[Rich content]' };
      }
    }

    if (text) {
      text = text
        .replace(/^[+\s]+/, '')
        .replace(/\s*iI\s*[A-Z]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return { text: text || url || '', url };
  } catch (error) {
    return { text: '[Message content not readable]' };
  }
}

// Format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Get state
function getState() {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  }
  return { lastMessageId: 0, lastCheck: Date.now() };
}

// Save state
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Query new messages
async function getNewMessages(lastMessageId) {
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
      m.cache_has_attachments,
      CASE
        WHEN m.text IS NOT NULL AND m.text != '' THEN 0
        WHEN m.attributedBody IS NOT NULL THEN 1
        ELSE 2
      END as content_type
    FROM message m
    INNER JOIN handle h ON h.ROWID = m.handle_id
    WHERE m.ROWID > ${lastMessageId}
      AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
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

      // Decode attributedBody if needed
      if (msg.content_type === 1) {
        const decoded = decodeAttributedBody(content);
        content = decoded.text;
        if (decoded.url) {
          content += ` [${decoded.url}]`;
        }
      }

      // Check for attachments
      if (msg.cache_has_attachments) {
        content += ' 📎';
      }

      return {
        id: msg.message_id,
        content,
        date: msg.date,
        sender: msg.sender,
        isFromMe: Boolean(msg.is_from_me)
      };
    });
  } catch (error) {
    console.error('Error querying messages:', error.message);
    return [];
  }
}

// Display message
function displayMessage(msg) {
  const time = formatDate(msg.date);
  const sender = msg.isFromMe
    ? `${colors.blue}You${colors.reset}`
    : `${colors.yellow}${msg.sender}${colors.reset}`;

  const arrow = msg.isFromMe ? '→' : '←';

  console.log(`${colors.gray}[${time}]${colors.reset} ${sender} ${arrow} ${msg.content}`);
}

// Send macOS notification
async function sendNotification(count, lastMessage) {
  const title = count === 1 ? 'New iMessage' : `${count} New iMessages`;
  const text = lastMessage.content.substring(0, 100);
  const subtitle = lastMessage.isFromMe ? 'You' : lastMessage.sender;

  const script = `display notification "${text}" with title "${title}" subtitle "${subtitle}"`;

  try {
    await execAsync(`osascript -e '${script}'`);
  } catch (error) {
    // Ignore notification errors
  }
}

// Main monitoring function
async function checkForNewMessages() {
  const state = getState();
  const messages = await getNewMessages(state.lastMessageId);

  if (messages.length > 0) {
    console.log(`\n${colors.green}📨 ${messages.length} new message(s)${colors.reset}\n`);

    messages.forEach(displayMessage);
    console.log('');

    // Update state
    state.lastMessageId = messages[messages.length - 1].id;
    state.lastCheck = Date.now();
    saveState(state);

    // Send notification
    await sendNotification(messages.length, messages[messages.length - 1]);
  }
}

// Initialize
async function initialize() {
  // Check database access
  try {
    await execAsync(`sqlite3 "${DB_PATH}" "SELECT 1;"`);
  } catch (error) {
    console.error('❌ Cannot access Messages database. Grant Full Disk Access to Terminal in System Settings.');
    process.exit(1);
  }

  // Initialize state if needed
  const state = getState();
  if (state.lastMessageId === 0) {
    const { stdout } = await execAsync(`sqlite3 "${DB_PATH}" "SELECT MAX(ROWID) FROM message;"`);
    state.lastMessageId = parseInt(stdout.trim()) || 0;
    saveState(state);
    console.log('✅ Initialized. Monitoring for new messages...\n');
  } else {
    console.log('✅ Monitoring for new messages...\n');
  }
}

// Start monitoring
async function main() {
  await initialize();

  // Watch for database changes
  let debounceTimer;

  watch(DB_PATH, async (eventType) => {
    if (eventType === 'change') {
      // Debounce to avoid multiple rapid checks
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await checkForNewMessages();
      }, 500);
    }
  });

  console.log('Press Ctrl+C to stop\n');
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopped monitoring');
  process.exit(0);
});

main().catch(console.error);
