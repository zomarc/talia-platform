#!/bin/bash
#
# Quick validation script for staging connectivity
# Checks VPN, ngrok, and service health
#
# Usage:
#   ./scripts/validate-staging-connectivity.sh
#   ./scripts/validate-staging-connectivity.sh --azure  # Include Azure connectivity test
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCRIPT_VERSION="2026-01-30.1"

CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

STAGING_USER="${STAGING_USER:-${STAGING_SSH_USER:-zomarc}}"
STAGING_HOST="${STAGING_HOST:-${STAGING_SSH_HOST:-192.168.1.120}}"
STAGING_DIR="${STAGING_DIR:-${STAGING_APP_DIR:-/home/${STAGING_USER}/talia-docker}}"
LOCAL_UI_URL="${LOCAL_UI_URL:-http://${LOCAL_UI_HOST:-127.0.0.1}:${LOCAL_UI_PORT:-5173}}"
STAGING_UI_URL="${STAGING_UI_URL:-http://${STAGING_UI_HOST:-${STAGING_HOST}}:${STAGING_UI_PORT:-5173}}"

NGROK_USER="${NGROK_USER:-${NGROK_BASIC_USER:-talia}}"
NGROK_PASS="${NGROK_PASS:-${NGROK_BASIC_PASS:-dev2025tal}}"
NGROK_URL="${NGROK_URL:-${PUBLIC_MAIN_URL:-https://taliahub.com}}"
NGROK_DOMAIN="${NGROK_URL#https://}"
NGROK_DOMAIN="${NGROK_DOMAIN#http://}"
STAGING_NGROK_SERVICE="${STAGING_NGROK_SERVICE:-ngrok-taliahub}"

