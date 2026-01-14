#!/bin/bash
# Install ProtonVPN CLI on MiniPC
# This script will prompt for sudo password once

set -e

echo "🔐 Installing ProtonVPN CLI"
echo "============================"
echo ""

# Check if already installed
if command -v protonvpn-cli &> /dev/null; then
    echo "✅ ProtonVPN CLI already installed"
    protonvpn-cli --version
    exit 0
fi

# Download repository package (already done, but verify)
cd /tmp
if [ ! -f protonvpn-release.deb ]; then
    echo "📥 Downloading ProtonVPN repository package..."
    wget -q https://repo.protonvpn.com/debian/dists/stable/main/binary-all/protonvpn-stable-release_1.0.3-3_all.deb -O protonvpn-release.deb
fi

echo "📦 Installing ProtonVPN repository..."
sudo dpkg -i protonvpn-release.deb || sudo apt-get install -f -y

echo "🔄 Updating package list..."
sudo apt-get update -qq

echo "⬇️  Installing ProtonVPN CLI..."
sudo apt-get install -y protonvpn-cli

echo ""
echo "✅ ProtonVPN CLI installed successfully!"
echo ""
protonvpn-cli --version

echo ""
echo "📋 Next steps:"
echo "1. Login: sudo protonvpn-cli login"
echo "2. Connect: sudo protonvpn-cli connect --fastest"
echo "3. Check IP: curl -s https://api.ipify.org"
echo ""
