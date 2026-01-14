# Fix MiniPC Setup

## Issue
The `talia-ui` directory wasn't extracted properly, causing the Docker build to fail.

## Solution

**On miniPC (SSH'd in):**

```bash
cd ~/talia-docker

# Check what's there
ls -la

# Extract talia-ui properly (ignore the macOS extended attributes warning)
tar -xzf talia-ui.tar.gz 2>&1 | grep -v "LIBARCHIVE" || true

# Verify talia-ui directory exists now
ls -la talia-ui/

# Should see: Dockerfile, nginx.conf, package.json, src/, etc.

# Also verify talia-server is extracted
ls -la | grep -E "talia-server|talia-ui"

# Now try starting again
docker compose up -d
```

## If talia-ui.tar.gz extraction still fails

**Option 1: Re-extract with verbose output**
```bash
cd ~/talia-docker
tar -xzvf talia-ui.tar.gz 2>&1 | tail -20
```

**Option 2: Extract to a temp location first**
```bash
cd ~/talia-docker
mkdir -p temp-ui
cd temp-ui
tar -xzf ../talia-ui.tar.gz
ls -la
# If files are here, move them up
mv * ../talia-ui/ 2>/dev/null || mkdir -p ../talia-ui && mv * ../talia-ui/
cd ..
rmdir temp-ui
```

## Verify Structure

After extraction, you should have:
```
~/talia-docker/
├── docker-compose.yml
├── talia-server/
│   ├── Dockerfile
│   ├── src/
│   ├── package.json
│   └── ...
├── talia-ui/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── src/
│   └── ...
├── supabase/
│   └── kong.yml
└── supabase_backup_20260113_193617.sql.gz
```

Then run: `docker compose up -d`
