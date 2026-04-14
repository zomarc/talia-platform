# Staging working copy (historical note)

## Overview

Staging (`~/talia-docker` on the MiniPC) may keep a **local git working copy** for your own history. **Deploys do not rely on any remote git host**: use `./scripts/deploy-to-staging.sh` from your laptop (tarball over SSH + Docker Compose on the host).

## Environment architecture

### Local (laptop)

- Development, `npm run dev`, optional local Docker.

### Staging (MiniPC)

- Path: `~/talia-docker` (example host `192.168.1.120`).
- Stack: `docker compose -f docker-compose.staging.yml`.
- **Deploy**: `./scripts/deploy-to-staging.sh` (`--ui-only`, `--full`, or `--graphql-only`).

### External (e.g. taliahub.com)

- Tunnel (e.g. ngrok) from staging when explicitly enabled; see `./scripts/validate`.

## Deployment workflow (supported)

1. Commit on your laptop if you want a saved revision (local repo only).
2. From repo root:

   ```bash
   ./scripts/deploy-to-staging.sh --ui-only   # or --full
   ```

3. Script builds artifacts on the laptop, copies them over SSH, extracts on staging, restarts/rebuilds containers as needed.

## Verification

```bash
ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose -f docker-compose.staging.yml ps'
```

---

**Policy**: Prefer tarball/SSH deploys; treat any `git remote` on staging as optional bookkeeping, not the source of truth for what runs.
