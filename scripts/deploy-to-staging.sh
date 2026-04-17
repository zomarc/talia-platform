#!/bin/bash
# Deploy Talia Platform from this machine to staging over SSH.
#
# POLICY — scope is never widened implicitly
# - Default with no flags: --ui-only (static UI path; no monorepo tarball unless you opt in).
# - Full stack, GraphQL-only rebuilds, and “UI + whole repo tarball” are opt-in and must match
#   the flags you pass. This script does not “deploy everything” unless you select --full or
#   equivalent narrow modes (--graphql-only, DEPLOY_INCLUDE_CODE_ARCHIVE=1, etc.).
# - Non-interactive use (token set, stdin not a TTY) requires a second explicit env for WIDE
#   modes only — see DEPLOY_EXPLICIT_* below. Narrow UI/scripts paths need only the token.
#
# Policy: local working tree → tarball/scp → extract on host → compose (no remote git pull).
# Usage: ./scripts/deploy-to-staging.sh [--ui-only|--ui-hot|--graphql-only|--full|--scripts-only|--dry-run]
# --ui-only: dist only by default (SKIP_FULL_CODE_ARCHIVE). Opt in: DEPLOY_INCLUDE_CODE_ARCHIVE=1
#   (non-interactive: also DEPLOY_EXPLICIT_INCLUDE_CODE_ARCHIVE=1).
# --ui-hot: same as ui-only but uses existing talia-ui/dist (no local npm build) and skips
#   docker compose restart ui after docker cp (static files only; run vite build locally first).
# --graphql-only: smaller tarball (no talia-ui) + tar heartbeat logs.
#
# Non-interactive (CI / automation / validate): set STAGING_DEPLOY_CONFIRM_TOKEN to the exact
# token for the mode. WIDE modes also require a matching DEPLOY_EXPLICIT_*=1:
#   UI only:     STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-staging.sh --ui-only
#   Full stack:  STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_FULL_STACK DEPLOY_EXPLICIT_FULL_STACK=1 ./scripts/deploy-to-staging.sh --full
#   GraphQL:     STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_GRAPHQL_ONLY DEPLOY_EXPLICIT_GRAPHQL_ONLY=1 ./scripts/deploy-to-staging.sh --graphql-only
#   UI+monorepo: DEPLOY_INCLUDE_CODE_ARCHIVE=1 DEPLOY_EXPLICIT_INCLUDE_CODE_ARCHIVE=1 STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-staging.sh --ui-only

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
# Shipped in UI dist as talia-instance.json so the header matches the host you deployed to (staging vs mvp).
export DEPLOY_TARGET_LABEL="${DEPLOY_TARGET_LABEL:-staging}"

# Remote Docker Compose invocation (set DEPLOY_DOCKER_COMPOSE='sudo docker compose' for Azure MVP if needed)
DC="${DEPLOY_DOCKER_COMPOSE:-docker compose}"
# Remote docker binary for docker cp (set DEPLOY_DOCKER_BIN=sudo docker with sudo compose)
DOCKER_BIN="${DEPLOY_DOCKER_BIN:-docker}"

# SSH: bounded TCP connect + keepalives so long remote docker builds do not look like a hung laptop SSH.
DEPLOY_SSH_OPTS=( -o "ConnectTimeout=25" -o "ServerAliveInterval=15" -o "ServerAliveCountMax=240" )
deploy_scp() { scp "${DEPLOY_SSH_OPTS[@]}" "$@"; }
deploy_ssh() { ssh "${DEPLOY_SSH_OPTS[@]}" "$@"; }

