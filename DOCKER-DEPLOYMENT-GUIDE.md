# Docker Deployment Guide - Talia Stack to MiniPC

## Overview

This guide covers deploying the complete Talia stack (Supabase + GraphQL server) to the miniPC server using Docker Compose.

## Prerequisites

- ✅ Docker installed on miniPC
- ✅ SSH access to miniPC (192.168.1.120)
- ✅ Database backup created (`supabase_backup_20260113_193617.sql.gz`)

## Step 1: Copy Files to MiniPC

**On your laptop:**

```bash
cd /path/to/talia
./copy-to-minipc-docker.sh
```

This script copies:
- `docker-compose.talia.yml` → `docker-compose.yml`
- `supabase/kong.yml` → `kong.yml`
- `talia-server/` directory (source code, Dockerfile)
- Database backup

## Step 2: Set Up on MiniPC

**SSH to miniPC:**

```bash
ssh zomarc@192.168.1.120
```

**On miniPC:**

```bash
cd ~/talia-docker

# Extract talia-server
tar -xzf talia-server.tar.gz

# Extract talia-ui
tar -xzf talia-ui.tar.gz

# Create supabase directory and move kong.yml
mkdir -p supabase
mv kong.yml supabase/

# Verify structure
ls -la
# Should see: docker-compose.yml, talia-server/, talia-ui/, supabase/, supabase_backup_*.sql.gz
```

## Step 3: Configure Environment (Optional)

If you need to customize environment variables, create `.env` file:

```bash
cd ~/talia-docker
cat > .env << EOF
AZURE_SYNAPSE_SERVER=your-synapse.sql.azuresynapse.net
AZURE_SYNAPSE_PORT=1433
AZURE_SYNAPSE_DATABASE=CDP_Dedicated_SQL_DWH
AZURE_SYNAPSE_USERNAME=RBryer
AZURE_SYNAPSE_PASSWORD=Cele5tyalrbUser!
DATA_SOURCE_PRIORITY=supabase
EOF
```

## Step 4: Start Docker Stack

```bash
cd ~/talia-docker

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

Wait for all services to be healthy (may take 1-2 minutes).

## Step 5: Restore Database

```bash
cd ~/talia-docker

# Extract backup
gunzip supabase_backup_20260113_193617.sql.gz

# Restore to database
docker exec -i talia-supabase-db psql -U postgres -d postgres < supabase_backup_20260113_193617.sql
```

**Note**: This may take a few minutes depending on backup size (~34MB).

## Step 6: Configure Firewall

**On miniPC:**

```bash
sudo ufw allow 4000/tcp comment "GraphQL"
sudo ufw allow 4001/tcp comment "SSE"
sudo ufw allow 5173/tcp comment "UI"
sudo ufw allow 54321/tcp comment "Supabase API"
sudo ufw allow 54322/tcp comment "PostgreSQL"
sudo ufw allow 54323/tcp comment "Supabase Studio"
```

## Step 7: Verify Deployment

**On miniPC:**

```bash
# Check all containers are running
docker compose ps

# Test GraphQL endpoint
curl http://localhost:4000/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'

# Test database connection
docker exec -it talia-supabase-db psql -U postgres -d postgres -c "\dt"
```

**From your laptop:**

```bash
# Test GraphQL
curl http://192.168.1.120:4000/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'

# Test Supabase API
curl http://192.168.1.120:54321/rest/v1/
```

## Step 8: Update Local Configuration

**On your laptop**, update environment files:

**talia-server/.env:**
```bash
SUPABASE_URL=http://192.168.1.120:54321
SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

**talia-ui/.env:**
```bash
VITE_SUPABASE_URL=http://192.168.1.120:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
VITE_GRAPHQL_ENDPOINT=http://192.168.1.120:4000/graphql
```

## Service URLs

Once deployed, services are available at:

- **UI**: http://192.168.1.120:5173
- **GraphQL**: http://192.168.1.120:4000/graphql
- **SSE Stream**: http://192.168.1.120:4001/api/sync/stream/:tableName
- **Supabase API**: http://192.168.1.120:54321
- **Supabase Studio**: http://192.168.1.120:54323
- **PostgreSQL**: postgresql://postgres:postgres@192.168.1.120:54322/postgres

## Docker Commands Reference

### Start Services
```bash
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
docker compose logs -f graphql-server
docker compose logs -f supabase-db
```

### Restart Services
```bash
docker compose restart
```

### Rebuild GraphQL Server
```bash
docker compose build graphql-server
docker compose up -d graphql-server
```

### Access Database Shell
```bash
docker exec -it talia-supabase-db psql -U postgres -d postgres
```

### Backup Database
```bash
docker exec talia-supabase-db pg_dump -U postgres postgres | gzip > ~/supabase_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

## Troubleshooting

### Containers Won't Start

```bash
# Check Docker is running
sudo systemctl status docker

# Check logs
docker compose logs

# Check port conflicts
sudo netstat -tulpn | grep -E '4000|4001|54321|54322|54323'
```

### GraphQL Server Can't Connect to Supabase

1. Check Supabase containers are running:
   ```bash
   docker compose ps supabase-kong supabase-db
   ```

2. Check GraphQL server logs:
   ```bash
   docker compose logs graphql-server
   ```

3. Verify network connectivity:
   ```bash
   docker exec talia-graphql-server ping -c 2 supabase-kong
   ```

### Database Restore Fails

1. Check backup file exists:
   ```bash
   ls -lh ~/talia-docker/supabase_backup_*.sql
   ```

2. Check database is ready:
   ```bash
   docker exec talia-supabase-db pg_isready -U postgres
   ```

3. Try restoring with verbose output:
   ```bash
   docker exec -i talia-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase_backup_20260113_193617.sql
   ```

### Cannot Connect from Laptop

1. Check firewall:
   ```bash
   sudo ufw status
   ```

2. Check containers are running:
   ```bash
   docker compose ps
   ```

3. Test from miniPC itself:
   ```bash
   curl http://localhost:4000/graphql
   ```

## Set Up as System Service (Optional)

To make the stack start automatically on boot:

**On miniPC:**

```bash
sudo nano /etc/systemd/system/talia-docker.service
```

Add:

```ini
[Unit]
Description=Talia Docker Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/zomarc/talia-docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=zomarc
Group=docker

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable talia-docker
sudo systemctl start talia-docker
sudo systemctl status talia-docker
```

## Next Steps

After successful deployment:

1. ✅ Update local `.env` files to point to miniPC
2. ✅ Test UI connectivity
3. ✅ Set up ngrok for external client access (Phase 5)
4. ✅ Monitor logs and performance

---

**Status**: Ready to deploy  
**Estimated Time**: 30-45 minutes
