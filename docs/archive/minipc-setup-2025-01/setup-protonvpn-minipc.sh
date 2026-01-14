#!/bin/bash
# Setup ProtonVPN on MiniPC
# This script installs ProtonVPN CLI and creates a systemd service

set -e

echo "🔐 ProtonVPN Setup for MiniPC"
echo "=============================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Step 1: Install ProtonVPN CLI
echo "📦 Step 1: Installing ProtonVPN CLI..."
if command -v protonvpn-cli &> /dev/null; then
    echo "✅ ProtonVPN CLI already installed"
    protonvpn-cli --version
else
    echo "Installing ProtonVPN repository..."
    cd /tmp
    wget -q https://repo.protonvpn.com/debian/dists/stable/main/binary-all/protonvpn-stable-release_1.0.3-3_all.deb -O protonvpn-release.deb
    dpkg -i protonvpn-release.deb || apt-get install -f -y
    apt-get update -qq
    apt-get install -y protonvpn-cli
    echo "✅ ProtonVPN CLI installed"
fi

# Step 2: Login (interactive)
echo ""
echo "🔑 Step 2: ProtonVPN Login"
echo "You need to login with your ProtonVPN credentials"
echo "Run: sudo protonvpn-cli login"
echo ""
read -p "Have you logged in? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please login first: sudo protonvpn-cli login"
    exit 1
fi

# Step 3: Find server that gives IP 149.40.48.92
echo ""
echo "🌍 Step 3: Finding server with IP 149.40.48.92"
echo "Connecting to test server to verify IP..."
protonvpn-cli connect --fastest
sleep 5
CURRENT_IP=$(curl -s https://api.ipify.org)
echo "Current IP: $CURRENT_IP"

if [ "$CURRENT_IP" = "149.40.48.92" ]; then
    echo "✅ Connected to correct server (IP: $CURRENT_IP)"
    SERVER=$(protonvpn-cli status | grep "Server:" | awk '{print $2}')
    echo "Server: $SERVER"
else
    echo "⚠️  Current IP ($CURRENT_IP) doesn't match target (149.40.48.92)"
    echo "You may need to manually select a server"
    echo "Run: protonvpn-cli connect --server-list"
fi

# Step 4: Create systemd service
echo ""
echo "⚙️  Step 4: Creating systemd service..."

cat > /etc/systemd/system/protonvpn.service << 'EOF'
[Unit]
Description=ProtonVPN Connection
After=network.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/protonvpn-cli connect --fastest
ExecStop=/usr/bin/protonvpn-cli disconnect
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Alternative: Use specific server if known
# Uncomment and modify if you know the server name:
# ExecStart=/usr/bin/protonvpn-cli connect --server <SERVER_NAME>

systemctl daemon-reload
systemctl enable protonvpn.service

echo "✅ Systemd service created and enabled"
echo ""
echo "📋 Service commands:"
echo "  Start:   sudo systemctl start protonvpn"
echo "  Stop:    sudo systemctl stop protonvpn"
echo "  Status:  sudo systemctl status protonvpn"
echo "  Logs:    sudo journalctl -u protonvpn -f"
echo ""
echo "✅ Setup complete!"
