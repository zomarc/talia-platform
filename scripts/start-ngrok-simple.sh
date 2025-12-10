#!/bin/bash

# Simple ngrok startup - reads users from ngrok.yml

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/ngrok.yml"

echo -e "${BLUE}🚇 Starting ngrok...${NC}"
echo ""

# Stop any existing ngrok
pkill -f "ngrok http" 2>/dev/null
sleep 1

# Read basic auth users from ngrok.yml
AUTH_ARGS=""
if [ -f "$CONFIG_FILE" ]; then
    # Extract basic_auth entries (format: - "username:password")
    AUTH_USERS=$(grep -A 10 "basic_auth:" "$CONFIG_FILE" | grep -E '^\s+-' | sed 's/.*"\(.*\)".*/\1/' | grep -v "^#")
    
    if [ -n "$AUTH_USERS" ]; then
        echo -e "${YELLOW}Starting tunnel:${NC}"
        echo "  Domain: taliahub.com"
        echo "  Port: 5173"
        echo -e "${YELLOW}  Auth users from ngrok.yml:${NC}"
        
        while IFS= read -r user; do
            if [ -n "$user" ] && [[ "$user" != *"#"* ]]; then
                echo "    - $user"
                AUTH_ARGS="$AUTH_ARGS --basic-auth=$user"
            fi
        done <<< "$AUTH_USERS"
        echo ""
    else
        echo -e "${YELLOW}⚠️  No auth users found in ngrok.yml, using default${NC}"
        AUTH_ARGS="--basic-auth=demo:celestyal2024"
    fi
else
    echo -e "${YELLOW}⚠️  ngrok.yml not found, using default auth${NC}"
    AUTH_ARGS="--basic-auth=demo:celestyal2024"
fi

# Start ngrok with auth from config
eval "ngrok http 5173 --domain=taliahub.com $AUTH_ARGS" &

sleep 3

if pgrep -f "ngrok http" >/dev/null; then
    echo -e "${GREEN}✅ ngrok is running!${NC}"
    echo ""
    echo -e "${BLUE}📱 Your URL:${NC}"
    echo -e "${GREEN}   https://taliahub.com/celestyal${NC}"
    echo ""
    echo -e "${YELLOW}Credentials (from ngrok.yml):${NC}"
    if [ -f "$CONFIG_FILE" ]; then
        grep -A 10 "basic_auth:" "$CONFIG_FILE" | grep -E '^\s+-' | sed 's/.*"\(.*\)".*/\1/' | grep -v "^#" | while read -r user; do
            if [ -n "$user" ]; then
                IFS=':' read -r username password <<< "$user"
                echo "   Username: $username"
                echo "   Password: $password"
            fi
        done
    else
        echo "   Username: demo"
        echo "   Password: celestyal2024"
    fi
    echo ""
    echo -e "${YELLOW}Test:${NC}"
    echo "   curl -u demo:celestyal2024 https://taliahub.com/celestyal"
    echo ""
    echo -e "${YELLOW}Stop with: pkill -f ngrok${NC}"
else
    echo -e "${RED}❌ Failed to start ngrok${NC}"
    echo "Check: ngrok config check"
    exit 1
fi

