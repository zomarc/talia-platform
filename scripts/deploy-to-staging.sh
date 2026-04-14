#!/bin/bash
# Deploy Talia Platform from local to staging environment.
# Policy: staging deploys default to direct local -> staging LAN sync.
# Git-based sync is intentionally guarded and requires explicit typed confirmation.
# Usage: ./scripts/deploy-to-staging.sh [--ui-only|--full|--scripts-only|--dry-run|--git-sync]
#
# Non-interactive (CI / automation): set STAGING_DEPLOY_CONFIRM_TOKEN to the
# exact token the script would ask for: DEPLOY_UI_ONLY / DEPLOY_FULL_STACK /
# DEPLOY_SCRIPTS_ONLY (must match selected mode). Example:
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
LOCAL_SCRIPTS_ARCHIVE="${LOCAL_SCRIPTS_ARCHIVE:-/tmp/talia-staging-scripts-sync.tar.gz}"
REMOTE_SCRIPTS_ARCHIVE="${REMOTE_SCRIPTS_ARCHIVE:-/tmp/talia-staging-scripts-sync.tar.gz}"
LOCAL_UI_DIST_ARCHIVE="${LOCAL_UI_DIST_ARCHIVE:-/tmp/talia-staging-ui-dist.tar.gz}"
REMOTE_UI_DIST_ARCHIVE="${REMOTE_UI_DIST_ARCHIVE:-/tmp/talia-staging-ui-dist.tar.gz}"
LOCAL_SERVER_DIST_ARCHIVE="${LOCAL_SERVER_DIST_ARCHIVE:-/tmp/talia-staging-server-dist.tar.gz}"
REMOTE_SERVER_DIST_ARCHIVE="${REMOTE_SERVER_DIST_ARCHIVE:-/tmp/talia-staging-server-dist.tar.gz}"
STAGING_VERIFY_UI_URL="${STAGING_VERIFY_UI_URL:-http://${STAGING_HOST}:${STAGING_UI_PORT:-5173}}"
STAGING_UI_SUPABASE_URL="${STAGING_UI_SUPABASE_URL:-http://${STAGING_HOST}:54321}"
STAGING_UI_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}"
STAGING_UI_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT:-http://${STAGING_HOST}:4000/graphql}"
STAGING_UI_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE:-true}"

# Remote Docker Compose invocation (set DEPLOY_DOCKER_COMPOSE='sudo docker compose' for Azure MVP if needed)
DC="${DEPLOY_DOCKER_COMPOSE:-docker compose}"
# Remote docker binary for docker cp (set DEPLOY_DOCKER_BIN=sudo docker with sudo compose)
DOCKER_BIN="${DEPLOY_DOCKER_BIN:-docker}"

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
    --graphql-only)
      DEPLOY_MODE="graphql-only"
      shift
      ;;
    --full)
      DEPLOY_MODE="full"
      shift
      ;;
    --scripts-only)
      DEPLOY_MODE="scripts-only"
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
      echo "Usage: $0 [--ui-only|--graphql-only|--full|--scripts-only|--dry-run|--git-sync]"
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
    elif [ "$DEPLOY_MODE" = "graphql-only" ] && [ "$STAGING_DEPLOY_CONFIRM_TOKEN" = "DEPLOY_GRAPHQL_ONLY" ]; then
      use_noninteractive=true
      CONFIRM_TOKEN="DEPLOY_GRAPHQL_ONLY"
    elif [ "$DEPLOY_MODE" = "scripts-only" ] && [ "$STAGING_DEPLOY_CONFIRM_TOKEN" = "DEPLOY_SCRIPTS_ONLY" ]; then
      use_noninteractive=true
      CONFIRM_TOKEN="DEPLOY_SCRIPTS_ONLY"
    else
      echo -e "${RED}Error: STAGING_DEPLOY_CONFIRM_TOKEN must match mode: DEPLOY_UI_ONLY / DEPLOY_GRAPHQL_ONLY / DEPLOY_FULL_STACK / DEPLOY_SCRIPTS_ONLY.${NC}"
      exit 1
    fi
  fi

  if [ "$use_noninteractive" = true ]; then
    echo -e "${BLUE}Non-interactive deploy: confirmed via STAGING_DEPLOY_CONFIRM_TOKEN=${CONFIRM_TOKEN}${NC}"
    DEPLOY_CONFIRM="$CONFIRM_TOKEN"
  elif [ ! -t 0 ]; then
    echo -e "${RED}Error: staging deploy requires interactive confirmation or STAGING_DEPLOY_CONFIRM_TOKEN.${NC}"
    echo -e "${RED}Deployment scope must be selected explicitly (UI-only, GraphQL-only, Full stack, or Scripts-only).${NC}"
    exit 1
  else
    echo -e "${BLUE}Select deployment scope:${NC}"
    echo "  1) UI-only  (default, recommended) - rebuild/restart UI only"
    echo "  2) Full stack - rebuild UI + GraphQL and run schema guard"
    echo "  3) GraphQL only - sync talia-server + docker compose build graphql-server (no UI, no schema guard)"
    echo "  4) Scripts + config only - sync scripts + config without restarting services"
    echo ""

    default_scope="1"
    if [ "$DEPLOY_MODE" = "full" ]; then
      default_scope="2"
    elif [ "$DEPLOY_MODE" = "graphql-only" ]; then
      default_scope="3"
    elif [ "$DEPLOY_MODE" = "scripts-only" ]; then
      default_scope="4"
    fi

    read -r -p "Choose scope [1/2/3/4] (default: ${default_scope}): " SCOPE_CHOICE
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
      3)
        DEPLOY_MODE="graphql-only"
        CONFIRM_TOKEN="DEPLOY_GRAPHQL_ONLY"
        ;;
      4)
        DEPLOY_MODE="scripts-only"
        CONFIRM_TOKEN="DEPLOY_SCRIPTS_ONLY"
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
elif [ "$DEPLOY_MODE" = "graphql-only" ]; then
  echo -e "${YELLOW}GraphQL-only: sync code archive + docker compose build graphql-server (no UI, no schema guard).${NC}"
  echo ""
