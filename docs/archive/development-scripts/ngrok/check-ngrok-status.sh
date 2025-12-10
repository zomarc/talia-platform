#!/bin/bash

# Check ngrok status and display external URL

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 ngrok Status Check${NC}"
echo "=========================================="

# Check if ngrok is running
if pgrep -f "ngrok http" > /dev/null; then
    echo -e "${GREEN}✅ ngrok process: Running${NC}"
else
    echo -e "${RED}❌ ngrok process: Not running${NC}"
    echo ""
    echo "To start ngrok, run:"
    echo "  ./scripts/start-ngrok.sh"
    echo ""
    exit 1
fi

# Check if ngrok dashboard is accessible
if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ngrok dashboard: Accessible${NC}"
else
    echo -e "${YELLOW}⚠️  ngrok dashboard: Not accessible${NC}"
fi

# Get tunnel information
TUNNEL_INFO=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)

if [ -z "$TUNNEL_INFO" ]; then
    echo -e "${RED}❌ Could not retrieve tunnel information${NC}"
    exit 1
fi

# Extract public URL
PUBLIC_URL=$(echo "$TUNNEL_INFO" | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') if tunnels else 'N/A')" 2>/dev/null)

if [ "$PUBLIC_URL" != "N/A" ] && [ -n "$PUBLIC_URL" ]; then
    echo ""
    echo -e "${GREEN}📱 External URL:${NC}"
    echo -e "${BLUE}   ${PUBLIC_URL}${NC}"
    echo ""
    
    # Test if URL is operational
    echo -e "${YELLOW}🔍 Testing connection...${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Status: Operational (HTTP $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo -e "${RED}❌ Status: Not accessible (connection failed)${NC}"
    else
        echo -e "${YELLOW}⚠️  Status: Responding with HTTP $HTTP_CODE${NC}"
    fi
    
    # Check backend proxy
    echo ""
    echo -e "${YELLOW}🔍 Testing API proxy...${NC}"
    API_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL/api/graphql" -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}' 2>/dev/null)
    
    if [ "$API_TEST" = "200" ]; then
        echo -e "${GREEN}✅ API Proxy: Working (HTTP $API_TEST)${NC}"
    else
        echo -e "${YELLOW}⚠️  API Proxy: HTTP $API_TEST${NC}"
    fi
    
else
    echo -e "${RED}❌ No active tunnel found${NC}"
    echo ""
    echo "Tunnel information:"
    echo "$TUNNEL_INFO" | python3 -m json.tool 2>/dev/null || echo "$TUNNEL_INFO"
fi

echo ""
echo -e "${BLUE}📊 Additional Information:${NC}"
echo "   • ngrok Dashboard: http://localhost:4040"
echo "   • Frontend (local): http://localhost:5173"
echo "   • Backend (local): http://localhost:4000"
echo ""

