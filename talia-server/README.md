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

### CLI Commands

```bash
# Check sync status for all tables
npm run sync-status

# Sync all tables using the default dataset (defined in sync.config.json)
npm run sync-all

# Sync a named dataset (e.g. Sept–Dec 2025)
npm run sync-dataset

# Sync specific tables (uses default dataset unless you pass an argument)
npm run sync-ships         # npm run sync-ships -- sept-dec-2025 for custom dataset
npm run sync-cabin
npm run sync-reservations
npm run sync-rates
npm run sync-occupancy
npm run sync-competitor
npm run sync-master-sail

# Test connections (optional dataset argument)
npm run sync-test          # npm run sync-test -- sept-dec-2025
```

### GraphQL API

You can also trigger syncs via the GraphQL API:

```graphql
mutation {
  syncTable(tableName: "master_sail", forceFullSync: false) {
    success
    tableName
    message
    recordsProcessed
    duration
    error
  }
}
```

The UI provides a Data Management page with sync buttons for all tables. Access it via the "📊 DATA MODE" button in the dashboard.

### Configuration-driven sync

- `sync.config.json` defines every table, its source query, target table, replacement rules, and available datasets.
- Datasets (e.g. `sept-dec-2025`) group tables and filter windows so you can pull a consistent slice of data without editing code.
- Replace strategies are enforced per-table (`delete-all`, `delete-range`, or `none`) ensuring no full database resets occur during sync.
- Derived tables such as `reservation_changes` run through specialised handlers that respect the configured date range.

### Sync Implementation Patterns

**Reference Implementation**: `competitor-sync.js` is the tested and correct implementation pattern for all derived table syncs. When implementing or modifying sync functions, follow this pattern:

- **Logging**: Helper functions (`loadXxxCurrentState`, `insertXxxChanges`, `updateXxxCurrentState`) should have NO logging. Only batch processor functions (`processXxxBatch`) should log batch-level progress. High-level logging (connection, totals, completion) is handled by the sync service.
- **Metadata**: Always use `SyncMetadataService` for metadata operations - never write custom metadata code.
- **Batching**: The sync service handles all batching logic - table sync files only process single batches.
- **Date Filtering**: Always filter by `Departure_Date` range (dataset requirement). Use `Snapshot_Date` only for incremental filtering.

See `src/services/SYNC_PRINCIPLES.md` for complete guidelines.

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

- **`DEVELOPMENT-GUIDE.md`**: Complete development reference (start here)
- `archive/`: Historical scripts and samples

## Database Backup & Restore

The local Supabase database can be backed up and restored using the provided scripts.

### Creating a Backup

```bash
# Using npm script (recommended)
npm run db-backup

# Or directly
./scripts/backup-db.sh
```

Backups are saved to `talia-server/backups/` with timestamps (e.g., `supabase_backup_20251125_143022.sql.gz`).

### Restoring from Backup

```bash
# Using npm script (recommended)
npm run db-restore backups/supabase_backup_20251125_143022.sql.gz

# Or directly
./scripts/restore-db.sh backups/supabase_backup_20251125_143022.sql.gz

# Or just the filename if it's in the backups directory
./scripts/restore-db.sh supabase_backup_20251125_143022.sql.gz
```

**⚠️ Warning**: Restoring will replace all data in the database. The script will ask for confirmation before proceeding.

### Prerequisites

The backup/restore scripts require PostgreSQL client tools (`pg_dump` and `psql`):

- **macOS**: `brew install postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql-client`
- **Windows**: Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)

### Best Practices

- Create backups before running migrations or major data changes
- Store backups in version control (they're automatically excluded via `.gitignore`)
- Regular backups help protect against accidental data loss
- Backups are compressed to save disk space

## Troubleshooting

### "Cannot find module" errors

Run `npm run clean` to clear stale compiled files, then `npm start`.

### Build fails

Ensure TypeScript is installed: `npm install typescript --save-dev`

### GraphQL errors with Supabase

Check that Supabase is running locally: `supabase status`

### Backup/Restore fails

- Ensure Supabase is running: `supabase start`
- Check that PostgreSQL client tools are installed: `which pg_dump`
- Verify database connection: `pg_isready -h 127.0.0.1 -p 54322`

## License

UNLICENSED

