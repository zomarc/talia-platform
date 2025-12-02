#!/bin/bash
# Server restart script that watches for exit code 0 and restarts

cd "$(dirname "$0")"

echo "🔄 Starting Talia GraphQL Server with auto-restart..."
echo "📝 Press Ctrl+C to stop"

while true; do
  echo "🚀 Starting server..."
  npm start || exit_code=$?
  
  if [ $exit_code -ne 0 ]; then
    echo "❌ Server exited with error code $exit_code"
    echo "⏳ Waiting 5 seconds before restart..."
    sleep 5
  else
    echo "✅ Server exited normally (restart requested)"
    echo "🔄 Restarting in 2 seconds..."
    sleep 2
  fi
done

