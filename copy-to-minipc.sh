#!/bin/bash
# Script to copy files from local to staging
# DEPRECATED: Use scripts/deploy-to-staging.sh instead
# Run this from your laptop

set -e

STAGING_USER="zomarc"
STAGING_HOST="192.168.1.120"
STAGING_HOME="~"

echo "📤 Copying files to staging ($STAGING_USER@$STAGING_HOST)..."
echo "⚠️  NOTE: This script is deprecated. Use scripts/deploy-to-staging.sh instead"
echo ""

# Step 1: Copy setup script
echo "1️⃣  Copying setup script..."
scp setup-minipc-supabase.sh $STAGING_USER@$STAGING_HOST:$STAGING_HOME/
echo "   ✅ Setup script copied"
echo ""

# Step 2: Copy migrations
echo "2️⃣  Copying Supabase migrations..."
cd talia-server
if [ -d "supabase/migrations" ]; then
    tar -czf /tmp/supabase-migrations.tar.gz supabase/migrations/
    scp /tmp/supabase-migrations.tar.gz $STAGING_USER@$STAGING_HOST:$STAGING_HOME/
    rm /tmp/supabase-migrations.tar.gz
    echo "   ✅ Migrations copied"
else
    echo "   ⚠️  Migrations directory not found"
fi
cd ..
echo ""

# Step 3: Copy latest database backup
echo "3️⃣  Copying latest database backup..."
LATEST_BACKUP=$(ls -t talia-server/backups/supabase_backup_*.sql.gz | head -1)
if [ -f "$LATEST_BACKUP" ]; then
    BACKUP_NAME=$(basename "$LATEST_BACKUP")
    echo "   Copying: $BACKUP_NAME ($(du -h "$LATEST_BACKUP" | cut -f1))"
    scp "$LATEST_BACKUP" $STAGING_USER@$STAGING_HOST:$STAGING_HOME/
    echo "   ✅ Backup copied"
else
    echo "   ⚠️  No backup file found"
fi
echo ""

echo "✅ All files copied!"
echo ""
echo "📋 Next steps on staging:"
echo "   1. SSH to staging: ssh $STAGING_USER@$STAGING_HOST"
echo "   2. Make setup script executable: chmod +x ~/setup-minipc-supabase.sh"
echo "   3. Run setup script: ~/setup-minipc-supabase.sh"
echo ""
