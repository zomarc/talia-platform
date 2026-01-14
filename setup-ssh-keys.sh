#!/bin/bash
# Setup SSH key authentication to miniPC
# Run this from your laptop

set -e

MINIPC_USER="zomarc"
MINIPC_HOST="192.168.1.120"

echo "🔑 Setting up SSH key authentication to miniPC..."
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_ed25519.pub ] && [ ! -f ~/.ssh/id_rsa.pub ]; then
    echo "📝 Generating SSH key..."
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "talia-deployment-$(date +%Y%m%d)"
    echo "✅ SSH key generated"
else
    echo "✅ SSH key already exists"
fi

# Get the public key
PUBLIC_KEY=$(cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub)

echo ""
echo "📋 Public key to copy to miniPC:"
echo "----------------------------------------"
echo "$PUBLIC_KEY"
echo "----------------------------------------"
echo ""

echo "📤 Copying SSH key to miniPC..."
echo "You'll be prompted for your password one last time..."
echo ""

# Copy SSH key to miniPC
ssh-copy-id -i ~/.ssh/id_ed25519.pub $MINIPC_USER@$MINIPC_HOST 2>/dev/null || \
ssh-copy-id -i ~/.ssh/id_rsa.pub $MINIPC_USER@$MINIPC_HOST 2>/dev/null || {
    echo ""
    echo "⚠️  ssh-copy-id failed. Manual setup required:"
    echo ""
    echo "1. Copy this public key:"
    echo "$PUBLIC_KEY"
    echo ""
    echo "2. On miniPC, run:"
    echo "   mkdir -p ~/.ssh"
    echo "   echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys"
    echo "   chmod 700 ~/.ssh"
    echo "   chmod 600 ~/.ssh/authorized_keys"
    echo ""
    exit 1
}

echo ""
echo "✅ SSH key copied successfully!"
echo ""
echo "🧪 Testing connection..."
ssh -o BatchMode=yes -o ConnectTimeout=5 $MINIPC_USER@$MINIPC_HOST "echo '✅ SSH connection works without password!'" && {
    echo ""
    echo "🎉 Success! You can now SSH without password prompts."
    echo ""
    echo "Test it: ssh $MINIPC_USER@$MINIPC_HOST"
} || {
    echo "❌ Connection test failed. Please check the manual setup steps above."
}
