# Move Supabase Docker to MiniPC

## Simple Steps

### 1. Copy docker-compose file to miniPC

**On your laptop:**
```bash
scp simple-docker-compose.yml zomarc@192.168.1.120:~/talia-supabase-docker/docker-compose.yml
```

### 2. Create directory on miniPC

**On miniPC (SSH'd in):**
```bash
mkdir -p ~/talia-supabase-docker
cd ~/talia-supabase-docker
```

### 3. Copy docker-compose file (if not done above)

Or create it directly:
```bash
# Copy the simple-docker-compose.yml content
# Or use the setup script
```

### 4. Start containers

**On miniPC:**
```bash
cd ~/talia-supabase-docker
docker compose up -d
```

### 5. Copy and restore backup

**On your laptop:**
```bash
scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/ 
```

**On miniPC:**
```bash
gunzip ~/supabase_backup_20260113_193617.sql.gz
docker exec -i talia-postgres psql -U postgres -d postgres < ~/supabase_backup_20260113_193617.sql
```

### 6. Update local config

**On your laptop**, update `talia-server/.env`:

```bash
SUPABASE_URL=http://192.168.1.120:54322  # Direct PostgreSQL connection
# Or if using Supabase client:
# SUPABASE_URL=http://192.168.1.120:54321  # But you'd need the API gateway for this
```

Actually, since you're using direct PostgreSQL connection through your GraphQL server, just use:
```
# Database connection string
DATABASE_URL=postgresql://postgres:postgres@192.168.1.120:54322/postgres
```

### 7. Access

- **Studio**: http://192.168.1.120:54323
- **Database**: `postgresql://postgres:postgres@192.168.1.120:54322/postgres`

---

That's it! Just PostgreSQL + Studio, no Kong, no complexity.
