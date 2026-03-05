#!/usr/bin/env python3
"""
iMessage Monitor and Claude Bot - Unified Edition with Context and Images
Monitors for messages from specific senders (Karin, Willi) and -messages
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

db_path = Path.home() / "Library/Messages/chat.db"
state_file = Path("state.txt")
sessions_dir = Path("sessions")


def _get_my_contact_ids():
    """Get user's own contact identifiers for -message detection"""
    query = """
        SELECT DISTINCT c.chat_identifier
        FROM message m
        LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
        LEFT JOIN chat c ON c.ROWID = cmj.chat_id
        WHERE m.is_from_me = 1
            AND c.chat_identifier IS NOT NULL
        LIMIT 100
    """

    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.execute(query)
        identifiers = [row[0] for row in cursor.fetchall()]

    return set(identifiers)

def get_last_processed_id():
    """Get the ID of the last processed message"""
    if state_file.exists():
        return int(state_file.read_text().strip())
    with sqlite3.connect(str(db_path)) as conn:
        cursor = conn.execute("SELECT MAX(ROWID) FROM message")
        max_id = cursor.fetchone()[0] or 0
        state_file.write_text(str(max_id))
        return max_id



def get_new_messages(last_id):
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
        ORDER BY m.date DESC
        LIMIT 10
    """

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with sqlite3.connect(str(db_path), timeout=10.0) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(query, (last_id,))
                return [dict(row) for row in cursor.fetchall()]
        except sqlite3.OperationalError as e:
            if attempt < max_retries - 1:
                time.sleep(0.5)
                continue
            else:
                print(f"⚠️  Database access error after {max_retries} attempts: {e}")
                return []

print("🔍 new messages from iMessages")
my_contact_ids = _get_my_contact_ids()
print(f"👤 My contact identifiers: {my_contact_ids}")
last_processed_id = get_last_processed_id() 
print(f"⏱️  Last processed message ID: {last_processed_id}")
new_messages = get_new_messages(last_processed_id)
print(f"📨 Found {len(new_messages)} new messages")
print("📋 Message details:")
for msg in new_messages:
    print(msg)
    # print(f"  - ID: {msg['message_id']}, From: {msg['sender_id']}, Content: {msg['content'][:30]}..., Date: {msg['date']}")