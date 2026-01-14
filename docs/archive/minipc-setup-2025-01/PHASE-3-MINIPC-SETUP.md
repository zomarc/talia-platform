# Phase 3: MiniPC Supabase Setup Guide

## Overview

This guide will help you set up Supabase on your miniPC (192.168.1.120) so the database runs on a separate server.

---

## Step 1: Copy Files to MiniPC

**On your laptop**, run:

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./copy-to-minipc.sh
```

This will copy:
- Setup script (`setup-minipc-supabase.sh`)
- Supabase migrations
- Latest database backup (`supabase_backup_20260113_193617.sql.gz`)

**Note**: You'll be prompted for your SSH password.

---

## Step 2: SSH to MiniPC

```bash
ssh zomarc@192.168.1.120
```

---

## Step 3: Run Setup Script on MiniPC

Once SSH'd into the miniPC:

```bash
# Make script executable
chmod +x ~/setup-minipc-supabase.sh

# Run the setup script
~/setup-minipc-supabase.sh
```

The script will:
1. ✅ Install Docker (if needed)
2. ✅ Install Supabase CLI (if needed)
3. ✅ Initialize Supabase project
4. ✅ Configure for network access
5. ✅ Set up firewall rules
6. ✅ Display network information

---

## Step 4: Extract Migrations

```bash
cd ~/talia-supabase
tar -xzf ~/supabase-migrations.tar.gz
```

This extracts the migrations into the Supabase project directory.

---

## Step 5: Start Supabase

```bash
cd ~/talia-supabase
supabase start
```

**Important**: Save the output! You'll need:
- API URL (will be `http://<miniPC-ip>:54321`)
- Publishable key (anon key)
- Secret key (service role key)

Example output:
```
API URL: http://192.168.1.120:54321
Publishable key: sb_publishable_...
Secret key: sb_secret_...
```

---

## Step 6: Install PostgreSQL Client (for restore)

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client
```

---

## Step 7: Restore Database Backup

```bash
# Extract the backup
gunzip ~/supabase_backup_20260113_193617.sql.gz

# Restore to Supabase
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < ~/supabase_backup_20260113_193617.sql
```

**Note**: This may take a few minutes depending on backup size (~35MB).

---

## Step 8: Verify Setup

### Check Supabase Status
```bash
cd ~/talia-supabase
supabase status
```

### Check Database Tables
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\dt"
```

You should see your tables listed.

### Access Supabase Studio
Open in browser: `http://192.168.1.120:54323`

---

## Step 9: Get Network Information

**On miniPC**, get the IP address:

```bash
hostname -I
```

This will show the IP address (should be `192.168.1.120`).

---

## Step 10: Test Connection from Laptop

**On your laptop**, test if you can reach Supabase:

```bash
# Test API endpoint
curl http://192.168.1.120:54321/rest/v1/

# Test Studio
curl http://192.168.1.120:54323
```

Both should return responses (not connection errors).

---

## Troubleshooting

### Cannot Connect from Laptop

1. **Check firewall on miniPC:**
   ```bash
   sudo ufw status
   ```
   Should show ports 54321, 54322, 54323 as allowed.

2. **Check Supabase is running:**
   ```bash
   cd ~/talia-supabase
   supabase status
   ```

3. **Check network connectivity:**
   ```bash
   # On laptop
   ping 192.168.1.120
   ```

### Supabase Won't Start

1. **Check Docker is running:**
   ```bash
   sudo systemctl status docker
   ```

2. **Check Docker permissions:**
   ```bash
   # If permission denied, add user to docker group
   sudo usermod -aG docker $USER
   # Then log out and back in
   ```

3. **Check ports are available:**
   ```bash
   sudo netstat -tulpn | grep -E '54321|54322|54323'
   ```

### Database Restore Fails

1. **Check backup file exists:**
   ```bash
   ls -lh ~/supabase_backup_*.sql
   ```

2. **Check Supabase is running:**
   ```bash
   supabase status
   ```

3. **Try restoring with verbose output:**
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 < ~/supabase_backup_20260113_193617.sql
   ```

---

## Next Steps

Once Supabase is running on miniPC:

1. ✅ **Note the Supabase keys** from `supabase status` output
2. ✅ **Note the IP address** (192.168.1.120)
3. ✅ **Proceed to Phase 4**: Update local config to use remote Supabase

See `JANUARY-MIGRATION-GUIDE.md` Phase 4 for details.

---

## Quick Reference

### MiniPC IP Address
- **IP**: 192.168.1.120
- **User**: zomarc

### Supabase Ports
- **API**: 54321
- **Database**: 54322
- **Studio**: 54323

### Important Files
- **Setup Script**: `~/setup-minipc-supabase.sh`
- **Project Directory**: `~/talia-supabase`
- **Backup File**: `~/supabase_backup_20260113_193617.sql.gz`

---

**Status**: Ready to begin  
**Estimated Time**: 45 minutes