EXPECTED_VPN_IP="${EXPECTED_VPN_IP:-${VPN_EXPECTED_EGRESS_IP:-149.40.48.92}}"
TEST_AZURE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    --azure) TEST_AZURE=true; shift ;;
    -h|--help) 
      echo "Usage: $0 [--azure]"
      echo "  --azure  Include Azure Synapse connectivity test"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Staging Connectivity Validation${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${BLUE}Version:${NC} ${SCRIPT_VERSION}"
echo ""

# Track overall status
ISSUES=0

check_status() {
  local label="$1"
  local status="$2"
  local details="${3:-}"
  
  if [[ "$status" == "OK" ]]; then
    echo -e "${GREEN}[OK]${NC}   ${label}${details:+ - $details}"
  elif [[ "$status" == "WARN" ]]; then
    echo -e "${YELLOW}[WARN]${NC} ${label}${details:+ - $details}"
    ((ISSUES++)) || true
  else
    echo -e "${RED}[FAIL]${NC} ${label}${details:+ - $details}"
    ((ISSUES++)) || true
  fi
  return 0
}

print_info() {
  local label="$1"
  local value="$2"
  echo -e "${BLUE}[INFO]${NC} ${label}: ${value}"
}

get_ui_version() {
  local base_url="$1"
  python3 - "$base_url" <<'PY'
import re
import sys
import urllib.request
import urllib.error

base = sys.argv[1].rstrip("/")
index_url = f"{base}/"
try:
    html = urllib.request.urlopen(index_url, timeout=5).read().decode("utf-8", "ignore")
except Exception:
    print("UNREACHABLE")
    raise SystemExit(0)

asset_match = re.search(r'assets/index-[^"\']+\.js', html)
if not asset_match:
    print("NO_ASSET")
    raise SystemExit(0)

asset = asset_match.group(0)
try:
    js = urllib.request.urlopen(f"{base}/{asset}", timeout=5).read().decode("utf-8", "ignore")
except Exception:
    print("NO_BUNDLE")
    raise SystemExit(0)

vers = sorted(
    set(re.findall(r'\b(0\.\d+\.\d+)\b', js)),
    key=lambda s: tuple(int(x) for x in s.split('.')),
    reverse=True,
)
if vers:
    print(vers[0])
else:
    print("UNKNOWN")
PY
}

get_local_source_version() {
  python3 - "$ROOT_DIR" <<'PY'
import json
import os
import sys

root = sys.argv[1]
path = os.path.join(root, "talia-ui", "package.json")
try:
    with open(path, "r", encoding="utf-8") as f:
        print(json.load(f).get("version", "UNKNOWN"))
except Exception:
    print("UNKNOWN")
PY
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 6 "${url}" 2>/dev/null || echo "000"
}

echo -e "${BLUE}=== Front Screen Status ===${NC}"
LOCAL_UI_CODE_FRONT=$(http_code "${LOCAL_UI_URL}/")
STAGING_UI_CODE_FRONT=$(http_code "${STAGING_UI_URL}/")
LOCAL_UI_VERSION_FRONT=$(get_ui_version "${LOCAL_UI_URL}")
STAGING_UI_VERSION_FRONT=$(get_ui_version "${STAGING_UI_URL}")
LOCAL_SOURCE_VERSION_FRONT=$(get_local_source_version)

if [[ "$LOCAL_UI_VERSION_FRONT" == "NO_ASSET" ]] && [[ "$LOCAL_SOURCE_VERSION_FRONT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  LOCAL_UI_VERSION_FRONT="${LOCAL_SOURCE_VERSION_FRONT} (dev)"
fi

LOCAL_NGROK_PROC=$(pgrep -af "ngrok .*${NGROK_DOMAIN}" 2>/dev/null | head -n 1 || true)
if [[ -n "$LOCAL_NGROK_PROC" ]]; then
  LOCAL_NGROK_STATUS="active"
else
  LOCAL_NGROK_STATUS="inactive"
fi

STAGING_NGROK_STATUS_FRONT=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ${STAGING_NGROK_SERVICE} 2>/dev/null || true" 2>/dev/null | head -n 1 || true)
if [[ -z "$STAGING_NGROK_STATUS_FRONT" ]]; then STAGING_NGROK_STATUS_FRONT="unreachable"; fi
TALIAHUB_HEADERS=$(curl -sS -I --max-time 10 "${NGROK_URL}" 2>/dev/null || true)
TALIAHUB_CODE=$(printf "%s\n" "$TALIAHUB_HEADERS" | awk 'tolower($1) ~ /^http/{print $2; exit}')
if [[ -z "$TALIAHUB_CODE" ]]; then TALIAHUB_CODE="000"; fi
TALIAHUB_GATEWAY=$(printf "%s\n" "$TALIAHUB_HEADERS" | awk -F': ' 'tolower($1)=="x-taliahub-gateway"{gsub("\r","",$2); print $2; exit}')
if [[ -z "$TALIAHUB_GATEWAY" ]]; then TALIAHUB_GATEWAY="n/a"; fi

PRESENTER_STATUS="unknown"
if [[ "$LOCAL_NGROK_STATUS" == "active" && "$STAGING_NGROK_STATUS_FRONT" != "active" ]]; then
  PRESENTER_STATUS="local"
elif [[ "$LOCAL_NGROK_STATUS" != "active" && "$STAGING_NGROK_STATUS_FRONT" == "active" ]]; then
  PRESENTER_STATUS="staging"
elif [[ "$LOCAL_NGROK_STATUS" == "active" && "$STAGING_NGROK_STATUS_FRONT" == "active" ]]; then
  PRESENTER_STATUS="conflict"
elif [[ "$LOCAL_NGROK_STATUS" != "active" && "$STAGING_NGROK_STATUS_FRONT" != "active" ]]; then
  PRESENTER_STATUS="none"
fi

print_info "Local UI" "${LOCAL_UI_URL} (HTTP ${LOCAL_UI_CODE_FRONT}, version ${LOCAL_UI_VERSION_FRONT})"
print_info "Staging UI" "${STAGING_UI_URL} (HTTP ${STAGING_UI_CODE_FRONT}, version ${STAGING_UI_VERSION_FRONT})"
print_info "Local ngrok (${NGROK_DOMAIN})" "${LOCAL_NGROK_STATUS}"
print_info "Staging ngrok service" "${STAGING_NGROK_STATUS_FRONT}"
print_info "Public ${NGROK_URL}" "HTTP ${TALIAHUB_CODE}, gateway ${TALIAHUB_GATEWAY}"
print_info "Current presenter via ngrok" "${PRESENTER_STATUS}"
echo ""
echo "Quick switch:"
echo "  -> Present LOCAL:   run local ngrok, stop staging ngrok"
echo "  -> Present STAGING: stop local ngrok, start staging ngrok"
echo ""

echo -e "${BLUE}=== VPN Connection ===${NC}"

# Check VPN service status
VPN_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active protonvpn-openvpn 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
if [[ "$VPN_STATUS" == "active" ]]; then
  check_status "VPN service" "OK" "running"
else
  check_status "VPN service" "FAIL" "status: $VPN_STATUS"
fi

# Check VPN IP
VPN_IP=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")
if [[ "$VPN_IP" == "$EXPECTED_VPN_IP" ]]; then
  check_status "VPN IP address" "OK" "$VPN_IP"
else
  if [[ "$VPN_IP" == "FAILED" ]] || [[ "$VPN_IP" == "UNREACHABLE" ]]; then
    check_status "VPN IP address" "FAIL" "could not determine IP"
  else
    check_status "VPN IP address" "WARN" "got $VPN_IP, expected $EXPECTED_VPN_IP"
  fi
fi

# Check VPN interface
TUN0_EXISTS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "ip addr show tun0 >/dev/null 2>&1 && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")
if [[ "$TUN0_EXISTS" == "yes" ]]; then
  check_status "VPN interface (tun0)" "OK" "exists"
else
  check_status "VPN interface (tun0)" "FAIL" "not found"
fi

echo ""
echo -e "${BLUE}=== ngrok Tunnel ===${NC}"

# Check ngrok service status
NGROK_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ${STAGING_NGROK_SERVICE} 2>/dev/null || true" 2>/dev/null | head -n 1 || true)
if [[ -z "$NGROK_STATUS" ]]; then NGROK_STATUS="unreachable"; fi
if [[ "$NGROK_STATUS" == "active" ]]; then
  check_status "ngrok service" "OK" "running"
else
  check_status "ngrok service" "FAIL" "status: $NGROK_STATUS"
fi

# Check ngrok tunnel API
NGROK_TUNNELS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 5 http://localhost:4040/api/tunnels 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")
if echo "$NGROK_TUNNELS" | grep -q "taliahub.com" 2>/dev/null; then
  check_status "ngrok tunnel" "OK" "taliahub.com active"
elif [[ "$NGROK_TUNNELS" == "FAILED" ]] || [[ "$NGROK_TUNNELS" == "UNREACHABLE" ]]; then
  check_status "ngrok tunnel" "FAIL" "could not check tunnel status"
else
  check_status "ngrok tunnel" "WARN" "taliahub.com not found in tunnels"
fi

# Check public access (no auth)
PUBLIC_CODE_NOAUTH=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" 2>/dev/null || echo "000")
if [[ "$PUBLIC_CODE_NOAUTH" == "401" ]]; then
  check_status "Public access (no auth)" "OK" "HTTP 401 (auth required)"
elif [[ "$PUBLIC_CODE_NOAUTH" == "000" ]]; then
  check_status "Public access (no auth)" "FAIL" "connection failed"
else
  check_status "Public access (no auth)" "WARN" "HTTP $PUBLIC_CODE_NOAUTH (expected 401)"
fi

# Check public access (with auth)
PUBLIC_CODE_AUTH=$(curl -sS --basic -u "${NGROK_USER}:${NGROK_PASS}" -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" 2>/dev/null || echo "000")
if [[ "$PUBLIC_CODE_AUTH" == "200" ]]; then
  check_status "Public access (with auth)" "OK" "HTTP 200"
elif [[ "$PUBLIC_CODE_AUTH" == "000" ]]; then
  check_status "Public access (with auth)" "FAIL" "connection failed"
else
  check_status "Public access (with auth)" "WARN" "HTTP $PUBLIC_CODE_AUTH (expected 200)"
fi

echo ""
echo -e "${BLUE}=== Internal Services ===${NC}"

# Check expected ports are listening on staging host
check_port_remote() {
  local port="$1"
  local label="$2"
  local port_open="false"
  port_open=$(ssh "${STAGING_USER}@${STAGING_HOST}" "if command -v ss >/dev/null 2>&1; then ss -ltn | awk '{print \$4}' | grep -qE ':${port}$' && echo true || echo false; elif command -v lsof >/dev/null 2>&1; then lsof -ti :${port} >/dev/null 2>&1 && echo true || echo false; else echo false; fi" 2>/dev/null || echo "false")
  if [[ "$port_open" == "true" ]]; then
    check_status "${label} port :${port}" "OK" "listening"
  else
    check_status "${label} port :${port}" "FAIL" "not listening"
  fi
}

check_port_remote 5173 "UI"
check_port_remote 4000 "GraphQL"
check_port_remote 8000 "Supabase Kong"

# Postgres may not be exposed on host; validate mapping and health instead
DB_MAPPING=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml port supabase-db 5432 2>/dev/null || echo ''" 2>/dev/null || echo "")
if [[ -n "$DB_MAPPING" ]] && ! echo "$DB_MAPPING" | grep -qE '(:0)$'; then
  DB_HOST_PORT="${DB_MAPPING##*:}"
  check_port_remote "${DB_HOST_PORT}" "Postgres host port"
else
  check_status "Postgres port exposure" "OK" "not exposed on host"
fi

DB_HEALTH=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml exec -T supabase-db pg_isready -U postgres >/dev/null 2>&1 && echo ok || echo fail" 2>/dev/null || echo "fail")
if [[ "$DB_HEALTH" == "ok" ]]; then
  check_status "Postgres health" "OK" "pg_isready"
else
  check_status "Postgres health" "FAIL" "pg_isready failed"
fi

# Check UI service
UI_CODE=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5173/ 2>/dev/null || echo '000'" 2>/dev/null || echo "000")
if [[ "$UI_CODE" == "200" ]]; then
  check_status "UI service" "OK" "HTTP 200"
else
  check_status "UI service" "FAIL" "HTTP $UI_CODE"
fi

# Check GraphQL service
GQL_CODE=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -o /dev/null -w '%{http_code}' --max-time 3 -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' 2>/dev/null || echo '000'" 2>/dev/null || echo "000")
if [[ "$GQL_CODE" == "200" ]]; then
  check_status "GraphQL service" "OK" "HTTP 200"
else
  check_status "GraphQL service" "FAIL" "HTTP $GQL_CODE"
fi

# Check GraphQL schema compatibility for Admin Lite
SCHEMA_CHECK=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName actualDataRange { min max } lastError } }\"}' 2>/dev/null" 2>/dev/null || echo "FAILED")
if [[ "$SCHEMA_CHECK" == "FAILED" ]]; then
  check_status "Admin Lite schema" "FAIL" "could not query GraphQL"
