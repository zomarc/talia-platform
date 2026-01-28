# January 2025 Migration Guide

## Overview

This guide covers the migration of Talia Platform from local development to a distributed setup with:
- **Local Laptop**: UI and GraphQL server (development)
- **MiniPC Server (locations.l)**: Supabase database instance (Docker)
- **External Access**: UI exposed via ngrok for client access

---

## Phase 1: Verify Current Local Setup

### Step 1.1: Check Prerequisites

```bash
# Verify Node.js version (should be >= 18.0.0)
node --version

# Verify npm version (should be >= 8.0.0)
npm --version

# Check if Supabase CLI is installed
supabase --version

# If not installed, install it:
# macOS: brew install supabase/tap/supabase
# Ubuntu: See https://supabase.com/docs/guides/cli/getting-started
```

### Step 1.2: Start Local Supabase Instance

```bash
# Navigate to talia-server directory
cd talia-server

# Check Supabase status
supabase status

# If not running, start Supabase
supabase start

# Note the output - you'll need:
# - API URL (usually http://127.0.0.1:54321)
# - anon key
# - service_role key
```

**Important**: Save the Supabase keys from the output. You'll need them for configuration.

### Step 1.3: Configure Environment Variables

```bash
# Copy example environment files if they don't exist
cd talia-server
cp env.example .env

# Edit .env file with your Supabase keys from Step 1.2
# Update SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

For `talia-ui`:

```bash
cd talia-ui
# Check if .env exists, if not create it
cat > .env << EOF
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-status>
VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
EOF
```

### Step 1.4: Install Dependencies

```bash
# From project root
npm run install:all

# Or individually:
cd talia-server && npm install
cd ../talia-ui && npm install
```

### Step 1.5: Verify Database Connection

```bash
cd talia-server

# Test Supabase connection
npm run sync-test

# Check sync status
npm run sync-status
```

### Step 1.6: Start Development Servers

**Terminal 1 - Backend:**
```bash
cd talia-server
npm start
# Should start on http://localhost:4000
```

**Terminal 2 - Frontend:**
```bash
cd talia-ui
npm run dev
# Should start on http://localhost:5173
```

### Step 1.7: Verify Everything Works

1. Open browser: http://localhost:5173
2. Check GraphQL Playground: http://localhost:4000
3. Verify UI can connect to backend
4. Test a simple query in the UI

**✅ Phase 1 Complete**: You now have a working local instance.

---

## Phase 2: Prepare Database Migration to MiniPC

### Step 2.1: Create Database Backup

**⚠️ CRITICAL**: Always backup before migration!

```bash
cd talia-server

# Create backup using npm script
npm run db-backup

# Or manually:
./scripts/backup-db.sh

# Backup will be saved to: talia-server/backups/supabase_backup_YYYYMMDD_HHMMSS.sql.gz
```

**Note the backup filename** - you'll need it for restoration.

### Step 2.2: Verify Backup File

```bash
# List backups
ls -lh talia-server/backups/

# Verify backup file exists and has reasonable size
# Should be several MB or larger depending on data
```

### Step 2.3: Document Current Supabase Configuration

```bash
cd talia-server

# Get current Supabase status and save to file
supabase status > supabase-current-config.txt

# Also note:
# - Database port (usually 54322)
# - API port (usually 54321)
# - Studio port (usually 54323)
# - All keys (anon, service_role)
```

---

## Phase 3: Set Up Supabase on MiniPC Server

### Step 3.1: Prepare MiniPC Server (locations.l)

**SSH into your miniPC:**
```bash
ssh <user>@locations.l
# Or use the IP address if you know it
```

### Step 3.2: Install Docker on MiniPC (if not already installed)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (optional, avoids sudo)
sudo usermod -aG docker $USER
# Log out and back in for this to take effect
```

### Step 3.3: Install Supabase CLI on MiniPC

```bash
# Ubuntu/Debian
# Download and install Supabase CLI
wget -O supabase.deb https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
sudo dpkg -i supabase.deb

# Or using package manager
# See: https://supabase.com/docs/guides/cli/getting-started
```

### Step 3.4: Create Supabase Project Directory on MiniPC

```bash
# On miniPC
mkdir -p ~/talia-supabase
cd ~/talia-supabase

# Initialize Supabase project
supabase init
```

### Step 3.5: Configure Supabase for Network Access

Edit `~/talia-supabase/supabase/config.toml`:

```toml
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
# Allow external connections
host = "0.0.0.0"  # Change from 127.0.0.1 to allow network access

[studio]
enabled = true
port = 54323
```

### Step 3.6: Copy Migrations to MiniPC

**From your laptop:**
```bash
# Create a tarball of migrations
cd talia-server
tar -czf supabase-migrations.tar.gz supabase/migrations/

# Copy to miniPC (adjust user@host as needed)
scp supabase-migrations.tar.gz <user>@locations.l:~/talia-supabase/
```

**On miniPC:**
```bash
cd ~/talia-supabase
tar -xzf supabase-migrations.tar.gz
```

### Step 3.7: Start Supabase on MiniPC