fi

# Local sync package transfer (default mode)
if [ "$SYNC_MODE" = "local" ]; then
  echo ""
  if [ "$DEPLOY_MODE" = "scripts-only" ]; then
    echo -e "${BLUE}📦 Preparing scripts/config archive for staging...${NC}"
  else
    echo -e "${BLUE}📦 Preparing local code archive for staging...${NC}"
  fi
  if [ "$DRY_RUN" = false ]; then
    if [ "$DEPLOY_MODE" = "scripts-only" ]; then
      tar -czf "$LOCAL_SCRIPTS_ARCHIVE" \
        --exclude='.DS_Store' \
        scripts validate
      scp "$LOCAL_SCRIPTS_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_SCRIPTS_ARCHIVE}"
      rm -f "$LOCAL_SCRIPTS_ARCHIVE"
      echo -e "${GREEN}✅ Scripts/config archive copied to staging${NC}"
    else
      if [ "${DEPLOY_SKIP_CODE_ARCHIVE:-0}" = "1" ] && [ "$DEPLOY_MODE" = "ui-only" ]; then
        echo -e "${BLUE}⏭️  Skipping full code archive (ui-only + DEPLOY_SKIP_CODE_ARCHIVE=1).${NC}"
        echo -e "${BLUE}   Pushing UI dist only. GraphQL/backend updates use --graphql-only or --full (syncs talia-server + compose build).${NC}"
      else
        tar -czf "$LOCAL_ARCHIVE" \
          --exclude='.git' \
          --exclude='talia-ui/node_modules' \
          --exclude='talia-server/node_modules' \
          --exclude='talia-ui/dist' \
          --exclude='talia-server/dist' \
          --exclude='.DS_Store' \
          docker-compose.staging.yml .env.staging.example talia-ui talia-server scripts supabase infra
        scp "$LOCAL_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_ARCHIVE}"
        rm -f "$LOCAL_ARCHIVE"
        echo -e "${GREEN}✅ Local code archive copied to staging${NC}"
      fi
    fi

    # UI: static dist can be copied into the nginx container. GraphQL: always built on the host via
    # Dockerfile (npm install + compile + prune) so node_modules and dist stay in sync — never docker-cp dist only.
    if [ "$DEPLOY_MODE" = "ui-only" ] || [ "$DEPLOY_MODE" = "full" ]; then
      echo -e "${BLUE}🧱 Building local UI dist artifact...${NC}"
      UI_APP_VERSION="$(python3 -c 'import json;print(json.load(open("talia-ui/package.json","r",encoding="utf-8")).get("version","0.0.0"))')"
      UI_BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
      VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-${DEPLOY_TARGET_LABEL:-staging}}"
      (
        cd talia-ui
        if [ ! -d "node_modules" ]; then
          echo -e "${YELLOW}node_modules not found in talia-ui; running npm install...${NC}"
          npm install
        fi
        VITE_SUPABASE_URL="$STAGING_UI_SUPABASE_URL" \
        VITE_SUPABASE_ANON_KEY="$STAGING_UI_SUPABASE_ANON_KEY" \
        VITE_GRAPHQL_ENDPOINT="$STAGING_UI_GRAPHQL_ENDPOINT" \
        VITE_ENABLE_DEV_MODE="$STAGING_UI_ENABLE_DEV_MODE" \
        VITE_APP_VERSION="$UI_APP_VERSION" \
        VITE_ENVIRONMENT="$VITE_ENVIRONMENT" \
        VITE_BUILD_TIME="$UI_BUILD_TIME" \
        npm run build
      )
      tar -czf "$LOCAL_UI_DIST_ARCHIVE" -C talia-ui dist
      scp "$LOCAL_UI_DIST_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_UI_DIST_ARCHIVE}"
      rm -f "$LOCAL_UI_DIST_ARCHIVE"
      echo -e "${GREEN}✅ Local UI dist artifact copied to staging${NC}"
    fi

  else
    if [ "$DEPLOY_MODE" = "scripts-only" ]; then
      echo -e "${YELLOW}[DRY RUN] Would create and copy scripts/config archive: ${LOCAL_SCRIPTS_ARCHIVE}${NC}"
    else
      echo -e "${YELLOW}[DRY RUN] Would create and copy archive: ${LOCAL_ARCHIVE}${NC}"
    fi
    if [ "$DEPLOY_MODE" = "ui-only" ] || [ "$DEPLOY_MODE" = "full" ]; then
      echo -e "${YELLOW}[DRY RUN] Would build and copy local UI dist artifact: ${LOCAL_UI_DIST_ARCHIVE}${NC}"
    fi
  fi
