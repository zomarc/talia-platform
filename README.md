# Talia Platform

Revenue and inventory management system

## Quick Start

### Local Development
```bash
# Start GraphQL server
cd talia-server && npm start

# Start UI (in another terminal)
cd talia-ui && npm run dev

# Access UI at http://localhost:5173
```

### Deploy to Staging
```bash
# UI bundle only (fast)
./scripts/deploy-to-staging.sh --ui-only

# UI + GraphQL image rebuild + schema guard
./scripts/deploy-to-staging.sh --full
```

Deploys use **your local tree** → tarball/scp → staging host (see `docs/ENVIRONMENTS-AND-DEPLOY.md`).  
Root `package-lock.json` may still list a few transitive npm packages with legacy names from upstream tooling; those are not Talia remotes and are unrelated to deploy.

### Azure staging (VM + Docker)
See [`docs/AZURE-STAGING.md`](docs/AZURE-STAGING.md) (Bicep VM, Docker install, Caddy TLS, `deploy-to-azure-staging.sh`).

## Documentation

### Canonical Docs
- `docs/DIRECTIVE.md` - mandatory coding and styling rules
- `docs/DOCS-CANONICAL.md` - authoritative documentation map
- `docs/README.md` - docs hub and navigation
- `docs/DEVELOPMENT-WORKFLOW.md` - day-to-day development workflow
- `docs/DEPLOYMENT.md` - deployment and environment operations

### Key Features
- **Data Management**: Sync and manage data from Azure Synapse
- **Executive Overview**: Automated reporting and analysis
- **Demand Heatmap**: Visualize booking patterns
- **Search Trends**: Google Trends integration
- **Competitor Pricing**: Track competitor rates

## Environments

### Local (Development)
- **UI**: http://localhost:5173
- **GraphQL**: http://localhost:4000/graphql
- **Supabase Studio**: http://localhost:54323

### Staging (Review)
- **Public URL**: https://taliahub.com
- **Local Access**: http://192.168.1.120:5173
- **GraphQL**: http://192.168.1.120:4000/graphql

## Architecture

- **Frontend**: React + Vite (talia-ui)
- **Backend**: Node.js + GraphQL (talia-server)
- **Database**: Supabase (PostgreSQL)
- **Data Source**: Azure Synapse Analytics

## Project Structure

```
talia/
├── talia-ui/          # Frontend React application
├── talia-server/      # Backend GraphQL server
├── scripts/           # Deployment and utility scripts
├── docs/              # Documentation
└── supabase/          # Database migrations
```

## Development Workflow

1. Validate local state: `./scripts/validate-staging.sh local --quick`
2. Make changes locally on `main`
3. Keep styling in CSS and code minimal (see `docs/DIRECTIVE.md`)
4. Commit focused changes
5. Deploy/verify as needed

## Status

✅ **Local Development**: Fully operational  
✅ **Staging Server**: Fully operational with auto-start  
✅ **Data Mode**: Operational (23 queryable tables)  
✅ **Database**: 27 tables present and accessible  

---

**Ready for Development** 🚀
