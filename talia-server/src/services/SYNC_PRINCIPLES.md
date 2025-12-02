# Data Synchronization Principles

**READ THIS FIRST** - These principles apply to ALL table sync implementations.

## Core Principles

### 1. Table Syncs = Definitions and Transforms Only

Table-specific sync files (e.g., `competitor-sync.js`, `published-rates-sync.js`) should contain **MINIMAL CODE** - only data definitions and transformations:

✅ **DO:**
- Define source column mappings
- Transform data from source format to target format
- Generate unique keys for records
- Detect changes between snapshots (compare current vs previous state)
- Export batch processor functions: `processXxxBatch(batch, currentState, logger) => {changes, updatedStates}`
- Export helper functions: `loadXxxCurrentState`, `insertXxxChanges`, `updateXxxCurrentState`

❌ **DON'T:**
- Handle batching logic (sync service handles all batching)
- Add logging logic (sync service handles all logging)
- Add control flow (full vs incremental decisions - sync service handles this)
- Add metadata management (sync service handles via `SyncMetadataService`)
- Create connection pools or query Synapse directly (sync service handles queries)
- Add UI-specific code
- Add terminal-specific code
- Add table-specific error handling
- Accumulate changes across batches (sync service handles accumulation)
- Insert data directly (sync service calls exported insert functions)

**CRITICAL:** The sync service (`synapse-sync.js`) handles ALL batching, logging, UI updates, connection management, query execution, and metadata updates. Table sync files are pure data transformation functions.

### 2. UI and Terminal = Same Code Path

**The same code must work for both UI and terminal commands.**

- Both call `synapseSyncService.syncTable()`
- Both use the same `SyncLogger` instance
- Both receive identical log messages
- Both see identical error messages

**NEVER** add code that only works in one context.

### 3. Logging = Handled by Sync Service

**The sync service handles ALL logging.** Table sync functions should:

- Accept a `logger` parameter for batch processor functions (optional, for progress logging within batch processing)
- Use logger only for batch-level progress (e.g., "Transforming X records")
- **NOT** log connection status, batch counts, totals, or completion messages (sync service handles this)

**Batch Processor Function Signature:**
```javascript
export function processXxxBatch(batch, currentState, logger = null) {
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  
  // Only log batch-level progress
  log(`🔄 Transforming ${batch.length} records...`);
  
  // Transform and detect changes
  const result = processChangesBatch(batch, currentState);
  
  log(`✅ Processed ${batch.length} records (${result.changes.length} changes)`);
  
  return result; // { changes: [], updatedStates: [] }
}
```

**Rules:**
- Sync service handles all high-level logging (connection, totals, completion)
- Table syncs only log batch-level transformation progress
- Never log connection status, metadata checks, or sync completion

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

**Sync Service (`synapse-sync.js`) Responsibilities:**
1. Check source for latest snapshot date
2. Get last processed snapshot date from metadata
3. Determine sync type (full vs incremental)
4. Build WHERE clause (always filter by departure_date range)
5. Load current state (once, before batching)
6. Query Synapse in batches
7. For each batch: call table's batch processor function
8. Accumulate changes and updated states from all batches
9. Insert changes (after all batches complete)
10. Update current state (after all batches complete)
11. Update metadata:
    - `last_processed_snapshot_date` = max snapshot date processed
    - `latest_available_snapshot_date` = max from source
    - `last_sync_at` = now (always updated, even if no data)

**Table Sync File Responsibilities:**
1. Export batch processor: `processXxxBatch(batch, currentState, logger) => {changes, updatedStates}`
2. Export helpers: `loadXxxCurrentState`, `insertXxxChanges`, `updateXxxCurrentState`
3. Transform batch data from source format to target format
4. Detect changes compared to current state
5. Return results to sync service

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

- [ ] Export batch processor function: `processXxxBatch(batch, currentState, logger) => {changes, updatedStates}`
- [ ] Export helper functions: `loadXxxCurrentState`, `insertXxxChanges`, `updateXxxCurrentState`
- [ ] Batch processor only transforms data and detects changes (no batching logic)
- [ ] No connection pooling or Synapse queries in table sync files
- [ ] No metadata checks or updates in table sync files
- [ ] No logging of connection status, totals, or completion (only batch-level progress)
- [ ] Keep code minimal - definitions and transforms only
- [ ] Code works in both UI and terminal contexts (via sync service)
- [ ] All functionality is generic and reusable

**Remember:** The sync service handles ALL batching, logging, UI updates, connections, queries, and metadata. Table syncs are pure data transformation functions.

## Quick Reference

- **Table syncs** = Definitions and transforms only (no batching, no logging, no metadata)
- **Sync service** = Handles ALL batching, logging, UI updates, connections, queries, metadata
- **UI and Terminal** = Same code path (via sync service)
- **Logging** = Handled by sync service (table syncs only log batch-level progress)
- **Metadata** = Handled by sync service via SyncMetadataService
- **Batching** = Handled by sync service (table syncs process single batches)
- **Everything** = Generic and reusable
