# Development Quick Start

## Environments

- **local** - Development on your laptop (localhost)
- **staging** - Client demo environment (taliahub.com)

## Daily Workflow

### 1. Develop Locally
```bash
# Terminal 1: GraphQL server
cd talia-server && npm start

# Terminal 2: UI
cd talia-ui && npm run dev
```

### 2. Deploy to Staging
```bash
# Code-only (quick)
./scripts/deploy-to-staging.sh --code-only

# Full (code + Docker)
./scripts/deploy-to-staging.sh --full
```

## Key Documents

- **`DEVELOPMENT-WORKFLOW.md`** - Complete workflow guide
- **`STAGING-SETUP-SUMMARY.md`** - Staging environment reference
- **`README-STAGING.md`** - Staging quick start

## Quick Commands

```bash
# Deploy code changes
./scripts/deploy-to-staging.sh --code-only

# Deploy Docker images
./scripts/deploy-to-staging-docker.sh

# Check staging status
ssh zomarc@192.168.1.120 'cd ~/talia-docker && docker compose ps'
```

---

**Ready to develop!** 🚀
