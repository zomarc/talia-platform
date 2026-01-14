# Development Workflow Guide

## Overview

This guide covers the daily development workflow for working with the Talia Platform across local and staging environments.

## Environments

### Local (Development)
- **Location**: Your laptop
- **Access**: http://localhost:5173 (UI), http://localhost:4000 (GraphQL)
- **Database**: Local Supabase (Docker)
- **Purpose**: Development and testing

### Staging (Client Demo)
- **Location**: MiniPC (192.168.1.120)
- **Access**: https://taliahub.com (via ngrok)
- **Database**: Staging Supabase (Docker on MiniPC)
- **Purpose**: Client demos and staging testing

## Daily Development Workflow

### 1. Start Local Development

```bash
# Terminal 1: Start GraphQL server
cd talia-server
npm start

# Terminal 2: Start UI
cd talia-ui
npm run dev

# Access at http://localhost:5173
```

### 2. Make Changes

- Edit code in `talia-ui/src/` or `talia-server/src/`
- Test locally
- Commit changes:
  ```bash
  git add .
  git commit -m "feat: your feature description"
  ```

### 3. Deploy to Staging

#### Quick Deploy (Code Only)

For code changes that don't require Docker rebuild:

```bash
./scripts/deploy-to-staging.sh --code-only
```

This will:
1. Check for uncommitted changes (prompts to commit)
2. Push code to git
3. SSH to staging and pull latest
4. Restart services

#### Full Deploy (Code + Docker)

For changes requiring Docker image rebuild:

```bash
# Deploy code
./scripts/deploy-to-staging.sh --code-only

# Deploy Docker images
./scripts/deploy-to-staging-docker.sh
```

Or use the full deployment:

```bash
./scripts/deploy-to-staging.sh --full
```

### 4. Verify Deployment

```bash
# Check staging is accessible
curl -u talia:dev2025tal https://taliahub.com

# Or visit in browser: https://taliahub.com
```

## Deployment Scripts

### `scripts/deploy-to-staging.sh`

Main deployment script for code updates.

**Usage**:
```bash
# Code-only deployment (default)
./scripts/deploy-to-staging.sh
./scripts/deploy-to-staging.sh --code-only

# Full deployment (code + Docker)
./scripts/deploy-to-staging.sh --full

# Dry run (preview without deploying)
./scripts/deploy-to-staging.sh --dry-run
```

**What it does**:
- Checks git status
- Prompts to commit uncommitted changes
- Pushes to git
- SSHs to staging and pulls latest code
- Restarts services (or rebuilds if `--full`)

### `scripts/deploy-to-staging-docker.sh`

Docker image deployment script.

**Usage**:
```bash
./scripts/deploy-to-staging-docker.sh
```

**What it does**:
- Builds Docker images locally
- Saves images to tar files
- Copies to staging server
- Loads images on staging
- Restarts containers

## Manual Deployment Steps

If you need to deploy manually:

### Code-Only Update

```bash
# 1. On local - Commit and push
git add .
git commit -m "feat: your changes"
git push

# 2. On staging - Pull and restart
ssh zomarc@192.168.1.120
cd ~/talia-docker
git pull
docker compose restart graphql-server ui
```

### Full Update (Code + Docker)

```bash
# 1. On local - Build images
cd talia-server && docker build -t talia-server:latest .
cd ../talia-ui && docker build -t talia-ui:latest .

# 2. Save and copy images
docker save talia-server:latest | gzip > /tmp/server.tar.gz
docker save talia-ui:latest | gzip > /tmp/ui.tar.gz
scp /tmp/*.tar.gz zomarc@192.168.1.120:/tmp/

# 3. On staging - Load and restart
ssh zomarc@192.168.1.120
cd ~/talia-docker
docker load < /tmp/server.tar.gz
docker load < /tmp/ui.tar.gz
docker compose up -d --force-recreate graphql-server ui
```

## Environment Configuration

### Local Environment

**File**: `.env.local`

Used for local development. Loaded automatically when running locally.

### Staging Environment

**File**: `.env.staging`

Used on staging server. Loaded by Docker Compose.

**Note**: Staging uses internal Docker network addresses for service communication.

## Common Tasks

### Check Service Status

**Local**:
```bash
# Check if services are running
curl http://localhost:4000/graphql
curl http://localhost:5173
```

**Staging**:
```bash
ssh zomarc@192.168.1.120
cd ~/talia-docker
docker compose ps
docker compose logs -f graphql-server
```

### View Logs

**Local**:
```bash
# GraphQL server logs
cd talia-server && npm start

# UI logs (in browser console)
```

**Staging**:
```bash
ssh zomarc@192.168.1.120
cd ~/talia-docker

# All services
docker compose logs -f

# Specific service
docker compose logs -f graphql-server
docker compose logs -f ui
```

### Restart Services

**Local**:
```bash
# Stop and restart manually
# Ctrl+C in terminals, then restart
```

**Staging**:
```bash
ssh zomarc@192.168.1.120
cd ~/talia-docker
docker compose restart graphql-server ui
```

### Database Access

**Local**:
- Supabase Studio: http://localhost:54323
- Direct: `psql` via Docker

**Staging**:
- Supabase Studio: http://192.168.1.120:54323
- Direct: `docker exec -it talia-supabase-db psql -U postgres`

## Troubleshooting

### Deployment Fails

1. Check git status: `git status`
2. Check SSH access: `ssh zomarc@192.168.1.120`
3. Check staging services: `ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose ps'`
4. View logs: `ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose logs'`

### Services Not Starting

1. Check Docker: `docker ps`
2. Check logs: `docker compose logs`
3. Check ports: `netstat -tuln | grep -E '4000|5173|54321'`
4. Restart: `docker compose restart`

### Code Changes Not Appearing

1. Verify deployment completed successfully
2. Check if services restarted: `docker compose ps`
3. Hard refresh browser (Ctrl+Shift+R)
4. Check browser console for errors

## Best Practices

1. **Always test locally first** - Verify changes work before deploying
2. **Commit frequently** - Small, focused commits are easier to debug
3. **Use descriptive commit messages** - Helps track what changed
4. **Check staging after deployment** - Verify changes work in staging
5. **Keep environments in sync** - Database schema should match

## Quick Reference

### Deploy Code Changes
```bash
./scripts/deploy-to-staging.sh --code-only
```

### Deploy Docker Images
```bash
./scripts/deploy-to-staging-docker.sh
```

### Check Staging Status
```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose ps'
```

### View Staging Logs
```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose logs -f'
```

---

**Ready for Development** ✅
