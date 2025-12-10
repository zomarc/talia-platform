#!/bin/bash

# Helper script to guide through ngrok custom domain setup

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🌐 ngrok Custom Domain Setup Guide${NC}"
echo "=========================================="
echo ""

# Step 1: Check if domain is added in ngrok
echo -e "${YELLOW}Step 1: Add Domain in ngrok Dashboard${NC}"
echo ""
echo "1. Go to: https://dashboard.ngrok.com/cloud-edge/domains"
echo "2. Click 'Add Domain' or 'New Domain'"
echo "3. Enter: taliahub.com"
echo "4. ngrok will provide a CNAME target (e.g., edge-xxxxx.ngrok-free.app)"
echo ""
read -p "Press Enter when you've added the domain in ngrok dashboard..."

# Step 2: Get the CNAME value
echo ""
echo -e "${YELLOW}Step 2: Get the CNAME Target${NC}"
echo ""
echo "In the ngrok dashboard, you should see:"
echo "  Domain: taliahub.com"
echo "  CNAME Target: edge-xxxxx.ngrok-free.app (or similar)"
echo ""
read -p "Enter the CNAME target value: " CNAME_TARGET

if [ -z "$CNAME_TARGET" ]; then
    echo -e "${RED}❌ CNAME target is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Configure DNS${NC}"
echo ""
echo "Add this CNAME record in your DNS provider:"
echo ""
echo -e "${GREEN}Type: CNAME${NC}"
echo -e "${GREEN}Name: @ (or taliahub.com or leave blank for root domain)${NC}"
echo -e "${GREEN}Value: ${CNAME_TARGET}${NC}"
echo -e "${GREEN}TTL: 3600 (or Auto)${NC}"
echo ""
echo "Where to add:"
echo "  • If using domain registrar: DNS Management section"
echo "  • If using Cloudflare: DNS → Records → Add record"
echo "  • If using Route53: Hosted zones → Create record"
echo ""
read -p "Press Enter after you've added the DNS record..."

# Step 4: Wait for DNS propagation
echo ""
echo -e "${YELLOW}Step 4: Wait for DNS Propagation${NC}"
echo ""
echo "DNS changes can take 5 minutes to 48 hours to propagate."
echo "Usually takes 15-30 minutes."
echo ""
echo "Checking DNS propagation..."

for i in {1..12}; do
    DNS_RESULT=$(dig taliahub.com CNAME +short 2>/dev/null)
    if [ -n "$DNS_RESULT" ] && echo "$DNS_RESULT" | grep -q "ngrok"; then
        echo -e "${GREEN}✅ DNS is configured! Found: $DNS_RESULT${NC}"
        break
    else
        echo "⏳ Waiting for DNS propagation... ($i/12 checks)"
        sleep 10
    fi
done

if [ -z "$DNS_RESULT" ] || ! echo "$DNS_RESULT" | grep -q "ngrok"; then
    echo -e "${YELLOW}⚠️  DNS not yet propagated. This is normal - can take up to 48 hours.${NC}"
    echo ""
    echo "You can:"
    echo "  1. Check manually: dig taliahub.com CNAME"
    echo "  2. Check online: https://www.whatsmydns.net/#CNAME/taliahub.com"
    echo "  3. Continue anyway - ngrok will verify when you start the tunnel"
fi

# Step 5: Verify in ngrok dashboard
echo ""
echo -e "${YELLOW}Step 5: Verify Domain Status${NC}"
echo ""
echo "Go to: https://dashboard.ngrok.com/cloud-edge/domains"
echo "Check that taliahub.com shows as 'Active' or 'Verified'"
echo ""
read -p "Press Enter when domain is verified in ngrok dashboard..."

# Step 6: Start ngrok
echo ""
echo -e "${YELLOW}Step 6: Start ngrok with Custom Domain${NC}"
echo ""
echo "Starting ngrok with taliahub.com..."
echo ""

cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-celestyal.sh

