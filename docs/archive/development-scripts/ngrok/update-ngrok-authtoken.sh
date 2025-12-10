#!/bin/bash

# Update ngrok authtoken for paid account

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔑 Updating ngrok Authtoken${NC}"
echo "=========================================="
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   If you upgraded to a paid account, you need to:"
echo "   1. Get a NEW authtoken from your paid account"
echo "   2. Update it in ngrok config"
echo ""
echo -e "${BLUE}📋 Steps:${NC}"
echo ""
echo "1. Get your authtoken from:"
echo -e "   ${GREEN}https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
echo ""
echo "2. Copy the token"
echo ""
echo "3. Run this command:"
echo -e "   ${GREEN}ngrok config add-authtoken YOUR_TOKEN_HERE${NC}"
echo ""
echo -e "${YELLOW}Or enter it now (press Enter to skip):${NC}"
read -p "Authtoken: " TOKEN

if [ -n "$TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}Updating authtoken...${NC}"
    ngrok config add-authtoken "$TOKEN"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Authtoken updated successfully!${NC}"
        echo ""
        echo -e "${BLUE}Testing connection...${NC}"
        ngrok config check
        echo ""
        echo -e "${GREEN}✅ You can now try starting ngrok:${NC}"
        echo "   ./scripts/start-ngrok-celestyal.sh"
    else
        echo -e "${RED}❌ Failed to update authtoken${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}⏭️  Skipped. Get your token from:${NC}"
    echo "   https://dashboard.ngrok.com/get-started/your-authtoken"
    echo ""
    echo "Then run:"
    echo "   ngrok config add-authtoken YOUR_TOKEN"
fi

