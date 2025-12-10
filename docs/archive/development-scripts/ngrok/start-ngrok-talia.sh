#!/bin/bash

# Start ngrok with talia.ngrok.dev endpoint

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

DOMAIN="talia.ngrok.dev"
FRONTEND_PORT=5173
BASE_PATH="${VITE_BASE_PATH:-/celestyal}"

echo -e "${BLUE}🌐 Starting ngrok with talia.ngrok.dev${NC}"
echo "=========================================="
echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   • Domain: ${DOMAIN}"
echo "   • Port: ${FRONTEND_PORT}"
echo "   • Base Path: ${BASE_PATH}"
echo ""

# Check if ngrok is already running
if pgrep -f "ngrok http" > /dev/null; then
    echo -e "${YELLOW}⚠️  ngrok is already running${NC}"
    echo "   Stopping existing tunnel..."
    pkill -f "ngrok http"
    sleep 2
fi

# Check if frontend is running
if ! curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    echo -e "${RED}❌ Frontend is not running on port ${FRONTEND_PORT}${NC}"
    echo "   Start it with: cd talia-ui && VITE_BASE_PATH=/celestyal npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Frontend is running${NC}"
echo ""

# Start ngrok
echo -e "${YELLOW}🚇 Starting ngrok tunnel...${NC}"
ngrok http ${FRONTEND_PORT} --domain=${DOMAIN} > /tmp/ngrok-talia.log 2>&1 &
NGROK_PID=$!

sleep 3

# Check if ngrok started successfully
if kill -0 $NGROK_PID 2>/dev/null; then
    echo -e "${GREEN}✅ ngrok started (PID: $NGROK_PID)${NC}"
    
    # Wait a bit more for tunnel to establish
    sleep 2
    
    # Get the public URL
    PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') + '${BASE_PATH}' if tunnels else 'N/A')" 2>/dev/null)
    
    if [ "$PUBLIC_URL" != "N/A" ] && [ -n "$PUBLIC_URL" ]; then
        echo ""
        echo -e "${GREEN}🎉 Tunnel is active!${NC}"
        echo ""
        echo -e "${BLUE}📱 External URL:${NC}"
        echo -e "${GREEN}   ${PUBLIC_URL}${NC}"
        echo ""
        echo -e "${YELLOW}📋 Notes:${NC}"
        echo "   • ngrok Dashboard: http://localhost:4040"
        echo "   • Make sure Vite is running with: VITE_BASE_PATH=/celestyal npm run dev"
        echo ""
    else
        echo -e "${YELLOW}⏳ Tunnel starting... check dashboard: http://localhost:4040${NC}"
    fi
else
    echo -e "${RED}❌ Failed to start ngrok${NC}"
    echo "   Check log: /tmp/ngrok-talia.log"
    cat /tmp/ngrok-talia.log | tail -10
    exit 1
fi

