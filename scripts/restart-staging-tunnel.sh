#!/bin/bash
#
# Quick restart script for VPN and ngrok tunnel
# Restarts services in proper order without rebooting server
#
# Usage:
#   ./scripts/restart-staging-tunnel.sh
#
set -euo pipefail

STAGING_USER="${STAGING_USER:-zomarc}"
STAGING_HOST="${STAGING_HOST:-192.168.1.120}"

NGROK_USER="${NGROK_USER:-talia}"
NGROK_PASS="${NGROK_PASS:-dev2025tal}"
NGROK_URL="${NGROK_URL:-https://taliahub.com}"

EXPECTED_VPN_IP="149.40.48.92"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Restart Staging VPN and ngrok Tunnel${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Step 1: Stop ngrok first (depends on VPN)
echo -e "${YELLOW}[1/6]${NC} Stopping ngrok service..."
if ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl stop ngrok-taliahub" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} ngrok stopped"
else
  echo -e "${YELLOW}⚠${NC}  ngrok may not have been running"
fi
sleep 2

# Step 2: Restart VPN
echo -e "${YELLOW}[2/6]${NC} Restarting VPN service..."
if ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl restart protonvpn-openvpn" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} VPN restart command sent"
else
  echo -e "${RED}✗${NC} Failed to restart VPN"
  exit 1
fi

# Step 3: Wait for VPN to establish
echo -e "${YELLOW}[3/6]${NC} Waiting for VPN to connect (10 seconds)..."
sleep 10

# Step 4: Verify VPN IP
echo -e "${YELLOW}[4/6]${NC} Verifying VPN connection..."
VPN_IP=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 10 https://api.ipify.org 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")

if [[ "$VPN_IP" == "$EXPECTED_VPN_IP" ]]; then
  echo -e "${GREEN}✓${NC} VPN connected (IP: $VPN_IP)"
elif [[ "$VPN_IP" == "FAILED" ]] || [[ "$VPN_IP" == "UNREACHABLE" ]]; then
  echo -e "${RED}✗${NC} VPN connection failed - could not determine IP"
  echo ""
  echo "Troubleshooting:"
  echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
  echo "  sudo systemctl status protonvpn-openvpn"
  echo "  sudo journalctl -u protonvpn-openvpn -n 50"
  exit 1
else
  echo -e "${YELLOW}⚠${NC}  VPN connected but IP is $VPN_IP (expected $EXPECTED_VPN_IP)"
  echo "  This may still work, but verify VPN server configuration"
fi

# Step 5: Restart ngrok
echo -e "${YELLOW}[5/6]${NC} Restarting ngrok service..."
if ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl restart ngrok-taliahub" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} ngrok restart command sent"
else
  echo -e "${RED}✗${NC} Failed to restart ngrok"
  exit 1
fi

# Step 6: Wait and verify ngrok tunnel
echo -e "${YELLOW}[6/6]${NC} Waiting for ngrok tunnel (5 seconds)..."
sleep 5

echo ""
echo -e "${BLUE}Verifying ngrok tunnel...${NC}"

# Check ngrok service status
NGROK_STATUS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "sudo systemctl is-active ngrok-taliahub 2>/dev/null || echo 'inactive'" 2>/dev/null || echo "unreachable")
if [[ "$NGROK_STATUS" == "active" ]]; then
  echo -e "${GREEN}✓${NC} ngrok service is running"
else
  echo -e "${RED}✗${NC} ngrok service is not active (status: $NGROK_STATUS)"
  echo ""
  echo "Troubleshooting:"
  echo "  ssh ${STAGING_USER}@${STAGING_HOST}"
  echo "  sudo systemctl status ngrok-taliahub"
  echo "  sudo journalctl -u ngrok-taliahub -n 50"
  exit 1
fi

# Check ngrok tunnel API
NGROK_TUNNELS=$(ssh "${STAGING_USER}@${STAGING_HOST}" "curl -sS --max-time 5 http://localhost:4040/api/tunnels 2>/dev/null || echo 'FAILED'" 2>/dev/null || echo "UNREACHABLE")
if echo "$NGROK_TUNNELS" | grep -q "taliahub.com" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} ngrok tunnel active (taliahub.com)"
else
  echo -e "${YELLOW}⚠${NC}  ngrok tunnel may not be fully established yet"
  echo "  Wait a few more seconds and check: curl -s http://localhost:4040/api/tunnels"
fi

# Test public access
echo ""
echo -e "${BLUE}Testing public access...${NC}"

PUBLIC_CODE_NOAUTH=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" 2>/dev/null || echo "000")
if [[ "$PUBLIC_CODE_NOAUTH" == "401" ]]; then
  echo -e "${GREEN}✓${NC} Public access working (HTTP 401 - auth required)"
elif [[ "$PUBLIC_CODE_NOAUTH" == "000" ]]; then
  echo -e "${YELLOW}⚠${NC}  Public access test failed (connection timeout)"
  echo "  This may be normal if ngrok is still establishing the tunnel"
  echo "  Wait 10-20 seconds and try: curl -I ${NGROK_URL}"
else
  echo -e "${YELLOW}⚠${NC}  Public access returned HTTP $PUBLIC_CODE_NOAUTH (expected 401)"
fi

PUBLIC_CODE_AUTH=$(curl -sS --basic -u "${NGROK_USER}:${NGROK_PASS}" -o /dev/null -w '%{http_code}' --max-time 10 "${NGROK_URL}" 2>/dev/null || echo "000")
if [[ "$PUBLIC_CODE_AUTH" == "200" ]]; then
  echo -e "${GREEN}✓${NC} Authenticated access working (HTTP 200)"
else
  echo -e "${YELLOW}⚠${NC}  Authenticated access returned HTTP $PUBLIC_CODE_AUTH (expected 200)"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}✅ VPN and ngrok restart complete${NC}"
echo ""
echo "Next steps:"
echo "  - Run validation: ./scripts/validate-staging-connectivity.sh"
echo "  - Test in browser: ${NGROK_URL}"
echo ""
