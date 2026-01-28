#!/bin/bash
#
# Local validation script - run directly ON the staging server (MiniPC)
# Checks VPN, ngrok, and service health without SSH
#
# Usage (on MiniPC):
#   ./validate-staging-local.sh
#
set -euo pipefail

STAGING_DIR="${STAGING_DIR:-/home/zomarc/talia-docker}"
NGROK_URL="${NGROK_URL:-https://taliahub.com}"
EXPECTED_VPN_IP="149.40.48.92"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Staging Local Validation (run on MiniPC)${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

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
VPN_STATUS=$(sudo systemctl is-active protonvpn-openvpn 2>/dev/null || echo 'inactive')
if [[ "$VPN_STATUS" == "active" ]]; then
  check_status "VPN service" "OK" "running"
else
  check_status "VPN service" "FAIL" "status: $VPN_STATUS"
fi

# Check VPN IP
VPN_IP=$(curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'FAILED')
if [[ "$VPN_IP" == "$EXPECTED_VPN_IP" ]]; then
  check_status "VPN IP address" "OK" "$VPN_IP"
elif [[ "$VPN_IP" == "FAILED" ]]; then
  check_status "VPN IP address" "FAIL" "could not determine IP"
else
  check_status "VPN IP address" "WARN" "got $VPN_IP, expected $EXPECTED_VPN_IP"
fi

# Check VPN interface
if ip addr show tun0 >/dev/null 2>&1; then
  check_status "VPN interface (tun0)" "OK" "exists"
else
  check_status "VPN interface (tun0)" "FAIL" "not found"
fi

echo ""
echo -e "${BLUE}=== ngrok Tunnel ===${NC}"

# Check ngrok service status
NGROK_STATUS=$(sudo systemctl is-active ngrok-taliahub 2>/dev/null || echo 'inactive')
if [[ "$NGROK_STATUS" == "active" ]]; then
  check_status "ngrok service" "OK" "running"
else
  check_status "ngrok service" "FAIL" "status: $NGROK_STATUS"
fi

# Check ngrok tunnel API
NGROK_TUNNELS=$(curl -sS --max-time 5 http://localhost:4040/api/tunnels 2>/dev/null || echo 'FAILED')
if echo "$NGROK_TUNNELS" | grep -q "taliahub.com" 2>/dev/null; then
  check_status "ngrok tunnel" "OK" "taliahub.com active"
elif [[ "$NGROK_TUNNELS" == "FAILED" ]]; then
  check_status "ngrok tunnel" "FAIL" "could not check tunnel status"
else
  check_status "ngrok tunnel" "WARN" "taliahub.com not found in tunnels"
fi

echo ""
echo -e "${BLUE}=== Internal Services ===${NC}"

# Check UI service
UI_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5173/ 2>/dev/null || echo '000')
if [[ "$UI_CODE" == "200" ]]; then
  check_status "UI service (localhost:5173)" "OK" "HTTP 200"
else
  check_status "UI service (localhost:5173)" "FAIL" "HTTP $UI_CODE"
fi

# Check GraphQL service
GQL_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}' 2>/dev/null || echo '000')
if [[ "$GQL_CODE" == "200" ]]; then
  check_status "GraphQL service (localhost:4000)" "OK" "HTTP 200"
else
  check_status "GraphQL service (localhost:4000)" "FAIL" "HTTP $GQL_CODE"
fi

# Check Docker services
echo ""
echo -e "${BLUE}=== Docker Containers ===${NC}"
cd "$STAGING_DIR" 2>/dev/null || cd /home/zomarc/talia-docker
docker compose -f docker-compose.staging.yml ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | head -15

echo ""
echo -e "${BLUE}============================================================${NC}"
if [[ $ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✅ All checks passed${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Found $ISSUES issue(s)${NC}"
  echo ""
  echo "Quick fixes:"
  echo "  sudo systemctl restart protonvpn-openvpn  # Restart VPN"
  echo "  sudo systemctl restart ngrok-taliahub     # Restart ngrok"
  echo "  cd $STAGING_DIR && docker compose -f docker-compose.staging.yml up -d  # Start Docker"
  exit 1
fi
