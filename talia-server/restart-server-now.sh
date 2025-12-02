#!/bin/bash
# Immediate server restart script - uses dev mode (no compilation needed)

cd "$(dirname "$0")"

echo "🔄 Restarting Talia GraphQL Server..."

# Find and kill existing server processes
pkill -f "tsx src/index.ts" || true
pkill -f "node.*dist/index.js" || true
sleep 1

# Start new server in dev mode (no compilation needed)
echo "🚀 Starting server in dev mode..."
nohup npm run dev > server.log 2>&1 &

echo "✅ Server restart initiated (check server.log for output)"
echo "📝 Using dev mode - no compilation needed, changes are picked up automatically"
