#!/bin/bash

# Talia ngrok Tunnel Script (Free Plan - No Custom Domain)
# Exposes the UI via ngrok's free random URL
# Works with free ngrok accounts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=5173
BACKEND_PORT=4000
BASE_PATH="${VITE_BASE_PATH:-/celestyal}"

echo -e "${BLUE}🌐 Starting ngrok Tunnel (Free Plan)${NC}"
echo "=========================================="
echo -e "${YELLOW}📋 Architecture:${NC}"
echo "   • UI will be exposed at a random ngrok URL"
echo "   • Backend stays local-only (localhost:4000)"
echo "   • API requests proxied through Vite dev server"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if ngrok is installed
if ! command_exists ngrok; then
    echo -e "${RED}❌ ngrok is not installed.${NC}"
    echo "   Install from: https://ngrok.com/download"
    exit 1
fi

# Check if ngrok is authenticated
if ! ngrok config check >/dev/null 2>&1; then
    echo -e "${RED}❌ ngrok is not configured.${NC}"
    echo "   Run: ngrok config add-authtoken <your-token>"
    echo "   Get token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

# Check if servers are running
check_server() {
    local port=$1
    local name=$2
    
    if ! curl -s "http://localhost:${port}" >/dev/null 2>&1 && ! curl -s "http://localhost:${port}/graphql" >/dev/null 2>&1; then
        echo -e "${RED}❌ $name is not running on port $port${NC}"
        echo "   Start it first with: ./scripts/start-dev.sh"
        return 1
    fi
    return 0
}

echo -e "${BLUE}🔍 Checking if servers are running...${NC}"
if ! check_server $FRONTEND_PORT "Frontend"; then
    exit 1
fi

if ! check_server $BACKEND_PORT "Backend"; then
    echo -e "${YELLOW}⚠️  Backend not running, but continuing (UI will proxy requests)${NC}"
    echo "   Start backend with: cd talia-server && npm start"
else
    echo -e "${GREEN}✅ Backend is running (local-only)${NC}"
fi

echo -e "${GREEN}✅ Frontend is running${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping ngrok tunnel...${NC}"
    pkill -f "ngrok http" 2>/dev/null
    echo -e "${GREEN}✅ Tunnel stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo -e "${YELLOW}🚇 Starting ngrok tunnel...${NC}"
echo -e "${BLUE}   Port: $FRONTEND_PORT${NC}"
echo -e "${YELLOW}   Note: Using free plan - URL will be random${NC}"
echo ""

# Start ngrok in foreground so we can see the URL
ngrok http $FRONTEND_PORT

