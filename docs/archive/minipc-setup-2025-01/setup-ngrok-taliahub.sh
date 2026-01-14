#!/bin/bash
# Setup ngrok to expose Talia UI at taliahub.com
# This script configures ngrok with custom domain and creates systemd service

set -e

echo "🌐 Setting up ngrok for taliahub.com"
echo "===================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Please install ngrok first."
    exit 1
fi

# Create ngrok config directory if it doesn't exist
mkdir -p ~/.ngrok2

# Check if ngrok auth token is configured
if ! ngrok config check &> /dev/null; then
    echo "⚠️  ngrok auth token not configured."
    echo "   Please run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    read -p "Do you want to configure it now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your ngrok auth token: " AUTH_TOKEN
        ngrok config add-authtoken "$AUTH_TOKEN"
    else
        echo "Please configure ngrok auth token first."
        exit 1
    fi
fi

# Create ngrok config file for Talia UI with custom domain
cat > ~/.ngrok2/ngrok-taliahub.yml << 'EOF'
version: "2"
authtoken: # Set via ngrok config add-authtoken
tunnels:
  talia-ui:
    proto: http
    addr: 5173
    inspect: true
    bind_tls: true
    hostname: taliahub.com
EOF

echo "✅ Created ngrok config: ~/.ngrok2/ngrok-taliahub.yml"
echo ""

# Create systemd service for ngrok Talia UI
sudo tee /etc/systemd/system/ngrok-taliahub.service > /dev/null << 'EOF'
[Unit]
Description=ngrok tunnel for Talia UI (taliahub.com)
After=network.target

[Service]
Type=simple
User=zomarc
ExecStart=/usr/local/bin/ngrok http --config=/home/zomarc/.ngrok2/ngrok-taliahub.yml talia-ui
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Created systemd service: /etc/systemd/system/ngrok-taliahub.service"
echo ""

# Reload systemd
sudo systemctl daemon-reload

echo "📋 Next steps:"
echo ""
echo "1. Stop any existing ngrok processes:"
echo "   sudo pkill ngrok"
echo ""
echo "2. Start ngrok service:"
echo "   sudo systemctl start ngrok-taliahub"
echo ""
echo "3. Enable auto-start:"
echo "   sudo systemctl enable ngrok-taliahub"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status ngrok-taliahub"
echo ""
echo "5. View logs:"
echo "   sudo journalctl -u ngrok-taliahub -f"
echo ""
echo "6. Verify tunnel:"
echo "   curl -s http://localhost:4040/api/tunnels | grep -o 'https://taliahub.com'"
echo ""
echo "✅ Setup complete!"
echo ""
echo "Your Talia UI will be available at: https://taliahub.com"
