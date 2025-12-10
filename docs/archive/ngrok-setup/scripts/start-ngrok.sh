#!/bin/bash

# Talia ngrok Tunnel Script
# This script exposes ONLY the UI to external users via ngrok
# The backend remains local-only - API requests are proxied through Vite
# Requires ngrok to be installed and configured with custom domain

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_PORT=5173
BACKEND_PORT=4000
FRONTEND_DOMAIN="${NGROK_FRONTEND_DOMAIN:-taliahub.com}"

echo -e "${BLUE}🌐 Starting ngrok Tunnel for Talia UI${NC}"
echo "=========================================="
echo -e "${YELLOW}📋 Architecture:${NC}"
echo "   • Only UI is exposed externally (via ngrok)"
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
    echo -e "${YELLOW}⚠️  ngrok may not be configured.${NC}"
    echo "   Run: ngrok config add-authtoken <your-token>"
    echo "   Get token from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo ""
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

# Function to start ngrok tunnel
start_tunnel() {
    local port=$1
    local domain=$2
    local name=$3
    local pid_file=".ngrok-${name}.pid"
    local log_file=".ngrok-${name}.log"
    
    echo -e "${YELLOW}🚇 Starting ngrok tunnel for $name...${NC}"
    echo -e "${BLUE}   Port: $port${NC}"
    echo -e "${BLUE}   Domain: $domain${NC}"
    
    # Start ngrok in background
    ngrok http $port --domain=$domain > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment for ngrok to start
    sleep 3
    
    # Check if process is still running
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✅ $name tunnel started (PID: $pid)${NC}"
        
        # Try to get the public URL (ngrok API)
        sleep 2
        local public_url=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | grep "https://${domain}" | head -1 | cut -d'"' -f4)
        
        if [ -n "$public_url" ]; then
            echo -e "${GREEN}   Public URL: $public_url${NC}"
        else
            echo -e "${YELLOW}   Check ngrok dashboard: http://localhost:4040${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Failed to start $name tunnel${NC}"
        echo "   Check log: $log_file"
        return 1
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping ngrok tunnel...${NC}"
    
    # Kill ngrok processes
    if [ -f ".ngrok-frontend.pid" ]; then
        kill $(cat .ngrok-frontend.pid) 2>/dev/null
        rm -f .ngrok-frontend.pid
    fi
    
    # Kill any remaining ngrok processes
    pkill -f "ngrok http" 2>/dev/null
    
    echo -e "${GREEN}✅ Tunnel stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start frontend tunnel (ONLY tunnel - backend stays local)
start_tunnel $FRONTEND_PORT $FRONTEND_DOMAIN "frontend"
FRONTEND_SUCCESS=$?

echo ""
echo "=========================================="

if [ $FRONTEND_SUCCESS -eq 0 ]; then
    echo -e "${GREEN}🎉 UI is now exposed externally!${NC}"
    echo ""
    echo -e "${BLUE}📱 Share this URL with clients:${NC} https://${FRONTEND_DOMAIN}"
    echo ""
    echo -e "${YELLOW}📋 Architecture Summary:${NC}"
    echo "   ✅ UI exposed: https://${FRONTEND_DOMAIN}"
    echo "   🔒 Backend local-only: http://localhost:4000 (not exposed)"
    echo "   🔄 API requests: Proxied through Vite (/api/graphql → localhost:4000/graphql)"
    echo ""
    echo -e "${BLUE}🔍 Monitoring:${NC}"
    echo "   • ngrok dashboard: http://localhost:4040"
    echo "   • Backend logs: Check talia-server terminal"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the tunnel${NC}"
else
    echo -e "${RED}❌ Tunnel failed to start${NC}"
    cleanup
    exit 1
fi

# Wait for user to stop
wait

