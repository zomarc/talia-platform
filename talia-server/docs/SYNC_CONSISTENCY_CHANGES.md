# Sync Consistency Changes Required

## Problem Summary
- **Competitor sync** ✅ Works - uses `syncDerivedTableWithBatching`, logs appear in Server Logs panel
- **Reservation sync** ❌ Doesn't work - uses `SyncOperation` wrapper, logs only in Client Activity panel
- **Published Rates sync** ✅ Works - uses `syncDerivedTableWithBatching`

## Root Cause
`reservationChanges` uses `SyncOperation` wrapper instead of `syncDerivedTableWithBatching`. The logger passed to `SyncOperation` may not have `eventEmitter` set correctly, so logs don't emit via SSE.

## Required Changes

### 1. Fix SyncOperation Logger (IMMEDIATE FIX)
**File**: `talia-server/src/services/sync-operation.js`
- Ensure logger passed to `SyncOperation` has `tableName` and `eventEmitter` set
- This is already done, but verify it's working correctly

**Status**: Already implemented, but may need verification

### 2. Migrate reservationChanges to syncDerivedTableWithBatching (RECOMMENDED)
**File**: `talia-server/src/services/synapse-sync.js`

**Current Code** (lines 1114-1151):
```javascript
case 'reservationChanges': {
  // Uses SyncOperation wrapper
  const syncOp = new SyncOperation(syncReservationChanges, logger, {...});
  const result = await syncOp.execute({...});
}
```

**Required Change**:
```javascript
case 'reservationChanges': {
  // Use syncDerivedTableWithBatching like competitor
  return await this.syncDerivedTableWithBatching(
    runtime,
    logger,
    loadReservationChangesCurrentState,
    processReservationChangesBatch,
    insertReservationChanges,
    updateReservationChangesCurrentState,
    {
      syncType: 'reservationChanges',
      dateRange: runtime.dateRange,
      forceFullSync,
      dataset: runtime.datasetName
    }
  );
}
```

**Challenge**: `reservationChanges` has special logic:
- Gets active reservation IDs from `stg.RES_HEADER`
- Builds dynamic WHERE clauses with reservation IDs
- Nested batching (reservation batches → snapshot batches)
- Calls `cleanupOldReservations` before processing

**Solution Options**:
- **Option A**: Enhance `syncDerivedTableWithBatching` to handle `reservationChanges` special case
- **Option B**: Keep `SyncOperation` but ensure logger has `eventEmitter` (simpler)

### 3. Enhance syncDerivedTableWithBatching for reservationChanges (IF OPTION A)
**File**: `talia-server/src/services/synapse-sync.js`

**Changes Needed**:
1. Add `cleanupOldReservations` call before processing (if `syncType === 'reservationChanges'`)
2. Add logic to get active reservation IDs from `stg.RES_HEADER`
3. Build dynamic WHERE clauses with reservation IDs
4. Handle nested batching (reservation batches → snapshot batches)

**Complexity**: HIGH - Requires significant refactoring

### 4. Verify All Syncs Use Same Pattern
**Files to Check**:
- `talia-server/src/services/synapse-sync.js` - `syncDerivedTable` method
- `talia-server/src/services/competitor-sync.js` - Uses `syncDerivedTableWithBatching` ✅
- `talia-server/src/services/published-rates-sync.js` - Uses `syncDerivedTableWithBatching` ✅
- `talia-server/src/services/reservation-changes-sync.js` - Uses `SyncOperation` ❌

## Recommended Approach

### Phase 1: Quick Fix (Verify SyncOperation Logger)
1. Verify `SyncOperation` constructor correctly preserves logger with `eventEmitter`
2. Test reservation sync - verify logs appear in Server Logs panel
3. If still not working, proceed to Phase 2

### Phase 2: Full Migration (If Needed)
1. Enhance `syncDerivedTableWithBatching` to handle `reservationChanges` special case
2. Migrate `reservationChanges` case to use `syncDerivedTableWithBatching`
3. Remove `SyncOperation` wrapper
4. Test thoroughly

## Files to Modify

### Immediate Fix:
1. `talia-server/src/services/sync-operation.js` - Verify logger preservation
2. `talia-server/src/services/synapse-sync.js` - Verify logger passed to SyncOperation has eventEmitter

### Full Migration (if needed):
1. `talia-server/src/services/synapse-sync.js`
   - Enhance `syncDerivedTableWithBatching` for reservationChanges
   - Change `reservationChanges` case to use `syncDerivedTableWithBatching`
2. `talia-server/src/services/reservation-changes-sync.js`
   - Ensure all batch functions are exported correctly
   - Remove or deprecate `syncReservationChanges` function

## Testing Checklist
- [ ] Reservation sync logs appear in Server Logs panel
- [ ] Competitor sync still works correctly
- [ ] Published Rates sync still works correctly
- [ ] All syncs use consistent logging pattern
- [ ] Terminal scripts work correctly
- [ ] UI syncs work correctly

