#!/bin/bash
# Setup OpenVPN auth file for ProtonVPN UK#11
# Run this script ON THE MINIPC

set -e

echo "🔐 ProtonVPN OpenVPN Auth Setup"
echo "================================"
echo ""

# Username with :10 suffix for UK#11 exit IP
USERNAME="russell@russellbryer.com:10"
AUTH_FILE="$HOME/protonvpn-auth.txt"

echo "Username format: $USERNAME"
echo ""
read -sp "Enter your OpenVPN password: " PASSWORD
echo ""

# Create auth file
echo "$USERNAME" > "$AUTH_FILE"
echo "$PASSWORD" >> "$AUTH_FILE"
chmod 600 "$AUTH_FILE"

echo ""
echo "✅ Auth file created at: $AUTH_FILE"
echo ""

# Verify config file
if [ -f "$HOME/protonvpn-uk11.ovpn" ]; then
    echo "✅ Config file found: $HOME/protonvpn-uk11.ovpn"
    if grep -q "auth-user-pass /home/zomarc/protonvpn-auth.txt" "$HOME/protonvpn-uk11.ovpn"; then
        echo "✅ Config file already updated with auth file path"
    else
        echo "⚠️  Config file needs to be updated"
    fi
else
    echo "❌ Config file not found: $HOME/protonvpn-uk11.ovpn"
fi

echo ""
echo "Next steps:"
echo "1. Test connection: sudo openvpn --config ~/protonvpn-uk11.ovpn"
echo "2. Verify IP: curl -s https://api.ipify.org"
echo "3. If IP is 149.40.48.92, create systemd service"
