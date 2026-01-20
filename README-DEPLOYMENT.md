# Deployment & Restart Guide

## Quick Reference

### Deploy Code to Staging
```bash
./scripts/deploy-to-staging.sh --code-only
```

### Deploy Code + Docker Images
```bash
./scripts/deploy-to-staging.sh --full
```

### Check Status & Restart if Needed
```bash
./scripts/restart-and-check.sh staging --restart
```

## Deployment Scripts

### `scripts/deploy-to-staging.sh`

Deploys code changes to staging server.

**Features:**
- Automatically restarts all services in correct order
- Tests critical endpoints after deployment
- Verifies Data Mode functionality
- Fails if critical services don't work

**Usage:**
```bash
# Code-only deployment (fast)
./scripts/deploy-to-staging.sh --code-only

# Full deployment with Docker rebuild
./scripts/deploy-to-staging.sh --full
```

**What it does:**
1. Checks for uncommitted changes (prompts to commit)
2. Pushes code to git
3. SSH to staging and pulls latest code
4. Restarts services in dependency order:
   - Supabase services (db, rest, kong)
   - GraphQL server
   - UI
5. Verifies:
   - GraphQL server responds
   - Supabase connection is online
   - `databaseTables` query works
   - UI proxy to GraphQL works

### `scripts/deploy-to-staging-docker.sh`

Deploys Docker images to staging (for container changes).

**Usage:**
```bash
./scripts/deploy-to-staging-docker.sh
```

### `scripts/restart-and-check.sh`

Health check and restart utility for both local and staging.

**Usage:**
```bash
# Check local environment
./scripts/restart-and-check.sh local

# Check staging environment
./scripts/restart-and-check.sh staging

# Restart staging services (safe)
./scripts/restart-and-check.sh staging --restart

# Check both environments
./scripts/restart-and-check.sh all
```

## Service Restart Order

Services are always restarted in this order to ensure proper dependency resolution:

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

## Auto-Start on Boot

The staging server is configured to automatically start all services on boot:

- **Docker**: Starts automatically
- **VPN** (ProtonVPN): Starts automatically
- **Docker Compose Stack**: Auto-starts via `talia-docker-compose.service`
- **ngrok**: Auto-starts after Docker services are ready

All containers use `restart: unless-stopped` policy, so they automatically restart on boot.

See `STAGING-AUTO-START-SETUP.md` for detailed configuration.

## Verification After Deployment

After deployment, verify:

1. **Database**: All 27 tables present
   ```bash
   ssh zomarc@192.168.1.120 "cd ~/talia-docker && docker compose -f docker-compose.staging.yml exec -T supabase-db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';\""
   ```

2. **GraphQL**: Returns tables
   ```bash
   curl -s -X POST http://192.168.1.120:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ databaseTables { tableName } }"}' | jq '.data.databaseTables | length'
   ```

3. **UI**: Accessible and working
   ```bash
   curl -s -u talia:dev2025tal "https://taliahub.com/api/graphql" -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'
   ```

4. **Data Mode**: Fully operational
   - Visit: https://taliahub.com
   - Click: 📊 DATA MODE button
   - Should see all 23 queryable tables with row counts

## Troubleshooting

### Services Not Starting

1. Check service status:
   ```bash
   ssh zomarc@192.168.1.120 "systemctl status docker.service protonvpn-openvpn.service talia-docker-compose.service ngrok-taliahub.service"
   ```

2. Check Docker containers:
   ```bash
   ssh zomarc@192.168.1.120 "cd ~/talia-docker && docker compose -f docker-compose.staging.yml ps"
   ```

3. Check logs:
   ```bash
   ssh zomarc@192.168.1.120 "cd ~/talia-docker && docker compose -f docker-compose.staging.yml logs graphql-server --tail 50"
   ```

### GraphQL Not Responding

1. Restart GraphQL server:
   ```bash
   ssh zomarc@192.168.1.120 "cd ~/talia-docker && docker compose -f docker-compose.staging.yml restart graphql-server"
   ```

2. Wait 15 seconds, then test:
   ```bash
   curl -s -X POST http://192.168.1.120:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ __typename }"}'
   ```

### Data Mode Not Working

1. Verify Supabase connection:
   ```bash
   curl -s -X POST http://192.168.1.120:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ supabaseConnectionStatus { online } }"}'
   ```

2. Verify `databaseTables` query:
   ```bash
   curl -s -X POST http://192.168.1.120:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ databaseTables { tableName rowCount } }"}' | jq '.data.databaseTables | length'
   ```

3. If needed, restart all services:
   ```bash
   ./scripts/restart-and-check.sh staging --restart
   ```

## Related Documentation

- `DEPLOYMENT-SCRIPTS-IMPROVEMENTS.md` - Details of script improvements
- `STAGING-AUTO-START-SETUP.md` - Auto-start configuration details
- `README-STAGING.md` - Staging environment overview
- `DEVELOPMENT-WORKFLOW.md` - Development workflow guide

---

**Last Updated**: January 20, 2025