```bash
cd ~/talia-supabase

# Start Supabase
supabase start

# Note the output - you'll get new keys:
# - API URL: http://<miniPC-ip>:54321
# - anon key
# - service_role key
```

### Step 3.8: Restore Database Backup on MiniPC

**From your laptop, copy backup to miniPC:**
```bash
# Find your latest backup
ls -lt talia-server/backups/ | head -2

# Copy to miniPC (replace with actual filename)
scp talia-server/backups/supabase_backup_YYYYMMDD_HHMMSS.sql.gz <user>@locations.l:~/
```

**On miniPC:**
```bash
# Install PostgreSQL client if needed
sudo apt-get install -y postgresql-client

# Extract backup
gunzip supabase_backup_YYYYMMDD_HHMMSS.sql.gz

# Restore to Supabase
# Get connection string from: supabase status
# Format: postgresql://postgres:postgres@127.0.0.1:54322/postgres
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase_backup_YYYYMMDD_HHMMSS.sql

# Or use Supabase CLI restore (if available)
# supabase db restore supabase_backup_YYYYMMDD_HHMMSS.sql
```

### Step 3.9: Verify Database on MiniPC

```bash
# On miniPC
cd ~/talia-supabase

# Check Supabase status
supabase status

# Access Supabase Studio
# http://<miniPC-ip>:54323
# Verify tables and data are present
```

### Step 3.10: Configure Network Access (Firewall)

**On miniPC, allow Supabase ports:**
```bash
# Ubuntu UFW
sudo ufw allow 54321/tcp  # API
sudo ufw allow 54322/tcp  # Database
sudo ufw allow 54323/tcp  # Studio

# Or iptables
sudo iptables -A INPUT -p tcp --dport 54321 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 54322 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 54323 -j ACCEPT
```

**Find miniPC IP address:**
```bash
# On miniPC
hostname -I
# Or
ip addr show
```

---

## Phase 4: Update Local Configuration to Use Remote Supabase

### Step 4.1: Update talia-server/.env

**On your laptop:**
```bash
cd talia-server

# Edit .env file
# Replace SUPABASE_URL with miniPC address
# SUPABASE_URL=http://<miniPC-ip>:54321
# Update keys with new keys from miniPC Supabase instance
```

Example:
```bash
SUPABASE_URL=http://192.168.1.100:54321
SUPABASE_ANON_KEY=<new-anon-key-from-miniPC>
SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key-from-miniPC>
```

### Step 4.2: Update talia-ui/.env

```bash
cd talia-ui

# Edit .env file
VITE_SUPABASE_URL=http://<miniPC-ip>:54321
VITE_SUPABASE_ANON_KEY=<new-anon-key-from-miniPC>
```

### Step 4.3: Test Connection to Remote Supabase

```bash
cd talia-server

# Test connection
npm run sync-test

# Should connect to miniPC Supabase instance
```

### Step 4.4: Restart Development Servers

**Terminal 1 - Backend:**
```bash
cd talia-server
# Stop current instance (Ctrl+C)
npm start
```

**Terminal 2 - Frontend:**
```bash
cd talia-ui
# Stop current instance (Ctrl+C)
npm run dev
```

### Step 4.5: Verify Everything Still Works

1. Open browser: http://localhost:5173
2. Verify UI connects to remote Supabase
3. Test data queries
4. Check GraphQL Playground: http://localhost:4000

**✅ Phase 4 Complete**: Local instances now use remote Supabase on miniPC.

---

## Phase 5: Expose UI for External Client Access

### Step 5.1: Install and Configure ngrok

**On your laptop:**

```bash
# Install ngrok (if not already installed)
# macOS: brew install ngrok/ngrok/ngrok
# Or download from: https://ngrok.com/download

# Authenticate ngrok
ngrok config add-authtoken <your-ngrok-token>
# Get token from: https://dashboard.ngrok.com/get-started/your-authtoken
```

### Step 5.2: Configure ngrok for Custom Domain (Optional)

**If you have a custom domain:**

