# Comprehensive Sync System Plan

## Overview
This document consolidates all sync system documentation into a single source of truth. It describes the architecture, principles, implementation patterns, and operational procedures for the Talia data synchronization system.

## Table of Contents
1. [Core Principles](#core-principles)
2. [Architecture](#architecture)
3. [Sync Types](#sync-types)
4. [Implementation Guide](#implementation-guide)
5. [Progress & Logging](#progress--logging)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Core Principles

### 1. Table Syncs = Source/Transform Only
Table-specific sync files should **ONLY** contain:
- Source column mappings
- Data transformation logic
- Unique key generation
- Change detection logic
- Data insertion (via exported functions)

Table syncs should **NOT** contain:
- Logging (use `logger` parameter)
- Control flow (handled by sync service)
- Metadata management (use `SyncMetadataService`)
- UI/terminal-specific code
- Batching logic (handled by sync service)
- Error handling (handled by sync service wrapper)

### 2. Sync Service = Orchestration & Control
The `SynapseSyncService` handles:
- Batching logic
- Progress tracking
- Logging coordination
- Metadata management
- Error handling
- Event emission (SSE)

### 3. Logging = Always Via Logger Parameter
- All sync functions accept `logger` parameter (default `null`)
- Use `logger.info()`, `logger.error()`, `logger.warn()` - never `console.log`
- Logger automatically emits events for real-time UI updates

### 4. Metadata = Always Via SyncMetadataService
- All metadata operations use `SyncMetadataService`
- Never access `sync_metadata` table directly
- Metadata updates handled by sync service

### 5. Everything = Generic and Reusable
- Functionality must be generic and reusable across all tables
- No table-specific logic in sync service
- Configuration-driven via `sync.config.json`

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    UI / Terminal CLI                          │
│              (Triggers sync via GraphQL)                      │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              SynapseSyncService                              │
│  • Orchestration                                             │
│  • Batching                                                  │
│  • Progress Tracking                                         │
│  • Event Emission (SSE)                                      │
│  • Metadata Management                                       │
└──────────────┬───────────────────────────────────────────────┘
               │
               ├─────────────────┬─────────────────┬─────────────┐
               ▼                 ▼                 ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
    │ Table Syncs  │  │ SyncLogger   │  │SyncMetadata  │  │  SSE      │
    │ (Pure Data)  │  │ (Events)     │  │ Service      │  │ Server   │
    └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘
```

### Data Flow

1. **UI/Terminal** → GraphQL mutation → `SynapseSyncService.syncTable()`
2. **Sync Service** → Determines sync type → Calls appropriate handler
3. **Handler** → Loads current state → Processes batches → Detects changes
4. **Table Sync** → Transforms data → Returns changes/states
5. **Sync Service** → Inserts changes → Updates state → Updates metadata
6. **Events** → Emitted via `SyncEventEmitter` → Streamed via SSE → UI updates

---

## Sync Types

### Direct Tables (Small/Static)
- **Type**: `direct` or `small`
- **Pattern**: Simple pull, replace all
- **Examples**: `ships`, `cabinAvailability`
- **Handler**: `syncSmallTable()`

### Large Tables (Batch Processing)
- **Type**: `large` or `isLargeDataset: true`
- **Pattern**: Batch processing with progress
- **Examples**: `reservations`, `reservationPromotion`
- **Handler**: `syncLargeTable()`

### Derived Tables (Current State + Changes)
- **Type**: `derived`
- **Pattern**: Current state + changes detection
- **Examples**: `competitor`, `publishedRates`, `reservationChanges`
- **Handler**: `syncDerivedTable()` → `syncDerivedTableWithBatching()`

---

## Implementation Guide

### Adding a New Table Sync

#### Step 1: Create Table Sync File
Create `src/services/{table-name}-sync.js`:

```javascript
/**
 * {Table Name} Sync
 * Pure data transformation - no logging, no control flow
 */

/**
 * Load current state from Supabase
 * @param {object} supabaseClient - Supabase client
 * @param {object} logger - Logger instance (optional)
 * @returns {Promise<Map>} Map of current state records
 */
export async function load{Table}CurrentState(supabaseClient, logger = null) {
  // Load current state
  // Return Map<uniqueKey, stateRecord>
}

/**
 * Process a batch of source data
 * @param {Array} batch - Batch of source records
 * @param {Map} currentState - Current state map
 * @returns {object} { changes: [], updatedStates: [] }
 */
export function process{Table}Batch(batch, currentState) {
  // Transform batch
  // Detect changes
  // Return changes and updated states
}

/**
 * Insert changes into changes table
 * @param {object} supabaseClient - Supabase client
 * @param {Array} changes - Array of change records
 * @param {object} logger - Logger instance (optional)
 */
export async function insert{Table}Changes(supabaseClient, changes, logger = null) {
  // Insert changes
}

/**
 * Update current state table
 * @param {object} supabaseClient - Supabase client
 * @param {Array} updatedStates - Array of updated state records
 * @param {object} logger - Logger instance (optional)
 */
export async function update{Table}CurrentState(supabaseClient, updatedStates, logger = null) {
  // Update current state
}
```

#### Step 2: Add to sync.config.json
```json
{
  "{tableName}": {
    "type": "derived",
    "source": "STG.{SOURCE_TABLE}",
    "target": "{target_table}",
    "handler": "{tableName}",
    "columns": { ... },
    "dateColumn": "Snapshot_Date",
    "dateRange": {
      "from": "2025-09-01",
      "to": "2025-12-31"
    }
  }
}
```

#### Step 3: Register in synapse-sync.js
```javascript
import { 
  load{Table}CurrentState,
  process{Table}Batch,
  insert{Table}Changes,
  update{Table}CurrentState
} from './{table-name}-sync.js';

// In syncDerivedTable():
case '{tableName}': {
  return await this.syncDerivedTableWithBatching(
    runtime,
    logger,
    load{Table}CurrentState,
    process{Table}Batch,
    insert{Table}Changes,
    update{Table}CurrentState,
    {
      syncType: '{tableName}',
      dateRange: runtime.dateRange,
      forceFullSync: runtime.overrides?.forceFullSync || false,
      dataset: runtime.datasetName
    }
  );
}
```

---

## Progress & Logging

### Progress Events
Progress events are emitted automatically by the sync service:
- **Records Progress**: `{ type: 'records', current: X, total: Y, percentage: Z }`
- **Batch Progress**: `{ type: 'batch', current: X, total: Y, batchNumber: N }`

### Logging
- All logs go through `SyncLogger`
- Logger automatically emits events for SSE
- UI receives logs in real-time via SSE

### Event Types
- `log`: Log message (info, error, warn)
- `progress`: Progress update
- `complete`: Sync completed
- `error`: Sync error

---

## Testing

### Terminal Testing
```bash
# Test specific table
npm run sync-competitor

# Test with dataset
npm run sync-competitor -- sept-dec-2025

# Force full sync
npm run sync-competitor -- --force-full-sync
```

### UI Testing
1. Start server: `cd talia-server && npm start`
2. Start UI: `cd talia-ui && npm run dev`
3. Navigate to Data Management page
4. Click "Full Sync" on table
5. Verify:
   - Progress bar updates in real-time
   - Logs appear in real-time
   - Sync completes successfully
   - UI cleans up properly

### Verification Checklist
- [ ] Terminal sync works
- [ ] UI sync works
- [ ] Progress bar updates during sync
- [ ] Logs appear in real-time
- [ ] Completion event fires
- [ ] UI cleans up after completion
- [ ] No errors in server logs
- [ ] No errors in browser console

---

## Troubleshooting

### Progress Bar Not Updating
- Check that `logger.tableName` and `logger.eventEmitter` are set
- Verify progress events are emitted in `syncLargeTable` or `syncDerivedTableWithBatching`
- Check SSE connection in browser DevTools

### Sync Stuck
- Check server logs for errors
- Verify SSE connection is active
- Check for concurrency issues (sync already running)

### Missing Logs
- Verify `SyncLogger` is passed to sync functions
- Check that logger methods are called (not `console.log`)
- Verify SSE endpoint is accessible

### Metadata Not Updating
- Check `SyncMetadataService` calls
- Verify `sync_metadata` table exists
- Check for database connection issues

---

## File Structure

```
talia-server/
├── src/
│   ├── services/
│   │   ├── synapse-sync.js          # Main sync service (orchestration)
│   │   ├── sync-logger.js           # Logger with event emission
│   │   ├── sync-metadata-service.js # Metadata operations
│   │   ├── sync-event-emitter.js    # Event emission system
│   │   ├── sync-operation.js         # Wrapper for sync functions
│   │   ├── {table}-sync.js          # Table-specific syncs (data only)
│   │   └── SYNC_PRINCIPLES.md       # This file
│   └── api/
│       └── resolvers.ts              # GraphQL resolvers
├── sync.config.json                  # Table configurations
└── docs/
    └── COMPREHENSIVE_SYNC_PLAN.md   # This file
```

---

## Summary Checklist

When implementing or modifying a table sync:

- [ ] Table sync file contains ONLY data transformation logic
- [ ] No logging calls (use `logger` parameter)
- [ ] No metadata operations (use `SyncMetadataService`)
- [ ] No batching logic (handled by sync service)
- [ ] Exported functions follow naming convention
- [ ] Registered in `syncDerivedTable()` or appropriate handler
- [ ] Added to `sync.config.json`
- [ ] Tested via terminal
- [ ] Tested via UI
- [ ] Progress bar updates correctly
- [ ] Logs appear in real-time
- [ ] No errors in logs

---

**Last Updated**: 2025-11-28
**Version**: 1.0

