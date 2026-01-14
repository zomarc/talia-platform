#!/bin/bash
# Script to copy Docker setup files to staging
# DEPRECATED: Use scripts/deploy-to-staging.sh instead
# Run this from your laptop

set -e

STAGING_USER="zomarc"
STAGING_HOST="192.168.1.120"
STAGING_DIR="~/talia-docker"

echo "📤 Copying Talia Docker stack to staging ($STAGING_USER@$STAGING_HOST)..."
echo "⚠️  NOTE: This script is deprecated. Use scripts/deploy-to-staging.sh instead"
echo ""

# Step 1: Create directory on staging
echo "1️⃣  Creating directory on staging..."
ssh $STAGING_USER@$STAGING_HOST "mkdir -p $STAGING_DIR"
echo "   ✅ Directory created"
echo ""

# Step 2: Copy docker-compose file
echo "2️⃣  Copying docker-compose.yml..."
scp docker-compose.talia.yml $STAGING_USER@$STAGING_HOST:$STAGING_DIR/docker-compose.yml
echo "   ✅ docker-compose.yml copied"
echo ""

# Step 3: Copy Supabase Kong config
echo "3️⃣  Copying Supabase Kong configuration..."
scp supabase/kong.yml $STAGING_USER@$STAGING_HOST:$STAGING_DIR/kong.yml
echo "   ✅ kong.yml copied"
echo ""

# Step 4: Copy talia-server directory (for Dockerfile and source)
echo "4️⃣  Copying talia-server directory..."
# Create a tarball excluding node_modules and dist
cd talia-server
tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='backups' \
    --exclude='*.log' \
    --exclude='.env' \
    -czf /tmp/talia-server.tar.gz \
    Dockerfile .dockerignore package.json package-lock.json tsconfig.json \
    src/ sync-cli.js sync.config.json supabase/
cd ..
scp /tmp/talia-server.tar.gz $STAGING_USER@$STAGING_HOST:$STAGING_DIR/
rm /tmp/talia-server.tar.gz
echo "   ✅ talia-server copied"
echo ""

# Step 4b: Copy talia-ui directory (for Dockerfile and source)
echo "4b️⃣ Copying talia-ui directory..."
# Create a tarball excluding node_modules and dist
cd talia-ui
tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='.env' \
    -czf /tmp/talia-ui.tar.gz \
    Dockerfile .dockerignore nginx.conf package.json package-lock.json \
    vite.config.js index.html src/ public/
cd ..
scp /tmp/talia-ui.tar.gz $STAGING_USER@$STAGING_HOST:$STAGING_DIR/
rm /tmp/talia-ui.tar.gz
echo "   ✅ talia-ui copied"
echo ""

# Step 5: Copy database backup
echo "5️⃣  Copying database backup..."
scp talia-server/backups/supabase_backup_20260113_193617.sql.gz $STAGING_USER@$STAGING_HOST:$STAGING_DIR/
echo "   ✅ Backup copied"
echo ""

echo "✅ All files copied!"
echo ""
echo "📋 Next steps on staging:"
echo "   1. SSH to staging: ssh $STAGING_USER@$STAGING_HOST"
echo "   2. Extract talia-server: cd $STAGING_DIR && tar -xzf talia-server.tar.gz"
echo "   3. Extract talia-ui: cd $STAGING_DIR && tar -xzf talia-ui.tar.gz"
echo "   4. Create supabase directory: mkdir -p supabase && mv kong.yml supabase/"
echo "   5. Start containers: docker compose up -d"
echo ""
