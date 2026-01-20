# Deployment Scripts Improvements

**Date**: January 20, 2025

## Overview

Updated all deployment and restart scripts to ensure all services are properly restarted and verified after deployment. This prevents issues where services weren't restarted or weren't fully operational after deployment.

## Changes Made

### 1. `scripts/deploy-to-staging.sh`

**Improvements:**
- Restarts all services in proper dependency order:
  1. `supabase-db`, `supabase-rest`, `supabase-kong` (base services)
  2. `graphql-server` (depends on Supabase)
  3. `ui` (depends on GraphQL server)
- Increased wait times for service health checks
- Added comprehensive endpoint testing:
  - GraphQL server availability
  - Supabase connection status
  - `databaseTables` query (critical for Data Mode)
  - UI GraphQL proxy functionality
- Script will fail if critical tests don't pass

### 2. `scripts/deploy-to-staging-docker.sh`

**Improvements:**
- Same service restart order as code-only deployment
- Same comprehensive testing suite
- Ensures all services are healthy before completion

### 3. `scripts/restart-and-check.sh`

**Improvements:**
- Restarts services in proper dependency order when `--restart` flag is used
- Added testing for UI GraphQL proxy
- Added `databaseTables` count check
- Uses correct docker-compose file (`docker-compose.staging.yml`)

## Service Restart Order

Services are now always restarted in this order to ensure proper dependency resolution:

1. **Base Services** (Supabase infrastructure):
   - `supabase-db` - Database
   - `supabase-rest` - REST API
   - `supabase-kong` - API Gateway
   - Wait: 3 seconds

2. **GraphQL Server**:
   - `graphql-server` - Depends on Supabase being ready
   - Wait: 3 seconds

3. **UI**:
   - `ui` - Depends on GraphQL server being ready
   - Wait: 10 seconds for full health

## Testing Verification

After restart, scripts now verify:

1. ✅ GraphQL server responds to queries
2. ✅ Supabase connection is online
3. ✅ `databaseTables` query returns tables (critical for Data Mode)
4. ✅ UI can proxy requests to GraphQL server

## Usage

### Code-only deployment (with verification):
```bash
./scripts/deploy-to-staging.sh --code-only
```

### Full deployment with Docker rebuild:
```bash
./scripts/deploy-to-staging.sh --full
```

### Check status and restart if needed:
```bash
./scripts/restart-and-check.sh staging --restart
```

## Benefits

- **Reliability**: Services are always restarted in correct order
- **Verification**: Endpoints are tested to ensure they work
- **Early Detection**: Scripts fail fast if critical services don't work
- **Data Mode**: Explicitly verifies Data Mode functionality with `databaseTables` query

---

**Result**: Deployments are now more reliable and will catch issues immediately rather than requiring manual testing.
