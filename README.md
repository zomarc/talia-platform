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
# Code-only deployment
./scripts/deploy-to-staging.sh --code-only

# Full deployment with Docker rebuild
./scripts/deploy-to-staging.sh --full
```

## Documentation

### Getting Started
- **`README-DEVELOPMENT.md`** - Local development setup
- **`README-STAGING.md`** - Staging environment overview
- **`README-DEPLOYMENT.md`** - Deployment and restart guide

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

1. Make changes locally
2. Test locally at http://localhost:5173
3. Commit and push to git
4. Deploy to staging: `./scripts/deploy-to-staging.sh --code-only`
5. Verify at https://taliahub.com

## Status

✅ **Local Development**: Fully operational  
✅ **Staging Server**: Fully operational with auto-start  
✅ **Data Mode**: Operational (23 queryable tables)  
✅ **Database**: 27 tables present and accessible  

---

**Ready for Development** 🚀
