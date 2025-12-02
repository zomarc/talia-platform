# Reservation Sync Migration Plan

## Problem
- `reservationChanges` uses `SyncOperation` wrapper instead of `syncDerivedTableWithBatching`
- Logs don't appear in Server Logs panel (only in Client Activity)
- Competitor sync works correctly because it uses `syncDerivedTableWithBatching`

## Root Cause
- `syncReservationChanges` is a full sync function that handles:
  1. WHERE clause building (with reservation ID filtering)
  2. Reservation ID batching (5000 IDs per batch)
  3. Snapshot batching within each reservation batch
  4. Metadata management
  5. Current state loading
  
- `syncDerivedTableWithBatching` expects:
  1. Simple WHERE clause from config filters
  2. Single-level batching (not nested reservation + snapshot batching)
  3. Generic batch processing

## Solution Options

### Option 1: Enhance syncDerivedTableWithBatching for reservationChanges (RECOMMENDED)
- Add special handling for `reservationChanges` sync type
- Support dynamic WHERE clause building for reservation IDs
- Handle nested batching (reservation batches → snapshot batches)
- Keep all logging in sync service

### Option 2: Fix SyncOperation logger (NOT RECOMMENDED)
- Ensure logger passed to SyncOperation has eventEmitter
- This would work but doesn't align with architecture goal

## Recommended Approach: Option 1

### Changes Required

1. **Modify `syncDerivedTableWithBatching`** to handle `reservationChanges`:
   - Detect `syncType === 'reservationChanges'`
   - Build dynamic WHERE clause with reservation ID filtering
   - Handle nested batching (reservation batches → snapshot batches)
   - Call cleanup function before processing

2. **Refactor `syncReservationChanges`**:
   - Remove full sync logic
   - Keep only batch processing functions
   - Export: `processReservationChangesBatch`, `loadReservationChangesCurrentState`, `insertReservationChanges`, `updateReservationChangesCurrentState`
   - Remove: `syncReservationChanges` function (or make it a thin wrapper)

3. **Update `synapse-sync.js`**:
   - Change `reservationChanges` case to use `syncDerivedTableWithBatching`
   - Pass special config for reservation ID handling

4. **Add helper function** for reservationChanges WHERE clause building:
   - Build WHERE clause with reservation IDs
   - Handle snapshot date filtering
   - Support incremental vs initial load

## Implementation Steps

1. Create `buildReservationChangesWhereClause` helper in `synapse-sync.js`
2. Enhance `syncDerivedTableWithBatching` to detect `reservationChanges` and use special logic
3. Remove `SyncOperation` wrapper from `reservationChanges` case
4. Test reservation sync in UI - verify logs appear in Server Logs panel
5. Verify all syncs use consistent pattern

## Files to Modify

1. `talia-server/src/services/synapse-sync.js`
   - Add `buildReservationChangesWhereClause` method
   - Enhance `syncDerivedTableWithBatching` for reservationChanges
   - Change `reservationChanges` case to use `syncDerivedTableWithBatching`

2. `talia-server/src/services/reservation-changes-sync.js`
   - Remove `syncReservationChanges` function (or deprecate)
   - Ensure batch functions are exported correctly

3. Test files
   - Verify UI logs work
   - Verify terminal scripts work

