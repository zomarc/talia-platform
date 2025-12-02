#!/bin/bash
# Simple server restart script - uses dev mode (no compilation needed)
# Runs server in background so it doesn't stop when terminal closes

cd "$(dirname "$0")"

echo "🛑 Stopping any running server..."
pkill -f "tsx src/index.ts" || pkill -f "node.*dist/index.js" || true
sleep 1

echo "🚀 Starting server in dev mode (background)..."
echo "📝 Changes to .ts files will be picked up automatically"
echo "📝 Server will keep running in background"
echo "📝 To stop: pkill -f 'tsx src/index.ts' or use npm run stop"
echo ""

# Start in background with nohup so it persists
nohup npm run dev > server.log 2>&1 &

echo "✅ Server started in background (PID: $!)"
echo "📄 Logs: tail -f server.log"
echo "🔍 Check status: lsof -i :4000"

