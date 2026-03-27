#!/bin/bash
# Deploy Talia Platform from local to staging environment.
# Policy: staging deploys default to direct local -> staging LAN sync.
# Git-based sync is intentionally guarded and requires explicit typed confirmation.
# Usage: ./scripts/deploy-to-staging.sh [--ui-only|--full|--dry-run|--git-sync]
#
# Non-interactive (CI / automation): set STAGING_DEPLOY_CONFIRM_TOKEN to the
# exact token the script would ask for: DEPLOY_UI_ONLY or DEPLOY_FULL_STACK
# (must match --ui-only vs --full). Example:
#   STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-staging.sh --ui-only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

# Configuration
STAGING_USER="${STAGING_USER:-${STAGING_SSH_USER:-zomarc}}"
STAGING_HOST="${STAGING_HOST:-${STAGING_SSH_HOST:-192.168.1.120}}"
STAGING_DIR="${STAGING_DIR:-${STAGING_APP_DIR:-/home/${STAGING_USER}/talia-docker}}"
STAGING_GIT_DIR="${STAGING_GIT_DIR:-${STAGING_DIR}}"
LOCAL_ARCHIVE="${LOCAL_ARCHIVE:-/tmp/talia-staging-code-sync.tar.gz}"
REMOTE_ARCHIVE="${REMOTE_ARCHIVE:-/tmp/talia-staging-code-sync.tar.gz}"
STAGING_VERIFY_UI_URL="${STAGING_VERIFY_UI_URL:-http://${STAGING_HOST}:${STAGING_UI_PORT:-5173}}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DEPLOY_MODE=""
DRY_RUN=false
SYNC_MODE="local"

while [[ $# -gt 0 ]]; do
  case $1 in
    --ui-only|--code-only)
      DEPLOY_MODE="ui-only"
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
    --git-sync)
      SYNC_MODE="git"
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--ui-only|--full|--dry-run|--git-sync]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy to Staging (${STAGING_HOST})${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Policy:${NC} default staging deploy is direct local -> staging LAN sync."
echo ""
if [ -z "$DEPLOY_MODE" ]; then
  DEPLOY_MODE="ui-only"
fi

if [ "$DRY_RUN" = false ]; then
  STAGING_DEPLOY_CONFIRM_TOKEN="${STAGING_DEPLOY_CONFIRM_TOKEN:-}"
  use_noninteractive=false
  if [ -n "$STAGING_DEPLOY_CONFIRM_TOKEN" ]; then
    if [ "$DEPLOY_MODE" = "full" ] && [ "$STAGING_DEPLOY_CONFIRM_TOKEN" = "DEPLOY_FULL_STACK" ]; then
      use_noninteractive=true
      CONFIRM_TOKEN="DEPLOY_FULL_STACK"
    elif [ "$DEPLOY_MODE" = "ui-only" ] && [ "$STAGING_DEPLOY_CONFIRM_TOKEN" = "DEPLOY_UI_ONLY" ]; then
      use_noninteractive=true
      CONFIRM_TOKEN="DEPLOY_UI_ONLY"
    else
      echo -e "${RED}Error: STAGING_DEPLOY_CONFIRM_TOKEN must be DEPLOY_UI_ONLY (with --ui-only) or DEPLOY_FULL_STACK (with --full).${NC}"
      exit 1
    fi
  fi

  if [ "$use_noninteractive" = true ]; then
    echo -e "${BLUE}Non-interactive deploy: confirmed via STAGING_DEPLOY_CONFIRM_TOKEN=${CONFIRM_TOKEN}${NC}"
    DEPLOY_CONFIRM="$CONFIRM_TOKEN"
  elif [ ! -t 0 ]; then
    echo -e "${RED}Error: staging deploy requires interactive confirmation or STAGING_DEPLOY_CONFIRM_TOKEN.${NC}"
    echo -e "${RED}Deployment scope must be selected explicitly (UI-only or Full stack).${NC}"
    exit 1
  else
    echo -e "${BLUE}Select deployment scope:${NC}"
    echo "  1) UI-only  (default, recommended) - rebuild/restart UI only"
    echo "  2) Full stack - rebuild UI + GraphQL and run schema guard"
    echo ""

    default_scope="1"
    if [ "$DEPLOY_MODE" = "full" ]; then
      default_scope="2"
    fi

    read -r -p "Choose scope [1/2] (default: ${default_scope}): " SCOPE_CHOICE
    SCOPE_CHOICE="${SCOPE_CHOICE:-$default_scope}"

    case "$SCOPE_CHOICE" in
      1)
        DEPLOY_MODE="ui-only"
        CONFIRM_TOKEN="DEPLOY_UI_ONLY"
        ;;
      2)
        DEPLOY_MODE="full"
        CONFIRM_TOKEN="DEPLOY_FULL_STACK"
        ;;
      *)
        echo -e "${RED}Invalid selection. Aborting.${NC}"
        exit 1
        ;;
    esac

    read -r -p "Type ${CONFIRM_TOKEN} to continue: " DEPLOY_CONFIRM
    if [ "$DEPLOY_CONFIRM" != "$CONFIRM_TOKEN" ]; then
      echo -e "${RED}Aborted: deployment not confirmed.${NC}"
      exit 1
    fi
  fi
fi

