#!/bin/bash

# Check ngrok status for celestyal path setup

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_PATH="/celestyal"

echo -e "${BLUE}🌐 ngrok Status Check (Celestyal Path)${NC}"
echo "=========================================="

# Check if ngrok is running
if pgrep -f "ngrok http" > /dev/null; then
    echo -e "${GREEN}✅ ngrok process: Running${NC}"
else
    echo -e "${RED}❌ ngrok process: Not running${NC}"
    echo ""
    echo "To start ngrok, run:"
    echo "  ./scripts/start-ngrok-celestyal.sh"
    echo ""
fi

# Check if Vite is running with base path
VITE_BASE_PATH=$(ps aux | grep -E "vite|node.*5173" | grep -v grep | grep -o "VITE_BASE_PATH=[^ ]*" | cut -d= -f2 || echo "")
if [ -n "$VITE_BASE_PATH" ]; then
    echo -e "${GREEN}✅ Vite base path: $VITE_BASE_PATH${NC}"
elif curl -s http://localhost:5173/celestyal > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Vite responding at /celestyal${NC}"
else
    echo -e "${YELLOW}⚠️  Vite base path: Not set or not responding at /celestyal${NC}"
    echo "   Restart Vite with: VITE_BASE_PATH=/celestyal npm run dev"
fi

# Check if ngrok dashboard is accessible
if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ngrok dashboard: Accessible${NC}"
    
    # Get tunnel information
    TUNNEL_INFO=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null)
    
    if [ -n "$TUNNEL_INFO" ]; then
        # Extract public URL
        PUBLIC_URL=$(echo "$TUNNEL_INFO" | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') if tunnels else 'N/A')" 2>/dev/null)
        
        if [ "$PUBLIC_URL" != "N/A" ] && [ -n "$PUBLIC_URL" ]; then
            echo ""
            echo -e "${GREEN}📱 External URL:${NC}"
            echo -e "${BLUE}   ${PUBLIC_URL}${BASE_PATH}${NC}"
            echo ""
            
            # Test if URL is operational
            echo -e "${YELLOW}🔍 Testing connection...${NC}"
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${PUBLIC_URL}${BASE_PATH}" 2>/dev/null)
            
            if [ "$HTTP_CODE" = "200" ]; then
                echo -e "${GREEN}✅ Status: Operational (HTTP $HTTP_CODE)${NC}"
            elif [ "$HTTP_CODE" = "404" ]; then
                echo -e "${YELLOW}⚠️  Status: 404 - Vite may not be configured with base path${NC}"
                echo "   Restart Vite with: VITE_BASE_PATH=/celestyal npm run dev"
            elif [ "$HTTP_CODE" = "000" ]; then
                echo -e "${RED}❌ Status: Not accessible (connection failed)${NC}"
            else
                echo -e "${YELLOW}⚠️  Status: Responding with HTTP $HTTP_CODE${NC}"
            fi
        fi
    fi
else
    echo -e "${YELLOW}⚠️  ngrok dashboard: Not accessible${NC}"
fi

echo ""
echo -e "${BLUE}📊 Additional Information:${NC}"
echo "   • Expected URL: https://taliahub.com${BASE_PATH}"
echo "   • Local URL: http://localhost:5173${BASE_PATH}"
echo "   • ngrok Dashboard: http://localhost:4040"
echo ""

