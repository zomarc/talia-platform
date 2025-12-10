#!/bin/bash

# Test ngrok with free domain (no custom domain required)
# This verifies basic auth works before upgrading to paid plan

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing ngrok with Free Domain${NC}"
echo "=========================================="
echo ""

# Check if frontend is running
if ! curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "${RED}❌ Frontend is not running on port 5173${NC}"
    echo "   Start it with: cd talia-ui && VITE_BASE_PATH=/celestyal npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Frontend is running${NC}"
echo ""

# Stop any existing ngrok
pkill -f "ngrok http" 2>/dev/null
sleep 2

# Start ngrok with basic auth (free domain)
echo -e "${YELLOW}🚇 Starting ngrok with basic auth...${NC}"
ngrok http 5173 --basic-auth="demo:celestyal2024" > /tmp/ngrok-test.log 2>&1 &
NGROK_PID=$!

sleep 4

# Check if ngrok started
if ! kill -0 $NGROK_PID 2>/dev/null; then
    echo -e "${RED}❌ ngrok failed to start${NC}"
    cat /tmp/ngrok-test.log | tail -10
    exit 1
fi

# Get the public URL
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') + '/celestyal' if tunnels else 'N/A')" 2>/dev/null)

if [ "$PUBLIC_URL" = "N/A" ] || [ -z "$PUBLIC_URL" ]; then
    echo -e "${RED}❌ Could not get ngrok URL${NC}"
    echo "   Check dashboard: http://localhost:4040"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ ngrok started${NC}"
echo ""
echo -e "${BLUE}📱 Public URL:${NC}"
echo -e "${GREEN}   ${PUBLIC_URL}${NC}"
echo ""

# Test access control
echo -e "${YELLOW}🧪 Testing Access Control...${NC}"
echo ""

echo "Test 1: Without credentials (should fail):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" 2>/dev/null)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}   ✅ Correct: 401 Unauthorized${NC}"
else
    echo -e "${RED}   ❌ Expected 401, got ${HTTP_CODE}${NC}"
fi
echo ""

echo "Test 2: Wrong credentials (should fail):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u wrong:password "$PUBLIC_URL" 2>/dev/null)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}   ✅ Correct: 401 Unauthorized${NC}"
else
    echo -e "${RED}   ❌ Expected 401, got ${HTTP_CODE}${NC}"
fi
echo ""

echo "Test 3: Correct credentials (should work):"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u demo:celestyal2024 "$PUBLIC_URL" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}   ✅ Correct: 200 OK${NC}"
else
    echo -e "${RED}   ❌ Expected 200, got ${HTTP_CODE}${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 All tests complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "   1. Test in browser: ${PUBLIC_URL}"
echo "   2. Should see login prompt"
echo "   3. Enter: demo / celestyal2024"
echo "   4. Should see your application"
echo ""
echo -e "${YELLOW}⚠️  Note: This is a FREE domain (changes on restart)${NC}"
echo "   To use taliahub.com, upgrade to paid plan:"
echo "   https://dashboard.ngrok.com/billing/choose-a-plan"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop ngrok${NC}"

# Wait for user to stop
wait $NGROK_PID

