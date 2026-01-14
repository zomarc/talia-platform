# Quick Fix for Supabase CLI Installation on MiniPC

## You're Already SSH'd In - Run These Commands:

### Option 1: Install from Existing .deb File

```bash
# Check if the .deb file exists and has content
ls -lh ~/supabase.deb

# If it exists and has size > 0, install it:
sudo dpkg -i ~/supabase.deb || sudo apt-get install -f -y

# Verify installation
supabase --version
```

### Option 2: Try Binary Installation (More Reliable)

```bash
# Download the binary directly
cd /tmp
wget https://github.com/supabase/cli/releases/download/v2.67.1/supabase_2.67.1_linux_amd64.tar.gz

# Extract and install
tar -xzf supabase_2.67.1_linux_amd64.tar.gz
sudo mv supabase /usr/local/bin/
sudo chmod +x /usr/local/bin/supabase

# Verify
supabase --version
```

### Option 3: Use npm (if Node.js is installed)

```bash
# Check if npm is available
npm --version

# If yes, install via npm
sudo npm install -g supabase

# Verify
supabase --version
```

### Option 4: Manual Download Latest Version

```bash
# Get the latest release URL from GitHub API
LATEST_URL=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest | grep "browser_download_url.*linux_amd64" | grep -E "(deb|tar.gz)" | head -1 | cut -d '"' -f 4)

# Download it
wget -O /tmp/supabase-install $LATEST_URL

# Install based on file type
if [[ $LATEST_URL == *.deb ]]; then
    sudo dpkg -i /tmp/supabase-install || sudo apt-get install -f -y
elif [[ $LATEST_URL == *.tar.gz ]]; then
    tar -xzf /tmp/supabase-install -C /tmp/
    sudo mv /tmp/supabase /usr/local/bin/
    sudo chmod +x /usr/local/bin/supabase
fi

# Verify
supabase --version
```

## Once Supabase CLI is Installed:

Continue with the setup script:

```bash
# Copy the updated script (from your laptop terminal):
# scp setup-minipc-supabase.sh zomarc@192.168.1.120:~/

# Then run it:
chmod +x ~/setup-minipc-supabase.sh
~/setup-minipc-supabase.sh
```

Or continue manually:

```bash
# Step 3: Initialize Supabase project
mkdir -p ~/talia-supabase
cd ~/talia-supabase
supabase init

# Step 4: Configure for network access
# (The script will do this, or you can edit supabase/config.toml manually)
# Change [db] host = "0.0.0.0"

# Step 5: Start Supabase
supabase start

# Save the output keys!
```
