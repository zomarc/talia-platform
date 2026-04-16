#!/usr/bin/env bash
# Build talia-ui with the same Vite env defaults as deploy-to-mvp.sh (Azure MVP VM).
# Use before: STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-mvp.sh --ui-hot
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
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
PUB_HOST="${MVP_UI_HOST:-$MVP_SSH_HOST}"
UI_PORT="${MVP_UI_PORT:-5173}"
KONG_PORT="${MVP_KONG_PORT:-54321}"
GQL_PORT="${MVP_GRAPHQL_PORT:-4000}"

export DEPLOY_TARGET_LABEL=mvp
STAGING_UI_SUPABASE_URL="${STAGING_UI_SUPABASE_URL:-http://${PUB_HOST}:${KONG_PORT}}"
STAGING_UI_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY:-${MVP_UI_SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}}"
STAGING_UI_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT:-http://${MVP_SSH_HOST}:${GQL_PORT}/graphql}"
STAGING_UI_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE:-${MVP_UI_ENABLE_DEV_MODE:-true}}"

UI_APP_VERSION="$(python3 -c 'import json;print(json.load(open("'"${ROOT_DIR}"'/talia-ui/package.json","r",encoding="utf-8")).get("version","0.0.0"))')"
UI_BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-mvp}"

echo "Building talia-ui for MVP (VITE_ENVIRONMENT=${VITE_ENVIRONMENT}, UI host=${PUB_HOST}:${UI_PORT})..."
cd "${ROOT_DIR}/talia-ui"
if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

export VITE_SUPABASE_URL="${STAGING_UI_SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY}"
export VITE_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT}"
export VITE_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE}"
export VITE_APP_VERSION="${UI_APP_VERSION}"
export VITE_ENVIRONMENT="${VITE_ENVIRONMENT}"
export VITE_BUILD_TIME="${UI_BUILD_TIME}"

npm run build
printf '{"deployTarget":"mvp"}\n' > dist/talia-instance.json
echo "Done. dist/ is ready for ./scripts/deploy-to-mvp.sh --ui-hot (or validate MVP deploy option 5)."
