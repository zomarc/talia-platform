# Plan: Rebuild Reservation Integration Using stg.* Tables

## Current State Analysis

### Current Implementation Issues
1. **Reservation Table**: Currently syncing from `dwh.Fact_Reservation_History` which may not reflect current state
2. **Reservation Changes**: Using `fou.Fact_Reservation_daily` which tracks snapshots but may include outdated data
3. **Complex Filtering**: Requires complex EXISTS subqueries and date range filtering
4. **Performance Issues**: Processing millions of rows unnecessarily

### Current Tables in Supabase
- `reservation` - Current reservation state (should be from current reservations)
- `reservation_changes` - Tracks changes over time
- `reservation_current_state` - Latest state per reservation for change detection

## Target: stg.* Tables

### Expected stg.RES_* Tables
Based on typical staging table patterns, we expect:
- `stg.RES_HEADER` - Main reservation header/current state
- `stg.RES_DETAIL` - Reservation detail lines (if applicable)
- `stg.RES_GUEST` - Guest information (if applicable)
- `stg.RES_CABIN` - Cabin assignments (if applicable)
- Other related tables as needed

## Phase 1: Discovery & Analysis

### Step 1.1: Explore stg.RES_* Tables
**Tasks:**
- [ ] Query Azure Synapse to list all `stg.RES_*` tables
- [ ] Get schema for each table (columns, data types, keys)
- [ ] Understand relationships between tables (foreign keys, joins)
- [ ] Identify which table contains current reservation state
- [ ] Identify date columns for filtering
- [ ] Identify unique identifier columns (res_id, etc.)

**Deliverable:** Document mapping of stg.* tables to Supabase schema

### Step 1.2: Analyze Current Reservation Schema
**Tasks:**
- [ ] Review current `reservation` table structure in Supabase
- [ ] Map current columns to stg.RES_HEADER columns
- [ ] Identify missing fields that should be added
- [ ] Identify fields that should be removed or deprecated

**Deliverable:** Column mapping document

## Phase 2: Rebuild Reservation Table Sync

### Step 2.1: Update sync.config.json
**Tasks:**
- [ ] Change `reservations` table definition to use `stg.RES_HEADER` as source
- [ ] Map all columns from `stg.RES_HEADER` to `reservation` table
- [ ] Configure date filtering using appropriate date column from stg.RES_HEADER
- [ ] Set up replace strategy (delete-range based on sailing dates)
- [ ] Configure incremental sync if applicable

**File:** `talia-server/sync.config.json`

**Example Structure:**
```json
{
  "reservations": {
    "type": "direct",
    "source": "stg.RES_HEADER",
    "target": "reservation",
    "columns": [
      // Map all relevant columns from stg.RES_HEADER
    ],
    "transformKey": "reservations",
    "isLargeDataset": true,
    "rowNumberOrder": ["[RES_ID]"]
  }
}
```

### Step 2.2: Update Transform Logic
**Tasks:**
- [ ] Update `transformData` function in `synapse-sync.js` for "reservations" transformKey
- [ ] Map stg.RES_HEADER column names to Supabase column names
- [ ] Handle data type conversions if needed
- [ ] Handle null values appropriately

**File:** `talia-server/src/services/synapse-sync.js`

### Step 2.3: Test Reservation Sync
**Tasks:**
- [ ] Run initial sync from stg.RES_HEADER
- [ ] Verify data quality and completeness
- [ ] Verify date filtering works correctly
- [ ] Verify incremental sync works (if applicable)
- [ ] Check performance and optimize if needed

## Phase 3: Rebuild Reservation Changes Sync

### Step 3.1: Understand Change Tracking Requirements
**Questions to Answer:**
- Does stg.RES_HEADER have a snapshot/version date?
- Do we need to track changes from stg.RES_HEADER or another table?
- Is there a history table in stg.* schema?
- What fields need change tracking? (guest_count, sail_code, agency_id, etc.)

### Step 3.2: Design Change Tracking Strategy

**Option A: If stg.RES_HEADER has snapshot dates**
- Use stg.RES_HEADER directly with snapshot_date filtering
- Track changes by comparing sequential snapshots

