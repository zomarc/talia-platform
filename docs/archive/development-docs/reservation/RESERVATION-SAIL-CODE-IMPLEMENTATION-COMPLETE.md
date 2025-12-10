# Reservation Sail Code and Inventory Status Implementation

## Summary

Fixed the reservation `sail_code` population issue and created a new inventory status table. All changes are **additive only** - no data was deleted, no tables were dropped, and no database resets occurred.

## Changes Made

### 1. Removed External Join from Reservation Changes Sync

**Files Modified:**
- `talia-server/src/services/reservation-changes-sync.js`
- `talia-server/sync.config.json`

**Changes:**
- Removed `SAIL_CODE` from `reservationChanges` columns in `sync.config.json`
- Removed external join with `dwh.Dim_Master_Sail` from `buildRowNumberQuery()`
- Updated `processReservationChangesBatch()` to accept `supabaseClient` and `sailCodeMap` parameters
- Added code to load `sail_code` from local `reservation` table before processing batches
- `reservation_current_state` now gets `sail_code` from the local `reservation` table (master index)

### 2. Created Migration to Backfill Reservation Sail Code

**New File:** `talia-server/supabase/migrations/20251210182348_populate_reservation_sail_code.sql`

**Purpose:** Populates `sail_code` in existing `reservation` records by joining with `master_sail` table locally.

**To Run:**
```bash
cd talia-server
supabase migration up
```

Or manually run the SQL in Supabase Studio.

### 3. Created Inventory Status by Day Table

**New File:** `talia-server/supabase/migrations/20251210182349_create_inventory_status_by_day.sql`

**Purpose:** Creates a new table to track current inventory status by day with:
- `date` - the day
- `ship_code` - ship identifier
- `sail_code` - sail code (nullable)
- `capacity` - total capacity
- `sold` - number of sold cabins/bookings
- `available` - calculated as capacity - sold

**To Run:**
```bash
cd talia-server
supabase migration up
```

### 4. Created Inventory Status Sync Service

**New File:** `talia-server/src/services/inventory-status-sync.js`

**Purpose:** Aggregates data from `cabin_availability` and `reservation` tables to populate `inventory_status_by_day`.

**Usage:**
```javascript
import { syncInventoryStatusByDay } from './services/inventory-status-sync.js';

await syncInventoryStatusByDay({
  dateFrom: '2025-09-01',
  dateTo: '2025-12-31',
  logger: loggerInstance
});
```

## Next Steps

### 1. Run Migrations

```bash
cd talia-server
supabase migration up
```

This will:
- Populate `sail_code` in existing `reservation` records
- Create the `inventory_status_by_day` table

### 2. Test Reservation Changes Sync

```bash
npm run sync-reservationChanges
```

This should now:
- Load `sail_code` from local `reservation` table
- Populate `sail_code` in `reservation_current_state` table

### 3. Populate Inventory Status Table

Create a script or add to sync CLI to run:
```javascript
import { syncInventoryStatusByDay } from './src/services/inventory-status-sync.js';

await syncInventoryStatusByDay({
  dateFrom: '2025-09-01',
  dateTo: '2025-12-31'
});
```

## Architecture

The `reservation` table now serves as the **master index** loaded from `RES_HEADER`. All `sail_code` lookups happen **locally in Supabase** by joining with the `master_sail` table:

1. **Reservation Sync**: Loads data from `RES_HEADER` → inserts into `reservation` table
2. **Migration**: Backfills `sail_code` in `reservation` by joining with `master_sail` locally
3. **Reservation Changes Sync**: Gets `sail_code` from local `reservation` table (not from external query)
4. **Inventory Status**: Aggregates from local `cabin_availability` and `reservation` tables

## Safety

- ✅ No data was deleted
- ✅ No tables were dropped
- ✅ No database resets occurred
- ✅ All changes are additive (new columns, new tables, data updates only)
- ✅ Migrations use UPDATE/INSERT only, never DELETE/DROP

## Verification

After running migrations and syncs, verify:

1. **Reservation table has sail_code:**
   ```sql
   SELECT COUNT(*) as total, 
          COUNT(sail_code) as with_sail_code,
          COUNT(*) - COUNT(sail_code) as without_sail_code
   FROM reservation;
   ```

2. **Reservation current state has sail_code:**
   ```sql
   SELECT COUNT(*) as total,
          COUNT(sail_code) as with_sail_code
   FROM reservation_current_state;
   ```

3. **Inventory status table is populated:**
   ```sql
   SELECT COUNT(*) as total_records,
          COUNT(DISTINCT date) as unique_dates,
          COUNT(DISTINCT ship_code) as unique_ships
   FROM inventory_status_by_day;
   ```

