# Sync Scripts Review

## Overview
This document provides a comprehensive review of all sync scripts, their source and destination tables, and recommendations for improvements.

---

## Sync Configuration Summary

### 1. **ships** (Direct Sync)
- **Source:** `dwh.Dim_Ship`
- **Destination:** `ship`
- **Type:** Direct
- **Strategy:** Delete-all (full replace)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Small reference table, full replacement strategy appropriate

### 2. **cabinAvailability** (Direct Sync)
- **Source:** `dwh.Dim_Cabin_Availability`
- **Destination:** `cabin_availability`
- **Type:** Direct
- **Strategy:** Delete-range (2025-09-01 to 2025-12-31)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Date-filtered sync, snapshot-based data

### 3. **reservations** (Direct Sync)
- **Source:** `dwh.Fact_Reservation_History`
- **Destination:** `reservation`
- **Type:** Direct (Large Dataset)
- **Strategy:** Delete-range (2025-09-01 to 2025-12-31)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Large dataset with batch processing, filtered by sail dates

### 4. **publishedRates** (Direct Sync)
- **Source:** `fou.GQL_PUBLISHED_RATES`
- **Destination:** `published_rates`
- **Type:** Direct
- **Strategy:** Delete-range (2025-09-01 to 2025-12-31)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Date-filtered sync by departure date

### 5. **sailByCabinOccupancy** (Direct Sync)
- **Source:** `dwh.Dim_Sail_By_Cabin_Occupancy`
- **Destination:** `sail_by_cabin_occupancy`
- **Type:** Direct
- **Strategy:** Delete-range (2025-09-01 to 2025-12-31)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Date-filtered sync by sail date

### 6. **masterSail** (Direct Sync)
- **Source:** `dwh.Dim_Master_Sail`
- **Destination:** `master_sail`
- **Type:** Direct
- **Strategy:** Delete-range (2025-09-01 to 2025-12-31)
- **Status:** ✅ Configured
- **Current Records:** 0 rows
- **Notes:** Date-filtered sync by sail date

### 7. **reservationChanges** (Derived/Incremental Sync)
- **Source:** `fou.Fact_Reservation_daily`
- **Destination:** `reservation_changes`
- **Current State Table:** `reservation_current_state`
- **Type:** Derived (Incremental)
- **Handler:** `reservation-changes-sync.js`
- **Strategy:** Incremental change detection
- **Status:** ✅ Active & Working
- **Current Records:** 1,336,989 rows in `reservation_changes`, 384,309 rows in `reservation_current_state`
- **Last Processed:** 2025-11-19
- **Notes:** 
  - Tracks changes to reservation fields (guest_count, sail_code, agency_id, group_id)
  - Uses snapshot-based incremental sync
  - Only stores changes, not full history

### 8. **competitor** (Derived/Incremental Sync)
- **Source:** `stg.COMPETITOR`
- **Destination:** `competitor`
- **Current State Table:** `competitor_current_state`
- **Type:** Derived (Incremental)
- **Handler:** `competitor-sync.js`
- **Strategy:** Incremental change detection
- **Status:** ✅ Active & Working
- **Current Records:** 34,620 rows in `competitor`, 6,213 rows in `competitor_current_state`
- **Last Processed:** 2025-11-18
- **Notes:** 
  - Tracks competitor pricing data with change detection
  - Extracts departure port from ports string
  - Uses composite key: `date|duration|cruiseline|destination|ship|market`
  - Stores price deltas for tracking changes

---

## Sync Architecture

### Direct Sync Tables
- **Process:** Full table replacement or date-range deletion
- **Use Case:** Reference data, dimension tables, fact tables without change tracking
- **Files:** Handled by `synapse-sync.js` with transform functions

### Derived/Incremental Sync Tables
- **Process:** Change detection using current state tables
- **Use Case:** Large fact tables where only changes matter
- **Files:** 
  - `reservation-changes-sync.js` - Reservation change tracking
  - `competitor-sync.js` - Competitor pricing change tracking

### Current State Tables
- **Purpose:** Store the latest known state for incremental syncs
- **Tables:**
  - `reservation_current_state` - Latest reservation state per `res_id`
  - `competitor_current_state` - Latest competitor state per `competitor_key`

### Metadata Tracking
- **Table:** `sync_metadata`
- **Purpose:** Track last processed dates and sync statistics
- **Fields:** `sync_type`, `last_processed_date`, `records_processed`, `changes_detected`

