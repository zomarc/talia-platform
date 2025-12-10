#!/bin/bash

# Quick script to get the current ngrok URL

BASE_PATH="${VITE_BASE_PATH:-/celestyal}"

if ! pgrep -f "ngrok http" > /dev/null; then
    echo "❌ ngrok is not running"
    echo "Start it with: ./scripts/start-ngrok-free.sh"
    exit 1
fi

URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') + '${BASE_PATH}' if tunnels else 'N/A')" 2>/dev/null)

if [ "$URL" != "N/A" ] && [ -n "$URL" ]; then
    echo "✅ External URL:"
    echo "   $URL"
    echo ""
    echo "📋 Share this URL with clients"
    echo "🔍 ngrok Dashboard: http://localhost:4040"
else
    echo "⏳ Waiting for ngrok to start..."
    echo "Check: http://localhost:4040"
fi

