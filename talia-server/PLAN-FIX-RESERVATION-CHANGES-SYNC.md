# Plan: Fix Reservation Changes Sync

## Current Problems

1. **Processing Too Much Data**: Currently trying to process all snapshots for all reservations, even those outside sailing date range
2. **Not Incremental**: May be processing data that was already processed
3. **Inefficient Filtering**: Not properly filtering by sailing dates before processing snapshots
4. **Change Detection**: May not be correctly detecting changes over time
5. **Performance Issues**: Processing millions of rows unnecessarily

## Requirements (From Previous Discussion)

1. ✅ **Select reservations within sailing dates**: Only process reservations where `SAIL_DATE_FROM` is within the provided date range
2. ✅ **Check all snapshots**: Process all snapshot records for those reservations and record changes over time
3. ✅ **Incremental**: Only process new snapshots since last sync
4. ✅ **Populate reservation table**: Ensure reservation table has current state (already done via reservations sync)
5. ✅ **Handle post-sailing records**: Source table has records even after sailing has left - filter these out

## Current Implementation Status

### ✅ Completed
- Migrated to `stg.RES_HEADER` for current reservation state
- Migrated to `stg.RES_HEADER_SNAPSHOT` for historical snapshots
- Updated column mappings
- Fixed URI length issue in `loadCurrentState`

### ❌ Issues Remaining
- Need to ensure proper filtering by sailing dates
- Need to optimize incremental sync
- Need to verify change detection logic works correctly
- Need to handle edge cases (sailings that have passed)

## Solution Plan

### Phase 1: Optimize Reservation Filtering

**Goal**: Only get reservation IDs for active sailings, then process only their snapshots

**Steps**:
1. ✅ Get active reservation IDs from `stg.RES_HEADER` filtered by `SAIL_DATE_FROM` (already done)
2. ✅ Load current state for those reservations only (fixed URI issue)
3. **Verify**: Ensure we're only processing snapshots for these reservations

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Lines ~440-490

### Phase 2: Optimize Snapshot Processing

**Goal**: Process snapshots efficiently, only for active reservations

**Current Approach**:
- Get active reservation IDs (31,330 reservations)
- Process snapshots in batches of reservation IDs (10,000 per batch)
- Filter snapshots by `Snapshot_Date` AND `RES_ID IN (active_ids)`

**Issues to Address**:
1. **Batch Size**: Currently using 10,000 reservation IDs per batch - may need to reduce if SQL Server has limits
2. **Date Range**: Ensure we're only processing snapshots within the date range
3. **Incremental Logic**: Track `last_processed_date` correctly

**Steps**:
1. Verify batch size is optimal (test with smaller batches if needed)
2. Ensure WHERE clause correctly filters by both snapshot date AND reservation IDs
3. Test with a small date range first

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Lines ~480-530

### Phase 3: Fix Incremental Sync Logic

**Goal**: Only process new snapshots since last sync

**Current Logic**:
- Gets `last_processed_date` from `sync_metadata`
- Processes snapshots from `last_processed_date` to yesterday
- Updates `last_processed_date` after processing

**Issues to Address**:
1. **Initial Load**: On first run, should process all snapshots in date range
2. **Incremental**: On subsequent runs, only process new snapshots
3. **Date Bounds**: Always respect the sailing date range (2025-09-01 to 2025-12-31)

**Steps**:
1. Verify `last_processed_date` logic is correct
2. Ensure initial load processes all snapshots
3. Ensure incremental only processes new data
4. Add logging to show what date range is being processed

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Lines ~420-460

### Phase 4: Verify Change Detection

**Goal**: Ensure changes are detected correctly

**Current Logic**:
- Compares current snapshot to previous state
- Detects changes in: `guest_count`, `sail_code`, `agency_id`, `group_id`
- Stores changes in `reservation_changes` table
- Updates `reservation_current_state` with latest state

