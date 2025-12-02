# Sync Consistency Fixes - Implementation Summary

## Changes Made

### 1. Standardized Metadata Updates

**Problem**: Direct syncs (ships, cabinAvailability, etc.) used a custom `updateSyncMetadata` method instead of the generic `SyncMetadataService`.

**Solution**: 
- Removed custom `updateSyncMetadata` method from `synapse-sync.js`
- Updated `syncSmallTable` to use `SyncMetadataService.updateSyncMetadata`
- Updated `syncLargeTable` to use `SyncMetadataService.updateSyncMetadata`
- All syncs now use the same metadata service for consistency

### 2. Direct Tables Metadata Handling

Direct tables (ships, cabinAvailability, reservations, etc.) don't have snapshot dates. The fix:
- Pass `null` for `lastProcessedSnapshotDate` and `latestAvailableSnapshotDate`
- Pass `0` for `changesDetected` (direct tables don't track changes)
- Pass actual `recordsProcessed` and `duration`
- Pass `dataset` name for tracking

### 3. Code Consistency

All sync types now follow the same pattern:
- ✅ Use `SyncLogger` with `eventEmitter` for logging
- ✅ Use `syncEventEmitter` for real-time event emission
- ✅ Use `SyncMetadataService` for metadata updates
- ✅ Emit events consistently via `syncEventEmitter.emitLog`, `emitProgress`, `emitComplete`, `emitError`

## Files Modified

1. **talia-server/src/services/synapse-sync.js**:
   - Removed `updateSyncMetadata` method (lines 736-776)
   - Updated `syncSmallTable` to use `SyncMetadataService.updateSyncMetadata` (3 locations)
   - Updated `syncLargeTable` to use `SyncMetadataService.updateSyncMetadata` (2 locations)

## Testing Checklist

### Ship Sync (Direct)
- [ ] Run `npm run sync-ships` in terminal
- [ ] Verify logs appear in terminal
- [ ] Verify logs appear in UI server log panel
- [ ] Verify last sync time updates in UI
- [ ] Verify metadata stored in `sync_metadata` table with `sync_type = 'ships'`

### Competitor Sync (Derived/Batch)
- [ ] Run `npm run sync-competitor` in terminal
- [ ] Verify logs appear in terminal
- [ ] Verify logs appear in UI server log panel
- [ ] Verify last sync time updates in UI
- [ ] Verify metadata stored in `sync_metadata` table with `sync_type = 'competitor'`

### UI Verification
- [ ] Both syncs show logs in real-time in server log panel
- [ ] Both syncs update last sync time immediately after completion
- [ ] Both syncs show progress bars during sync
- [ ] Both syncs show completion status correctly

## Architecture Verification

### Logging Flow
1. `SyncLogger` created with `tableName` and `eventEmitter`
2. `logger.info()` → emits via `syncEventEmitter.emitLog()`
3. SSE endpoint subscribes to `sync-${tableName}` events
4. UI subscribes to `/api/sync/stream/${tableName}`
5. Events streamed to UI in real-time

### Metadata Flow
1. Sync completes (success or failure)
2. `SyncMetadataService.updateSyncMetadata()` called with:
   - `syncType`: table name from sync config (e.g., "ships", "competitor")
   - `lastProcessedSnapshotDate`: null for direct tables, actual date for derived
   - `latestAvailableSnapshotDate`: null for direct tables, actual date for derived
   - `recordsProcessed`: actual count
   - `changesDetected`: 0 for direct tables, actual count for derived
   - `duration`: sync duration in ms
   - `dataset`: dataset name
3. Metadata stored in `sync_metadata` table
4. UI reads from `sync_metadata` table to display last sync time

## Future Syncs

All future syncs should follow this pattern:

```javascript
// 1. Create logger with eventEmitter
const logger = new SyncLogger(tableName, syncEventEmitter);

// 2. Use logger for all logging (automatically emits events)
logger.info('Starting sync...');

// 3. Use SyncMetadataService for metadata updates
await SyncMetadataService.updateSyncMetadata(
  supabaseClient,
  syncType, // Use sync config name (e.g., "ships", "competitor")
  lastProcessedSnapshotDate, // null for direct tables
  latestAvailableSnapshotDate, // null for direct tables
  recordsProcessed,
  changesDetected, // 0 for direct tables
  duration,
  dataset
);
```

## Notes

- Direct tables: No snapshot dates, no change tracking
- Derived tables: Have snapshot dates, track changes
- All syncs: Use same logging and metadata services
- All syncs: Emit events consistently for UI updates

