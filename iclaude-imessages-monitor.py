#!/usr/bin/env python3
"""
iMessage Monitor and Claude Bot - Unified Edition with Context
Monitors for messages from specific senders (Karin, Willi) and self-messages
Responds using Claude CLI with previous message context and session management
"""

import os
import sqlite3
import subprocess
import time
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class iMessageMonitorUnified:
    def __init__(self, monitored_senders=None, context_messages=10):
        self.db_path = Path.home() / "Library/Messages/chat.db"
        self.state_file = Path("state.txt")
        self.sessions_dir = Path("sessions")
        self.sessions_dir.mkdir(exist_ok=True)
        self.monitored_senders = monitored_senders or []
        self.poll_interval = 1  # seconds
        self.context_messages = context_messages  # Number of previous messages to include
        self.my_contact_ids = self._get_my_contact_ids()

    def _get_my_contact_ids(self):
        """Get user's own contact identifiers for self-message detection"""
        query = """
            SELECT DISTINCT c.chat_identifier
            FROM message m
            LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
            LEFT JOIN chat c ON c.ROWID = cmj.chat_id
            WHERE m.is_from_me = 1
                AND c.chat_identifier IS NOT NULL
            LIMIT 100
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute(query)
            identifiers = [row[0] for row in cursor.fetchall()]

        return set(identifiers)

    def get_last_processed_id(self):
        """Get the ID of the last processed message"""
        if self.state_file.exists():
            return int(self.state_file.read_text().strip())
        # Initialize with current max message ID
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("SELECT MAX(ROWID) FROM message")
            max_id = cursor.fetchone()[0] or 0
            self.state_file.write_text(str(max_id))
            return max_id

    def update_last_processed_id(self, message_id):
        """Update the last processed message ID"""
        self.state_file.write_text(str(message_id))

    def get_new_messages(self, last_id):
        """Query for all new messages"""
        query = """
            SELECT
                m.ROWID as message_id,
                m.text as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as sender_id,
                m.is_from_me,
                c.chat_identifier,
                m.cache_roomnames
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
            LEFT JOIN chat c ON c.ROWID = cmj.chat_id
            WHERE m.ROWID > ?
                AND m.text IS NOT NULL
                AND m.text != ''
            ORDER BY m.date ASC
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, (last_id,))
            return [dict(row) for row in cursor.fetchall()]

    def is_from_monitored_sender(self, message):
        """Check if message is from one of the monitored senders"""
        if message['is_from_me'] == 1:
            return False  # Not incoming

        sender_id = message.get('sender_id', '')
        if not sender_id:
            return False

        # Check if sender matches any monitored name
        sender_lower = sender_id.lower()
        return any(name.lower() in sender_lower for name in self.monitored_senders)

    def is_self_message(self, message):
        """Check if message is sent to self (not to others)"""
        if message['is_from_me'] == 0:
            return False  # Not sent by me

        chat_id = message.get('chat_identifier', '')

        # If chat_identifier contains my own contact info, it's a self-message
        if chat_id:
            return any(my_id in chat_id for my_id in self.my_contact_ids if my_id and chat_id == my_id)

        return False

    def should_process_message(self, message):
        """Determine if message should be processed"""
        return self.is_from_monitored_sender(message) or self.is_self_message(message)

    def get_message_type(self, message):
        """Get a description of the message type"""
        if message['is_from_me'] == 1:
            return "Self-message"

        sender_id = message.get('sender_id', 'Unknown')
        for name in self.monitored_senders:
            if name.lower() in sender_id.lower():
                return f"Message from {name}"

        return "Unknown"

    def get_reply_recipient(self, message):
        """Get the recipient to reply to"""
        if message['is_from_me'] == 1:
            return message.get('chat_identifier')
        else:
            return message.get('sender_id')

    def get_chat_key(self, message):
        """Get a unique key for this chat/conversation"""
        if message['is_from_me'] == 1:
            return message.get('chat_identifier', 'self')
        else:
            return message.get('sender_id', 'unknown')

    def get_previous_messages(self, message, limit=None):
        """Get previous messages from the same chat for context"""
        if limit is None:
            limit = self.context_messages

        chat_key = self.get_chat_key(message)
        current_msg_id = message['message_id']

        # Query for previous messages in the same chat
        query = """
            SELECT
                m.ROWID as message_id,
                m.text as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as sender_id,
                m.is_from_me,
                c.chat_identifier
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
            LEFT JOIN chat c ON c.ROWID = cmj.chat_id
            WHERE m.ROWID < ?
                AND m.text IS NOT NULL
                AND m.text != ''
                AND (
                    (m.is_from_me = 1 AND c.chat_identifier = ?)
                    OR (m.is_from_me = 0 AND h.id = ?)
                )
            ORDER BY m.date DESC
            LIMIT ?
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, (current_msg_id, chat_key, chat_key, limit))
            messages = [dict(row) for row in cursor.fetchall()]

        return list(reversed(messages))

    def get_session_file(self, chat_key):
        """Get the session file path for a chat"""
        safe_key = "".join(c if c.isalnum() else "_" for c in chat_key)
        return self.sessions_dir / f"session_{safe_key}.txt"

    def load_session(self, chat_key):
        """Load the Claude session ID for a chat, if any"""
        session_file = self.get_session_file(chat_key)
        if session_file.exists():
            return session_file.read_text().strip()
        return None

    def save_session(self, chat_key, session_id):
        """Save the Claude session ID for a chat"""
        session_file = self.get_session_file(chat_key)
        session_file.write_text(session_id)

    def execute_claude(self, message_text, previous_messages=None, chat_key=None):
        """Execute claude command with context and session management"""
        try:
            cmd = ['claude']

            # Check if there's an existing session for this chat
            session_id = None
            if chat_key:
                session_id = self.load_session(chat_key)
                if session_id:
                    cmd.extend(['--resume', session_id])
                    print(f"🔄 Resuming session: {session_id}")

            # Add context from previous messages if available and no session
            if previous_messages and not session_id:
                context = "Previous conversation:\n"
                for msg in previous_messages:
                    sender = "Assistant" if msg['is_from_me'] else "User"
                    context += f"{sender}: {msg['content']}\n"
                context += f"\nUser: {message_text}"
                message_text = context

            cmd.append(message_text)

            print(f"🤖 Executing: {' '.join(cmd[:3])}...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                response = result.stdout.strip()

                # Try to extract session ID from output if this is a new session
                if not session_id and chat_key and '--resume' not in cmd:
                    # Look for session ID in stderr (Claude CLI outputs session info there)
                    if result.stderr:
                        for line in result.stderr.split('\n'):
                            if 'session' in line.lower() and len(line) < 50:
                                # Simple heuristic: try to find session ID
                                parts = line.split()
                                for part in parts:
                                    if len(part) > 10 and part.replace('-', '').isalnum():
                                        print(f"💾 Saved session: {part}")
                                        self.save_session(chat_key, part)
                                        break

                return response
            else:
                return f"Error: {result.stderr.strip()}"

        except subprocess.TimeoutExpired:
            return "Error: Claude command timed out"
        except Exception as e:
            return f"Error executing Claude: {str(e)}"

    def send_imessage(self, recipient, message):
        """Send an iMessage using AppleScript with safe parameter passing"""
        if not recipient:
            print("⚠️  No recipient found, cannot send reply")
            return False

        applescript = '''
on run argv
    set recipient to item 1 of argv
    set theMessage to item 2 of argv

    tell application "Messages"
        set targetService to first service whose service type = iMessage
        set targetBuddy to buddy recipient of targetService
        send theMessage to targetBuddy
    end tell
end run
'''

        try:
            result = subprocess.run(
                ['osascript', '-', recipient, message],
                input=applescript.encode('utf-8'),
                check=True,
                capture_output=True,
                timeout=10
            )
            print(f"✅ Sent reply to {recipient}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to send message: {e.stderr}")
            return self._send_via_text_chat(recipient, message)
        except subprocess.TimeoutExpired:
            print(f"⚠️  Send timed out (message may have been sent)")
            return False

    def _send_via_text_chat(self, recipient, message):
        """Alternative method using text chat with safe parameter passing"""
        applescript = '''
on run argv
    set recipient to item 1 of argv
    set theMessage to item 2 of argv

    tell application "Messages"
        set targetService to first service whose service type = iMessage
        set textChat to text chat id recipient of targetService
        send theMessage to textChat
    end tell
end run
'''

        try:
            subprocess.run(
                ['osascript', '-', recipient, message],
                input=applescript.encode('utf-8'),
                check=True,
                capture_output=True,
                timeout=10
            )
            print(f"✅ Sent via text chat to {recipient}")
            return True
        except Exception as e:
            print(f"❌ Alternative send also failed: {str(e)}")
            return False

    def process_message(self, message):
        """Process a single message with context"""
        content = message['content']
        date = message['date']
        msg_type = self.get_message_type(message)
        chat_key = self.get_chat_key(message)

        print(f"\n📨 [{date}] {msg_type}: {content}")

        # Get previous messages for context
        previous_messages = self.get_previous_messages(message)
        if previous_messages:
            print(f"📚 Loaded {len(previous_messages)} previous messages for context")

        # Execute Claude with context and session management
        response = self.execute_claude(content, previous_messages, chat_key)
        print(f"💬 Claude response: {response[:100]}...")

        # Send response back
        recipient = self.get_reply_recipient(message)
        self.send_imessage(recipient, response)

    def monitor(self):
        """Main monitoring loop"""
        print("🔍 iMessage Claude Bot (Unified with Context) started")
        print(f"📱 Monitoring for:")
        print(f"   - Messages from: {', '.join(self.monitored_senders)}")
        print(f"   - Self-messages (messages to yourself)")
        print(f"   - Ignoring: Messages you send to others")
        print(f"📚 Context: Including up to {self.context_messages} previous messages")
        print(f"💾 Sessions: Stored in {self.sessions_dir}")
        print("Press Ctrl+C to stop\n")

        last_id = self.get_last_processed_id()
        print(f"Starting from message ID: {last_id}\n")

        try:
            while True:
                new_messages = self.get_new_messages(last_id)

                for message in new_messages:
                    if self.should_process_message(message):
                        self.process_message(message)

                    last_id = message['message_id']
                    self.update_last_processed_id(last_id)

                time.sleep(self.poll_interval)

        except KeyboardInterrupt:
            print("\n\n👋 Stopping unified monitor...")
            print(f"Last processed message ID: {last_id}")


def main():
    # Load monitored senders from environment variable
    monitored_senders_str = os.getenv("MONITORED_SENDERS", "")
    monitored_senders = [s.strip() for s in monitored_senders_str.split(",") if s.strip()]

    if not monitored_senders:
        print("⚠️  No MONITORED_SENDERS configured in .env file")
        print("Please create a .env file with MONITORED_SENDERS=sender1,sender2,sender3")
        return

    monitor = iMessageMonitorUnified(monitored_senders=monitored_senders)
    monitor.monitor()


if __name__ == "__main__":
    main()
