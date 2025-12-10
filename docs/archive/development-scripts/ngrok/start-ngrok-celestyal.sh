#!/bin/bash

# Talia ngrok Tunnel Script for Celestyal Path
# Exposes the UI at taliahub.com/celestyal via ngrok
# The backend remains local-only - API requests are proxied through Vite
# Supports access control via ngrok.yml configuration file

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
BASE_PATH="/celestyal"
NGROK_CONFIG="${NGROK_CONFIG:-ngrok.yml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/$NGROK_CONFIG"

echo -e "${BLUE}🌐 Starting ngrok Tunnel for Talia UI (Celestyal Path)${NC}"
echo "=========================================="
echo -e "${YELLOW}📋 Architecture:${NC}"
echo "   • UI exposed at: https://${FRONTEND_DOMAIN}${BASE_PATH}"
echo "   • Backend stays local-only (localhost:4000)"
echo "   • API requests proxied through Vite dev server"
echo ""

# Check for access control configuration
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}🔒 Checking access control configuration...${NC}"
    
    # Check if basic auth is configured
    if grep -q "basic_auth:" "$CONFIG_FILE" && ! grep -q "^[[:space:]]*#.*basic_auth:" "$CONFIG_FILE"; then
        echo -e "${GREEN}   ✅ Basic HTTP Authentication: ENABLED${NC}"
        AUTH_ENABLED=true
    else
        echo -e "${YELLOW}   ⚠️  Basic HTTP Authentication: DISABLED${NC}"
        AUTH_ENABLED=false
    fi
    
    # Check if IP restriction is configured
    if grep -q "ip_restriction:" "$CONFIG_FILE" && ! grep -q "^[[:space:]]*#.*ip_restriction:" "$CONFIG_FILE"; then
        echo -e "${GREEN}   ✅ IP Whitelisting: ENABLED${NC}"
        IP_RESTRICTION_ENABLED=true
    else
        echo -e "${YELLOW}   ⚠️  IP Whitelisting: DISABLED${NC}"
        IP_RESTRICTION_ENABLED=false
    fi
    
    if [ "$AUTH_ENABLED" = false ] && [ "$IP_RESTRICTION_ENABLED" = false ]; then
        echo -e "${YELLOW}   ⚠️  No access control enabled - tunnel is publicly accessible${NC}"
        echo -e "${YELLOW}   💡 To enable access control, edit: $CONFIG_FILE${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  No ngrok config file found at: $CONFIG_FILE${NC}"
    echo -e "${YELLOW}   Using default configuration (no access control)${NC}"
    echo -e "${YELLOW}   💡 Create $CONFIG_FILE to enable access control${NC}"
    echo ""
fi

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

# Set environment variable for Vite base path
export VITE_BASE_PATH="${BASE_PATH}"

