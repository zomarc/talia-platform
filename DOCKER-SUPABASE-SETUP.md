# Docker-Based Supabase Setup for MiniPC

## Overview

This guide sets up Supabase as Docker containers on your miniPC (192.168.1.120). This is more reliable and easier to manage than using the Supabase CLI.

---

## Step 1: Copy Setup Script to MiniPC

**On your laptop:**

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
scp setup-docker-supabase.sh zomarc@192.168.1.120:~/
```

---

## Step 2: SSH to MiniPC and Run Setup

```bash
ssh zomarc@192.168.1.120
```

**On miniPC:**

```bash
chmod +x ~/setup-docker-supabase.sh
~/setup-docker-supabase.sh
```

This will:
- ✅ Verify Docker is running
- ✅ Create project directory (`~/talia-supabase-docker`)
- ✅ Create docker-compose.yml
- ✅ Create Kong configuration
- ✅ Configure firewall
- ✅ Pull Docker images

---

## Step 3: Copy Migrations and Backup

**On your laptop:**

```bash
# Copy migrations
scp -r talia-server/supabase/migrations zomarc@192.168.1.120:~/talia-supabase-docker/supabase/

# Copy latest backup
scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/
```

---

## Step 4: Start Supabase Containers

**On miniPC:**

```bash
cd ~/talia-supabase-docker
docker compose up -d
```

This starts all Supabase services in detached mode.

---

## Step 5: Check Service Status

```bash
# Check all containers are running
docker compose ps

# Check logs if needed
docker compose logs -f
```

Wait until all services show as "healthy" (may take 1-2 minutes).

---

## Step 6: Apply Migrations (Optional)

If you copied migrations, apply them:

```bash
cd ~/talia-supabase-docker

# List migrations
ls -la supabase/migrations/

# Apply each migration (example)
docker exec -i talia-supabase-db psql -U postgres -d postgres < supabase/migrations/20251023004146_create_business_tables.sql

# Or apply all migrations in order
for migration in supabase/migrations/*.sql; do
    echo "Applying $migration..."
    docker exec -i talia-supabase-db psql -U postgres -d postgres < "$migration"
done
```

---

## Step 7: Restore Database Backup

```bash
# Extract backup
gunzip ~/supabase_backup_20260113_193617.sql.gz

# Restore to database
docker exec -i talia-supabase-db psql -U postgres -d postgres < ~/supabase_backup_20260113_193617.sql
```

**Note**: This may take a few minutes depending on backup size (~35MB).

---

## Step 8: Verify Setup

### Check Containers
```bash
docker compose ps
```

All services should be "Up" and "healthy".

### Test API Endpoint
```bash
curl http://192.168.1.120:54321/rest/v1/
```

Should return a response (not connection error).

### Access Supabase Studio
Open in browser: `http://192.168.1.120:54323`

### Check Database Tables
```bash
docker exec -it talia-supabase-db psql -U postgres -d postgres -c "\dt"
```

---

## Service URLs

Once running, Supabase will be available at:

- **API URL**: `http://192.168.1.120:54321`
- **Studio**: `http://192.168.1.120:54323`
- **Database**: `postgresql://postgres:postgres@192.168.1.120:54322/postgres`

### Supabase Keys

- **Publishable Key**: `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`
- **Secret Key**: `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`

---

## Docker Commands Reference

### Start Services
```bash
cd ~/talia-supabase-docker
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f supabase-db
```

### Restart Services
```bash
docker compose restart
```

### Check Status
```bash
docker compose ps
```

### Access Database Shell
```bash
docker exec -it talia-supabase-db psql -U postgres -d postgres
```

### Backup Database
```bash
docker exec talia-supabase-db pg_dump -U postgres postgres | gzip > ~/supabase_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database
```bash
gunzip backup_file.sql.gz
docker exec -i talia-supabase-db psql -U postgres -d postgres < backup_file.sql
```

---

## Set Up as System Service (Optional)

To make Supabase start automatically on boot:

**On miniPC:**

```bash
sudo nano /etc/systemd/system/talia-supabase.service
```

Add:

```ini
[Unit]
Description=Talia Supabase Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/zomarc/talia-supabase-docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=zomarc
Group=docker

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable talia-supabase
sudo systemctl start talia-supabase
sudo systemctl status talia-supabase
```

---

## Troubleshooting

### Containers Won't Start

```bash
# Check Docker is running
sudo systemctl status docker

# Check logs
docker compose logs

# Check port conflicts
sudo netstat -tulpn | grep -E '54321|54322|54323'
```

### Cannot Connect from Laptop

1. **Check firewall:**
   ```bash
   sudo ufw status
   ```

2. **Check containers are running:**
   ```bash
   docker compose ps
   ```

3. **Test from miniPC itself:**
   ```bash
   curl http://localhost:54321/rest/v1/
   ```

### Database Restore Fails

1. **Check backup file:**
   ```bash
   ls -lh ~/supabase_backup_*.sql
   ```

2. **Check database is ready:**
   ```bash
   docker exec talia-supabase-db pg_isready -U postgres
   ```

3. **Try restoring with verbose output:**
   ```bash
   docker exec -i talia-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < ~/supabase_backup_20260113_193617.sql
   ```

### Reset Everything

If you need to start fresh:

```bash
cd ~/talia-supabase-docker
docker compose down -v  # Removes volumes too!
docker compose up -d
```

**⚠️ Warning**: This deletes all data!

---

## Next Steps

Once Supabase is running on miniPC:

1. ✅ **Note the IP address**: 192.168.1.120
2. ✅ **Test connection from laptop**: `curl http://192.168.1.120:54321/rest/v1/`
3. ✅ **Proceed to Phase 4**: Update local config to use remote Supabase

See `JANUARY-MIGRATION-GUIDE.md` Phase 4 for details.

---

**Status**: Ready to deploy  
**Estimated Time**: 30 minutes
