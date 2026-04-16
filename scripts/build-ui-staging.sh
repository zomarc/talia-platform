#!/usr/bin/env bash
# Build talia-ui with the same Vite env defaults as deploy-to-staging.sh (LAN MiniPC).
# Use before: STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_UI_ONLY ./scripts/deploy-to-staging.sh --ui-hot
# so staging shows "staging" (not production) and dev-mode role behavior matches full UI deploy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

STAGING_HOST="${STAGING_HOST:-${STAGING_SSH_HOST:-192.168.1.120}}"
STAGING_UI_SUPABASE_URL="${STAGING_UI_SUPABASE_URL:-http://${STAGING_HOST}:54321}"
STAGING_UI_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}"
STAGING_UI_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT:-http://${STAGING_HOST}:4000/graphql}"
STAGING_UI_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE:-true}"

UI_APP_VERSION="$(python3 -c 'import json;print(json.load(open("'"${ROOT_DIR}"'/talia-ui/package.json","r",encoding="utf-8")).get("version","0.0.0"))')"
UI_BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-${DEPLOY_TARGET_LABEL:-staging}}"

echo "Building talia-ui for staging (VITE_ENVIRONMENT=${VITE_ENVIRONMENT}, host=${STAGING_HOST})..."
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
printf '{"deployTarget":"staging"}\n' > dist/talia-instance.json
echo "Done. dist/ is ready for ./scripts/deploy-to-staging.sh --ui-hot (or validate deploy option 5)."
