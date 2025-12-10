# Reservation Sail Code Fix - Testing Guide

## Changes Applied

### 1. Code Changes ✅
- **Removed external join** from `reservation-changes-sync.js` - no longer joins with `dwh.Dim_Master_Sail` in Synapse
- **Updated to use local reservation table** - `reservation_current_state` now gets `sail_code` from local `reservation` table
- **Removed SAIL_CODE** from `sync.config.json` columns list

### 2. Data Migration ✅
- **Populated sail_code in reservation table**: 17,232 out of 33,234 reservations (52%) now have `sail_code`
- Remaining 16,002 reservations don't have matching `master_sail` records (different date ranges, ship codes, etc.)

### 3. Table Creation ⚠️
- **inventory_status_by_day table**: Needs manual creation (see below)

## Current Status

### Reservation Table
- **Total**: 33,234 records
- **With sail_code**: 17,232 (52%)
- **Without sail_code**: 16,002 (48%)
  - These likely don't have matching `master_sail` records for their `sail_from_date` and `ship` combination

### Reservation Current State Table
- **Total**: 1,175 records
- **With sail_code**: 0 (0%) - **This will be fixed by the sync**

## Manual Steps Required

### 1. Create inventory_status_by_day Table

**Option A: Via Supabase Studio (Recommended)**
1. Open http://127.0.0.1:54323
2. Go to SQL Editor
3. Run the SQL from: `talia-server/supabase/migrations/20251210182349_create_inventory_status_by_day.sql`

**Option B: Via Migration**
```bash
cd talia-server
supabase migration up --local
```

## Testing Steps

### Step 1: Verify Current State
```bash
cd talia-server
node scripts/verify-and-test-reservation-fix.js
```

### Step 2: Test Reservation Changes Sync
```bash
npm run sync-reservationChanges
```

**Expected Results:**
- Sync should process snapshot rows
- `reservation_current_state` should get `sail_code` populated from local `reservation` table
- No errors about missing `SAIL_CODE` column

### Step 3: Verify Results
```sql
-- Check reservation_current_state
SELECT 
  COUNT(*) as total,
  COUNT(sail_code) as with_sail_code,
  COUNT(*) - COUNT(sail_code) as without_sail_code
FROM reservation_current_state;

-- Sample records
SELECT res_id, snapshot_date, sail_code, agency_id, guest_count
FROM reservation_current_state
WHERE sail_code IS NOT NULL
LIMIT 10;
```

### Step 4: Test Inventory Status Sync (After table creation)
```javascript
// In Node.js or add to sync CLI
import { syncInventoryStatusByDay } from './src/services/inventory-status-sync.js';

await syncInventoryStatusByDay({
  dateFrom: '2025-09-01',
  dateTo: '2025-12-31'
});
```

## Safety Verification

✅ **No data was deleted** - All operations were UPDATE/INSERT only
✅ **No tables were dropped** - Only new table created
✅ **No database reset** - All changes are additive
✅ **Data integrity maintained** - Existing records preserved

## Troubleshooting

### If sync still shows 0 rows:
- Check that `reservation` table has `sail_code` populated (52% should have it)
- Verify the WHERE clause logic is correct (check logs)
- Ensure date range matches your data

### If sail_code is still NULL in reservation_current_state:
- Verify `reservation` table has `sail_code` for those `res_id`s
- Check that the sync is loading `sail_code` from local table (check logs)
- Verify the join logic in `processReservationChangesBatch`

### If inventory_status_by_day creation fails:
- Use Supabase Studio SQL Editor directly
- Check that you have proper permissions
- Verify the table doesn't already exist with a different structure

## Architecture Summary

```
┌─────────────────┐
│  RES_HEADER     │ (Synapse - External)
└────────┬────────┘
         │ Sync
         ▼
┌─────────────────┐
│  reservation    │ (Local - Master Index)
│  - res_id       │
│  - sail_code    │ ← Populated from master_sail (local join)
└────────┬────────┘
         │ Lookup
         ▼
┌─────────────────────────┐
│ reservation_current_state│
│  - res_id               │
│  - sail_code            │ ← Gets from reservation table
└─────────────────────────┘
```

All `sail_code` lookups now happen **locally in Supabase**, not in external Synapse queries.

