# Talia Server

GraphQL API and Data Sync Service for Talia Revenue Management Platform.

## Quick Start

```bash
# Install dependencies
npm install

# Start GraphQL server (runs on port 4000)
npm start

# In development with auto-reload
npm run dev
```

## Features

- **GraphQL API**: Full GraphQL server with Apollo Server
- **Supabase Integration**: PostgreSQL data access via Supabase
- **Azure Synapse Sync**: One-way data sync from Azure Synapse Analytics
- **TypeScript**: Fully typed backend

## Data Sync Commands

```bash
# Check sync status for all tables
npm run sync-status

# Sync all tables from Azure Synapse
npm run sync-all

# Sync specific table
npm run sync-ships         # Ships data
npm run sync-cabin         # Cabin availability
npm run sync-reservations  # Reservation data
npm run sync-rates         # Published rates
npm run sync-occupancy     # Sail occupancy data

# Test connections
npm run sync-test
```

## Architecture

### Active Components

- **src/api/**: GraphQL schema, resolvers, server startup
- **src/services/**: Data services (Supabase, sync)
- **sync-cli.js**: Command-line sync tool
- **supabase/**: Supabase migrations and config

### Archived Components

- **archive/migrations/**: One-time data migration scripts
- **archive/experiments/**: Test and exploration scripts
- **archive/data-samples/**: Sample CSV and SQL files

## Environment Setup

Copy `env.example` to `.env` and configure:

```bash
# Azure Synapse Connection
AZURE_SERVER=your-server.database.windows.net
AZURE_DATABASE=your-database
AZURE_USER=your-username
AZURE_PASSWORD=your-password

# Supabase (configured automatically for local dev)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

## Development

### Build Process

The build process ensures fresh compilation every time:

```bash
npm run clean     # Remove dist directory
npm run compile   # Clean → Compile TypeScript → Copy JS files
npm start         # Compile → Run server
```

**Important**: The `clean` script runs automatically on every start to prevent stale compiled files.

See `BUILD-FIX.md` for details on why this is necessary.

### Project Structure

```
talia-server/
├── src/
│   ├── api/              # GraphQL API (index, schema, resolvers)
│   └── services/         # Data services (Supabase, sync)
├── supabase/             # Supabase migrations
├── dist/                 # Compiled JavaScript (generated)
├── sync-cli.js           # Sync CLI tool
├── package.json
└── tsconfig.json
```

## GraphQL Endpoints

- **GraphQL**: http://localhost:4000/graphql
- **Playground**: http://localhost:4000/ (in development)

## Documentation

- `BUILD-FIX.md`: Build process explanation
- `SYNC-SERVICE-COMPLETE.md`: Sync service documentation
- `archive/`: Historical scripts and samples

## Troubleshooting

### "Cannot find module" errors

Run `npm run clean` to clear stale compiled files, then `npm start`.

### Build fails

Ensure TypeScript is installed: `npm install typescript --save-dev`

### GraphQL errors with Supabase

Check that Supabase is running locally: `supabase status`

## License

UNLICENSED

