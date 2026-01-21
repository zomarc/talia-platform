#!/bin/bash
#
# Comprehensive fix script for staging connectivity
# Validates, fixes issues, and re-validates
#
# Usage:
#   ./scripts/fix-staging-connectivity.sh
#   ./scripts/fix-staging-connectivity.sh --azure  # Include Azure connectivity test
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
echo -e "${BLUE}Fix Staging Connectivity${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Phase 1: Initial Validation
echo -e "${BLUE}Phase 1: Initial Validation${NC}"
echo "Running connectivity validation..."
echo ""

if ./scripts/validate-staging-connectivity.sh $([ "$TEST_AZURE" == "true" ] && echo "--azure" || true) 2>/dev/null; then
  echo ""
  echo -e "${GREEN}✅ All checks passed - no fixes needed${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Issues detected. Proceeding with fixes...${NC}"
echo ""

# Phase 2: Fix VPN
echo -e "${BLUE}Phase 2: Fixing VPN Connection${NC}"

VPN_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active protonvpn-openvpn 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
VPN_IP=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")

if [[ "$VPN_STATUS" != "active" ]] || [[ "$VPN_IP" != "$EXPECTED_VPN_IP" ]]; then
  echo "  VPN needs restart..."
  
  # Stop ngrok first if it's running
  if ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ngrok-taliahub >/dev/null 2>&1"; then
    echo "  Stopping ngrok (depends on VPN)..."
    ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl stop ngrok-taliahub" 2>/dev/null || true
    sleep 2
  fi
  
  # Restart VPN
  echo "  Restarting VPN..."
  ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl restart protonvpn-openvpn" 2>/dev/null || {
    echo -e "${RED}✗${NC} Failed to restart VPN"
    echo ""
    echo "Manual troubleshooting:"
    echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
    echo "  sudo systemctl status protonvpn-openvpn"
    echo "  sudo journalctl -u protonvpn-openvpn -n 50"
    exit 1
  }
  
  # Wait for VPN
  echo "  Waiting for VPN to connect (15 seconds)..."
  sleep 15
  
  # Verify VPN
  VPN_IP_NEW=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")
  if [[ "$VPN_IP_NEW" == "$EXPECTED_VPN_IP" ]]; then
    echo -e "  ${GREEN}✓${NC} VPN connected (IP: $VPN_IP_NEW)"
  elif [[ "$VPN_IP_NEW" != "FAILED" ]] && [[ "$VPN_IP_NEW" != "UNREACHABLE" ]]; then
    echo -e "  ${YELLOW}⚠${NC}  VPN connected but IP is $VPN_IP_NEW (expected $EXPECTED_VPN_IP)"
  else
    echo -e "  ${RED}✗${NC} VPN connection failed"
    echo ""
    echo "VPN troubleshooting:"
    echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
    echo "  sudo systemctl status protonvpn-openvpn"
    echo "  sudo journalctl -u protonvpn-openvpn -n 50"
    echo "  ip addr show tun0"
    echo "  curl -s https://api.ipify.org"
    exit 1
  fi
else
  echo -e "  ${GREEN}✓${NC} VPN is already connected (IP: $VPN_IP)"
fi

echo ""

# Phase 3: Fix ngrok
echo -e "${BLUE}Phase 3: Fixing ngrok Tunnel${NC}"

NGROK_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ngrok-taliahub 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
NGROK_TUNNELS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 5 http://localhost:4040/api/tunnels 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")

