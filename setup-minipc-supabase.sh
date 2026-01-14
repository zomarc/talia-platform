#!/bin/bash
# Setup script for Supabase on miniPC (locations.l / 192.168.1.120)
# Run this script ON THE MINIPC after SSH'ing in

set -e  # Exit on error

echo "🚀 Setting up Supabase on miniPC..."
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "⚠️  Please run as regular user, not root"
   exit 1
fi

# Step 1: Install Docker (if not installed)
echo "📦 Step 1: Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "   Docker not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "   ✅ Docker installed. You may need to log out and back in."
else
    echo "   ✅ Docker already installed: $(docker --version)"
fi

# Step 2: Install Supabase CLI (if not installed)
echo ""
echo "📦 Step 2: Checking Supabase CLI installation..."
if ! command -v supabase &> /dev/null; then
    echo "   Supabase CLI not found. Installing..."
    
    # Try multiple installation methods
    INSTALLED=0
    
    # Method 1: Try using existing .deb file if present
    if [ -f ~/supabase.deb ]; then
        echo "   Found existing supabase.deb file, trying to install..."
        sudo dpkg -i ~/supabase.deb || sudo apt-get install -f -y
        if command -v supabase &> /dev/null; then
            INSTALLED=1
            echo "   ✅ Installed from existing .deb file"
        fi
    fi
    
    # Method 2: Try direct download with specific version
    if [ $INSTALLED -eq 0 ]; then
        echo "   Downloading Supabase CLI v2.67.1..."
        wget -O /tmp/supabase.deb https://github.com/supabase/cli/releases/download/v2.67.1/supabase_linux_amd64.deb 2>&1 | grep -v "404" || true
        if [ -f /tmp/supabase.deb ] && [ -s /tmp/supabase.deb ]; then
            sudo dpkg -i /tmp/supabase.deb || sudo apt-get install -f -y
            rm /tmp/supabase.deb
            if command -v supabase &> /dev/null; then
                INSTALLED=1
                echo "   ✅ Installed from downloaded .deb file"
            fi
        fi
    fi
    
    # Method 3: Try using npm (if available)
    if [ $INSTALLED -eq 0 ] && command -v npm &> /dev/null; then
        echo "   Trying npm installation method..."
        sudo npm install -g supabase
        if command -v supabase &> /dev/null; then
            INSTALLED=1
            echo "   ✅ Installed via npm"
        fi
    fi
    
    # Method 4: Manual binary download
    if [ $INSTALLED -eq 0 ]; then
        echo "   Trying binary download method..."
        wget -O /tmp/supabase.tar.gz https://github.com/supabase/cli/releases/download/v2.67.1/supabase_2.67.1_linux_amd64.tar.gz 2>&1 | grep -v "404" || true
        if [ -f /tmp/supabase.tar.gz ] && [ -s /tmp/supabase.tar.gz ]; then
            tar -xzf /tmp/supabase.tar.gz -C /tmp/
            sudo mv /tmp/supabase /usr/local/bin/supabase
            sudo chmod +x /usr/local/bin/supabase
            rm /tmp/supabase.tar.gz
            if command -v supabase &> /dev/null; then
                INSTALLED=1
                echo "   ✅ Installed from binary"
            fi
        fi
    fi
    
    if [ $INSTALLED -eq 0 ]; then
        echo "   ⚠️  Could not install Supabase CLI automatically"
        echo "   Please install manually: https://supabase.com/docs/guides/cli/getting-started"
        exit 1
    fi
    
    echo "   ✅ Supabase CLI installed: $(supabase --version)"
else
    echo "   ✅ Supabase CLI already installed: $(supabase --version)"
fi

# Step 3: Create project directory
echo ""
echo "📁 Step 3: Creating Supabase project directory..."
PROJECT_DIR="$HOME/talia-supabase"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

if [ ! -f "supabase/config.toml" ]; then
    echo "   Initializing Supabase project..."
    supabase init
    echo "   ✅ Supabase project initialized"
else
    echo "   ✅ Supabase project already exists"
fi

# Step 4: Configure for network access
echo ""
echo "⚙️  Step 4: Configuring Supabase for network access..."
CONFIG_FILE="supabase/config.toml"

# Backup original config
cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

# Update config for network access
cat > "$CONFIG_FILE" << 'EOF'
# A string used to distinguish different Supabase projects on the same host.
project_id = "talia-server"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
# Allow external connections
host = "0.0.0.0"
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://127.0.0.1:54321"

[inbucket]
enabled = true
port = 54324
smtp_port = 54325
pop3_port = 54326

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[analytics]
enabled = false
EOF

echo "   ✅ Configuration updated for network access"

# Step 5: Configure firewall
echo ""
echo "🔥 Step 5: Configuring firewall..."
if command -v ufw &> /dev/null; then
    echo "   Configuring UFW firewall rules..."
    sudo ufw allow 54321/tcp comment "Supabase API"
    sudo ufw allow 54322/tcp comment "Supabase Database"
    sudo ufw allow 54323/tcp comment "Supabase Studio"
    echo "   ✅ Firewall rules added"
else
    echo "   ⚠️  UFW not found. Please manually configure firewall to allow ports 54321-54323"
fi

# Step 6: Get IP address
echo ""
echo "🌐 Step 6: Network information..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "   MiniPC IP Address: $IP_ADDRESS"
echo "   Supabase API will be available at: http://$IP_ADDRESS:54321"
echo "   Supabase Studio will be available at: http://$IP_ADDRESS:54323"

# Step 7: Instructions for next steps
echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Copy migrations from laptop:"
echo "      From laptop: cd talia-server && tar -czf supabase-migrations.tar.gz supabase/migrations/"
echo "      Then: scp supabase-migrations.tar.gz zomarc@192.168.1.120:~/talia-supabase/"
echo ""
echo "   2. Copy database backup:"
echo "      From laptop: scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/"
echo ""
echo "   3. Start Supabase:"
echo "      cd ~/talia-supabase && supabase start"
echo ""
echo "   4. Extract migrations (if copied):"
echo "      cd ~/talia-supabase && tar -xzf ~/supabase-migrations.tar.gz"
echo ""
echo "   5. Restore database backup:"
echo "      sudo apt-get install -y postgresql-client"
echo "      gunzip ~/supabase_backup_20260113_193617.sql.gz"
echo "      psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" < ~/supabase_backup_20260113_193617.sql"
echo ""
echo "   6. Get Supabase keys:"
echo "      cd ~/talia-supabase && supabase status"
echo ""