echo -e "${YELLOW}📝 Configuration:${NC}"
echo "   • Base path: ${BASE_PATH}"
echo "   • Vite will serve app at: http://localhost:${FRONTEND_PORT}${BASE_PATH}"
echo "   • External URL: https://${FRONTEND_DOMAIN}${BASE_PATH}"
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
    
    # Use direct command line (simpler and more reliable)
    # Read basic auth from config if it exists
    local auth_args=""
    if [ -f "$CONFIG_FILE" ]; then
        # Extract basic auth credentials from config (format: "username:password")
        local auth_line=$(grep -A 3 "basic_auth:" "$CONFIG_FILE" | grep -E '^\s+-' | head -1 | sed 's/.*"\(.*\)".*/\1/' | tr -d ' ')
        if [ -n "$auth_line" ] && [ "$auth_line" != "" ]; then
            auth_args="--basic-auth=$auth_line"
        fi
    fi
    
    # Start ngrok with direct command (uses global config for authtoken)
    if [ -n "$auth_args" ]; then
        ngrok http $port --domain=$domain $auth_args > "$log_file" 2>&1 &
    else
        ngrok http $port --domain=$domain > "$log_file" 2>&1 &
    fi
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check for errors
    sleep 3
    
    # Check log for common errors
    if grep -q "ERR_NGROK_314" "$log_file" 2>/dev/null; then
        echo -e "${RED}❌ Error: Custom domain requires paid plan${NC}"
        echo -e "${YELLOW}   Your account is on the Free plan${NC}"
        echo -e "${YELLOW}   Upgrade at: https://dashboard.ngrok.com/billing/choose-a-plan${NC}"
        echo -e "${YELLOW}   Or use a free domain (remove 'domain:' from ngrok.yml)${NC}"
        echo ""
        echo -e "${BLUE}   See: NGROK-PLAN-UPGRADE.md for details${NC}"
        kill $pid 2>/dev/null
        rm -f "$pid_file"
        return 1
    fi
    
    if grep -q "ERR_NGROK_4018\|authentication failed" "$log_file" 2>/dev/null; then
        echo -e "${RED}❌ Error: Authentication failed${NC}"
        echo -e "${YELLOW}   Update your authtoken:${NC}"
        echo -e "${YELLOW}   ngrok config add-authtoken YOUR_TOKEN${NC}"
        echo -e "${YELLOW}   Get token from: https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
        kill $pid 2>/dev/null
        rm -f "$pid_file"
        return 1
    fi
    
    # Wait a moment for ngrok to start
    sleep 3
    
    # Check if process is still running
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✅ $name tunnel started (PID: $pid)${NC}"
        
        # Try to get the public URL (ngrok API)
        sleep 2
        local public_url=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | grep "https://${domain}" | head -1 | cut -d'"' -f4)
        
        if [ -n "$public_url" ]; then
            echo -e "${GREEN}   Public URL: ${public_url}${BASE_PATH}${NC}"
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
    echo -e "${BLUE}📱 Share this URL with clients:${NC}"
    echo -e "${GREEN}   https://${FRONTEND_DOMAIN}${BASE_PATH}${NC}"
    echo ""
    
    # Show access control status
    if [ -f "$CONFIG_FILE" ]; then
        if [ "$AUTH_ENABLED" = true ] || [ "$IP_RESTRICTION_ENABLED" = true ]; then
            echo -e "${BLUE}🔒 Access Control:${NC}"
            if [ "$AUTH_ENABLED" = true ]; then
                echo -e "${GREEN}   ✅ Basic Authentication: Active${NC}"
                echo -e "${YELLOW}   💡 Users will be prompted for username/password${NC}"
            fi
            if [ "$IP_RESTRICTION_ENABLED" = true ]; then
                echo -e "${GREEN}   ✅ IP Whitelisting: Active${NC}"
                echo -e "${YELLOW}   💡 Only whitelisted IPs can access${NC}"
            fi
            echo ""
        fi
    fi
    
    echo -e "${YELLOW}📋 Architecture Summary:${NC}"
    echo "   ✅ UI exposed: https://${FRONTEND_DOMAIN}${BASE_PATH}"
    echo "   🔒 Backend local-only: http://localhost:4000 (not exposed)"
    echo "   🔄 API requests: Proxied through Vite (/celestyal/api/graphql → localhost:4000/graphql)"
    echo ""
    echo -e "${YELLOW}⚠️  Important:${NC}"
    echo "   • Make sure Vite is started with: VITE_BASE_PATH=${BASE_PATH} npm run dev"
    echo "   • Or restart the dev server after setting the environment variable"
    if [ ! -f "$CONFIG_FILE" ] || ([ "$AUTH_ENABLED" = false ] && [ "$IP_RESTRICTION_ENABLED" = false ]); then
        echo -e "${YELLOW}   • Access control is disabled - tunnel is publicly accessible${NC}"
        echo -e "${YELLOW}   • To enable access control, edit: $CONFIG_FILE${NC}"
    fi
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

