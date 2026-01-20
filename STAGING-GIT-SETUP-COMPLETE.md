# Staging Git Repository Setup - Complete ✅

**Date**: January 20, 2025  
**Status**: ✅ Git repository configured and deployment working

## What Was Done

### 1. Git Repository Setup on Staging
- **Location**: `~/talia-docker` on staging server (192.168.1.120)
- **Method**: Fresh clone from GitHub
- **Remote**: `https://github.com/zomarc/talia-platform.git`
- **Branch**: `main`
- **Latest Commit**: `ee70813` - "feat: Fix App Mode with mock user system and dev role selector"

### 2. Container Rebuild
- ✅ UI container rebuilt with latest code
- ✅ Includes all App Mode changes (DevRoleSelector, mock user system)
- ✅ Service restarted and running

### 3. Deployment Script Updated
- Updated `scripts/deploy-to-staging.sh` to:
  - Use `git reset --hard origin/main` for clean pulls
  - Explicitly use `docker-compose.staging.yml`
  - Rebuild containers for full deployment

## Environment Architecture

### 1. **Local (Laptop)**
- **Path**: `/Users/russell/Work/AA-Celestyal/Dev/talia`
- **Purpose**: Development environment
- **Services**:
  - Supabase (Docker): `localhost:54321`
  - GraphQL server: `localhost:4000`
  - UI dev server: `localhost:5173`
- **Access**: Direct localhost

### 2. **Staging (MiniPC)**
- **Path**: `~/talia-docker` on `192.168.1.120`
- **Purpose**: Staging/pre-production
- **Services**: Full Docker stack (Supabase + GraphQL + UI)
- **Access**:
  - Internal: `http://192.168.1.120:5173`
  - SSH: `ssh zomarc@192.168.1.120`
- **Git**: ✅ Configured and synced with GitHub

### 3. **External (taliahub.com)**
- **URL**: `https://taliahub.com`
- **Purpose**: External client access
- **Connection**: ngrok tunnel from staging
- **Gateway Auth**: `talia` / `dev2025tal` (temporary)
- **Backend**: Directly connected to staging services

## Deployment Workflow

### Code-Only Deployment (Fast)
```bash
# From local laptop
./scripts/deploy-to-staging.sh --code-only
```

**What it does**:
1. Pushes code to GitHub
2. SSH to staging
3. Pulls latest code (`git reset --hard origin/main`)
4. Restarts services (uses existing Docker images)

### Full Deployment (Code + Docker)
```bash
# From local laptop
./scripts/deploy-to-staging.sh --full
```

**What it does**:
1. Pushes code to GitHub
2. SSH to staging
3. Pulls latest code
4. Rebuilds Docker containers (includes all code changes)
5. Restarts services

## Verification Commands

### Check Staging Git Status
```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && git status'
```

### Check Staging Services
```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose -f docker-compose.staging.yml ps'
```

### Test External Access
```bash
curl --basic -u "talia:dev2025tal" https://taliahub.com
```

### Check Latest Commit on Staging
```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && git log -1 --oneline'
```

## Current Status

✅ **Git Repository**: Configured and synced  
✅ **UI Container**: Rebuilt with latest code  
✅ **Services**: Running and healthy  
✅ **External Access**: https://taliahub.com (HTTP 200)  
✅ **Deployment Script**: Updated and ready

## Next Steps

1. **Test App Mode on Staging**:
   - Visit https://taliahub.com
   - Login with: `talia` / `dev2025tal`
   - Verify App Mode works (no Supabase login)
   - Check Dev Role Selector is visible

2. **Future Deployments**:
   - Use `./scripts/deploy-to-staging.sh --code-only` for code changes
   - Use `./scripts/deploy-to-staging.sh --full` when Docker images need rebuild

---

**Ready for Development** ✅
