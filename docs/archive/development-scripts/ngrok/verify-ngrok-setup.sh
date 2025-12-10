#!/bin/bash

# Verify ngrok setup for paid plan with custom domain

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying ngrok Setup${NC}"
echo "=========================================="
echo ""

# Check 1: ngrok config
echo -e "${YELLOW}1. Checking ngrok configuration...${NC}"
if ngrok config check >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ ngrok config is valid${NC}"
else
    echo -e "${RED}   ❌ ngrok config error${NC}"
    ngrok config check
    exit 1
fi
echo ""

# Check 2: DNS
echo -e "${YELLOW}2. Checking DNS for taliahub.com...${NC}"
CNAME=$(dig taliahub.com CNAME +short 2>/dev/null | head -1)
if [ -n "$CNAME" ]; then
    echo -e "${GREEN}   ✅ CNAME found: ${CNAME}${NC}"
    if [[ "$CNAME" == *"ngrok"* ]]; then
        echo -e "${GREEN}   ✅ Points to ngrok${NC}"
    else
        echo -e "${YELLOW}   ⚠️  CNAME doesn't contain 'ngrok'${NC}"
    fi
else
    echo -e "${RED}   ❌ No CNAME record found${NC}"
    echo -e "${YELLOW}   💡 DNS may not be configured correctly${NC}"
fi
echo ""

# Check 3: Domain IP resolution
echo -e "${YELLOW}3. Checking IP resolution...${NC}"
IPS=$(dig taliahub.com +short 2>/dev/null | head -3)
if [ -n "$IPS" ]; then
    echo -e "${GREEN}   ✅ Resolves to:${NC}"
    echo "$IPS" | while read ip; do
        echo -e "${BLUE}      - $ip${NC}"
    done
else
    echo -e "${RED}   ❌ No IP resolution${NC}"
fi
echo ""

# Check 4: Services
echo -e "${YELLOW}4. Checking local services...${NC}"
if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Frontend running on port 5173${NC}"
else
    echo -e "${RED}   ❌ Frontend NOT running${NC}"
fi

if curl -s http://localhost:4000/graphql >/dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Backend running on port 4000${NC}"
else
    echo -e "${YELLOW}   ⚠️  Backend NOT running (optional)${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${BLUE}📋 Summary:${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Even with a paid plan, you MUST:${NC}"
echo ""
echo "   1. Add domain in ngrok dashboard:"
echo -e "      ${BLUE}https://dashboard.ngrok.com/cloud-edge/domains${NC}"
echo ""
echo "   2. Click 'Add Domain' or 'New Domain'"
echo ""
echo "   3. Enter: taliahub.com"
echo ""
echo "   4. Verify DNS matches what ngrok shows"
echo ""
echo "   5. Wait for domain status to show 'Active'"
echo ""
echo -e "${YELLOW}💡 The error 'Free plan' usually means:${NC}"
echo "   • Domain not added in dashboard (most common)"
echo "   • Domain not verified/active"
echo "   • Wrong authtoken (different account)"
echo ""
echo -e "${GREEN}✅ Once domain is 'Active' in dashboard, try:${NC}"
echo "   ./scripts/start-ngrok-celestyal.sh"

