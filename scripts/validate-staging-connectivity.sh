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

STAGING_USER="${STAGING_USER:-zomarc}"
STAGING_HOST="${STAGING_HOST:-192.168.1.120}"
STAGING_DIR="${STAGING_DIR:-/home/${STAGING_USER}/talia-docker}"

NGROK_USER="${NGROK_USER:-talia}"
NGROK_PASS="${NGROK_PASS:-dev2025tal}"
NGROK_URL="${NGROK_URL:-https://taliahub.com}"

EXPECTED_VPN_IP="149.40.48.92"
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

# Track overall status
ISSUES=0

check_status() {
  local label="$1"
  local status="$2"
  local details="${3:-}"
  
  if [[ "$status" == "OK" ]]; then
    echo -e "${GREEN}[OK]${NC}   ${label}${details:+ - $details}"
    return 0
  elif [[ "$status" == "WARN" ]]; then
    echo -e "${YELLOW}[WARN]${NC} ${label}${details:+ - $details}"
    ((ISSUES++)) || true
    return 1
  else
    echo -e "${RED}[FAIL]${NC} ${label}${details:+ - $details}"
    ((ISSUES++)) || true
    return 1
  fi
}

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
NGROK_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ngrok-taliahub 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
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

# Check Docker services
DOCKER_PS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml ps --format json 2>/dev/null | jq -r '.[] | select(.State != \"running\") | .Name' | head -5" 2>/dev/null || echo "ERROR")
if [[ -z "$DOCKER_PS" ]] || [[ "$DOCKER_PS" == "ERROR" ]]; then
  check_status "Docker services" "OK" "all running"
else
  check_status "Docker services" "WARN" "some containers not running: $DOCKER_PS"
fi

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
