# Staging Git Repository Setup - Complete ✅

## Overview

The staging server (MiniPC) now has a proper git repository set up in `~/talia-docker` for automated deployments.

## Environment Architecture

### 1. **Local (Laptop)**
- **Location**: `/path/to/talia`
- **Purpose**: Development environment
- **Services**: 
  - Supabase (Docker) on `localhost:54321`
  - GraphQL server on `localhost:4000`
  - UI dev server on `localhost:5173`
- **Access**: Direct localhost access

### 2. **Staging (MiniPC)**
- **Location**: `~/talia-docker` on `192.168.1.120`
- **Purpose**: Staging/pre-production environment
- **Services**: 
  - Full Docker stack (Supabase + GraphQL + UI)
  - UI accessible on `http://192.168.1.120:5173`
- **Access**: 
  - Internal network: `http://192.168.1.120:5173`
  - SSH: `ssh zomarc@192.168.1.120`
- **Git Repository**: `~/talia-docker/.git` (cloned from GitHub)

### 3. **External (taliahub.com)**
- **URL**: `https://taliahub.com`
- **Purpose**: External client access
- **Connection**: ngrok tunnel from staging server
- **Gateway Auth**: `talia` / `dev2025tal` (temporary, development only)
- **Backend**: Directly connected to staging (MiniPC) services

## Git Setup on Staging

### Repository Location
```bash
~/talia-docker/.git
```

### Remote Configuration
- **Origin**: `https://github.com/zomarc/talia-platform.git`
- **Branch**: `main`

### Deployment Workflow

1. **Local Development**
   ```bash
   # Make changes locally
   git add .
   git commit -m "your message"
   git push
   ```

2. **Deploy to Staging**
   ```bash
   # From local laptop
   ./scripts/deploy-to-staging.sh --code-only
   ```
   
   This script:
   - Pushes code to GitHub
   - SSH to staging
   - Pulls latest code from git
   - Restarts services (or rebuilds for full deploy)

3. **Full Deployment (Code + Docker Images)**
   ```bash
   ./scripts/deploy-to-staging.sh --full
   ```
   
   This rebuilds Docker containers with new code.

## Verification

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

## Notes

- **Staging git repo**: Cloned from GitHub, tracks `main` branch
- **Docker containers**: Need rebuild when code changes (use `--full` deploy)
- **Code-only deploy**: Restarts services (faster, but uses existing images)
- **Full deploy**: Rebuilds containers (slower, but includes all code changes)

---

**Status**: ✅ Git repository configured and ready for automated deployments