1. Go to [ngrok Dashboard](https://dashboard.ngrok.com/cloud-edge/domains)
2. Add your domain (e.g., `taliahub.com`)
3. Configure DNS as instructed
4. Wait for DNS propagation

### Step 5.3: Create ngrok Configuration

```bash
cd /path/to/talia

# Copy example config
cp ngrok.yml.example ngrok.yml

# Edit ngrok.yml with your settings
# - Domain (if using custom domain)
# - Basic auth credentials (username:password)
```

Example `ngrok.yml`:
```yaml
version: "3"

tunnels:
  talia:
    proto: http
    addr: 5173
    domain: taliahub.com  # Or remove for free ngrok URL
    basic_auth:
      - "client:secure-password-here"
```

**⚠️ IMPORTANT**: Never commit `ngrok.yml` with real credentials!

### Step 5.4: Start ngrok Tunnel

**Terminal 3 - ngrok:**
```bash
cd /path/to/talia

# Start ngrok with config file
ngrok start --config ngrok.yml talia

# Or without config file (free tier):
ngrok http 5173
```

**Note the public URL** - this is what you'll share with your client.

### Step 5.5: Verify External Access

1. **Check ngrok dashboard**: http://localhost:4040
2. **Test from external network**: Use the ngrok URL from a different network/device
3. **Verify API works**: UI should be able to make GraphQL requests
4. **Check authentication**: Basic auth should prompt for credentials

### Step 5.6: Share Access with Client

Provide your client with:
- **URL**: The ngrok URL (e.g., `https://taliahub.com` or `https://abc123.ngrok-free.app`)
- **Credentials**: Username and password from `ngrok.yml` basic_auth

**✅ Phase 5 Complete**: UI is now accessible to external clients.

---

## Phase 6: Ongoing Operations

### Daily Startup Sequence

**On your laptop:**

1. **Start Supabase on miniPC** (if not running as service):
   ```bash
   ssh <user>@locations.l
   cd ~/talia-supabase
   supabase start
   ```

2. **Start Backend**:
   ```bash
   cd talia-server
   npm start
   ```

3. **Start Frontend**:
   ```bash
   cd talia-ui
   npm run dev
   ```

4. **Start ngrok** (when client needs access):
   ```bash
   ngrok start --config ngrok.yml talia
   ```

### Make Supabase Run as Service (Optional)

**On miniPC, create systemd service:**

```bash
# Create service file
sudo nano /etc/systemd/system/talia-supabase.service
```

Content:
```ini
[Unit]
Description=Talia Supabase Instance
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=<your-username>
WorkingDirectory=/home/<your-username>/talia-supabase
ExecStart=/usr/local/bin/supabase start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable talia-supabase
sudo systemctl start talia-supabase
sudo systemctl status talia-supabase
```

### Monitoring

**Check Supabase status on miniPC:**
```bash
ssh <user>@locations.l
cd ~/talia-supabase
supabase status
```

**Check ngrok status:**
- Dashboard: http://localhost:4040
- Or check terminal output

---

## Troubleshooting

### Cannot Connect to Remote Supabase

1. **Check miniPC is accessible:**
   ```bash
   ping <miniPC-ip>
   ```

2. **Check Supabase is running:**
   ```bash
   ssh <user>@locations.l
   cd ~/talia-supabase
   supabase status
   ```

3. **Check firewall:**
   ```bash
   # On miniPC
   sudo ufw status
   ```

4. **Check network connectivity:**
   ```bash
   # From laptop, test connection
   curl http://<miniPC-ip>:54321
   ```

### UI Not Accessible via ngrok

1. **Check ngrok is running:**
   ```bash
   # Check ngrok dashboard
   open http://localhost:4040
   ```

2. **Check frontend is running:**
   ```bash
   curl http://localhost:5173
   ```

3. **Check ngrok config:**
   ```bash
   ngrok config check
   ```

4. **Verify domain DNS** (if using custom domain):
   ```bash
   dig taliahub.com
   ```

### Database Migration Issues

1. **Backup failed:**
   - Ensure Supabase is running
   - Check PostgreSQL client tools are installed
   - Verify disk space

2. **Restore failed:**
   - Check backup file integrity
   - Verify Supabase is running on miniPC
   - Check database permissions

3. **Data missing after migration:**
   - Verify backup file size
   - Check restore logs
   - Re-run restore if needed

---

## Quick Reference

### Key URLs

- **Local UI**: http://localhost:5173
- **Local GraphQL**: http://localhost:4000
- **Local Supabase Studio**: http://127.0.0.1:54323 (before migration)
- **Remote Supabase Studio**: http://<miniPC-ip>:54323 (after migration)
- **ngrok Dashboard**: http://localhost:4040
- **External UI**: https://taliahub.com (or ngrok URL)

### Key Commands

```bash
# Start everything locally
cd talia-server && npm start &
cd talia-ui && npm run dev &
ngrok start --config ngrok.yml talia

# Database backup
cd talia-server && npm run db-backup

# Database restore
cd talia-server && npm run db-restore backups/filename.sql.gz

# Check Supabase status (local)
cd talia-server && supabase status

# Check Supabase status (remote)
ssh <user>@locations.l "cd ~/talia-supabase && supabase status"

# Test connections
cd talia-server && npm run sync-test
```

---

## Next Steps After Migration

1. **Set up automated backups** on miniPC
2. **Configure Supabase as a service** for auto-start
3. **Set up monitoring** for database and services
4. **Document client access procedures**
5. **Plan for production deployment**

---

## Important Notes

⚠️ **CRITICAL WARNINGS**:

1. **NEVER run `supabase db reset`** - This deletes all data
2. **Always backup before major changes**
3. **Never commit `ngrok.yml`** with real credentials
4. **Stop ngrok when not needed** for security
5. **Keep Supabase keys secure** - Don't commit to git

---

## Support

For issues or questions:
- Check logs: `talia-server` and `talia-ui` console output
- Check ngrok dashboard: http://localhost:4040
- Review Supabase logs: `supabase logs` (on miniPC)
- Check this guide's troubleshooting section

---

**Last Updated**: January 2025
**Version**: 1.0