elif echo "$SCHEMA_CHECK" | grep -q '"errors"'; then
  check_status "Admin Lite schema" "FAIL" "schema mismatch"
else
  check_status "Admin Lite schema" "OK" "actualDataRange + lastError"
fi

# Check databaseTables data presence
TABLE_COUNT=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName } }\"}' 2>/dev/null | grep -o '\"tableName\"' | wc -l || echo '0'" 2>/dev/null || echo "0")
if [[ "$TABLE_COUNT" -gt 0 ]]; then
  check_status "Database tables" "OK" "${TABLE_COUNT} tables"
else
  check_status "Database tables" "FAIL" "no tables returned"
fi

# Check Docker services
DOCKER_PS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml ps --format json 2>/dev/null | jq -r '.[] | select(.State != \"running\") | .Name' | head -5" 2>/dev/null || echo "ERROR")
if [[ -z "$DOCKER_PS" ]] || [[ "$DOCKER_PS" == "ERROR" ]]; then
  check_status "Docker services" "OK" "all running"
else
  check_status "Docker services" "WARN" "some containers not running: $DOCKER_PS"
fi

# Check expected vs running services (no extras, no missing)
EXPECTED_SERVICES=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml config --services 2>/dev/null | tr '\n' ' '" 2>/dev/null || echo "")
RUNNING_SERVICES=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml ps --services --status running 2>/dev/null | tr '\n' ' '" 2>/dev/null || echo "")

