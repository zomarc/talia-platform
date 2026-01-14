#!/bin/bash
# Manual auth file creation - run this ON THE MINIPC
# This creates the auth file interactively

echo "Creating ProtonVPN OpenVPN auth file..."
echo "Username will be: russell@russellbryer.com:10"
echo ""
read -sp "Enter your OpenVPN password: " PASSWORD
echo ""

USERNAME="russell@russellbryer.com:10"
AUTH_FILE="$HOME/protonvpn-auth.txt"

echo "$USERNAME" > "$AUTH_FILE"
echo "$PASSWORD" >> "$AUTH_FILE"
chmod 600 "$AUTH_FILE"

echo ""
echo "✅ Auth file created: $AUTH_FILE"
echo ""
echo "Next: Test connection with:"
echo "  sudo openvpn --config ~/protonvpn-uk11.ovpn"
