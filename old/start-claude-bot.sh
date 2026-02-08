#!/bin/bash

# Startup script for iMessage Claude Bot

cd "$(dirname "$0")"

# Check if API key is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY not set"
    echo ""
    echo "Options:"
    echo "  1. Export it in your shell rc file (~/.zshrc or ~/.bashrc):"
    echo "     export ANTHROPIC_API_KEY='sk-ant-...'"
    echo ""
    echo "  2. Set it for this session:"
    echo "     export ANTHROPIC_API_KEY='sk-ant-...'"
    echo "     ./start-claude-bot.sh"
    echo ""
    echo "  3. Pass it directly:"
    echo "     ANTHROPIC_API_KEY='sk-ant-...' ./start-claude-bot.sh"
    echo ""
    exit 1
fi

echo "🚀 Starting iMessage Claude Bot..."
echo ""

# Run the bot
exec node imessage-claude-bot.js
