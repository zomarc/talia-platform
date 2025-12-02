# Batching Refactor Plan

## Goal
Move all batching logic from individual table sync files to the sync service (`synapse-sync.js`). Individual table syncs should only handle data transformation and change detection.

## Current Architecture

### Individual Table Syncs (competitor-sync.js, published-rates-sync.js)
- Handle metadata checks
- Build WHERE clauses
- Create connection pools
- Query Synapse in batches
- Process batches
- Insert changes
- Update current state
- Update metadata

### Problems
- Batching logic duplicated in each table sync
- Connection pooling handled in multiple places
- Hard to maintain consistent batching behavior
- Violates SYNC_PRINCIPLES.md (table syncs should be source/transform only)

## Target Architecture

### Sync Service (synapse-sync.js)
- Handle metadata checks
- Build WHERE clauses
- Create connection pools (once)
- Query Synapse in batches
- Load current state (once, before batching)
- Call batch processor for each batch
- Accumulate changes from all batches
- Insert changes (after all batches)
- Update current state (after all batches)
- Update metadata

### Individual Table Syncs
- Accept batch data + current state
- Transform batch data
- Detect changes
- Return { changes, updatedStates }

## Implementation Steps

### Step 1: Create Batch Processor Functions
Create new functions in competitor-sync.js and published-rates-sync.js:
- `processCompetitorBatch(batch, currentState, logger)` - processes single batch
- `processPublishedRatesBatch(batch, currentState, logger)` - processes single batch

### Step 2: Update Sync Service
- Use `syncDerivedTableWithBatching` wrapper for competitor and publishedRates
- Load current state once before batching
- Pass current state to batch processor
- Accumulate changes and states
- Insert changes and update state after all batches

### Step 3: Refactor Existing Functions
- Keep `syncCompetitors` and `syncPublishedRates` for backward compatibility
- Or deprecate them and use batch processors directly

## Function Signatures

### Batch Processor
```javascript
function processCompetitorBatch(batch, currentState, logger) {
  // Transform batch
  // Detect changes
  // Update currentState in memory
  return { changes: [], updatedStates: [] };
}
```

### Sync Service Batching Wrapper
```javascript
async syncDerivedTableWithBatching(runtime, logger, batchProcessor, currentStateLoader) {
  // Load current state once
  const currentState = await currentStateLoader();
  
  // Query and batch
  for (const batch of batches) {
    const result = await batchProcessor(batch, currentState, logger);
    // Accumulate results
  }
  
  // Insert changes
  // Update current state
  // Update metadata
}
```

## Benefits
- Single source of truth for batching logic
- Consistent batch sizes and behavior
- Easier to add new derived tables
- Individual syncs focus on transformation only
- Better separation of concerns

