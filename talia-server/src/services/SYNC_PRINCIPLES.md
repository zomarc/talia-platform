# Data Synchronization Principles

**READ THIS FIRST** - These principles apply to ALL table sync implementations.

## Core Principles

### 1. Table Syncs = Source/Transform Only

Table-specific sync files (e.g., `competitor-sync.js`, `published-rates-sync.js`) should contain **MINIMAL CODE**:

✅ **DO:**
- Define source column mappings
- Transform data from source format to target format
- Generate unique keys for records
- Detect changes between snapshots
- Insert data into target tables

❌ **DON'T:**
- Add logging logic (use `logger` parameter)
- Add control flow (full vs incremental decisions)
- Add metadata management (use `SyncMetadataService`)
- Add UI-specific code
- Add terminal-specific code
- Add table-specific error handling

### 2. UI and Terminal = Same Code Path

**The same code must work for both UI and terminal commands.**

- Both call `synapseSyncService.syncTable()`
- Both use the same `SyncLogger` instance
- Both receive identical log messages
- Both see identical error messages

**NEVER** add code that only works in one context.

### 3. Logging = Always Via Logger Parameter

**ALWAYS** accept a `logger` parameter in sync functions:

```javascript
export async function syncCompetitors({
  // ... other parameters ...
  logger = null  // Always accept logger, default to null
}) {
  // Create local log functions at the START of the function
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  const logError = (...args) => logger ? logger.error(...args) : console.error(...args);
  const logWarn = (...args) => logger ? logger.warn(...args) : console.warn(...args);
  
  // Use log, logError, logWarn throughout
  // NEVER use console.log directly
}
```

**Rules:**
- Define `log`, `logError`, `logWarn` at the very start of each function
- Use these functions throughout, never `console.log` directly
- The logger works in both UI and terminal contexts

### 4. Metadata = Always Via SyncMetadataService

**ALWAYS** use `SyncMetadataService` for metadata operations:

```javascript
import { SyncMetadataService } from './sync-metadata-service.js';

// Get latest snapshot date from source
const latestSnapshotDate = await SyncMetadataService.getLatestSnapshotDate(
  synapseConfig,
  sourceTable,
  snapshotColumn
);

// Get last processed snapshot date
const lastProcessedSnapshotDate = await SyncMetadataService.getLastProcessedSnapshotDate(
  supabaseClient,
  syncType
);

// Update metadata after sync
await SyncMetadataService.updateSyncMetadata(
  supabaseClient,
  syncType,
  lastProcessedSnapshotDate,
  latestAvailableSnapshotDate,
  recordsProcessed,
  changesDetected,
  durationMs,
  dataset,
  lastProcessedDate
);
```

**NEVER** write custom metadata code in table sync files.

### 5. Everything = Generic and Reusable

**CRITICAL RULE:** When adding functionality to one table sync, ensure it can be applied to ALL tables:

- Logging → Use logger parameter (generic)
- Error handling → Use generic patterns
- Metadata → Use SyncMetadataService (generic)
- Control flow → Make it configurable (generic)
- **NEVER** add table-specific code that can't be reused

## Key Concepts

### Date Range vs Snapshot Date

- **Date Range (Departure_Date)**: Business date range (e.g., sail dates 2025-09-01 to 2025-12-31)
  - Always filter by this range in WHERE clauses
  - This is the dataset requirement

- **Snapshot Date**: When data was loaded into source system (new data loaded daily)
  - Used for incremental updates
  - Stored in metadata as `last_processed_snapshot_date`

### Table Types

**Direct Tables (Small/Static):**
- Simple pull: source → target
- No change tracking
- Examples: `ship`, `master_sail`

**Derived Tables (Large/Dynamic):**
- Source → Current State Table + Changes Table
- Current State: Latest snapshot of each unique record
- Changes: Only deltas/changes detected
- Examples: `competitor`, `published_rates_changes`, `reservation_changes`

### Sync Types

**Full Load:**
- Processes ALL data in departure_date range
- WHERE: `Departure_Date BETWEEN dateRange.from AND dateRange.to`
- Used for initial load or force refresh

**Incremental Load:**
- Processes NEW snapshot dates since last sync
- WHERE: 
  - `Departure_Date BETWEEN dateRange.from AND dateRange.to` (always)
  - `AND Snapshot_Date > lastProcessedSnapshotDate` (incremental only)

## Standard Sync Flow

1. Check source for latest snapshot date → store in metadata
2. Get last processed snapshot date from metadata
3. Determine sync type (full vs incremental)
4. Build WHERE clause (always filter by departure_date range)
5. Process data in batches
6. Update current state table (for derived tables)
7. Detect and insert changes (for derived tables)
8. Update metadata:
   - `last_processed_snapshot_date` = max snapshot date processed
   - `latest_available_snapshot_date` = max from source
   - `last_sync_at` = now (always updated, even if no data)

## File Structure

```
talia-server/src/services/
├── SYNC_PRINCIPLES.md          ← This file (read first!)
├── sync-metadata-service.js    ← Generic metadata operations
├── synapse-sync.js             ← Generic sync orchestration
├── sync-logger.js              ← Logging infrastructure
├── competitor-sync.js          ← Table-specific (transform only)
├── published-rates-sync.js     ← Table-specific (transform only)
└── reservation-changes-sync.js ← Table-specific (transform only)
```

## Summary Checklist

When implementing or modifying a table sync:

- [ ] Table sync file contains ONLY source/transform logic
- [ ] All logging uses `logger` parameter (no console.log)
- [ ] All metadata operations use `SyncMetadataService`
- [ ] Code works in both UI and terminal contexts
- [ ] No table-specific control flow or error handling
- [ ] All functionality is generic and reusable

## Quick Reference

- **Table syncs** = Source/Transform only
- **UI and Terminal** = Same code path
- **Logging** = Always via logger parameter
- **Metadata** = Always via SyncMetadataService
- **Everything** = Generic and reusable
