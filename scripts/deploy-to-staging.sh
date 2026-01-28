#!/bin/bash
# Deploy Talia Platform from local to staging environment
# Usage: ./scripts/deploy-to-staging.sh [--code-only|--full|--dry-run]

set -e

# Configuration
STAGING_USER="zomarc"
STAGING_HOST="192.168.1.120"
STAGING_DIR="~/talia-docker"
STAGING_GIT_DIR="~/talia-docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DEPLOY_MODE="code-only"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --code-only)
      DEPLOY_MODE="code-only"
      shift
      ;;
    --full)
      DEPLOY_MODE="full"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--code-only|--full|--dry-run]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy to Staging (taliahub.com)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Mode: ${YELLOW}${DEPLOY_MODE}${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "Dry Run: ${YELLOW}YES${NC}"
fi
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "talia-ui" ] || [ ! -d "talia-server" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

# Check git status
echo -e "${BLUE}📋 Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
  echo ""
  read -p "Do you want to commit them now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Commit message: " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
      COMMIT_MSG="chore: deploy to staging"
    fi
    git add .
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✅ Changes committed${NC}"
  else
    echo -e "${YELLOW}⚠️  Proceeding with uncommitted changes${NC}"
  fi
fi

# Push to git
echo ""
echo -e "${BLUE}📤 Pushing to git...${NC}"
if [ "$DRY_RUN" = false ]; then
  git push
  echo -e "${GREEN}✅ Code pushed to git${NC}"
else
  echo -e "${YELLOW}[DRY RUN] Would run: git push${NC}"
fi

# Deploy to staging
echo ""
echo -e "${BLUE}🚀 Deploying to staging...${NC}"

if [ "$DEPLOY_MODE" = "full" ]; then
  echo -e "${YELLOW}Full deployment mode: Code + Docker images${NC}"
  echo -e "${YELLOW}Note: Docker image deployment requires separate script${NC}"
  echo -e "${YELLOW}Run: ./scripts/deploy-to-staging-docker.sh${NC}"
  echo ""
fi

# SSH to staging and pull/restart
DEPLOY_SCRIPT="
set -e
cd $STAGING_GIT_DIR

echo '📥 Pulling latest code...'
git fetch origin
git reset --hard origin/main

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🐳 Rebuilding Docker containers...'
  docker compose -f docker-compose.staging.yml build --no-cache ui graphql-server
  docker compose -f docker-compose.staging.yml up -d
else
  echo '🔄 Restarting base services (code-only)...'
  docker compose -f docker-compose.staging.yml restart supabase-db supabase-rest supabase-kong
  sleep 3
  # Rebuild GraphQL server and UI so staging gets latest schema and frontend
  echo '🔨 Rebuilding GraphQL server with latest schema...'
  docker compose -f docker-compose.staging.yml build graphql-server
  echo '🔨 Rebuilding UI container with latest code...'
  docker compose -f docker-compose.staging.yml build ui
  docker compose -f docker-compose.staging.yml up -d graphql-server ui
fi

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
echo '✅ Deployment complete and verified!'
echo '🌐 Verify at: https://taliahub.com'
"

if [ "$DRY_RUN" = false ]; then
  ssh ${STAGING_USER}@${STAGING_HOST} "$DEPLOY_SCRIPT"
  echo ""
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "  1. Verify staging: https://taliahub.com"
  echo "  2. Check logs if needed: ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && docker compose logs'"
else
  echo -e "${YELLOW}[DRY RUN] Would execute on staging:${NC}"
  echo "$DEPLOY_SCRIPT"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
