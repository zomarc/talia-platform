# Reservation Current State Sail Code Fix

## Issue Summary

The `reservation_current_state` table was missing `sail_code` values even though the source data in `stg.RES_HEADER` contains this information.

## Root Cause

The reservation changes sync reads from `stg.RES_HEADER_SNAPSHOT`, which does **not** contain the `SAIL_CODE` column. The `SAIL_CODE` is only available in the main `stg.RES_HEADER` table. The sync was:

1. Reading from `stg.RES_HEADER_SNAPSHOT` (which has snapshot history data)
2. Not joining with `stg.RES_HEADER` (which has the `SAIL_CODE`)
3. Explicitly setting `sail_code: null` in the code with comments indicating it wasn't available

## Solution

Modified the reservation changes sync to join `stg.RES_HEADER_SNAPSHOT` with `stg.RES_HEADER` on `RES_ID` to retrieve the `SAIL_CODE`.

### Changes Made

1. **Updated `sync.config.json`**:
   - Added `SAIL_CODE` to the columns list for `reservationChanges` sync configuration

2. **Updated `reservation-changes-sync.js`**:
   - Modified `buildRowNumberQuery()` function to include an `INNER JOIN` with `stg.RES_HEADER`
   - Updated column mapping to use `SAIL_CODE` from the joined `RES_HEADER` table (aliased as `rh`)
   - Updated count query to include the same join
   - Changed `processReservationChangesBatch()` to use `row.SAIL_CODE` instead of `null`
   - Updated both places where `sail_code` was set to `null` to now use the joined value

### Technical Details

**Before:**
```sql
SELECT rhs.[Snapshot_Date], rhs.[RES_ID], ...
FROM stg.RES_HEADER_SNAPSHOT rhs
WHERE ...
```

**After:**
```sql
SELECT rhs.[Snapshot_Date], rhs.[RES_ID], ..., rh.[SAIL_CODE]
FROM stg.RES_HEADER_SNAPSHOT rhs
INNER JOIN stg.RES_HEADER rh ON rhs.[RES_ID] = rh.[RES_ID]
WHERE ...
```

## Files Modified

1. `talia-server/sync.config.json` - Added `SAIL_CODE` to columns
2. `talia-server/src/services/reservation-changes-sync.js` - Added join logic and updated sail_code mapping

## Testing Required

After running the sync, verify:
1. `reservation_current_state` table has `sail_code` populated
2. `reservation_changes` table has `sail_code` populated
3. No performance degradation from the join operation
4. All existing functionality continues to work

## Next Steps

1. Run a full sync of `reservation_changes` to populate historical data
2. Verify the `sail_code` column is populated in both tables
3. Check UI components that display reservation data to ensure they can now filter/display by sail_code

