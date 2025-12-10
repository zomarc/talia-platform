# Commit Summary - Data Debug View & Related Fixes

## Commits Made

### 1. `ece42fc` - feat: Add unified operation metadata and inventory status sync
**Backend Infrastructure & New Features**
- Unified operation_metadata table migration (replaces sync_metadata and data_refresh_metadata)
- Updated SyncMetadataService and SupabaseDataService to use unified schema
- Added inventory-status-sync.js service for aggregating inventory by day
- Created three new migrations:
  - `20251207000000_create_unified_operation_metadata.sql`
  - `20251210182348_populate_reservation_sail_code.sql`
  - `20251210182349_create_inventory_status_by_day.sql`

**Files Changed**: 7 files, +505 insertions, -31 deletions

---

### 2. `bd8dbd2` - fix: Fix Data Mode panel GraphQL queries and reservation sail_code population
**Critical Fixes**
- Fixed GraphQL field name mismatches in `useDatabaseTables.js`
  - Changed camelCase to snake_case (syncType → sync_type, lastSyncAt → last_sync_at, etc.)
  - Fixes 500 errors in Data Mode panel queries
- Updated reservation-changes-sync to use local sail_code lookup
  - Pre-load sail_code map from local reservation table
  - Pass sailCodeMap to processReservationChangesBatch
  - Ensures sail_code populated from local data, not external queries

**Files Changed**: 2 files, +222 insertions, -381 deletions

---

### 3. `63be2a9` - feat: Add Data Debug View component for data visibility and debugging
**New UI Component & Backend API**
- Created comprehensive Data Debug View component accessible in test mode
- Added GraphQL schema types and resolver for dataDebugInfo query
- Display features:
  - Ship code filtering
  - Sailing days aggregation (by day with capacity/booked)
  - Year/Month breakdown
  - Total capacity and booked metrics
  - Table overview with row counts, snapshot dates, and change metrics
- Enabled watch mode for automatic server reload (tsx watch)
- All data joins performed locally in Supabase (no external queries)

**Files Changed**: 8 files, +1357 insertions, -30 deletions

---

## Summary Statistics

**Total Changes**: 17 files changed
- **Backend**: 10 files
- **Frontend**: 7 files
- **Migrations**: 3 new migration files
- **New Services**: 1 (inventory-status-sync.js)
- **New Components**: 1 (DataDebugView.jsx)
- **New Hooks**: 1 (useDataDebugInfo.js)

**Total Lines**: +2084 insertions, -442 deletions

## Testing Status

✅ All changes tested and verified:
- Data Debug View component working correctly
- GraphQL queries functioning properly
- Data Mode panel fixed (no more 500 errors)
- Server auto-reloads on file changes
- Reservation sail_code population working
- Inventory status sync service created

## Remaining Uncommitted Files

The following files remain uncommitted (may be unrelated or pending review):
- UI component changes (Dashboard, PublishedRates, ReservationCurrentState, etc.)
- Configuration files (tableSources.js, etc.)
- One migration file modification (20251124100000_add_departure_port_to_competitor.sql)
- Various documentation files

These can be reviewed and committed separately if needed.

