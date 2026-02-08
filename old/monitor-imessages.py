#!/usr/bin/env python3
"""
iMessage Monitor and Claude Bot
Monitors for self-messages in iMessage and responds using Claude CLI
"""

import sqlite3
import subprocess
import time
import os
import json
from pathlib import Path
from datetime import datetime


class iMessageMonitor:
    def __init__(self):
        self.db_path = Path.home() / "Library/Messages/chat.db"
        self.state_file = Path("/tmp/imessage_claude_state.txt")
        self.poll_interval = 1  # seconds

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

    def get_new_self_messages(self, last_id):
        """Query for new messages sent to self"""
        query = """
            SELECT
                m.ROWID as message_id,
                m.text as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as chat_id,
                m.is_from_me,
                c.chat_identifier
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
            LEFT JOIN chat c ON c.ROWID = cmj.chat_id
            WHERE m.ROWID > ?
                AND m.is_from_me = 1
                AND m.text IS NOT NULL
                AND m.text != ''
            ORDER BY m.date ASC
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, (last_id,))
            return [dict(row) for row in cursor.fetchall()]

    def is_self_message(self, message):
        """Check if message is sent to self"""
        # Self messages have chat_identifier that matches user's own number/email
        # Or they appear in a chat with yourself
        return message['is_from_me'] == 1 and message['chat_identifier']

    def execute_claude(self, message_text):
        """Execute claude command and return response"""
        try:
            print(f"🤖 Executing: claude {message_text}")
            result = subprocess.run(
                ['claude', message_text],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                return result.stdout.strip()
            else:
                return f"Error: {result.stderr.strip()}"

        except subprocess.TimeoutExpired:
            return "Error: Claude command timed out"
        except Exception as e:
            return f"Error executing Claude: {str(e)}"

    def send_imessage(self, chat_identifier, message):
        """Send an iMessage using AppleScript"""
        # Escape quotes in message
        escaped_message = message.replace('"', '\\"').replace('\\', '\\\\')

        applescript = f'''
        tell application "Messages"
            set targetService to 1st account whose service type = iMessage
            set targetBuddy to participant "{chat_identifier}" of targetService
            send "{escaped_message}" to targetBuddy
        end tell
        '''

        try:
            subprocess.run(
                ['osascript', '-e', applescript],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"✅ Sent reply to {chat_identifier}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to send message: {e.stderr}")
            return False

    def process_message(self, message):
        """Process a single message"""
        content = message['content']
        chat_id = message['chat_identifier']
        date = message['date']

        print(f"\n📨 [{date}] New self-message: {content}")

        # Execute Claude
        response = self.execute_claude(content)
        print(f"💬 Claude response: {response[:100]}...")

        # Send response back
        if chat_id:
            self.send_imessage(chat_id, response)
        else:
            print("⚠️  No chat identifier found, cannot send reply")

    def monitor(self):
        """Main monitoring loop"""
        print("🔍 iMessage Claude Bot started")
        print("📱 Monitoring for self-messages...")
        print("Press Ctrl+C to stop\n")

        last_id = self.get_last_processed_id()
        print(f"Starting from message ID: {last_id}\n")

        try:
            while True:
                new_messages = self.get_new_self_messages(last_id)

                for message in new_messages:
                    if self.is_self_message(message):
                        self.process_message(message)

                    # Update last processed ID
                    last_id = message['message_id']
                    self.update_last_processed_id(last_id)

                time.sleep(self.poll_interval)

        except KeyboardInterrupt:
            print("\n\n👋 Stopping monitor...")
            print(f"Last processed message ID: {last_id}")


def main():
    monitor = iMessageMonitor()
    monitor.monitor()


if __name__ == "__main__":
    main()