# Stamped into talia-ui/dist immediately before the UI dist tarball (overrides build-time VITE_ENVIRONMENT in the header).
stamp_talia_ui_instance_manifest() {
  local lbl="${DEPLOY_TARGET_LABEL:-staging}"
  mkdir -p talia-ui/dist
  printf '{"deployTarget":"%s"}\n' "$lbl" > talia-ui/dist/talia-instance.json
  echo -e "${BLUE}   Instance manifest for this push: deployTarget=${lbl} (talia-ui/dist/talia-instance.json)${NC}"
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DEPLOY_MODE=""
DRY_RUN=false
UI_HOT_SYNC="${UI_HOT_SYNC:-0}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --ui-hot)
      DEPLOY_MODE="ui-only"
      UI_HOT_SYNC=1
      shift
      ;;
    --ui-only|--code-only)
      DEPLOY_MODE="ui-only"
      UI_HOT_SYNC=0
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
      echo -e "${RED}--git-sync is removed.${NC} Deploy uses only your local tree → scp tarball → staging (see header)." >&2
      exit 1
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--ui-only|--ui-hot|--graphql-only|--full|--scripts-only|--dry-run]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy to Staging (${STAGING_HOST})${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Policy:${NC} default scope is ${YELLOW}UI-only${NC} (no full stack, no surprise monorepo tarball)."
echo -e "${BLUE}      ${NC}Wider actions require ${YELLOW}--full${NC}, ${YELLOW}--graphql-only${NC}, or explicit ${YELLOW}DEPLOY_INCLUDE_CODE_ARCHIVE${NC} — see script header."
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
    echo "  1) UI-only  (default, recommended) - local vite build + copy into nginx + restart ui"
    echo "  5) UI hot sync - use existing talia-ui/dist only (no build, no ui restart) — typical static UI release"
    echo "  2) Full stack - rebuild UI + GraphQL and run schema guard (largest scope — intentional only)"
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
    elif [ "$DEPLOY_MODE" = "ui-only" ] && [ "$UI_HOT_SYNC" = "1" ]; then
      default_scope="5"
    fi

    read -r -p "Choose scope [1/5/2/3/4] (default: ${default_scope}): " SCOPE_CHOICE
    SCOPE_CHOICE="${SCOPE_CHOICE:-$default_scope}"

    case "$SCOPE_CHOICE" in
      1)
        DEPLOY_MODE="ui-only"
        UI_HOT_SYNC=0
        CONFIRM_TOKEN="DEPLOY_UI_ONLY"
        ;;
      5)
        DEPLOY_MODE="ui-only"
        UI_HOT_SYNC=1
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

# Wide non-interactive paths: token alone is not enough (prevents accidental full stack from agents/CI).
if [ "$DRY_RUN" = false ] && [ "${use_noninteractive:-false}" = true ]; then
  case "$DEPLOY_MODE" in
    full)
      if [ "${DEPLOY_EXPLICIT_FULL_STACK:-0}" != "1" ]; then
        echo -e "${RED}Error: non-interactive full stack requires BOTH:${NC}"
        echo "    STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_FULL_STACK"
        echo "    DEPLOY_EXPLICIT_FULL_STACK=1"
        echo -e "${YELLOW}Full stack rebuilds UI + GraphQL and runs the schema guard — pass 1 only if that is exactly what you want.${NC}"
        exit 1
      fi
      ;;
    graphql-only)
      if [ "${DEPLOY_EXPLICIT_GRAPHQL_ONLY:-0}" != "1" ]; then
        echo -e "${RED}Error: non-interactive GraphQL-only requires BOTH:${NC}"
        echo "    STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_GRAPHQL_ONLY"
        echo "    DEPLOY_EXPLICIT_GRAPHQL_ONLY=1"
        exit 1
      fi
      ;;
  esac
  if [ "$DEPLOY_MODE" = "ui-only" ] && [ "${DEPLOY_INCLUDE_CODE_ARCHIVE:-0}" = "1" ]; then
    if [ "${DEPLOY_EXPLICIT_INCLUDE_CODE_ARCHIVE:-0}" != "1" ]; then
      echo -e "${RED}Error: non-interactive UI-only + DEPLOY_INCLUDE_CODE_ARCHIVE=1 requires:${NC}"
      echo "    DEPLOY_EXPLICIT_INCLUDE_CODE_ARCHIVE=1"
      echo -e "${YELLOW}That ships a full monorepo tarball with a UI deploy — use only when intentional.${NC}"
      exit 1
    fi
  fi
fi

if [ "$DEPLOY_MODE" = "ui-only" ] && [ "$UI_HOT_SYNC" = "1" ]; then
  echo -e "Mode: ${YELLOW}ui-only (hot sync — existing dist, no ui container restart)${NC}"
else
  echo -e "Mode: ${YELLOW}${DEPLOY_MODE}${NC}"
fi
echo -e "Sync: ${YELLOW}local tree → tarball/scp → staging${NC} (no remote git)"
if [ "$DRY_RUN" = true ]; then
  echo -e "Dry Run: ${YELLOW}YES${NC}"
