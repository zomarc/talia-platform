# Archive Reference

This document describes files archived from the active codebase to maintain a clean development environment.

## Archive Structure

```
archive/
├── migrations/      # One-time data migration scripts
├── experiments/     # Test and exploration scripts
├── data-samples/    # Sample CSV and SQL files
└── setup/          # Initial setup scripts (currently empty)
```

## Archived Files

### Migration Scripts (archive/migrations/)

**Purpose**: One-time scripts used to migrate data from Azure Synapse to Supabase.

**Files** (32 total):
- `admin-supabase.js` - Admin utilities for Supabase
- `create-and-import-direct.js` - Direct import functionality
- `create-table-and-import.js` - Table creation and import
- `create-tables-*.js` (9 files) - Various table creation approaches
- `direct-migrate-both-tables.js` - Direct migration script
- `get-supabase-keys.js` - Key retrieval utilities
- `import-*.js` (6 files) - Data import scripts
- `migrate-*.js` (10 files) - Migration scripts for different tables
- Other setup and migration utilities

**Why Archived**: These were used during initial setup to establish the data pipeline. The active sync service (`sync-cli.js`) now handles ongoing data synchronization.

**If Needed**: Copy file to root directory for reference, do not run directly as environment may have changed.

### Experimental Scripts (archive/experiments/)

**Purpose**: Test scripts, exploration utilities, and diagnostic tools used during development.

**Files** (24 total):
- `check-tables.js` - Table verification
- `debug-count-query.js` - Query debugging
- `discover-columns.js` - Column discovery
- `import-data.js` - Data import testing
- `setup-tables.js` - Table setup
- `test-*.js` (7 files) - Various test scripts
- `explore-*.js` (3 files) - Exploration utilities
- `verify-tables.js` - Table verification
- Other diagnostic and setup scripts

**Why Archived**: These were used during development and exploration. They contain one-off tests and are not part of the active system.

**If Needed**: Reference for debugging or understanding historical approaches. Can be used as templates for new diagnostic scripts.

### Data Samples (archive/data-samples/)

**Purpose**: Sample data files used during initial setup and testing.

**Files** (estimated 11):
- `budget_data.csv` - Budget data samples
- `cabin_availability_2025.csv` - Cabin availability samples
- `published_rates_data.csv` - Published rates samples
- `create_*.sql` (8 files) - SQL table creation scripts

**Why Archived**: These were sample/demo files. The actual data now comes from the live Azure Synapse sync.

**If Needed**: Useful for testing or as reference for data structure. Do not use for production data.

## Active vs Archived

### Active Components (Do Not Archive)

**GraphQL Server** (`src/`):
- `src/api/` - GraphQL API (schema, resolvers, server)
- `src/services/` - Data services (Supabase, sync)

**Sync Service**:
- `sync-cli.js` - Active CLI tool for data synchronization

**Configuration**:
- `package.json` - Project dependencies
- `tsconfig.json` - TypeScript configuration
- `supabase/` - Supabase configuration and migrations

**Documentation**:
- `README.md` - Project documentation
- `BUILD-FIX.md` - Build process documentation
- `SYNC-SERVICE-COMPLETE.md` - Sync service documentation

### Why Archive Instead of Delete?

1. **Historical Reference**: Understand how system evolved
2. **Learning Tool**: See different approaches tried during development
3. **Debugging Aid**: Refer to old implementations if issues arise
4. **Template Resource**: Use as templates for new scripts

## How to Use Archived Files

### Viewing Archived Files

```bash
# List migration scripts
ls archive/migrations/

# Read an archived script
cat archive/migrations/migrate-ships.js

# Search archived files
grep -r "specific_function" archive/
```

### Restoring an Archived File

```bash
# Copy file back for reference (do not run directly)
cp archive/migrations/old-script.js reference-script.js
```

### Moving Files to Archive

Before moving new files to archive:

1. Document what the file does
2. Note dependencies or environment requirements
3. Add to appropriate archive subdirectory
4. Update this document

## Related Documentation

- **`DEVELOPMENT-GUIDE.md`** - Complete development reference (start here)
- `README.md` - Main project documentation
- `archive/docs/` - Archived documentation files (consolidated into DEVELOPMENT-GUIDE.md)

## Archive Statistics

- **Total archived files**: ~67
- **Migration scripts**: 32 files
- **Experimental scripts**: 24 files
- **Data samples**: ~11 files
- **Date archived**: October 2025

## Questions?

If you need to reference or restore an archived file:
1. Check this document first
2. Verify the file's purpose and dependencies
3. Copy to working directory for reference
4. Do not modify the archive directly
5. Update this document if restoring a file

