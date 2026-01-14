#!/bin/bash
# Fix talia-ui extraction - run this on miniPC

cd ~/talia-docker

echo "🔧 Fixing talia-ui directory structure..."

# Create talia-ui directory
mkdir -p talia-ui

# Move talia-ui files into the directory
# These files belong to talia-ui (not talia-server)
mv Dockerfile talia-ui/ 2>/dev/null || echo "Dockerfile already moved or doesn't exist"
mv nginx.conf talia-ui/ 2>/dev/null || echo "nginx.conf already moved or doesn't exist"
mv .dockerignore talia-ui/ 2>/dev/null || echo ".dockerignore already moved or doesn't exist"
mv index.html talia-ui/ 2>/dev/null || echo "index.html already moved or doesn't exist"
mv package.json talia-ui/ 2>/dev/null || echo "package.json already moved or doesn't exist"
mv package-lock.json talia-ui/ 2>/dev/null || echo "package-lock.json already moved or doesn't exist"
mv vite.config.js talia-ui/ 2>/dev/null || echo "vite.config.js already moved or doesn't exist"
mv src talia-ui/ 2>/dev/null || echo "src already moved or doesn't exist"
mv public talia-ui/ 2>/dev/null || echo "public already moved or doesn't exist"
mv ._index.html talia-ui/ 2>/dev/null || true  # macOS metadata file

# Verify structure
echo ""
echo "✅ Checking structure..."
echo "talia-ui files:"
ls -la talia-ui/ | head -10

echo ""
echo "talia-server files (should be in current dir):"
ls -la | grep -E "tsconfig.json|sync-cli.js|sync.config.json" | head -5

echo ""
echo "✅ Fix complete! Now run: docker compose up -d"