fi

# SSH to staging and deploy
_DEPLOY_SKIP_CODE_EXTRACT="${DEPLOY_SKIP_CODE_ARCHIVE:-0}"
DEPLOY_SCRIPT="
set -e
mkdir -p $STAGING_GIT_DIR
cd $STAGING_GIT_DIR
REMOTE_ARCHIVE='$REMOTE_ARCHIVE'
REMOTE_SCRIPTS_ARCHIVE='$REMOTE_SCRIPTS_ARCHIVE'
REMOTE_UI_DIST_ARCHIVE='$REMOTE_UI_DIST_ARCHIVE'

if [ \"$SYNC_MODE\" = \"git\" ]; then
  echo '📥 Pulling latest code from git...'
  git fetch origin
  git reset --hard origin/main
else
  if [ \"$DEPLOY_MODE\" = \"scripts-only\" ]; then
    echo '📦 Extracting scripts/config archive...'
    tar -xzf \"\$REMOTE_SCRIPTS_ARCHIVE\" -C .
    rm -f \"\$REMOTE_SCRIPTS_ARCHIVE\"
    chmod +x ./scripts/validate ./validate 2>/dev/null || true
  else
    if [ \"$_DEPLOY_SKIP_CODE_EXTRACT\" = \"1\" ] && [ \"$DEPLOY_MODE\" = \"ui-only\" ]; then
      echo '📦 Skipping full code archive extract (ui-only dist sync).'
    else
      echo '📦 Extracting local code archive...'
      tar -xzf \"\$REMOTE_ARCHIVE\" -C .
      rm -f \"\$REMOTE_ARCHIVE\"
    fi
  fi
fi

if [ \"$DEPLOY_MODE\" = \"scripts-only\" ]; then
  echo '🎯 Scripts/config deployment complete (no service restarts).'
elif [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🎯 Full deployment (backend + UI + schema guard)...'
  echo '🔨 Building graphql-server image (Dockerfile: npm install + compile + prune)...'
  ${DC} -f docker-compose.staging.yml build graphql-server
  ${DC} -f docker-compose.staging.yml up -d --no-deps graphql-server

  if [ -f \"\$REMOTE_UI_DIST_ARCHIVE\" ]; then
    echo '📦 Applying local UI dist artifact...'
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    UI_CONTAINER_ID=\$(${DC} -f docker-compose.staging.yml ps -q ui)
    if [ -z \"\$UI_CONTAINER_ID\" ]; then
      echo '❌ FAILED - ui container is not running; cannot apply local dist artifact'
      exit 1
    fi
    TMP_UI_DIST_DIR=\"/tmp/talia-ui-dist-fallback\"
    rm -rf \"\$TMP_UI_DIST_DIR\"
    mkdir -p \"\$TMP_UI_DIST_DIR\"
    tar -xzf \"\$REMOTE_UI_DIST_ARCHIVE\" -C \"\$TMP_UI_DIST_DIR\"
    if [ ! -d \"\$TMP_UI_DIST_DIR/dist\" ]; then
      echo '❌ FAILED - dist folder missing in UI artifact'
      exit 1
    fi
    ${DOCKER_BIN} cp \"\$TMP_UI_DIST_DIR/dist/.\" \"\$UI_CONTAINER_ID:/usr/share/nginx/html/\"
    ${DC} -f docker-compose.staging.yml restart ui
    rm -rf \"\$TMP_UI_DIST_DIR\"
    rm -f \"\$REMOTE_UI_DIST_ARCHIVE\"
    echo '✅ UI dist applied; graphql-server rebuilt from image'
  else
    echo '🔨 No local UI dist artifact; rebuilding ui image...'
    ${DC} -f docker-compose.staging.yml build ui
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    echo '✅ UI image rebuild succeeded'
  fi
elif [ \"$DEPLOY_MODE\" = \"graphql-only\" ]; then
  echo '🎯 GraphQL-only: rebuild graphql-server from synced talia-server (Dockerfile)...'
  ${DC} -f docker-compose.staging.yml build graphql-server
  ${DC} -f docker-compose.staging.yml up -d --no-deps graphql-server
  echo '✅ graphql-server container running from new image'
else
  echo '🎯 UI-only deployment (backend/data services untouched)...'
  if [ -f \"\$REMOTE_UI_DIST_ARCHIVE\" ]; then
    echo '📦 Applying local UI dist artifact (no remote image rebuild)...'
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    UI_CONTAINER_ID=\$(${DC} -f docker-compose.staging.yml ps -q ui)
    if [ -z \"\$UI_CONTAINER_ID\" ]; then
      echo '❌ FAILED - ui container is not running; cannot apply local dist artifact'
      exit 1
    fi
    TMP_UI_DIST_DIR=\"/tmp/talia-ui-dist-fallback\"
    rm -rf \"\$TMP_UI_DIST_DIR\"
    mkdir -p \"\$TMP_UI_DIST_DIR\"
    tar -xzf \"\$REMOTE_UI_DIST_ARCHIVE\" -C \"\$TMP_UI_DIST_DIR\"
    if [ ! -d \"\$TMP_UI_DIST_DIR/dist\" ]; then
      echo '❌ FAILED - dist folder missing in fallback archive'
      exit 1
    fi
    ${DOCKER_BIN} cp \"\$TMP_UI_DIST_DIR/dist/.\" \"\$UI_CONTAINER_ID:/usr/share/nginx/html/\"
    ${DC} -f docker-compose.staging.yml restart ui
    rm -rf \"\$TMP_UI_DIST_DIR\"
    rm -f \"\$REMOTE_UI_DIST_ARCHIVE\"
    echo '✅ Local UI dist artifact applied to running ui container'
  else
    echo '🔨 No local UI dist artifact found; falling back to remote ui image rebuild...'
    ${DC} -f docker-compose.staging.yml build ui
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    echo '✅ UI image rebuild succeeded'
  fi
fi

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🗄️ Running schema guard (apply + verify required tables)...'
  bash ./scripts/staging-db-guard.sh
fi

if [ \"$DEPLOY_MODE\" != \"scripts-only\" ]; then
  echo '⏳ Waiting for services to be healthy...'
  sleep 10

  echo '📊 Checking service status...'
  ${DC} -f docker-compose.staging.yml ps

  echo ''
  echo '🧪 Testing critical endpoints...'
fi

# Wait for services to be ready
max_attempts=30
attempt=0

if [ \"$DEPLOY_MODE\" = \"full\" ] || [ \"$DEPLOY_MODE\" = \"graphql-only\" ]; then
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
fi

if [ \"$DEPLOY_MODE\" = \"full\" ]; then
  # Test required schema tables for ship tracker/inventory memo features
  echo -n '  Testing required tables (inventory_item, inventory_item_memo)... '
  required_tables_check=\$(${DC} -f docker-compose.staging.yml exec -T supabase-db psql -U postgres -d postgres -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('inventory_item','inventory_item_memo');\" | tr -d '[:space:]')
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
if [ \"$DEPLOY_MODE\" != \"scripts-only\" ]; then
  echo -n '  Testing UI GraphQL proxy... '
  if curl -sS -f -X POST http://localhost:5173/api/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
    echo '✅ OK'
  else
    echo '❌ FAILED - UI proxy not working'
    exit 1
  fi
fi

echo ''
if [ \"$DEPLOY_MODE\" = \"scripts-only\" ]; then
  echo '✅ Scripts/config deployment complete!'
else
  echo '✅ Deployment complete and verified!'
  echo '🌐 Verify direct staging: ${STAGING_VERIFY_UI_URL}'
fi
"

if [ "$DRY_RUN" = false ]; then
  ssh ${STAGING_USER}@${STAGING_HOST} "$DEPLOY_SCRIPT"
  echo ""
  echo -e "${GREEN}✅ Deployment successful!${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "  1. Verify direct staging: ${STAGING_VERIFY_UI_URL}"
  echo "  2. Check logs if needed: ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && ${DC} logs'"
else
  echo -e "${YELLOW}[DRY RUN] Would execute on staging:${NC}"
  echo "$DEPLOY_SCRIPT"
fi

echo ""
echo -e "${GREEN}Done!${NC}"
