#!/usr/bin/env python3
"""
iMessage Monitor and Claude Bot - Unified Edition with Context and Images
Monitors for messages from specific senders (Karin, Willi) and self-messages
Responds using Claude CLI with previous message context, session management, and image support
"""

import os
import re
import sqlite3
import subprocess
import time
import uuid
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class iMessageMonitorUnified:
    def __init__(self, monitored_senders=None, context_messages=10, custom_prompt=None):
        self.db_path = Path.home() / "Library/Messages/chat.db"
        self.state_file = Path("state.txt")
        self.sessions_dir = Path("sessions")
        self.sessions_dir.mkdir(exist_ok=True)
        self.monitored_senders = monitored_senders or []
        self.poll_interval = 1
        self.context_messages = context_messages
        self.custom_prompt = custom_prompt
        self.my_contact_ids = self._get_my_contact_ids()

        # Supported image MIME types
        self.image_mime_types = [
            'image/jpeg', 'image/jpg', 'image/png',
            'image/gif', 'image/heic', 'image/heif'
        ]

        # Supported file extensions for sending
        self.sendable_extensions = [
            # Images
            '.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif',
            # Audio
            '.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg',
            # Video
            '.mp4', '.mov', '.avi', '.mkv', '.m4v',
            # Documents
            '.pdf', '.doc', '.docx', '.txt', '.md',
            # Archives
            '.zip', '.tar', '.gz'
        ]

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
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("SELECT MAX(ROWID) FROM message")
            max_id = cursor.fetchone()[0] or 0
            self.state_file.write_text(str(max_id))
            return max_id

    def update_last_processed_id(self, message_id):
        """Update the last processed message ID"""
        self.state_file.write_text(str(message_id))

    def get_new_messages(self, last_id):
        """Query for all new messages including those with attachments"""
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
                AND (m.text IS NOT NULL OR m.ROWID IN (
                    SELECT message_id FROM message_attachment_join
                ))
            ORDER BY m.date ASC
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, (last_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_message_attachments(self, message_id):
        """Get image attachments for a message"""
        query = """
            SELECT
                a.filename,
                a.mime_type,
                a.transfer_name
            FROM attachment a
            JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
            WHERE maj.message_id = ?
        """

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, (message_id,))
            attachments = [dict(row) for row in cursor.fetchall()]

        # Filter for images and resolve paths
        image_attachments = []
        for att in attachments:
            if att['mime_type'] in self.image_mime_types:
                filename = att['filename']
                if filename and filename.startswith('~'):
                    filename = str(Path(filename).expanduser())

                if filename and Path(filename).exists():
                    image_attachments.append({
                        'path': filename,
                        'mime_type': att['mime_type'],
                        'name': att['transfer_name'] or Path(filename).name
                    })

        return image_attachments

    def is_from_monitored_sender(self, message):
        """Check if message is from one of the monitored senders"""
        if message['is_from_me'] == 1:
            return False

        sender_id = message.get('sender_id', '')
        if not sender_id:
            return False

        sender_lower = sender_id.lower()
        return any(name.lower() in sender_lower for name in self.monitored_senders)

    def is_self_message(self, message):
        """Check if message is sent to self (not to others)"""
        if message['is_from_me'] == 0:
            return False

        chat_id = message.get('chat_identifier', '')

        if chat_id:
            return any(my_id in chat_id for my_id in self.my_contact_ids if my_id and chat_id == my_id)

        return False

    def should_process_message(self, message):
        """Determine if message should be processed"""
        return self.is_from_monitored_sender(message) or self.is_self_message(message)

    def is_stop_command(self, message_text):
        """Check if message is a stop command in any variant"""
        if not message_text:
            return False
        # Remove all punctuation and whitespace, convert to lowercase
        clean_text = re.sub(r'[^\w\s]', '', message_text.strip()).lower()
        return clean_text == 'stop'

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

    def extract_image_paths_from_response(self, response):
        """Extract file paths from Claude's response and return (paths, cleaned_response)"""
        # Build extension pattern from supported extensions (case-insensitive)
        # Include both lowercase and uppercase variants
        exts = []
        for ext in self.sendable_extensions:
            ext_clean = ext.lstrip('.')
            exts.append(ext_clean.lower())
            exts.append(ext_clean.upper())
            exts.append(ext_clean.capitalize())
        ext_pattern = '|'.join(set(exts))  # Remove duplicates

        # Match file paths starting with /, ~, or /Users/me
        # Supports quoted, backtick-wrapped, bold-wrapped (**), and unquoted paths
        patterns = [
            rf'["\']([/~][^"\']+\.(?:{ext_pattern}))["\']',  # Quoted: "/path" or '/path'
            rf'`([/~][^`]+\.(?:{ext_pattern}))`',  # Backtick: `/path`
            rf'\*\*([/~][^\*]+\.(?:{ext_pattern}))\*\*',  # Bold: **/path**
            rf'(?:^|(?<=\s))((?:/Users/me|~|/[a-zA-Z])[^\s<>"|*?`\']*\.(?:{ext_pattern}))(?=\s|$)',  # Unquoted paths
        ]

        file_paths = []
        path_spans = []  # Track (start, end, path) tuples

        for idx, pattern in enumerate(patterns):
            for match in re.finditer(pattern, response):
                # Get the path from group 1
                path = match.group(1)

                # Expand ~ to home directory
                if path.startswith('~'):
                    expanded_path = str(Path(path).expanduser())
                else:
                    expanded_path = path

                # Only include if file exists
                if Path(expanded_path).exists():
                    # For quoted/backtick/bold paths, use full match span
                    # For unquoted paths (idx=3), use group 1 span to avoid removing surrounding whitespace
                    if idx < 3:
                        span_start, span_end = match.start(), match.end()
                    else:
                        span_start, span_end = match.start(1), match.end(1)

                    file_paths.append(expanded_path)
                    path_spans.append((span_start, span_end, expanded_path))

        # Remove duplicates while preserving order
        seen = set()
        unique_paths = []
        unique_spans = []
        for (start, end, path) in path_spans:
            if path not in seen:
                seen.add(path)
                unique_paths.append(path)
                unique_spans.append((start, end))

        # Clean response by removing path references
        cleaned_response = response
        if unique_paths:
            # Sort spans in reverse order to remove from end to start
            unique_spans.sort(reverse=True)
            for start, end in unique_spans:
                # Remove the path (quotes already included in span for quoted paths)
                before = cleaned_response[:start]
                after = cleaned_response[end:]

                # Clean up common lead-in phrases that precede paths
                before = re.sub(r'(?:saved|created|generated|wrote|found|located|sending)\s+(?:to|at|in)\s*$', '', before, flags=re.IGNORECASE)
                before = re.sub(r'(?:image|file|photo|song|music|audio|video|document)\s+(?:at|in|is|located)\s*$', '', before, flags=re.IGNORECASE)
                before = before.rstrip(' :')

                cleaned_response = before + after

            # Clean up artifacts
            cleaned_response = re.sub(r'``', '', cleaned_response)  # Remove empty backticks
            cleaned_response = re.sub(r'""', '', cleaned_response)  # Remove empty quotes
            cleaned_response = re.sub(r' +', ' ', cleaned_response)  # Multiple spaces
            cleaned_response = re.sub(r'\n\s*\n\s*\n+', '\n\n', cleaned_response)  # Multiple newlines
            cleaned_response = cleaned_response.strip()

        return unique_paths, cleaned_response

    def execute_claude(self, message_text, previous_messages=None, chat_key=None, image_paths=None):
        """Execute claude command with context, images, and session management"""
        try:
            cmd = ['claude', '-p', '--dangerously-skip-permissions']

            # Check if there's an existing session for this chat
            session_id = None
            is_new_session = False
            if chat_key:
                session_id = self.load_session(chat_key)
                if session_id:
                    cmd.extend(['--resume', session_id])
                    print(f"🔄 Resuming session: {session_id}")
                else:
                    # Create new session with UUID
                    session_id = str(uuid.uuid4())
                    cmd.extend(['--session-id', session_id])
                    self.save_session(chat_key, session_id)
                    is_new_session = True
                    print(f"💾 Created new session: {session_id}")

            # Add context from previous messages ONLY for new sessions
            if previous_messages and is_new_session:
                context = "Previous conversation:\n"
                for msg in previous_messages:
                    sender = "Assistant" if msg['is_from_me'] else "User"
                    context += f"{sender}: {msg['content']}\n"

                # Add image context if images were attached
                if image_paths:
                    img_list = "\n".join([f"- {Path(p).name}" for p in image_paths])
                    context += f"\nUser sent {len(image_paths)} image(s):\n{img_list}\n"

                context += f"\nUser: {message_text or '[Image received]'}"
                message_text = context
            elif image_paths:
                # For first message with images, mention them in prompt
                img_list = "\n".join([f"- {Path(p).name}" for p in image_paths])
                image_context = f"User sent {len(image_paths)} image(s):\n{img_list}\n\n"
                message_text = image_context + (message_text or "What can you tell me about these images?")
                print(f"🖼️  Mentioned {len(image_paths)} image(s) in prompt")

            # Prepend custom prompt if configured
            if self.custom_prompt:
                message_text = f"{self.custom_prompt}\n\n{message_text}"

            cmd.append(message_text)

            print(f"🤖 Executing: {' '.join(cmd[:3])}...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                return result.stdout.strip()
            else:
                print(f"⚠️  Claude returned error: {result.stderr.strip()}")
                return None

        except subprocess.TimeoutExpired:
            print("⚠️  Claude command timed out")
            return None
        except Exception as e:
            print(f"⚠️  Error executing Claude: {str(e)}")
            return None

    def send_imessage(self, recipient, message, image_paths=None):
        """Send an iMessage with optional image attachments"""
        if not recipient:
            print("⚠️  No recipient found, cannot send reply")
            return False

        # Filter out error messages that shouldn't be sent to user
        if message and message.strip().startswith("Error:"):
            print(f"⚠️  Suppressing error message: {message}")
            return False

        # Send images first if any
        if image_paths:
            for img_path in image_paths:
                if not self._send_file(recipient, img_path):
                    print(f"⚠️  Failed to send image: {img_path}")

        # Then send text message if any
        if message:
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
                subprocess.run(
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
                return self._send_via_text_chat(recipient, message, image_paths)
            except subprocess.TimeoutExpired:
                print(f"⚠️  Send timed out (message may have been sent)")
                return False

        return True

    def _send_file(self, recipient, file_path):
        """Send a file via iMessage"""
        applescript = '''
on run argv
    set recipient to item 1 of argv
    set filePath to item 2 of argv

    tell application "Messages"
        set targetService to first service whose service type = iMessage
        set targetBuddy to buddy recipient of targetService
        send POSIX file filePath to targetBuddy
    end tell
end run
'''

        try:
            subprocess.run(
                ['osascript', '-', recipient, str(Path(file_path).resolve())],
                input=applescript.encode('utf-8'),
                check=True,
                capture_output=True,
                timeout=15
            )
            print(f"✅ Sent file: {Path(file_path).name}")
            return True
        except Exception as e:
            print(f"❌ Failed to send file: {str(e)}")
            return False

    def _send_via_text_chat(self, recipient, message, image_paths=None):
        """Alternative method using text chat with safe parameter passing"""
        # Send images first
        if image_paths:
            for img_path in image_paths:
                self._send_file_via_text_chat(recipient, img_path)

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

    def _send_file_via_text_chat(self, recipient, file_path):
        """Send file via text chat"""
        applescript = '''
on run argv
    set recipient to item 1 of argv
    set filePath to item 2 of argv

    tell application "Messages"
        set targetService to first service whose service type = iMessage
        set textChat to text chat id recipient of targetService
        send POSIX file filePath to textChat
    end tell
end run
'''

        try:
            subprocess.run(
                ['osascript', '-', recipient, str(Path(file_path).resolve())],
                input=applescript.encode('utf-8'),
                check=True,
                capture_output=True,
                timeout=15
            )
            return True
        except:
            return False

    def process_message(self, message):
        """Process a single message with context and images"""
        content = message.get('content', '')
        date = message['date']
        msg_type = self.get_message_type(message)
        chat_key = self.get_chat_key(message)
        recipient = self.get_reply_recipient(message)

        print(f"\n📨 [{date}] {msg_type}: {content or '[no text]'}")

        # Send immediate acknowledgment
        self.send_imessage(recipient, "⌛")

        # Check for stop command
        if self.is_stop_command(content):
            print("🛑 STOP command received - shutting down...")
            self.send_imessage(recipient, "Bot stopped.")
            raise SystemExit("Stop command received")

        # Get image attachments
        image_attachments = self.get_message_attachments(message['message_id'])
        image_paths = [att['path'] for att in image_attachments]

        if image_attachments:
            print(f"🖼️  Found {len(image_attachments)} image(s):")
            for att in image_attachments:
                print(f"   - {att['name']} ({att['mime_type']})")

        # Get previous messages for context
        previous_messages = self.get_previous_messages(message)
        if previous_messages:
            print(f"📚 Loaded {len(previous_messages)} previous messages for context")

        # Execute Claude with context, images, and session management
        response = self.execute_claude(content, previous_messages, chat_key, image_paths)

        # Skip sending if timeout occurred (response is None)
        if response is None:
            return

        print(f"💬 Claude response: {response[:100]}...")

        # Check if Claude generated any files in the response
        generated_files, cleaned_response = self.extract_image_paths_from_response(response)
        if generated_files:
            print(f"📎 Extracted {len(generated_files)} file(s) from response:")
            for file in generated_files:
                print(f"   - {file}")

        # Send response back with any generated files (using cleaned response)
        self.send_imessage(recipient, cleaned_response, generated_files if generated_files else None)

    def monitor(self):
        """Main monitoring loop"""
        print("🔍 iMessage Claude Bot (Unified with Context & Images) started")
        print(f"📱 Monitoring for:")
        print(f"   - Messages from: {', '.join(self.monitored_senders)}")
        print(f"   - Self-messages (messages to yourself)")
        print(f"   - Ignoring: Messages you send to others")
        print(f"📚 Context: Including up to {self.context_messages} previous messages")
        print(f"💾 Sessions: Stored in {self.sessions_dir}")
        print(f"🖼️  Image support: Receiving and sending images")
        print(f"🛑 Stop command: Send 'stop' to shut down the bot")
        print("Press Ctrl+C to stop\n")

        last_id = self.get_last_processed_id()
        print(f"Starting from message ID: {last_id}\n")

        try:
            while True:
                new_messages = self.get_new_messages(last_id)

                for message in new_messages:
                    try:
                        if self.should_process_message(message):
                            self.process_message(message)
                    except SystemExit as e:
                        # Update ID before stopping so stop command isn't re-processed on restart
                        last_id = message['message_id']
                        self.update_last_processed_id(last_id)
                        raise  # Re-raise to exit outer loop

                    last_id = message['message_id']
                    self.update_last_processed_id(last_id)

                time.sleep(self.poll_interval)

        except SystemExit as e:
            print(f"\n\n🛑 {e}")
            print(f"Last processed message ID: {last_id}")
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

    # Load custom prompt from environment variable
    custom_prompt = os.getenv("CUSTOM_PROMPT", "").strip()
    if custom_prompt:
        print(f"📝 Custom prompt loaded: {custom_prompt[:50]}{'...' if len(custom_prompt) > 50 else ''}")

    monitor = iMessageMonitorUnified(
        monitored_senders=monitored_senders,
        custom_prompt=custom_prompt if custom_prompt else None
    )
    monitor.monitor()


if __name__ == "__main__":
    main()
