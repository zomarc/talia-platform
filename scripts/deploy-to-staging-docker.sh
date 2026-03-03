#!/bin/bash
# Deploy Docker images from local to staging environment
# Usage: ./scripts/deploy-to-staging-docker.sh

set -euo pipefail

# Configuration
STAGING_USER="zomarc"
STAGING_HOST="192.168.1.120"
STAGING_DIR="~/talia-docker"
COMPOSE_FILE="docker-compose.staging.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy Docker Images to Staging${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.staging.yml" ] || [ ! -d "talia-ui" ] || [ ! -d "talia-server" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

APP_VERSION="$(python3 - <<'PY'
import json
with open('talia-ui/package.json', 'r', encoding='utf-8') as f:
    print(json.load(f)['version'])
PY
)"

echo -e "${BLUE}Using UI version:${NC} ${APP_VERSION}"

# Build images locally (linux/amd64 to match staging host)
echo -e "${BLUE}🔨 Building Docker images locally (linux/amd64)...${NC}"
echo ""

echo "Building talia-docker-graphql-server..."
docker buildx build --platform linux/amd64 --load -t talia-docker-graphql-server:latest ./talia-server

echo ""
echo "Building talia-docker-ui..."
docker buildx build --platform linux/amd64 --load -t talia-docker-ui:latest \
  --build-arg VITE_SUPABASE_URL=http://192.168.1.120:54321 \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH \
  --build-arg VITE_GRAPHQL_ENDPOINT=http://192.168.1.120:4000/graphql \
  --build-arg VITE_ENABLE_DEV_MODE=true \
  --build-arg VITE_APP_VERSION="${APP_VERSION}" \
  ./talia-ui

echo ""
echo -e "${GREEN}✅ Images built${NC}"

# Save images and schema guard assets to tar/files
echo ""
echo -e "${BLUE}💾 Saving images and migrations...${NC}"
docker save talia-docker-graphql-server:latest | gzip > /tmp/talia-docker-graphql-server-latest.tar.gz
docker save talia-docker-ui:latest | gzip > /tmp/talia-docker-ui-latest.tar.gz
tar -czf /tmp/talia-migrations.tar.gz -C talia-server/supabase migrations
cp scripts/staging-db-guard.sh /tmp/staging-db-guard.sh
echo -e "${GREEN}✅ Images and schema assets prepared${NC}"

# Copy to staging
echo ""
echo -e "${BLUE}📤 Copying images and schema assets to staging...${NC}"
scp /tmp/talia-docker-graphql-server-latest.tar.gz ${STAGING_USER}@${STAGING_HOST}:/tmp/
scp /tmp/talia-docker-ui-latest.tar.gz ${STAGING_USER}@${STAGING_HOST}:/tmp/
scp /tmp/talia-migrations.tar.gz ${STAGING_USER}@${STAGING_HOST}:/tmp/
scp /tmp/staging-db-guard.sh ${STAGING_USER}@${STAGING_HOST}:/tmp/
echo -e "${GREEN}✅ Assets copied${NC}"

# Load images on staging and restart
echo ""
echo -e "${BLUE}🚀 Loading images, applying schema guard, and restarting on staging...${NC}"

DEPLOY_SCRIPT="
set -e
cd $STAGING_DIR

echo '📥 Loading Docker images...'
docker load < /tmp/talia-docker-graphql-server-latest.tar.gz
docker load < /tmp/talia-docker-ui-latest.tar.gz

echo '🗂️ Preparing migrations...'
mkdir -p /tmp/talia-migrations
tar -xzf /tmp/talia-migrations.tar.gz -C /tmp/talia-migrations
chmod +x /tmp/staging-db-guard.sh

echo '🔄 Restarting core services...'
docker compose -f $COMPOSE_FILE restart supabase-db supabase-rest supabase-kong || true
sleep 3
docker compose -f $COMPOSE_FILE up -d --force-recreate --no-build graphql-server
sleep 3
docker compose -f $COMPOSE_FILE up -d --force-recreate --no-build ui

echo '🗄️ Applying pending migrations and verifying required tables...'
COMPOSE_FILE=$COMPOSE_FILE MIGRATIONS_DIR=/tmp/talia-migrations/migrations REQUIRED_TABLES='inventory_item inventory_item_memo' bash /tmp/staging-db-guard.sh

echo '⏳ Waiting for services to be healthy...'
sleep 10

echo '📊 Checking service status...'
docker compose -f $COMPOSE_FILE ps

echo ''
echo '🧪 Testing critical endpoints...'

max_attempts=30
attempt=0
echo -n '  Testing GraphQL server... '
while [ \$attempt -lt \$max_attempts ]; do
  if curl -sS -f -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
    echo '✅ OK'
    break
  fi
  attempt=\$((attempt + 1))
  sleep 2
done
if [ \$attempt -eq \$max_attempts ]; then
  echo '❌ FAILED - GraphQL server not responding'
  exit 1
fi

echo -n '  Testing UI GraphQL proxy... '
if curl -sS -f -X POST http://localhost:5173/api/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
  echo '✅ OK'
else
  echo '❌ FAILED - UI proxy not working'
  exit 1
fi

echo -n '  Testing required tables (inventory_item, inventory_item_memo)... '
required_tables_check=\$(docker compose -f $COMPOSE_FILE exec -T supabase-db psql -U postgres -d postgres -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('inventory_item','inventory_item_memo');\" | tr -d '[:space:]')
if [ \"\$required_tables_check\" = \"2\" ]; then
  echo '✅ OK'
else
  echo \"❌ FAILED - Required tables missing (found \$required_tables_check/2)\"
  exit 1
fi

echo ''
echo '🧹 Cleaning up staging temp files...'
rm -rf /tmp/talia-docker-graphql-server-latest.tar.gz /tmp/talia-docker-ui-latest.tar.gz /tmp/talia-migrations.tar.gz /tmp/staging-db-guard.sh /tmp/talia-migrations

echo ''
echo '✅ Docker deployment complete and verified!'
"

ssh ${STAGING_USER}@${STAGING_HOST} "$DEPLOY_SCRIPT"

# Clean up local tar files
rm -f /tmp/talia-docker-graphql-server-latest.tar.gz /tmp/talia-docker-ui-latest.tar.gz /tmp/talia-migrations.tar.gz /tmp/staging-db-guard.sh

echo ""
echo -e "${GREEN}✅ Docker deployment successful!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Verify staging direct URL: http://192.168.1.120:5173"
echo "  2. Check logs if needed: ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && docker compose -f ${COMPOSE_FILE} logs'"
