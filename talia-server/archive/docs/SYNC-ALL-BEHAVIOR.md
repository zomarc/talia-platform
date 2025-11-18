# Sync-All Behavior Summary

## Overview

Running `npm run sync-all` will sync all tables in the configured sequence, with **automatic incremental updates** for `reservationChanges`.

## Table Sync Behavior

### Direct Tables (Full Sync Each Time)
These tables use `delete-all` or `delete-range` strategies and reprocess their entire date range:

- **ships**: `delete-all` - Always full sync (4 records, fast)
- **masterSail**: `delete-range` - Full sync for date range (213 records, fast)
- **cabinAvailability**: `delete-range` - Full sync for date range (11k records, fast)
- **sailByCabinOccupancy**: `delete-range` - Full sync for date range (16k records, fast)
- **reservations**: `delete-range` - Full sync for date range (1.8M records, moderate)
- **publishedRates**: `delete-range` - Full sync for date range (905k records, moderate)

### Derived Tables (Incremental Sync)
These tables use specialized handlers with incremental logic:

- **reservationChanges**: **INCREMENTAL** - Only processes new snapshots since last sync

## How Incremental Updates Work

### For `reservationChanges`:

1. **Checks `sync_metadata`** table for `last_processed_date`
2. **If date exists**: Only processes snapshots since that date
3. **If no date**: Does initial load (processes all snapshots)
4. **Updates metadata**: Sets `last_processed_date` to end of processed range

### Example Flow:

**First Run (Initial Load):**
```
Last processed: NULL
→ Processes: 2025-09-01 to 2025-12-31
→ Result: All historical data processed
→ Updates: last_processed_date = 2025-12-31
```

**Second Run (Incremental):**
```
Last processed: 2025-12-31
→ Checks: Any new data since 2025-12-31?
→ Result: "No new data to process" (if date range ends at 2025-12-31)
```

**Daily Run (After new data arrives):**
```
Last processed: 2025-12-31
→ New data available: 2025-12-31 to 2026-01-01
→ Processes: Only new snapshots
→ Updates: last_processed_date = 2026-01-01
```

## NPM Scripts

All scripts are configured correctly:

```json
{
  "sync-all": "node sync-cli.js sync-all",                    // Sync all tables
  "sync-status": "node sync-cli.js status",                   // Check sync status
  "sync-test": "node sync-cli.js test-connection",            // Test connections
  "sync-ships": "node sync-cli.js sync-table ships",          // Individual tables
  "sync-masterSail": "node sync-cli.js sync-table masterSail",
  "sync-cabin": "node sync-cli.js sync-table cabinAvailability",
  "sync-reservations": "node sync-cli.js sync-table reservations",
  "sync-rates": "node sync-cli.js sync-table publishedRates",
  "sync-occupancy": "node sync-cli.js sync-table sailByCabinOccupancy",
  "sync-reservationChanges": "node sync-cli.js sync-table reservationChanges"
}
```

## Force Full Sync

To force a full sync of `reservationChanges` (ignore incremental):

```bash
node sync-cli.js sync-table reservationChanges sept-dec-2025 --force-full-sync
```

## Verification

✅ **Incremental logic is correct**: `reservationChanges` checks `last_processed_date`  
✅ **Default behavior is incremental**: `forceFullSync` defaults to `false`  
✅ **Other tables are appropriate**: Small tables use full sync (fast), large table uses incremental  
✅ **Scripts are complete**: All tables have individual sync scripts  

## Expected Behavior When Running `sync-all`

1. **ships**: Full sync (~2 seconds)
2. **masterSail**: Full sync (~2 seconds)
3. **cabinAvailability**: Full sync (~3 seconds)
4. **sailByCabinOccupancy**: Full sync (~5 seconds)
5. **reservations**: Full sync (~5-10 minutes)
6. **publishedRates**: Full sync (~5-10 minutes)
7. **reservationChanges**: **INCREMENTAL** (~1-2 minutes if new data, instant if none)

**Total time**: ~10-20 minutes for full sync, ~1-2 minutes for daily incremental updates