---

## Recommendations

### 🔴 Critical Issues

1. **Missing Sync Metadata for Direct Tables**
   - **Issue:** Direct sync tables don't track last sync date or record counts in `sync_metadata`
   - **Impact:** No visibility into sync history or troubleshooting capability
   - **Recommendation:** Add metadata tracking for all sync types, not just derived tables

2. **No Incremental Strategy for Large Direct Tables**
   - **Issue:** Tables like `reservations` use full replacement even though they could benefit from incremental sync
   - **Impact:** Unnecessary data transfer and longer sync times
   - **Recommendation:** Consider converting `reservations` to incremental sync if change tracking is needed

### 🟡 Important Improvements

3. **Inconsistent Error Handling**
   - **Issue:** Different error handling patterns across sync scripts
   - **Recommendation:** Standardize error handling and logging across all sync scripts

4. **Missing Validation**
   - **Issue:** No validation of source data before sync
   - **Recommendation:** Add data quality checks (null checks, type validation, constraint validation)

5. **No Rollback Mechanism**
   - **Issue:** If sync fails mid-process, partial data may remain
   - **Recommendation:** Implement transaction-based syncs or backup/restore mechanism

6. **Limited Monitoring**
   - **Issue:** No alerts or notifications for sync failures
   - **Recommendation:** Add email/Slack notifications for sync failures

### 🟢 Nice-to-Have Enhancements

7. **Sync Performance Metrics**
   - **Recommendation:** Track sync duration, throughput (rows/second), and compare across runs

8. **Data Lineage Tracking**
   - **Recommendation:** Track which source records map to which destination records for audit purposes

9. **Incremental Sync for More Tables**
   - **Recommendation:** Evaluate if `cabinAvailability`, `publishedRates`, or `sailByCabinOccupancy` would benefit from incremental sync

10. **Parallel Sync Support**
    - **Recommendation:** Allow parallel syncing of independent tables to reduce total sync time

11. **Sync Scheduling**
    - **Recommendation:** Add cron-based scheduling for automated syncs

12. **Dry-Run Mode**
    - **Recommendation:** Add `--dry-run` flag to preview changes without applying them

---

## Table Status Summary

| Table | Type | Records | Status | Last Sync |
|-------|------|---------|--------|-----------|
| `ship` | Direct | 0 | ⚠️ Empty | Unknown |
| `cabin_availability` | Direct | 0 | ⚠️ Empty | Unknown |
| `reservation` | Direct | 0 | ⚠️ Empty | Unknown |
| `published_rates` | Direct | 0 | ⚠️ Empty | Unknown |
| `sail_by_cabin_occupancy` | Direct | 0 | ⚠️ Empty | Unknown |
| `master_sail` | Direct | 0 | ⚠️ Empty | Unknown |
| `reservation_changes` | Derived | 1,336,989 | ✅ Active | 2025-11-19 |
| `competitor` | Derived | 34,620 | ✅ Active | 2025-11-18 |

---

## Configuration File Structure

```
sync.config.json
├── tables (8 tables)
│   ├── Direct sync (6 tables)
│   └── Derived sync (2 tables)
└── datasets
    └── sept-dec-2025
        ├── tableSequence (8 tables)
        └── tables (per-table overrides)
```

---

## Sync Script Files

1. **`synapse-sync.js`** - Main orchestration service
   - Handles direct syncs
   - Routes derived syncs to handlers
   - Manages connections and transformations

2. **`reservation-changes-sync.js`** - Reservation change tracking
   - Incremental sync logic
   - Change detection
   - Current state management

3. **`competitor-sync.js`** - Competitor pricing sync
   - Incremental sync logic
   - Price change detection
   - Port extraction logic

4. **`sync-cli.js`** - Command-line interface
   - Table-level sync commands
   - Dataset-level sync commands
   - Status and query commands

---

## Next Steps

1. **Immediate:** Add metadata tracking for direct sync tables
2. **Short-term:** Implement validation and error handling improvements
3. **Medium-term:** Add monitoring and alerting
4. **Long-term:** Evaluate incremental sync for additional tables

---

## Notes

- All direct sync tables currently show 0 rows, suggesting they haven't been synced recently or data was cleared
- Derived sync tables (`reservation_changes`, `competitor`) are actively syncing and contain data
- The sync system is working correctly for incremental syncs
- Consider running initial syncs for direct tables to populate data