if [[ "$NGROK_STATUS" != "active" ]] || ! echo "$NGROK_TUNNELS" | grep -q "taliahub.com" 2>/dev/null; then
  echo "  ngrok needs restart..."
  
  # Restart ngrok
  echo "  Restarting ngrok..."
  ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl restart ngrok-taliahub" 2>/dev/null || {
    echo -e "${RED}✗${NC} Failed to restart ngrok"
    echo ""
    echo "Manual troubleshooting:"
    echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
    echo "  sudo systemctl status ngrok-taliahub"
    echo "  sudo journalctl -u ngrok-taliahub -n 50"
    exit 1
  }
  
  # Wait for ngrok
  echo "  Waiting for ngrok tunnel to establish (10 seconds)..."
  sleep 10
  
  # Verify ngrok
  NGROK_STATUS_NEW=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ngrok-taliahub 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
  if [[ "$NGROK_STATUS_NEW" == "active" ]]; then
    echo -e "  ${GREEN}✓${NC} ngrok service is running"
    
    # Check tunnel
    NGROK_TUNNELS_NEW=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 5 http://localhost:4040/api/tunnels 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")
    if echo "$NGROK_TUNNELS_NEW" | grep -q "taliahub.com" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} ngrok tunnel active (taliahub.com)"
    else
      echo -e "  ${YELLOW}⚠${NC}  ngrok tunnel may still be establishing"
      echo "    Wait a few more seconds and check: curl -s http://localhost:4040/api/tunnels"
    fi
  else
    echo -e "  ${RED}✗${NC} ngrok service failed to start"
    echo ""
    echo "ngrok troubleshooting:"
    echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
    echo "  sudo systemctl status ngrok-taliahub"
    echo "  sudo journalctl -u ngrok-taliahub -n 50"
    echo "  curl -s http://localhost:4040/api/tunnels"
    exit 1
  fi
else
  echo -e "  ${GREEN}✓${NC} ngrok is already running"
fi

echo ""

# Phase 4: Check Internal Services
echo -e "${BLUE}Phase 4: Checking Internal Services${NC}"

UI_CODE=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5173/ 2>/dev/null || echo '000'" 2>/dev/null || echo "000")
if [[ "$UI_CODE" != "200" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  UI service returned HTTP $UI_CODE"
  echo "  Attempting to restart UI service..."
  ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml restart ui" 2>/dev/null || true
  sleep 5
else
  echo -e "  ${GREEN}✓${NC} UI service is running (HTTP 200)"
fi

GQL_CODE=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS -o /dev/null -w '%{http_code}' --max-time 3 -X POST http://127.0.0.1:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}' 2>/dev/null || echo '000'" 2>/dev/null || echo "000")
if [[ "$GQL_CODE" != "200" ]]; then
  echo -e "  ${YELLOW}⚠${NC}  GraphQL service returned HTTP $GQL_CODE"
  echo "  Attempting to restart GraphQL service..."
  ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml restart graphql-server" 2>/dev/null || true
  sleep 5
else
  echo -e "  ${GREEN}✓${NC} GraphQL service is running (HTTP 200)"
fi

echo ""

# Phase 5: Final Validation
echo -e "${BLUE}Phase 5: Final Validation${NC}"
echo "Re-running connectivity validation..."
echo ""

if ./scripts/validate-staging-connectivity.sh $([ "$TEST_AZURE" == "true" ] && echo "--azure" || true) 2>/dev/null; then
  echo ""
  echo -e "${GREEN}============================================================${NC}"
  echo -e "${GREEN}✅ All connectivity issues resolved!${NC}"
  echo ""
  echo "Services are now operational:"
  echo "  - VPN: Connected"
  echo "  - ngrok: Active"
  echo "  - Public URL: ${NGROK_URL}"
  echo ""
  exit 0
else
  echo ""
  echo -e "${YELLOW}============================================================${NC}"
  echo -e "${YELLOW}⚠️  Some issues may remain${NC}"
  echo ""
  echo "Manual troubleshooting steps:"
  echo ""
  echo "1. Check VPN:"
  echo "   ssh ${STAGING_USER}@${STAGING_HOST}"
  echo "   sudo systemctl status protonvpn-openvpn"
  echo "   curl -s https://api.ipify.org"
  echo ""
  echo "2. Check ngrok:"
  echo "   sudo systemctl status ngrok-taliahub"
  echo "   curl -s http://localhost:4040/api/tunnels"
  echo ""
  echo "3. Check Docker services:"
  echo "   cd ${STAGING_DIR}"
  echo "   docker compose -f docker-compose.staging.yml ps"
  echo ""
  exit 1
fi
