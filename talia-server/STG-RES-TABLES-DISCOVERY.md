# stg.RES_* Tables Discovery Results

## Summary

Found **7 main reservation-related tables** in the `stg` schema:

## Key Tables

### 1. stg.RES_HEADER (PRIMARY - Current State)
- **Row Count:** 304,779
- **Purpose:** Current reservation state
- **Key Columns:**
  - `RES_ID` (decimal) - Primary key
  - `SAIL_DATE_FROM` (datetime2) - Sailing start date
  - `SAIL_DATE_TO` (datetime2) - Sailing end date
  - `RES_STATUS` (nvarchar(8)) - Reservation status
  - `PROBABILITY` (decimal) - Probability percentage
  - `RES_GUEST_COUNT` (decimal) - Guest count
  - `AGENCY_ID` (decimal) - Agency identifier
  - `GROUP_ID` (decimal) - Group identifier
  - `CABIN_CATEGORY` (nvarchar) - Cabin category
  - `SHIP_CODE` (nvarchar) - Ship code
  - `PACKAGE_TYPE` (nvarchar) - Package type
  - `LAST_UPDATED_AT` (datetime2) - Last update timestamp
  - `RES_INIT_DATE` (datetime2) - Reservation init date
  - `CURRENCY_CODE` (nvarchar) - Currency
  - `CURRENCY_RATE` (decimal) - Currency rate
- **Total Columns:** 94
- **Use Case:** Populate `reservation` table with current state

### 2. stg.RES_HEADER_SNAPSHOT (PRIMARY - Change Tracking)
- **Row Count:** 23,360,254
- **Purpose:** Historical snapshots for change tracking
- **Key Columns:**
  - `Snapshot_Date` (date) - Snapshot date (PRIMARY for filtering)
  - `RES_ID` (int) - Reservation ID
  - `RES_GUEST_COUNT` (int) - Guest count
  - `AGENCY_ID` (int) - Agency identifier
  - `GROUP_ID` (int) - Group identifier
  - `RES_STATUS` (nvarchar) - Status
  - `PROBABILITY` (decimal) - Probability
  - `SHIP` (nvarchar) - Ship code
  - `SAIL_ID` (int) - Sail identifier
  - `SAIL_DAYS` (int) - Sail duration
  - `CABIN_CATEGORY` (nvarchar) - Cabin category
  - `LAST_CHANGED_DATE` (datetime) - Last change date
  - Revenue fields: `GROSS_REVENUE`, `NET_REVENUE`, `CRUISE_REV`, etc.
- **Total Columns:** 66
- **Use Case:** Track changes over time for `reservation_changes` table

### 3. stg.RES_HEADER_SNAPSHOT_NEW
- **Row Count:** 22,924,630
- **Purpose:** Similar to RES_HEADER_SNAPSHOT (newer version?)
- **Structure:** Same as RES_HEADER_SNAPSHOT
- **Use Case:** May be preferred over RES_HEADER_SNAPSHOT

### 4. stg.RES_HEADER_DAILY
- **Row Count:** 3,829
- **Purpose:** Daily snapshots (smaller subset)
- **Structure:** Same as RES_HEADER (94 columns)
- **Use Case:** May be for recent daily snapshots only

### 5. stg.RES_HEADER_INTRADAY
- **Row Count:** 2,641
- **Purpose:** Intraday snapshots (very recent)
- **Structure:** Same as RES_HEADER (94 columns)
- **Use Case:** Real-time or near-real-time updates

### 6. stg.RES_SUMMARY
- **Row Count:** 304,397
- **Purpose:** Summary view with additional agency/agent details
- **Key Columns:**
  - `RES_ID` (decimal) - Primary key
  - `AGENCY_NAME` (nvarchar) - Agency name
  - `AGENT_FIRST_NAME`, `AGENT_LAST_NAME` - Agent details
  - `SAIL_CODE` (nvarchar) - Sail code
  - `SAIL_DATE_FROM` (datetime2) - Sailing date
  - Revenue fields
- **Total Columns:** 99
- **Use Case:** May be useful for reporting/analytics

### 7. stg.RES_SUMMARY_DAILY
- **Row Count:** 232,839
- **Purpose:** Daily summary view
- **Structure:** Similar to RES_SUMMARY
- **Use Case:** Daily summary snapshots

## Recommended Approach

### For Reservation Table (Current State)
**Source:** `stg.RES_HEADER`
- Contains current state of all reservations
- Has `SAIL_DATE_FROM` and `SAIL_DATE_TO` for filtering by sailing dates
- Has `LAST_UPDATED_AT` for incremental syncs
- 304K rows is manageable

**Filtering Strategy:**
- Filter by `SAIL_DATE_FROM >= dateRange.from AND SAIL_DATE_FROM <= dateRange.to`
- This ensures only active sailings are synced

### For Reservation Changes (Change Tracking)
**Source:** `stg.RES_HEADER_SNAPSHOT` or `stg.RES_HEADER_SNAPSHOT_NEW`
- Contains historical snapshots with `Snapshot_Date`
- 23M rows - need efficient filtering
- Can track changes by comparing sequential snapshots per `RES_ID`

**Filtering Strategy:**
1. First, get active reservation IDs from `stg.RES_HEADER` filtered by sailing dates
2. Then, filter `stg.RES_HEADER_SNAPSHOT` by:
   - `RES_ID IN (active_res_ids)`
   - `Snapshot_Date >= processFrom AND Snapshot_Date <= processTo`
- This dramatically reduces the dataset from 23M to only relevant reservations

## Column Mapping (stg.RES_HEADER → reservation table)

| stg.RES_HEADER Column | Supabase Column | Notes |
|----------------------|-----------------|-------|
| RES_ID | res_id | Primary identifier |
| RES_STATUS | res_status | Status code |
| PROBABILITY | res_probability | Probability percentage |
| RES_GUEST_COUNT | guest_count | Guest count |
| SAIL_DATE_FROM | sail_from_date | Sailing start date |
| SAIL_DATE_TO | sail_to_date | Sailing end date |
| AGENCY_ID | agency_id | Agency identifier |
| SEC_AGENCY_ID | sec_agency_id | Secondary agency |
| CABIN_CATEGORY | cabin_category | Cabin category |
| SHIP_CODE | ship | Ship code |
| PACKAGE_TYPE | (package_name?) | Package type |
| SOURCE_CODE | source_code | Source code |
| CURRENCY_CODE | currency | Currency |
| CURRENCY_RATE | currency_rate | Currency rate |
| GROUP_ID | (group_id?) | Group identifier |

**Note:** Need to check if revenue fields are in RES_HEADER or only in SNAPSHOT tables.

## Next Steps

1. ✅ **Discovery Complete** - Tables identified and documented
2. ⏭️ **Map Columns** - Create detailed column mapping document
3. ⏭️ **Update sync.config.json** - Change source to `stg.RES_HEADER`
4. ⏭️ **Update Transform Logic** - Map columns correctly
5. ⏭️ **Update Change Tracking** - Use `stg.RES_HEADER_SNAPSHOT` with proper filtering
6. ⏭️ **Test & Validate** - Run syncs and verify data quality

## Questions Answered

✅ **Which table contains current state?** → `stg.RES_HEADER`  
✅ **How are changes tracked?** → `stg.RES_HEADER_SNAPSHOT` with `Snapshot_Date` column  
✅ **What date column for filtering?** → `SAIL_DATE_FROM` for reservations, `Snapshot_Date` for changes  
✅ **Are there relationships?** → All tables use `RES_ID` as primary key