missing_services=""
for svc in $EXPECTED_SERVICES; do
  echo "$RUNNING_SERVICES" | grep -qE "(^| )${svc}($| )" || missing_services="${missing_services}${svc} "
done

extra_services=""
for svc in $RUNNING_SERVICES; do
  echo "$EXPECTED_SERVICES" | grep -qE "(^| )${svc}($| )" || extra_services="${extra_services}${svc} "
done

if [[ -z "$missing_services" ]]; then
  check_status "Expected services running" "OK" "all present"
else
  check_status "Expected services running" "FAIL" "missing: ${missing_services}"
fi

if [[ -z "$extra_services" ]]; then
  check_status "Unexpected services" "OK" "none"
else
  check_status "Unexpected services" "WARN" "extra: ${extra_services}"
fi

echo ""
echo -e "${BLUE}=== UI Endpoints & Versions ===${NC}"

LOCAL_UI_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "${LOCAL_UI_URL}/" 2>/dev/null || echo "000")
LOCAL_UI_VERSION=$(get_ui_version "${LOCAL_UI_URL}")
if [[ "$LOCAL_UI_CODE" == "200" ]]; then
  if [[ "$LOCAL_UI_VERSION" == "NO_ASSET" ]]; then
    LOCAL_SOURCE_VERSION=$(get_local_source_version)
    if [[ "$LOCAL_SOURCE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      check_status "Local UI health" "OK" "reachable, v${LOCAL_SOURCE_VERSION} (dev server)"
    else
      check_status "Local UI health" "WARN" "reachable, dev server (source version unknown)"
    fi
  elif [[ "$LOCAL_UI_VERSION" =~ ^0\.1\.[0-9]+$ ]]; then
    check_status "Local UI health" "OK" "reachable, v${LOCAL_UI_VERSION}"
  else
    check_status "Local UI health" "WARN" "reachable, version=${LOCAL_UI_VERSION}"
  fi
else
  check_status "Local UI health" "FAIL" "not reachable (HTTP ${LOCAL_UI_CODE})"
fi

STAGING_UI_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "${STAGING_UI_URL}/" 2>/dev/null || echo "000")
STAGING_UI_VERSION=$(get_ui_version "${STAGING_UI_URL}")
if [[ "$STAGING_UI_CODE" == "200" ]]; then
  if [[ "$STAGING_UI_VERSION" =~ ^0\.[0-9]+\.[0-9]+$ ]]; then
    check_status "Staging UI health" "OK" "reachable, v${STAGING_UI_VERSION}"
  else
    check_status "Staging UI health" "WARN" "reachable, version=${STAGING_UI_VERSION}"
  fi
else
  check_status "Staging UI health" "FAIL" "not reachable (HTTP ${STAGING_UI_CODE})"
fi

echo ""
echo -e "${BLUE}=== Versions / Deploy Commit ===${NC}"

# Local repo (no network fetch — deploy path is local tree → scp → staging)
if git -C "$ROOT_DIR" rev-parse HEAD >/dev/null 2>&1; then
  LOCAL_HEAD=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  check_status "Local git" "OK" "HEAD ${LOCAL_HEAD}"
else
  check_status "Local git" "WARN" "not a git repo"
fi

# Staging checkout on host (reference only; runtime is Docker)
STAGING_HEAD=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && git rev-parse --short HEAD 2>/dev/null || echo 'unknown'" 2>/dev/null || echo "unknown")
check_status "Staging git" "OK" "HEAD ${STAGING_HEAD} (on-disk ref)"

if [[ "$TEST_AZURE" == "true" ]]; then
  echo ""
  echo -e "${BLUE}=== Azure Synapse Connectivity ===${NC}"
  
  # Test Azure connection via GraphQL
  AZURE_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ synapseConnectionStatus { online error } }\"}' 2>/dev/null | jq -r '.data.synapseConnectionStatus.online // false' 2>/dev/null || echo 'false'" 2>/dev/null || echo "false")
  if [[ "$AZURE_STATUS" == "true" ]]; then
    check_status "Azure Synapse" "OK" "connected"
  else
    AZURE_ERROR=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ synapseConnectionStatus { error } }\"}' 2>/dev/null | jq -r '.data.synapseConnectionStatus.error // \"unknown\"' 2>/dev/null || echo 'unknown'" 2>/dev/null || echo "unknown")
    check_status "Azure Synapse" "WARN" "not connected${AZURE_ERROR:+ - $AZURE_ERROR}"
  fi
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
if [[ $ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✅ All checks passed${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Found $ISSUES issue(s)${NC}"
  echo ""
  echo "Quick fix: ./scripts/restart-staging-tunnel.sh"
  echo "Full fix:  ./scripts/fix-staging-connectivity.sh"
  exit 1
fi