echo -e "Mode: ${YELLOW}${DEPLOY_MODE}${NC}"
echo -e "Sync: ${YELLOW}${SYNC_MODE}${NC} (default: local)"
if [ "$DRY_RUN" = true ]; then
  echo -e "Dry Run: ${YELLOW}YES${NC}"
fi
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "talia-ui" ] || [ ! -d "talia-server" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

if [ "$SYNC_MODE" = "git" ]; then
  echo -e "${YELLOW}⚠️  You selected --git-sync.${NC}"
  echo -e "${YELLOW}⚠️  Default/approved method is direct local -> staging LAN deployment.${NC}"
  echo -e "${YELLOW}⚠️  Use git-sync only with explicit approval for this run.${NC}"
  echo ""
  if [ "$DRY_RUN" = false ]; then
    if [ ! -t 0 ]; then
      echo -e "${RED}Error: --git-sync requires an interactive terminal confirmation.${NC}"
      echo -e "${RED}Run again interactively or use default local sync.${NC}"
      exit 1
    fi
    read -r -p "Type APPROVE_GIT_SYNC to continue with git-based deployment: " GIT_SYNC_APPROVAL
    if [ "$GIT_SYNC_APPROVAL" != "APPROVE_GIT_SYNC" ]; then
      echo -e "${RED}Aborted: git-sync not approved. Use default local sync deployment.${NC}"
      exit 1
    fi
  fi

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

  echo ""
  echo -e "${BLUE}📤 Pushing to git...${NC}"
  if [ "$DRY_RUN" = false ]; then
    git push
    echo -e "${GREEN}✅ Code pushed to git${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would run: git push${NC}"
  fi
else
  echo -e "${BLUE}📦 Local sync mode selected (no git push/pull).${NC}"
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

# Local sync package transfer (default mode)
if [ "$SYNC_MODE" = "local" ]; then
  echo ""
  echo -e "${BLUE}📦 Preparing local code archive for staging...${NC}"
  if [ "$DRY_RUN" = false ]; then
    tar -czf "$LOCAL_ARCHIVE" \
      --exclude='.git' \
      --exclude='talia-ui/node_modules' \
      --exclude='talia-server/node_modules' \
      --exclude='talia-ui/dist' \
      --exclude='talia-server/dist' \
      --exclude='.DS_Store' \
      docker-compose.staging.yml talia-ui talia-server scripts supabase
    scp "$LOCAL_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_ARCHIVE}"
    rm -f "$LOCAL_ARCHIVE"
    echo -e "${GREEN}✅ Local code archive copied to staging${NC}"
  else
    echo -e "${YELLOW}[DRY RUN] Would create and copy archive: ${LOCAL_ARCHIVE}${NC}"
  fi
fi

# SSH to staging and deploy
DEPLOY_SCRIPT="
set -e
mkdir -p $STAGING_GIT_DIR
cd $STAGING_GIT_DIR

if [ \"$SYNC_MODE\" = \"git\" ]; then
  echo '📥 Pulling latest code from git...'
  git fetch origin
  git reset --hard origin/main
else
  echo '📦 Extracting local code archive...'
  tar -xzf $REMOTE_ARCHIVE -C .
  rm -f $REMOTE_ARCHIVE
fi

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🐳 Rebuilding Docker containers...'
  docker compose -f docker-compose.staging.yml build --no-cache ui graphql-server
  docker compose -f docker-compose.staging.yml up -d
else
  echo '🎯 UI-only deployment (backend/data services untouched)...'
  echo '🔨 Rebuilding UI container with latest code...'
  docker compose -f docker-compose.staging.yml build ui
  docker compose -f docker-compose.staging.yml up -d --no-deps ui
fi

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🗄️ Running schema guard (apply + verify required tables)...'
  bash ./scripts/staging-db-guard.sh
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

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
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

  # Test required schema tables for ship tracker/inventory memo features
  echo -n '  Testing required tables (inventory_item, inventory_item_memo)... '
  required_tables_check=\$(docker compose -f docker-compose.staging.yml exec -T supabase-db psql -U postgres -d postgres -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('inventory_item','inventory_item_memo');\" | tr -d '[:space:]')
  if [ \"\$required_tables_check\" = \"2\" ]; then
    echo '✅ OK'
  else
    echo \"❌ FAILED - Required tables missing (found \$required_tables_check/2)\"
    exit 1
  fi

  # Test schema compatibility for Admin Lite metadata fields
  echo -n '  Testing Admin Lite metadata fields... '
  schema_check=\$(curl -sS -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName actualDataRange { min max } lastError } }\"}' 2>/dev/null)
  if echo \"\$schema_check\" | grep -q '\"errors\"'; then
    echo '❌ FAILED - Admin Lite schema mismatch'
    echo \"\$schema_check\"
    exit 1
  else
    echo '✅ OK'
  fi
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
echo '🌐 Verify direct staging: ${STAGING_VERIFY_UI_URL}'
"

if [ "$DRY_RUN" = false ]; then
  ssh ${STAGING_USER}@${STAGING_HOST} "$DEPLOY_SCRIPT"
  echo ""
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "  1. Verify direct staging: ${STAGING_VERIFY_UI_URL}"
  echo "  2. Check logs if needed: ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && docker compose logs'"
else
  echo -e "${YELLOW}[DRY RUN] Would execute on staging:${NC}"
  echo "$DEPLOY_SCRIPT"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