**Issues to Address**:
1. **Sail Code**: Not available in `stg.RES_HEADER_SNAPSHOT` - currently set to `null`
   - **Solution**: May need to join with `stg.RES_HEADER` or `master_sail` table
   - **Alternative**: Remove sail_code from change tracking if not critical
2. **Change Detection**: Verify logic correctly detects all changes
3. **State Updates**: Ensure `reservation_current_state` is updated correctly

**Steps**:
1. Review `processChangesBatch` function
2. Test change detection with sample data
3. Decide on sail_code handling (join vs null)
4. Verify state updates work correctly

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Lines ~207-296

### Phase 5: Handle Edge Cases

**Goal**: Handle edge cases gracefully

**Edge Cases**:
1. **Sailings that have passed**: Should not process snapshots for sailings outside date range
2. **Reservations with no snapshots**: Should handle gracefully
3. **Large datasets**: Should process efficiently without memory issues
4. **Missing data**: Should handle null values correctly

**Steps**:
1. Add validation for sailing dates
2. Add error handling for edge cases
3. Add logging for debugging
4. Test with various scenarios

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Throughout

### Phase 6: Performance Optimization

**Goal**: Optimize performance for large datasets

**Current Performance Considerations**:
- Processing 31,330 reservations
- Each reservation may have multiple snapshots
- Need to process efficiently

**Optimization Strategies**:
1. **Batch Processing**: Already implemented - verify batch sizes are optimal
2. **Parallel Processing**: Consider processing batches in parallel (if safe)
3. **Database Indexes**: Ensure indexes exist on `res_id`, `snapshot_date` in source table
4. **Memory Management**: Ensure we're not loading too much into memory

**Steps**:
1. Profile current performance
2. Identify bottlenecks
3. Optimize queries
4. Test with full dataset

**File**: `talia-server/src/services/reservation-changes-sync.js`
**Location**: Throughout

## Implementation Order

1. **Phase 1** ✅ - Already completed (reservation filtering)
2. **Phase 2** ⏭️ - Optimize snapshot processing (verify batch sizes, WHERE clauses)
3. **Phase 3** ⏭️ - Fix incremental sync logic (verify date handling)
4. **Phase 4** ⏭️ - Verify change detection (test with sample data)
5. **Phase 5** ⏭️ - Handle edge cases (add validation and error handling)
6. **Phase 6** ⏭️ - Performance optimization (profile and optimize)

## Testing Strategy

### Unit Tests
- Test `processChangesBatch` with sample data
- Test change detection logic
- Test date filtering logic

### Integration Tests
- Test full sync with small date range (1 week)
- Test incremental sync (run twice, verify only new data processed)
- Test with edge cases (no data, all data, partial data)

### Performance Tests
- Test with full dataset (31K reservations)
- Measure processing time
- Monitor memory usage
- Verify no timeouts or errors

## Success Criteria

- [ ] Only processes reservations within sailing date range
- [ ] Only processes snapshots for active reservations
- [ ] Incremental sync only processes new data
- [ ] Changes are detected correctly
- [ ] Performance is acceptable (< 10 minutes for full sync)
- [ ] No errors or timeouts
- [ ] Data quality is maintained

## Key Files to Modify

1. `talia-server/src/services/reservation-changes-sync.js` - Main sync logic
2. `talia-server/sync.config.json` - Configuration (already updated)

## Questions to Answer

1. **Sail Code**: Should we join with `master_sail` to get `sail_code`, or is it okay to leave as `null`?
2. **Batch Size**: What's the optimal batch size for SQL Server IN clauses? (Currently 10,000)
3. **Change Fields**: Are we tracking all necessary fields? (Currently: guest_count, sail_code, agency_id, group_id)
4. **Performance Target**: What's acceptable processing time? (Currently unknown)

## Next Steps

1. Review and approve this plan
2. Start with Phase 2 (Optimize Snapshot Processing)
3. Test incrementally after each phase
4. Document any issues or changes


