#!/bin/bash
#
# Restart + health-check helper for Talia environments
#
# Environments:
# - local:   laptop development
# - staging: MiniPC (taliahub.com via ngrok)
#
# Usage examples:
#   ./scripts/restart-and-check.sh local
#   ./scripts/restart-and-check.sh staging
#   ./scripts/restart-and-check.sh all
#   ./scripts/restart-and-check.sh staging --restart
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STAGING_USER="${STAGING_USER:-zomarc}"
STAGING_HOST="${STAGING_HOST:-192.168.1.120}"
STAGING_DIR="${STAGING_DIR:-/home/${STAGING_USER}/talia-docker}"

NGROK_USER="${NGROK_USER:-talia}"
NGROK_PASS="${NGROK_PASS:-dev2025tal}"
NGROK_URL="${NGROK_URL:-https://taliahub.com}"

DO_RESTART=false

usage() {
  cat <<EOF
Usage: $0 <local|staging|all> [--restart]

Options:
  --restart   Restart key services before checks (safe: no DB reset).

Env overrides:
  STAGING_USER, STAGING_HOST, STAGING_DIR
  NGROK_URL, NGROK_USER, NGROK_PASS
EOF
}

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --restart) DO_RESTART=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) break ;;
  esac
done

TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
  usage
  exit 1
fi

echo "============================================================"
echo "Talia Restart + Check"
echo "target=${TARGET} restart=${DO_RESTART}"
echo "============================================================"
echo ""

check_cmd() {
  local label="$1"
  shift
  if "$@"; then
    echo "[OK]   ${label}"
  else
    echo "[FAIL] ${label}"
    return 1
  fi
}

warn() {
  echo "[WARN] $*"
}

check_local() {
  echo "=== LOCAL (laptop) checks ==="
  echo "root: ${ROOT_DIR}"

  echo ""
  echo "-- Ports --"
  (lsof -nP -iTCP -sTCP:LISTEN | egrep ":(5173|4000|4001|54321|54322|54323)\\s" || true) | sed 's/^/  /'

  echo ""
  echo "-- HTTP checks --"
  local gql_code
  gql_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:4000/graphql || true)"
  if [[ "${gql_code}" == "200" || "${gql_code}" == "400" ]]; then
    echo "[OK]   GraphQL local responds (http://127.0.0.1:4000/graphql) (http_code=${gql_code})"
  else
    echo "[FAIL] GraphQL local responds (http://127.0.0.1:4000/graphql) (http_code=${gql_code})"
    return 1
  fi

  if curl -sS -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:5173/ | grep -q '^200$'; then
    echo "[OK]   UI local responds (http://127.0.0.1:5173)"
  else
    warn "UI local is not responding on :5173 (start with: cd talia-ui && npm run dev)"
  fi

  local kong_code
  kong_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:54321/ || true)"
  if echo "${kong_code}" | grep -qE '^(200|301|302|401|403|404)$'; then
    echo "[OK]   Supabase Kong local responds (http://127.0.0.1:54321) (http_code=${kong_code})"
  else
    echo "[FAIL] Supabase Kong local responds (http://127.0.0.1:54321) (http_code=${kong_code})"
    return 1
  fi

  echo ""
  echo "-- Docker containers (summary) --"
  if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" >/dev/null 2>&1; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | egrep "supabase_|talia-" || true
  else
    warn "Docker not available locally"
  fi

  echo ""
}

check_staging() {
  echo "=== STAGING (MiniPC) checks ==="
  echo "ssh: ${STAGING_USER}@${STAGING_HOST}"
  echo "dir: ${STAGING_DIR}"

  if $DO_RESTART; then
    echo ""
    echo "-- Restart staging services (safe) --"
    ssh "${STAGING_USER}@${STAGING_HOST}" "set -e;
      echo '[staging] stop conflicting ngrok.service (ssh tunnel)...';
      sudo systemctl stop ngrok.service >/dev/null 2>&1 || true;
      sudo systemctl disable ngrok.service >/dev/null 2>&1 || true;
      echo '[staging] restart VPN...';
      sudo systemctl restart protonvpn-openvpn;
      sleep 3;
      echo '[staging] restart ngrok taliahub...';
      sudo systemctl restart ngrok-taliahub;
      echo '[staging] ensure docker stack is up...';
      cd '${STAGING_DIR}' && docker compose up -d;
    "
  fi

  echo ""
  echo "-- VPN / outbound --"
  ssh "${STAGING_USER}@${STAGING_HOST}" "set -e;
    echo -n 'ipify='; curl -sS --max-time 10 https://api.ipify.org || echo '(failed)';
    echo;
    sudo systemctl --no-pager status protonvpn-openvpn | head -12 || true;
  " | sed 's/^/  /'

  echo ""
  echo "-- Docker stack --"
  ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose ps" | sed 's/^/  /'

  echo ""
  echo "-- Internal service probes (from staging host) --"
  ssh "${STAGING_USER}@${STAGING_HOST}" "set -e;
    echo -n 'ui_http_code='; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 http://127.0.0.1:5173/ || true;
    echo -n 'graphql_http_code='; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 http://127.0.0.1:4000/graphql || true;
    echo -n 'storage_http_code='; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 http://127.0.0.1:5000/status || true;
    echo -n 'gotrue_health_http_code='; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 http://127.0.0.1:9999/health || true;
    echo -n 'pgmeta_health_http_code='; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 http://127.0.0.1:8080/health || true;
  " | sed 's/^/  /'

  echo ""
  echo "-- External taliahub.com probe (from local machine) --"
  local code_noauth
  code_noauth="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" || true)"
  if [[ "${code_noauth}" == "401" ]]; then
    echo "[OK]   taliahub.com requires basic auth (HTTP 401)"
  else
    warn "taliahub.com expected 401 without creds, got ${code_noauth} (if ERR_NGROK_3200, restart VPN then ngrok on staging)"
  fi

  local code_auth
  # Force Basic auth preemptively so we don't just capture the initial 401 challenge.
  code_auth="$(curl -sS --basic -u "${NGROK_USER}:${NGROK_PASS}" -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" || true)"
  if [[ "${code_auth}" == "200" ]]; then
    echo "[OK]   taliahub.com serves UI with creds (HTTP 200)"
  else
    warn "taliahub.com expected 200 with creds, got ${code_auth}"
  fi

  echo ""
}

case "${TARGET}" in
  local)   check_local ;;
  staging) check_staging ;;
  all)     check_local; check_staging ;;
  *) usage; exit 1 ;;
esac

echo "Done."

