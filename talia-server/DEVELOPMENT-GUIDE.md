# Talia Server - Development Guide

Complete reference for developing and maintaining the Talia Revenue Management Platform backend.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Data Sync System](#data-sync-system)
5. [Reservation Changes Sync](#reservation-changes-sync)
6. [Build Process](#build-process)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
8. [NPM Scripts Reference](#npm-scripts-reference)
9. [Configuration](#configuration)
10. [Archive Reference](#archive-reference)

---

## Overview

Talia Server is a GraphQL API and data sync service that:
- Provides GraphQL API access to revenue management data
- Syncs data from Azure Synapse Analytics to local Supabase PostgreSQL
- Implements incremental change capture for reservation tracking
- Supports multiple datasets and date ranges

### Key Features

- **GraphQL API**: Full GraphQL server with Apollo Server
- **Supabase Integration**: PostgreSQL data access via Supabase
- **Azure Synapse Sync**: One-way data sync from Azure Synapse Analytics
- **Incremental Updates**: Efficient change tracking for large datasets
- **TypeScript**: Fully typed backend
- **Configuration-Driven**: Table syncs defined in `sync.config.json`

---

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start GraphQL server (runs on port 4000)
npm start

# In development with auto-reload
npm run dev
```

### Environment Setup

Copy `env.example` to `.env` and configure:

```bash
# Azure Synapse Connection
AZURE_SYNAPSE_SERVER=celestyaldataplatform-prd.sql.azuresynapse.net
AZURE_SYNAPSE_DATABASE=CDP_Dedicated_SQL_DWH
AZURE_SYNAPSE_USERNAME=RBryer
AZURE_SYNAPSE_PASSWORD=your-password

# Supabase (configured automatically for local dev)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

### First Sync

```bash
# Test connection
npm run sync-test

# Sync all tables
npm run sync-all

# Check sync status
npm run sync-status
```

---

## Architecture

### Project Structure

```
talia-server/
├── src/
│   ├── api/              # GraphQL API (index, schema, resolvers)
│   └── services/         # Data services (Supabase, sync)
├── supabase/             # Supabase migrations and config
├── dist/                 # Compiled JavaScript (generated)
├── sync-cli.js           # Sync CLI tool
├── sync.config.json      # Sync configuration
├── package.json
└── tsconfig.json
```

### Active Components

- **src/api/**: GraphQL schema, resolvers, server startup
- **src/services/**: Data services (Supabase, sync)
- **sync-cli.js**: Command-line sync tool
- **supabase/**: Supabase migrations and config

### GraphQL Endpoints

- **GraphQL**: http://localhost:4000/graphql
- **Playground**: http://localhost:4000/ (in development)

---

## Data Sync System

### Overview

The sync system provides one-way data synchronization from Azure Synapse Analytics to Supabase PostgreSQL. It supports:
- **Direct tables**: Full sync with replace strategies
- **Derived tables**: Specialized handlers with incremental logic
- **Multiple datasets**: Date-filtered data slices
- **Batch processing**: Efficient handling of large datasets

### Table Types

#### Direct Tables (Full Sync)

These tables use `delete-all` or `delete-range` strategies and reprocess their entire date range:

| Table | Strategy | Records | Sync Time |
|-------|----------|---------|-----------|
| ships | delete-all | 4 | ~2 seconds |
| masterSail | delete-range | 213 | ~2 seconds |
| cabinAvailability | delete-range | 11k | ~3 seconds |
| sailByCabinOccupancy | delete-range | 16k | ~5 seconds |
| reservations | delete-range | 1.8M | ~5-10 minutes |
| publishedRates | delete-range | 905k | ~5-10 minutes |

#### Derived Tables (Incremental Sync)

- **reservationChanges**: Incremental change capture (see [Reservation Changes Sync](#reservation-changes-sync))

### Sync Strategies

#### `delete-all`
- Removes all existing records
- Inserts all records from source
- Used for small, static reference data

#### `delete-range`
- Removes records within date range
- Inserts all records from source for that range
- Used for time-series data

#### `none` (for derived tables)
- No deletion
- Incremental updates only
- Used for change tracking tables

### Configuration

Tables are configured in `sync.config.json`:

```json
{
  "tables": {
    "ships": {
      "type": "direct",
      "source": "dwh.Dim_Ship",
      "target": "ship",
      "defaultReplace": {
        "strategy": "delete-all"
      }
    }
  },
  "datasets": {
    "sept-dec-2025": {
      "tableSequence": ["ships", "masterSail", "..."],
      "tables": {
        "masterSail": {
          "filters": [
            {
              "column": "[Sail_Date_From]",
              "operator": "between",
              "from": "2025-09-01",
              "to": "2025-12-31"
            }
          ]
        }
      }
    }
  }
}
```

---

## Reservation Changes Sync

### Overview

The reservation changes sync implements an incremental change capture system that:
1. **Maintains complete reservation state** - All reservations tracked in `reservation_current_state`
2. **Stores only changes** - Only actual changes stored in `reservation_changes` (not every snapshot)
3. **Supports incremental updates** - Once history is captured, only new snapshots are processed
4. **Enables clean initial load** - Can do full sync or incremental updates

### Architecture

#### Tables

**`reservation_current_state`**
Stores the current/latest state of each reservation for comparison:
- `res_id` (PRIMARY KEY)
- `snapshot_date` - Last snapshot date processed
- `sail_code`, `agency_id`, `group_id`, `guest_count` - Current values
- `updated_at` - Last update timestamp

**`reservation_changes`**
Stores only actual changes (events):
- `snapshot_date` - When the change occurred
- `res_id` - Reservation ID
- `guest_count_delta` - Change in guest count
- `sail_code_changed`, `agency_id_changed`, `group_id_changed` - Flags indicating what changed
- All current values at time of change

**`sync_metadata`**
Tracks sync progress:
- `sync_type` - 'reservation_changes'
- `last_processed_date` - Last snapshot date processed
- `records_processed` - Total records processed
- `changes_detected` - Total changes detected

### How It Works

#### Initial Load

1. No `last_processed_date` exists in `sync_metadata`
2. Processes all snapshots in the date range
3. Loads current state from `reservation_current_state` (empty initially)
4. For each snapshot:
   - Compares to current state
   - If change detected → stores in `reservation_changes`
   - Updates `reservation_current_state` with latest values
5. Updates `sync_metadata` with last processed date

#### Incremental Update

1. Reads `last_processed_date` from `sync_metadata`
2. Only processes snapshots since last processed date
3. Loads current state from `reservation_current_state`
4. For each new snapshot:
   - Compares to current state (not previous snapshot in batch)
   - If change detected → stores in `reservation_changes`
   - Updates `reservation_current_state` with latest values
5. Updates `sync_metadata` with new last processed date

### Key Features

- **No Duplicate Processing**: Once a snapshot date is processed, it's never reprocessed (unless forced)
- **Change Detection**: Compares to current state from database, not previous snapshot in batch
- **No Initial State Storage**: First snapshot for a reservation is NOT stored as a change (it's just baseline)
- **Efficient**: Only processes new snapshots, not entire history

### Usage

#### Initial Load (Full Sync)

```bash
# Process all snapshots in date range
node sync-cli.js sync-table reservationChanges sept-dec-2025 --force-full-sync
```

#### Incremental Update (Default)

```bash
# Only process snapshots since last sync
node sync-cli.js sync-table reservationChanges sept-dec-2025
```

#### Check Sync Status

```bash
# View last processed date and stats
node sync-cli.js status
```

### Performance

**Before (Old System)**
- 663,202 records stored (including initial states)
- Hours to build - Reprocessed all snapshots every time
- Stored initial state as "changes"
- No incremental capability

**After (New System)**
- ~1,062,953 records (only actual changes)
- Minutes for incremental updates - Only processes new snapshots
- No initial state stored as changes
- Full incremental support

### Benefits

✅ **50% reduction** in stored records (only changes, not all snapshots)  
✅ **10x faster** incremental updates (only new snapshots)  
✅ **No reprocessing** of historical data  
✅ **Clean separation** between current state and change events  
✅ **Audit trail** of all changes with timestamps  

---

## Build Process

### Build Scripts

```json
{
  "scripts": {
    "clean": "rm -rf dist",
    "compile": "npm run clean && tsc && mkdir -p dist/services dist/config && cp src/services/*.js dist/services/ && cp src/config/*.js dist/config/",
    "start": "npm run compile && node ./dist/index.js"
  }
}
```

### What This Does

1. **`npm run clean`**: Removes the entire `dist/` directory
2. **`npm run compile`**: Cleans → compiles TypeScript → creates directories → copies JavaScript files
3. **`npm start`**: Compiles fresh → runs server

### Why This Works

- **Always Fresh**: Every start always rebuilds from scratch
- **No Stale Files**: The clean step ensures old files don't persist
- **Proper File Structure**: JavaScript files are copied where they need to be

### Important Notes

- Always use `npm start` instead of running `node dist/index.js` directly
- If issues persist, run `npm run clean` manually, then `npm start`
- The `src/services/` directory contains JavaScript files (not TypeScript) that are copied during build

---

## Monitoring & Troubleshooting

### Monitoring Sync Progress

#### Check if sync is running:
```bash
ps aux | grep "sync-cli.js sync-table reservationChanges" | grep -v grep
```

#### View live progress:
```bash
tail -f sync-reservation-changes.log
```

#### Check database progress:
```sql
-- Check changes detected
SELECT COUNT(*) as total_changes FROM reservation_changes;

-- Check current state tracked
SELECT COUNT(*) as tracked_reservations FROM reservation_current_state;

-- Check sync metadata
SELECT last_processed_date, records_processed, changes_detected, last_sync_at 
FROM sync_metadata 
WHERE sync_type = 'reservation_changes';

-- Check latest change date
SELECT MAX(snapshot_date) as latest_change_date FROM reservation_changes;
```

#### Stop the sync (if needed):
```bash
pkill -f "sync-cli.js sync-table reservationChanges"
```

### Expected Behavior

- **Initial Load**: Processing ~27M rows from date range
- **Progress**: ~50k rows per batch
- **Changes**: Only actual changes are stored (not all snapshots)
- **State**: Current state is updated incrementally

### Common Issues

#### "Cannot find module" errors
```bash
npm run clean
npm start
```

#### Build fails
```bash
npm install typescript --save-dev
```

#### GraphQL errors with Supabase
```bash
supabase status  # Check if Supabase is running
```

#### Sync not processing new data
Check `sync_metadata.last_processed_date` - if it's at the end of the date range, update it:
```sql
UPDATE sync_metadata 
SET last_processed_date = '2025-11-17' 
WHERE sync_type = 'reservation_changes';
```

---

## NPM Scripts Reference

### Sync Commands

```bash
# Sync all tables (uses default dataset)
npm run sync-all

# Sync specific dataset
npm run sync-dataset

# Sync individual tables
npm run sync-ships
npm run sync-masterSail
npm run sync-cabin
npm run sync-reservations
npm run sync-rates
npm run sync-occupancy
npm run sync-reservationChanges

# Check sync status
npm run sync-status

# Test connections
npm run sync-test

# Show help
npm run sync-help
```

### Development Commands

```bash
# Clean build artifacts
npm run clean

# Compile TypeScript
npm run compile

# Start server (compiles first)
npm start

# Development mode with auto-reload
npm run dev
```

### Sync-All Behavior

When running `npm run sync-all`:

1. **ships**: Full sync (~2 seconds)
2. **masterSail**: Full sync (~2 seconds)
3. **cabinAvailability**: Full sync (~3 seconds)
4. **sailByCabinOccupancy**: Full sync (~5 seconds)
5. **reservations**: Full sync (~5-10 minutes)
6. **publishedRates**: Full sync (~5-10 minutes)
7. **reservationChanges**: **INCREMENTAL** (~1-2 minutes if new data, instant if none)

**Total time**: ~10-20 minutes for full sync, ~1-2 minutes for daily incremental updates

### Incremental Updates

`reservationChanges` automatically does incremental updates:
- Checks `sync_metadata.last_processed_date`
- Only processes snapshots since last sync
- Updates metadata after completion
- Use `--force-full-sync` flag to override

---

## Configuration

### Date Range Configuration

Date ranges for data integration can be configured via environment variables to override the defaults in `sync.config.json`. This allows different environments to use different data subsets without modifying configuration files.

#### Environment Variables

Add these to your `.env` file:

```bash
# Date Range Configuration for Data Integration
# Override date ranges from sync.config.json datasets
# Leave empty to use dataset defaults from sync.config.json
SYNC_DATE_RANGE_FROM=
SYNC_DATE_RANGE_TO=
ENVIRONMENT=local
```

#### Configuration Examples

**Local Development (Smaller Subset):**
```bash
SYNC_DATE_RANGE_FROM=2025-11-01
SYNC_DATE_RANGE_TO=2025-12-31
ENVIRONMENT=local
```

**Staging (Larger Complete Set):**
```bash
SYNC_DATE_RANGE_FROM=2025-09-01
SYNC_DATE_RANGE_TO=2025-12-31
ENVIRONMENT=staging
```

#### How It Works

1. **Priority**: Environment variables override dataset date ranges in `sync.config.json`
2. **Application**: Date ranges are applied to:
   - All table filters with `operator: "between"`
   - All replace strategies with `from` and `to` dates
   - WHERE clauses in SQL queries
3. **Fallback**: If environment variables are not set, the system uses date ranges from the dataset configuration
4. **Validation**: Both `SYNC_DATE_RANGE_FROM` and `SYNC_DATE_RANGE_TO` must be set together (YYYY-MM-DD format)

#### Logging

When a sync operation starts, the system logs which date range source is being used:
- `📅 Date range override active (local): Using 2025-11-01 to 2025-12-31 (overriding dataset default: 2025-09-01 to 2025-12-31)`
- `📅 Date range from dataset config: 2025-09-01 to 2025-12-31`

### Sync Configuration (`sync.config.json`)

The sync system is fully configuration-driven. Key sections:

#### Table Definitions

```json
{
  "tables": {
    "tableName": {
      "type": "direct" | "derived",
      "source": "schema.table",
      "target": "target_table",
      "columns": ["[Column1]", "[Column2]"],
      "defaultReplace": {
        "strategy": "delete-all" | "delete-range" | "none",
        "column": "date_column"
      }
    }
  }
}
```

#### Dataset Configuration

```json
{
  "datasets": {
    "dataset-name": {
      "tableSequence": ["table1", "table2"],
      "tables": {
        "tableName": {
          "filters": [
            {
              "column": "[Date_Column]",
              "operator": "between",
              "from": "2025-09-01",
              "to": "2025-12-31"
            }
          ],
          "replace": {
            "strategy": "delete-range",
            "column": "date_column",
            "from": "2025-09-01",
            "to": "2025-12-31"
          }
        }
      }
    }
  }
}
```

### Environment Variables

See [Quick Start](#quick-start) for environment setup.

---

## Archive Reference

### Archive Structure

```
archive/
├── migrations/      # One-time data migration scripts (32 files)
├── experiments/     # Test and exploration scripts (24 files)
├── data-samples/    # Sample CSV and SQL files (~11 files)
└── setup/          # Initial setup scripts
```

### Why Archive?

- **Historical Reference**: Understand how system evolved
- **Learning Tool**: See different approaches tried during development
- **Debugging Aid**: Refer to old implementations if issues arise
- **Template Resource**: Use as templates for new scripts

### Using Archived Files

```bash
# List migration scripts
ls archive/migrations/

# Read an archived script
cat archive/migrations/migrate-ships.js

# Search archived files
grep -r "specific_function" archive/
```

**Important**: Do not run archived scripts directly - copy to working directory for reference first.

---

## Additional Resources

- **GraphQL Playground**: http://localhost:4000/
- **Supabase Dashboard**: http://127.0.0.1:54323
- **Sync Logs**: `sync-reservation-changes.log`

---

## License

UNLICENSED

