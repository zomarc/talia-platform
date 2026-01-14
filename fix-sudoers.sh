#!/bin/bash
# Fix passwordless sudo for zomarc user
# Run this script ON THE MINIPC (not via SSH)

echo "Setting up passwordless sudo for zomarc..."

# Create sudoers.d file
echo "zomarc ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/zomarc-nopasswd
sudo chmod 0440 /etc/sudoers.d/zomarc-nopasswd

# Verify syntax
sudo visudo -c

# Test
if sudo -n true 2>/dev/null; then
    echo "✅ Passwordless sudo is working!"
else
    echo "❌ Passwordless sudo not working. Please check configuration."
fi