fi
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "talia-ui" ] || [ ! -d "talia-server" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

echo -e "${BLUE}📦 Source: this machine’s working tree (commit locally if you want a saved revision).${NC}"

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

# UI-only: ship built dist only (no monorepo tarball). Opt in: DEPLOY_INCLUDE_CODE_ARCHIVE=1
SKIP_FULL_CODE_ARCHIVE=0
if [ "$DEPLOY_MODE" = "ui-only" ] && [ "${DEPLOY_INCLUDE_CODE_ARCHIVE:-0}" != "1" ]; then
  SKIP_FULL_CODE_ARCHIVE=1
fi

echo ""
echo -e "${GREEN}✓ Locked deploy scope:${NC} ${YELLOW}${DEPLOY_MODE}${NC}  monorepo_tarball=${YELLOW}$([ "$SKIP_FULL_CODE_ARCHIVE" = 1 ] && echo skipped || echo included)${NC}  ui_hot_sync=${YELLOW}${UI_HOT_SYNC}${NC}"
echo -e "${BLUE}  (This script will not expand to full stack or other modes unless you re-run with those flags.)${NC}"

# Local sync package transfer
  echo ""
  if [ "$DEPLOY_MODE" = "scripts-only" ]; then
    echo -e "${BLUE}📦 Preparing scripts/config archive for staging...${NC}"
  elif [ "$SKIP_FULL_CODE_ARCHIVE" = "1" ]; then
    echo -e "${BLUE}📦 UI-only: static bundle only (skipping full repo tarball).${NC}"
  else
    echo -e "${BLUE}📦 Preparing local code archive for staging...${NC}"
  fi
  if [ "$DRY_RUN" = false ]; then
    if [ "$DEPLOY_MODE" = "scripts-only" ]; then
      tar -czf "$LOCAL_SCRIPTS_ARCHIVE" \
        --exclude='.DS_Store' \
        scripts validate
      deploy_scp "$LOCAL_SCRIPTS_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_SCRIPTS_ARCHIVE}"
      rm -f "$LOCAL_SCRIPTS_ARCHIVE"
      echo -e "${GREEN}✅ Scripts/config archive copied to staging${NC}"
    else
      if [ "$SKIP_FULL_CODE_ARCHIVE" = "1" ]; then
        echo -e "${BLUE}⏭️  Skipping full code tarball — local npm build + dist → scp → nginx only.${NC}"
        echo -e "${BLUE}   Backend / compose tree sync: use --graphql-only or --full, or DEPLOY_INCLUDE_CODE_ARCHIVE=1 with --ui-only.${NC}"
      else
        # GraphQL-only: do not pack talia-ui (saves large local tar + scp time). Staging keeps existing UI tree.
        if [ "$DEPLOY_MODE" = "graphql-only" ]; then
          echo -e "${BLUE}   GraphQL-only pack: talia-server + compose + scripts + supabase + infra (skips talia-ui).${NC}"
          _tar_paths=(docker-compose.staging.yml .env.staging.example talia-server scripts supabase infra)
        else
          _tar_paths=(docker-compose.staging.yml .env.staging.example talia-ui talia-server scripts supabase infra)
        fi
        echo -e "${BLUE}   Measuring paths to archive…${NC}"
        du -sh "${_tar_paths[@]}" 2>/dev/null || true
        echo -e "${DIM}   (Sizes above are full trees on disk. The tarball omits node_modules, dist, local DB backup dumps, logs, and .env — it does not ship Postgres volume data.)${NC}"
        echo -e "${BLUE}   Compressing (can take 1–5 min on a laptop; progress lines every ~12s)…${NC}"
        rm -f "$LOCAL_ARCHIVE"
        tar -czf "$LOCAL_ARCHIVE" \
          --exclude='.git' \
          --exclude='talia-ui/node_modules' \
          --exclude='talia-server/node_modules' \
          --exclude='talia-ui/dist' \
          --exclude='talia-server/dist' \
          --exclude='talia-server/backups' \
          --exclude='talia-server/archive' \
          --exclude='talia-server/server.log' \
          --exclude='talia-server/.env' \
          --exclude='talia-server/.env.old' \
          --exclude='talia-server/.env.updated' \
          --exclude='talia-ui/.env' \
          --exclude='.DS_Store' \
          "${_tar_paths[@]}" &
        _tar_pid=$!
        while kill -0 "$_tar_pid" 2>/dev/null; do
          sleep 12
          echo -e "${YELLOW}   …still compressing (working, not frozen)${NC}"
        done
        wait "$_tar_pid" || { echo -e "${RED}tar failed${NC}"; exit 1; }
        echo -e "${BLUE}   Tarball: $(ls -lh "$LOCAL_ARCHIVE" | awk '{print $5}')${NC}"
        echo -e "${BLUE}   Uploading to ${STAGING_USER}@${STAGING_HOST} (scp; no progress bar)…${NC}"
        deploy_scp "$LOCAL_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_ARCHIVE}"
        rm -f "$LOCAL_ARCHIVE"
        echo -e "${GREEN}✅ Local code archive copied to staging${NC}"
      fi
    fi

    # UI: static dist can be copied into the nginx container. GraphQL: always built on the host via
    # Dockerfile (npm install + compile + prune) so node_modules and dist stay in sync — never docker-cp dist only.
    if [ "$DEPLOY_MODE" = "ui-only" ] || [ "$DEPLOY_MODE" = "full" ]; then
      if [ "$DEPLOY_MODE" = "ui-only" ] && [ "$UI_HOT_SYNC" = "1" ]; then
        if [ ! -f "talia-ui/dist/index.html" ]; then
          echo -e "${RED}Error: UI hot sync needs an existing talia-ui/dist.${NC}"
          echo -e "${RED}  Plain 'npm run build' omits staging Vite env → header shows PRODUCTION and admin gating matches production.${NC}"
          echo -e "${YELLOW}  Run: npm run build:staging (LAN) or npm run build:mvp (Azure) then re-run deploy --ui-hot, or use menu 1) UI-only.${NC}"
          exit 1
        fi
        echo -e "${BLUE}⏭️  UI hot sync: packing existing talia-ui/dist (no npm run build).${NC}"
        echo -e "${YELLOW}    Tip: use npm run build:staging / build:mvp before hot sync, or menu 1) UI-only; this run stamps talia-instance.json for ${DEPLOY_TARGET_LABEL}.${NC}"
      else
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
      fi
      stamp_talia_ui_instance_manifest
      tar -czf "$LOCAL_UI_DIST_ARCHIVE" -C talia-ui dist
      deploy_scp "$LOCAL_UI_DIST_ARCHIVE" "${STAGING_USER}@${STAGING_HOST}:${REMOTE_UI_DIST_ARCHIVE}"
      rm -f "$LOCAL_UI_DIST_ARCHIVE"
      echo -e "${GREEN}✅ Local UI dist artifact copied to staging${NC}"
    fi

  else
    if [ "$DEPLOY_MODE" = "scripts-only" ]; then
      echo -e "${YELLOW}[DRY RUN] Would create and copy scripts/config archive: ${LOCAL_SCRIPTS_ARCHIVE}${NC}"
    elif [ "$SKIP_FULL_CODE_ARCHIVE" = "1" ]; then
      echo -e "${YELLOW}[DRY RUN] Would skip full repo tarball (UI-only dist path).${NC}"
    else
      echo -e "${YELLOW}[DRY RUN] Would create and copy archive: ${LOCAL_ARCHIVE}${NC}"
    fi
    if [ "$DEPLOY_MODE" = "ui-only" ] || [ "$DEPLOY_MODE" = "full" ]; then
      if [ "$DEPLOY_MODE" = "ui-only" ] && [ "$UI_HOT_SYNC" = "1" ]; then
        echo -e "${YELLOW}[DRY RUN] Would pack existing talia-ui/dist and copy: ${LOCAL_UI_DIST_ARCHIVE} (no build, no ui restart)${NC}"
      else
        echo -e "${YELLOW}[DRY RUN] Would build and copy local UI dist artifact: ${LOCAL_UI_DIST_ARCHIVE}${NC}"
      fi
    fi
  fi

# SSH to staging and deploy (must match whether we skipped creating LOCAL_ARCHIVE above)
_DEPLOY_SKIP_CODE_EXTRACT="$SKIP_FULL_CODE_ARCHIVE"
_UI_HOT_SYNC="$UI_HOT_SYNC"
DEPLOY_SCRIPT="
set -e
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain
mkdir -p $STAGING_GIT_DIR
cd $STAGING_GIT_DIR
REMOTE_ARCHIVE='$REMOTE_ARCHIVE'
REMOTE_SCRIPTS_ARCHIVE='$REMOTE_SCRIPTS_ARCHIVE'
REMOTE_UI_DIST_ARCHIVE='$REMOTE_UI_DIST_ARCHIVE'

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

if [ \"$DEPLOY_MODE\" = \"scripts-only\" ]; then
  echo '🎯 Scripts/config deployment complete (no service restarts).'
elif [ \"$DEPLOY_MODE\" = \"full\" ]; then
  echo '🎯 Full deployment (backend + UI + schema guard)...'
  echo '🔨 Building graphql-server image (Dockerfile: npm install + compile + prune)...'
  echo '⏳  npm install inside Docker often runs several minutes with sparse logs — not a network hang.'
  ${DC} -f docker-compose.staging.yml build --progress=plain graphql-server
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
    ${DC} -f docker-compose.staging.yml build --progress=plain ui
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    echo '✅ UI image rebuild succeeded'
  fi
elif [ \"$DEPLOY_MODE\" = \"graphql-only\" ]; then
  echo '🎯 GraphQL-only: rebuild graphql-server from synced talia-server (Dockerfile)...'
  echo '⏳  npm install inside Docker often runs several minutes with sparse logs — not a network hang.'
  ${DC} -f docker-compose.staging.yml build --progress=plain graphql-server
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
    if [ \"$_UI_HOT_SYNC\" = \"1\" ]; then
      echo '🔄 UI hot sync: skipped ui container restart (static files updated in place).'
    else
      ${DC} -f docker-compose.staging.yml restart ui
    fi
    rm -rf \"\$TMP_UI_DIST_DIR\"
    rm -f \"\$REMOTE_UI_DIST_ARCHIVE\"
    echo '✅ Local UI dist artifact applied to running ui container'
  else
    echo '🔨 No local UI dist artifact found; falling back to remote ui image rebuild...'
    ${DC} -f docker-compose.staging.yml build --progress=plain ui
    ${DC} -f docker-compose.staging.yml up -d --no-deps ui
    echo '✅ UI image rebuild succeeded'
  fi
fi

if [ \"$DEPLOY_MODE\" = \"full\" ] || [ \"$DEPLOY_MODE\" = \"graphql-only\" ]; then
  echo '🗄️ Running schema guard (DB volume: required tables + talia_config grants; images alone do not apply SQL)...'
  bash ./scripts/staging-db-guard.sh
fi

if [ \"$DEPLOY_MODE\" != \"scripts-only\" ]; then
  if [ \"$DEPLOY_MODE\" = \"ui-only\" ] && [ \"$_UI_HOT_SYNC\" = \"1\" ]; then
    echo '⏳ Brief pause before checks (UI hot sync)...'
    sleep 2
  else
    echo '⏳ Waiting for services to be healthy...'
    sleep 10
  fi

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
    if curl -sS -f --connect-timeout 3 --max-time 25 -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
      echo '✅ OK'
      break
    fi
    attempt=\$((attempt + 1))
    if [ \$((attempt % 5)) -eq 0 ]; then
      echo \" ...still waiting for GraphQL (\$attempt/\$max_attempts tries, ~\$((attempt * 2))s)\"
    fi
    sleep 2
  done
  if [ \$attempt -eq \$max_attempts ]; then
    echo '❌ FAILED - GraphQL server not responding'
    exit 1
  fi

  # Test Supabase connection via GraphQL
  echo -n '  Testing Supabase connection... '
  supabase_online=\$(curl -sS -f --connect-timeout 3 --max-time 30 -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ supabaseConnectionStatus { online } }\"}' 2>/dev/null | grep -o '\"online\":true' || echo '')
  if [ -n \"\$supabase_online\" ]; then
    echo '✅ OK'
  else
    echo '⚠️  WARNING - Supabase connection may be offline'
  fi

  # Test databaseTables query (critical for Data Mode)
  echo -n '  Testing databaseTables query... '
  table_count=\$(curl -sS --connect-timeout 3 --max-time 120 -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName } }\"}' 2>/dev/null | grep -o '\"tableName\"' | wc -l || echo '0')
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
  schema_check=\$(curl -sS --connect-timeout 3 --max-time 120 -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName actualDataRange { min max } lastError } }\"}' 2>/dev/null)
  if echo \"\$schema_check\" | grep -q '\"errors\"'; then
    echo '❌ FAILED - Admin Lite schema mismatch'
    echo \"\$schema_check\"
    exit 1
  else
    echo '✅ OK'
  fi
fi

# Test UI GraphQL proxy (skip for graphql-only: backend-only deploy; UI at :5173 may be unchanged)
if [ \"$DEPLOY_MODE\" != \"scripts-only\" ] && [ \"$DEPLOY_MODE\" != \"graphql-only\" ]; then
  echo -n '  Testing UI GraphQL proxy... '
  if curl -sS -f --connect-timeout 3 --max-time 25 -X POST http://localhost:5173/api/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' > /dev/null 2>&1; then
    echo '✅ OK'
  else
    echo '❌ FAILED - UI proxy not working'
    exit 1
  fi
elif [ \"$DEPLOY_MODE\" = \"graphql-only\" ]; then
  echo '  (Skipped UI /api/graphql check — graphql-only deploy.)'
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
  deploy_ssh "${STAGING_USER}@${STAGING_HOST}" "$DEPLOY_SCRIPT"
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
