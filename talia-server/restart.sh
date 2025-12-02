#!/bin/bash
# Simple server restart script - uses dev mode (no compilation needed)

cd "$(dirname "$0")"

echo "🛑 Stopping any running server..."
pkill -f "tsx src/index.ts" || pkill -f "node.*dist/index.js" || true
sleep 1

echo "🚀 Starting server in dev mode (no compilation needed)..."
echo "📝 Changes to .ts files will be picked up automatically"
echo "📝 Press Ctrl+C to stop"
echo ""

npm run dev

