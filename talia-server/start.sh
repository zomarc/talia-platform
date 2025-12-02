#!/bin/bash
# Start server script - runs server in background persistently

cd "$(dirname "$0")"

echo "🚀 Starting Talia GraphQL Server..."
echo "📝 Server will run in background and persist across terminal sessions"
echo ""

# Check if server is already running
if lsof -i :4000 > /dev/null 2>&1; then
  echo "⚠️  Server already running on port 4000"
  echo "📝 Use 'npm run restart' to restart, or 'npm run stop' to stop"
  exit 0
fi

# Start in background with nohup so it persists
nohup npm run dev > server.log 2>&1 &
SERVER_PID=$!

echo "✅ Server started in background (PID: $SERVER_PID)"
echo "📄 View logs: tail -f server.log"
echo "🔍 Check status: lsof -i :4000"
echo "🛑 Stop server: npm run stop"
echo ""
echo "Server will keep running even if you close this terminal."

