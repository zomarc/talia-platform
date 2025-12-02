# Sync Consistency Plan

## Problem Statement

The sync processes work correctly, but the UI logging and metadata updates are inconsistent:

- ✅ **Competitor batch sync**: Works correctly - logs appear in UI server log panel, last sync time updates
- ✅ **Ship direct sync**: Works correctly - logs appear, last sync time updates  
- ❌ **Inconsistency**: Different code paths for metadata updates and logging

## Root Cause Analysis

### Current State

1. **Competitor Sync (Derived/Batch)**:
   - Uses `syncDerivedTableWithBatching` → `SyncMetadataService.updateSyncMetadata`
   - Uses `SyncLogger` with `eventEmitter` → Events emitted correctly
   - ✅ Consistent with architecture

2. **Ship Sync (Direct)**:
   - Uses `syncSmallTable` → `this.updateSyncMetadata` (custom method)
   - Uses `SyncLogger` with `eventEmitter` → Events emitted correctly
   - ❌ Uses custom metadata method instead of `SyncMetadataService`

### Issues Identified

1. **Metadata Update Inconsistency**:
   - Direct syncs use `this.updateSyncMetadata()` in `synapse-sync.js`
   - Derived syncs use `SyncMetadataService.updateSyncMetadata()`
   - Both should use `SyncMetadataService` for consistency

2. **Metadata Schema Mismatch**:
   - Custom `updateSyncMetadata` uses `last_processed_date` (date field)
   - `SyncMetadataService` uses `last_processed_snapshot_date` (datetime)
   - Direct tables don't have snapshot dates, but should still use consistent service

3. **Code Duplication**:
   - Custom metadata update logic in `synapse-sync.js` duplicates `SyncMetadataService` functionality
   - Violates DRY principle and makes maintenance harder

## Solution Plan

### Phase 1: Standardize Metadata Updates

1. **Remove custom `updateSyncMetadata` method** from `synapse-sync.js`
2. **Update `syncSmallTable`** to use `SyncMetadataService.updateSyncMetadata`
3. **Update `syncLargeTable`** to use `SyncMetadataService.updateSyncMetadata`
4. **Handle direct tables** (no snapshot dates) by passing `null` for snapshot date fields

### Phase 2: Ensure Consistent Logging

1. **Verify all syncs use `SyncLogger` with `eventEmitter`** ✅ (already correct)
2. **Verify all syncs emit events via `syncEventEmitter`** ✅ (already correct)
3. **Verify UI subscribes to correct table names** (check SSE endpoint mapping)

### Phase 3: Testing & Validation

1. Test competitor batch sync - verify logs in UI and terminal
2. Test ship direct sync - verify logs in UI and terminal
3. Verify last sync time updates correctly for both
4. Verify metadata is stored consistently

## Implementation Details

### Direct Tables (ships, cabinAvailability, etc.)

Direct tables don't have snapshot dates. Use `SyncMetadataService.updateSyncMetadata` with:
- `lastProcessedSnapshotDate`: `null` (no snapshot concept for direct tables)
- `latestAvailableSnapshotDate`: `null` (no snapshot concept for direct tables)
- `recordsProcessed`: actual count
- `changesDetected`: `0` (direct tables don't track changes)
- `durationMs`: sync duration
- `dataset`: dataset name

### Derived Tables (competitor, publishedRates, etc.)

Already using `SyncMetadataService` correctly. No changes needed.

## Files to Modify

1. `talia-server/src/services/synapse-sync.js`:
   - Remove `updateSyncMetadata` method (lines 736-776)
   - Update `syncSmallTable` to use `SyncMetadataService.updateSyncMetadata`
   - Update `syncLargeTable` to use `SyncMetadataService.updateSyncMetadata`

## Testing Checklist

- [ ] Ship sync logs appear in UI server log panel
- [ ] Ship sync logs appear in terminal
- [ ] Ship sync updates last sync time in UI
- [ ] Ship sync metadata stored correctly in `sync_metadata` table
- [ ] Competitor sync logs appear in UI server log panel
- [ ] Competitor sync logs appear in terminal
- [ ] Competitor sync updates last sync time in UI
- [ ] Competitor sync metadata stored correctly in `sync_metadata` table
- [ ] Both syncs use same metadata service
- [ ] Both syncs emit events consistently

## Future Considerations

1. **GraphQL Interface**: Plan for sending messages back to target reservation system
2. **Additional Tables**: Ensure new syncs follow the same pattern
3. **Additional Sources**: Ensure new data sources follow the same pattern
4. **Code Cleanup**: Remove any remaining table-specific sync logic

