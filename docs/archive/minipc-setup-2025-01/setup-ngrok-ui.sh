#!/bin/bash
# Setup ngrok to expose UI on MiniPC
# This script creates a systemd service for ngrok to expose port 5173 (UI)

set -e

echo "🌐 Setting up ngrok for UI access"
echo "=================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Please install ngrok first."
    exit 1
fi

# Check if ngrok auth token is set
if [ -z "$NGROK_AUTH_TOKEN" ]; then
    echo "⚠️  NGROK_AUTH_TOKEN not set. You may need to configure ngrok auth."
    echo "   Run: ngrok config add-authtoken YOUR_TOKEN"
fi

# Create ngrok config directory if it doesn't exist
mkdir -p ~/.ngrok2

# Create ngrok config file for UI
cat > ~/.ngrok2/ngrok-ui.yml << 'EOF'
version: "2"
authtoken: # Will be set via NGROK_AUTH_TOKEN env var or ngrok config
tunnels:
  ui:
    proto: http
    addr: 5173
    inspect: true
    bind_tls: true
EOF

echo "✅ Created ngrok config: ~/.ngrok2/ngrok-ui.yml"
echo ""

# Create systemd service for ngrok UI
sudo tee /etc/systemd/system/ngrok-ui.service > /dev/null << 'EOF'
[Unit]
Description=ngrok tunnel for Talia UI
After=network.target

[Service]
Type=simple
User=zomarc
ExecStart=/usr/local/bin/ngrok http --config=/home/zomarc/.ngrok2/ngrok-ui.yml ui
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Created systemd service: /etc/systemd/system/ngrok-ui.service"
echo ""

# Reload systemd
sudo systemctl daemon-reload

echo "📋 Next steps:"
echo "1. Configure ngrok auth token (if not already done):"
echo "   ngrok config add-authtoken YOUR_TOKEN"
echo ""
echo "2. Start ngrok service:"
echo "   sudo systemctl start ngrok-ui"
echo ""
echo "3. Enable auto-start:"
echo "   sudo systemctl enable ngrok-ui"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status ngrok-ui"
echo ""
echo "5. Get public URL:"
echo "   curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^\"]*' | head -1"
echo ""