**Option B: If stg.RES_HEADER is current state only**
- Need to find history table (e.g., `stg.RES_HISTORY` or similar)
- Or implement change detection by comparing current state to previous state

**Option C: Use multiple stg.* tables**
- Combine stg.RES_HEADER with other tables for complete picture
- Track changes across related tables

### Step 3.3: Update reservation-changes-sync.js
**Tasks:**
- [ ] Update source table reference to appropriate stg.* table(s)
- [ ] Simplify filtering logic (no complex EXISTS queries needed)
- [ ] Update column mappings
- [ ] Ensure incremental sync works correctly
- [ ] Update cleanup logic to use stg.* table structure

**File:** `talia-server/src/services/reservation-changes-sync.js`

### Step 3.4: Update sync.config.json for reservationChanges
**Tasks:**
- [ ] Update `reservationChanges` definition to use stg.* source
- [ ] Configure appropriate date column for filtering
- [ ] Map columns correctly

**File:** `talia-server/sync.config.json`

## Phase 4: Data Migration & Validation

### Step 4.1: Backup Current Data
**Tasks:**
- [ ] Backup current `reservation` table
- [ ] Backup current `reservation_changes` table
- [ ] Backup current `reservation_current_state` table

### Step 4.2: Clear Old Data (if needed)
**Tasks:**
- [ ] Decide if we need to clear old data or migrate it
- [ ] If clearing: Delete data from old tables
- [ ] If migrating: Create migration script to transform old data

### Step 4.3: Run New Syncs
**Tasks:**
- [ ] Run reservation sync from stg.RES_HEADER
- [ ] Run reservation changes sync from stg.* tables
- [ ] Verify data counts match expectations
- [ ] Verify data quality

### Step 4.4: Validation
**Tasks:**
- [ ] Compare record counts between old and new approaches
- [ ] Spot check data accuracy
- [ ] Verify date ranges are correct
- [ ] Verify change tracking works correctly
- [ ] Performance testing

## Phase 5: Cleanup & Documentation

### Step 5.1: Remove Old Code
**Tasks:**
- [ ] Remove references to `dwh.Fact_Reservation_History`
- [ ] Remove references to `fou.Fact_Reservation_daily`
- [ ] Clean up unused functions
- [ ] Update comments and documentation

### Step 5.2: Update Documentation
**Tasks:**
- [ ] Update sync documentation with new table sources
- [ ] Document column mappings
- [ ] Document change tracking approach
- [ ] Update runbooks and procedures

## Implementation Order

1. **Phase 1** - Discovery (must be done first)
2. **Phase 2** - Rebuild reservation table sync (foundation)
3. **Phase 3** - Rebuild reservation changes sync (depends on Phase 2)
4. **Phase 4** - Migration and validation
5. **Phase 5** - Cleanup

## Key Decisions Needed

1. **Which stg.RES_* table contains current reservation state?**
   - Likely `stg.RES_HEADER` but needs confirmation

2. **How are changes tracked in stg.* schema?**
   - Snapshot dates in header table?
   - Separate history table?
   - Need to compare current vs previous state?

3. **What date column should be used for filtering?**
   - Sailing date (sail_from_date)?
   - Snapshot date?
   - Created/updated date?

4. **Should we maintain backward compatibility?**
   - Keep old sync code temporarily?
   - Or complete cutover?

## Success Criteria

- [ ] Reservation table populated from stg.RES_HEADER
- [ ] Reservation changes tracked correctly
- [ ] Only reservations within sailing date range are processed
- [ ] Performance is acceptable (< 5 minutes for full sync)
- [ ] Data quality is maintained or improved
- [ ] Code is simpler and more maintainable

## Risks & Mitigation

**Risk 1:** stg.RES_HEADER doesn't have all needed fields
- **Mitigation:** Identify missing fields early, may need to join with other stg.* tables

**Risk 2:** Change tracking approach unclear
- **Mitigation:** Thorough discovery phase, test with sample data

**Risk 3:** Data volume issues
- **Mitigation:** Implement proper filtering and incremental sync from start

**Risk 4:** Breaking existing functionality
- **Mitigation:** Thorough testing, keep backups, gradual rollout


