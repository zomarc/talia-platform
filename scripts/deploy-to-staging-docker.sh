#!/bin/bash
# Deploy Docker images from local to staging environment
# Usage: ./scripts/deploy-to-staging-docker.sh

set -e

# Configuration
STAGING_USER="zomarc"
STAGING_HOST="192.168.1.120"
STAGING_DIR="~/talia-docker"

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
if [ ! -f "docker-compose.talia.yml" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

# Build images locally
echo -e "${BLUE}🔨 Building Docker images locally...${NC}"
echo ""

echo "Building talia-server..."
cd talia-server
docker build -t talia-server:latest .
cd ..

echo ""
echo "Building talia-ui..."
cd talia-ui
docker build -t talia-ui:latest --build-arg VITE_SUPABASE_URL=http://192.168.1.120:54321 --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH --build-arg VITE_GRAPHQL_ENDPOINT=http://192.168.1.120:4000/graphql .
cd ..

echo ""
echo -e "${GREEN}✅ Images built${NC}"

# Save images to tar files
echo ""
echo -e "${BLUE}💾 Saving images to tar files...${NC}"
docker save talia-server:latest | gzip > /tmp/talia-server-latest.tar.gz
docker save talia-ui:latest | gzip > /tmp/talia-ui-latest.tar.gz
echo -e "${GREEN}✅ Images saved${NC}"

# Copy to staging
echo ""
echo -e "${BLUE}📤 Copying images to staging...${NC}"
scp /tmp/talia-server-latest.tar.gz ${STAGING_USER}@${STAGING_HOST}:/tmp/
scp /tmp/talia-ui-latest.tar.gz ${STAGING_USER}@${STAGING_HOST}:/tmp/
echo -e "${GREEN}✅ Images copied${NC}"

# Load images on staging and restart
echo ""
echo -e "${BLUE}🚀 Loading images and restarting on staging...${NC}"

DEPLOY_SCRIPT="
set -e
cd $STAGING_DIR

echo '📥 Loading Docker images...'
docker load < /tmp/talia-server-latest.tar.gz
docker load < /tmp/talia-ui-latest.tar.gz

echo '🧹 Cleaning up...'
rm -f /tmp/talia-server-latest.tar.gz /tmp/talia-ui-latest.tar.gz

echo '🔄 Restarting all services...'
# Restart in dependency order to ensure proper startup
docker compose -f docker-compose.staging.yml restart supabase-db supabase-rest supabase-kong || true
sleep 3
docker compose -f docker-compose.staging.yml up -d --force-recreate graphql-server
sleep 3
docker compose -f docker-compose.staging.yml up -d --force-recreate ui

echo '⏳ Waiting for services to be healthy...'
sleep 10

echo '📊 Checking service status...'
docker compose -f docker-compose.staging.yml ps

echo ''
echo '🧪 Testing critical endpoints...'

# Wait for services to be ready
max_attempts=30
attempt=0

# Test GraphQL server
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

# Test Supabase connection via GraphQL
echo -n '  Testing Supabase connection... '
supabase_online=\$(curl -sS -f -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ supabaseConnectionStatus { online } }\"}' 2>/dev/null | grep -o '\"online\":true' || echo '')
if [ -n \"\$supabase_online\" ]; then
  echo '✅ OK'
else
  echo '⚠️  WARNING - Supabase connection may be offline'
fi

# Test databaseTables query (critical for Data Mode)
echo -n '  Testing databaseTables query... '
table_count=\$(curl -sS -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName } }\"}' 2>/dev/null | grep -o '\"tableName\"' | wc -l || echo '0')
if [ \"\$table_count\" -gt \"0\" ]; then
  echo \"✅ OK (\$table_count tables)\"
else
  echo '❌ FAILED - No tables returned'
  exit 1
fi

# Test UI GraphQL proxy
echo -n '  Testing UI GraphQL proxy... '
if curl -sS -f -X POST http://localhost:5173/api/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
  echo '✅ OK'
else
  echo '❌ FAILED - UI proxy not working'
  exit 1
fi

echo ''
echo '✅ Docker deployment complete and verified!'
"

ssh ${STAGING_USER}@${STAGING_HOST} "$DEPLOY_SCRIPT"

# Clean up local tar files
rm /tmp/talia-server-latest.tar.gz /tmp/talia-ui-latest.tar.gz

echo ""
echo -e "${GREEN}✅ Docker deployment successful!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Verify staging: https://taliahub.com"
echo "  2. Check logs if needed: ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && docker compose logs'"
