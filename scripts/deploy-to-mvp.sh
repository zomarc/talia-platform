#!/usr/bin/env bash
# Deploy from this machine to MVP over SSH — same path as LAN staging (tarball/scp + compose on the VM).
# Only your local working tree is shipped; no remote git pull on MVP. Configure MVP_* in scripts/config/targets.env.
#
# Usage:
#   ./scripts/deploy-to-mvp.sh [--ui-only|--ui-hot|--graphql-only|--full|--scripts-only|--dry-run]
#
# Non-interactive (same tokens + explicit flags as deploy-to-staging.sh; never widen scope by accident):
#   STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-mvp.sh --ui-only
#   STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_FULL_STACK DEPLOY_EXPLICIT_FULL_STACK=1 ./scripts/deploy-to-mvp.sh --full
#   STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_GRAPHQL_ONLY DEPLOY_EXPLICIT_GRAPHQL_ONLY=1 ./scripts/deploy-to-mvp.sh --graphql-only
#
# Azure user often needs sudo for docker; override if your MVP user is in the docker group:
#   DEPLOY_DOCKER_COMPOSE="docker compose" ./scripts/deploy-to-mvp.sh --full

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

if [[ -z "${MVP_SSH_HOST:-}" ]]; then
  echo "Set MVP_SSH_HOST in scripts/config/targets.env (or export it)." >&2
  exit 1
fi

MVP_USER="${MVP_SSH_USER:-azureuser}"
MVP_HOME="${MVP_APP_DIR:-/home/${MVP_USER}/talia-docker}"
PUB_HOST="${MVP_UI_HOST:-$MVP_SSH_HOST}"
UI_PORT="${MVP_UI_PORT:-5173}"
KONG_PORT="${MVP_KONG_PORT:-54321}"
GQL_PORT="${MVP_GRAPHQL_PORT:-4000}"

export STAGING_USER="${MVP_USER}"
export STAGING_HOST="${MVP_SSH_HOST}"
export STAGING_SSH_USER="${MVP_USER}"
export STAGING_SSH_HOST="${MVP_SSH_HOST}"
export STAGING_DIR="${MVP_HOME}"
export STAGING_APP_DIR="${MVP_HOME}"
export STAGING_GIT_DIR="${MVP_HOME}"

export STAGING_VERIFY_UI_URL="${STAGING_VERIFY_UI_URL:-http://${PUB_HOST}:${UI_PORT}}"
export STAGING_UI_SUPABASE_URL="${STAGING_UI_SUPABASE_URL:-http://${PUB_HOST}:${KONG_PORT}}"
export STAGING_UI_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT:-http://${MVP_SSH_HOST}:${GQL_PORT}/graphql}"
export STAGING_UI_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY:-${MVP_UI_SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}}"
export STAGING_UI_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE:-${MVP_UI_ENABLE_DEV_MODE:-true}}"

# UI banner: show "mvp" in ModeSelector / Data Management (not "staging")
export DEPLOY_TARGET_LABEL=mvp
export VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-mvp}"

# Optional: isolate archive paths if you deploy staging and MVP from the same laptop in parallel
export LOCAL_ARCHIVE="${LOCAL_ARCHIVE:-/tmp/talia-mvp-code-sync.tar.gz}"
export REMOTE_ARCHIVE="${REMOTE_ARCHIVE:-/tmp/talia-mvp-code-sync.tar.gz}"
export LOCAL_UI_DIST_ARCHIVE="${LOCAL_UI_DIST_ARCHIVE:-/tmp/talia-mvp-ui-dist.tar.gz}"
export REMOTE_UI_DIST_ARCHIVE="${REMOTE_UI_DIST_ARCHIVE:-/tmp/talia-mvp-ui-dist.tar.gz}"
export LOCAL_SERVER_DIST_ARCHIVE="${LOCAL_SERVER_DIST_ARCHIVE:-/tmp/talia-mvp-server-dist.tar.gz}"
export REMOTE_SERVER_DIST_ARCHIVE="${REMOTE_SERVER_DIST_ARCHIVE:-/tmp/talia-mvp-server-dist.tar.gz}"

export DEPLOY_DOCKER_COMPOSE="${DEPLOY_DOCKER_COMPOSE:-sudo docker compose}"
export DEPLOY_DOCKER_BIN="${DEPLOY_DOCKER_BIN:-sudo docker}"

if [[ -n "${AZURE_STAGING_DEPLOY_CONFIRM_TOKEN:-}" && -z "${STAGING_DEPLOY_CONFIRM_TOKEN:-}" ]]; then
  export STAGING_DEPLOY_CONFIRM_TOKEN="${AZURE_STAGING_DEPLOY_CONFIRM_TOKEN}"
fi

exec "${SCRIPT_DIR}/deploy-to-staging.sh" "$@"
