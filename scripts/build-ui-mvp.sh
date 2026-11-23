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

MVP_PUBLIC_URL="${MVP_PUBLIC_URL:-https://talia.celestyal.com}"
# Celestyal Entra group Object IDs → Talia roles (first-login seed only)
DEFAULT_OIDC_ROLE_MAP='{"40a4cefa-1557-4b41-9817-ca0a8c985d53":"ADMIN","7ab9c616-c2af-4b4d-a393-dfd45c09befa":"MANAGER","1ce5b5eb-b115-4bb3-bc9b-2aae4a5185c9":"USER"}'

export DEPLOY_TARGET_LABEL=mvp
STAGING_UI_SUPABASE_URL="${STAGING_UI_SUPABASE_URL:-${MVP_PUBLIC_URL}}"
STAGING_UI_SUPABASE_ANON_KEY="${STAGING_UI_SUPABASE_ANON_KEY:-${MVP_UI_SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}}"
STAGING_UI_GRAPHQL_ENDPOINT="${STAGING_UI_GRAPHQL_ENDPOINT:-${MVP_PUBLIC_URL}/api/graphql}"
STAGING_UI_ENABLE_DEV_MODE="${STAGING_UI_ENABLE_DEV_MODE:-${MVP_UI_ENABLE_DEV_MODE:-false}}"
STAGING_UI_AUTH_MODE="${STAGING_UI_AUTH_MODE:-${VITE_AUTH_MODE:-oidc}}"
STAGING_UI_ENABLE_SSO="${STAGING_UI_ENABLE_SSO:-${VITE_ENABLE_SSO:-true}}"
STAGING_UI_ENABLE_BREAK_GLASS="${STAGING_UI_ENABLE_BREAK_GLASS:-${VITE_ENABLE_BREAK_GLASS:-true}}"
STAGING_UI_OIDC_ROLE_MAP="${STAGING_UI_OIDC_ROLE_MAP:-${VITE_OIDC_ROLE_MAP:-${DEFAULT_OIDC_ROLE_MAP}}}"

UI_APP_VERSION="$(python3 -c 'import json;print(json.load(open("'"${ROOT_DIR}"'/talia-ui/package.json","r",encoding="utf-8")).get("version","0.0.0"))')"
UI_BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-mvp}"

echo "Building talia-ui for MVP (VITE_ENVIRONMENT=${VITE_ENVIRONMENT}, public=${MVP_PUBLIC_URL}, auth=${STAGING_UI_AUTH_MODE})..."
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
export VITE_AUTH_MODE="${STAGING_UI_AUTH_MODE}"
export VITE_ENABLE_SSO="${STAGING_UI_ENABLE_SSO}"
export VITE_ENABLE_BREAK_GLASS="${STAGING_UI_ENABLE_BREAK_GLASS}"
export VITE_OIDC_ROLE_MAP="${STAGING_UI_OIDC_ROLE_MAP}"

npm run build
printf '{"deployTarget":"mvp"}\n' > dist/talia-instance.json
echo "Done. dist/ is ready for ./scripts/deploy-to-mvp.sh --ui-hot (or validate MVP deploy option 5)."
