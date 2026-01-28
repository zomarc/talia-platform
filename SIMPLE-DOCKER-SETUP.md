# Simple Docker Supabase Setup

## Overview

Just move your existing Supabase Docker setup to the miniPC. No Kong, no complexity - just PostgreSQL and Studio.

---

## Step 1: Copy Setup Script

**On your laptop:**

```bash
cd /path/to/talia
scp setup-simple-docker-supabase.sh zomarc@192.168.1.120:~/
```

---

## Step 2: Run Setup on MiniPC

**On miniPC (SSH'd in):**

```bash
chmod +x ~/setup-simple-docker-supabase.sh
~/setup-simple-docker-supabase.sh
```

This creates:
- `~/talia-supabase-docker/docker-compose.yml`
- Sets up firewall rules

---

## Step 3: Start Containers

**On miniPC:**

```bash
cd ~/talia-supabase-docker
docker compose up -d
```

Wait for containers to be healthy:
```bash
docker compose ps
```

---

## Step 4: Copy Backup and Restore

**On your laptop:**

```bash
scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/
```

**On miniPC:**

```bash
# Extract backup
gunzip ~/supabase_backup_20260113_193617.sql.gz

# Restore database
docker exec -i talia-postgres psql -U postgres -d postgres < ~/supabase_backup_20260113_193617.sql
```

---

## Step 5: Update Local Config

**On your laptop**, update `.env` files:

**talia-server/.env:**
```bash
SUPABASE_URL=http://192.168.1.120:54321
```

Wait - you need the REST API. Let me check what port Supabase uses...

Actually, for direct database access, you just need:
- Database: `postgresql://postgres:postgres@192.168.1.120:54322/postgres`

But your app uses Supabase client which needs the API endpoint. Let me add that...

---

## What You Get

- **PostgreSQL**: Port 54322
- **Studio**: Port 54323  
- **Database URL**: `postgresql://postgres:postgres@192.168.1.120:54322/postgres`

---

## Access

- **Studio**: http://192.168.1.120:54323
- **Database**: Direct connection on port 54322

---

That's it! Simple Docker setup, no Kong needed.
