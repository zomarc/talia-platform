# Sync Status Report - Current State

## 🚨 CRITICAL ISSUE: Duplicate sync_type Entries

**The problem**: Multiple sync_type entries exist for the same table with different naming conventions. This causes:
- UI can't find the right sync metadata
- Last sync time doesn't update correctly
- Inconsistent tracking

## Current Sync Metadata Status

### ✅ Clean Entries (No Duplicates)

| sync_type | Last Sync | Records | Changes | Duration | Snapshot Date |
|-----------|-----------|---------|---------|----------|---------------|
| **competitor** | 2025-12-02 21:14:54 | 598 | 596 | 5.7s | 2025-12-02 |
| **reservation_changes** | 2025-12-02 02:57:30 | 0 | 0 | 25.8s | 2025-12-01 |

### ❌ DUPLICATE ENTRIES (The Problem!)

#### 1. Ships Table
- **ship** (old): 2025-11-27 17:20:28, 4 records, 2.2s
- **ships** (new): 2025-12-02 21:25:57, 4 records, 2.8s ← **UI uses this**

#### 2. Cabin Availability
- **cabin_availability** (old): 2025-11-27 15:04:20, 11,076 records, 3.2s
- **cabinAvailability** (new): 2025-12-02 03:17:37, 11,167 records, 3.8s ← **UI uses this**

#### 3. Master Sail
- **master_sail** (old): 2025-11-27 22:30:17, 213 records, 2.9s
- **masterSail** (new): 2025-12-02 09:43:44, 213 records, 3.6s ← **UI uses this**

#### 4. Published Rates
- **published_rates** (old): 2025-11-28 00:54:47, 0 records, 5.0s
- **publishedRates** (new): 2025-12-02 21:33:28, 0 records, 3.0s ← **PROBLEM: UI looks for published_rates but sync creates publishedRates**

#### 5. Reservation Promotion
- **reservation_promotion** (old): 2025-12-02 01:31:02, 0 records, 3.1s
- **reservationPromotion** (new): 2025-12-02 03:18:50, 179,326 records, 56.7s ← **UI uses this**

#### 6. Reservations
- **reservation** (old): 2025-12-02 01:20:47, 0 records, 1.2s
- **reservations** (new): 2025-12-02 21:34:42, 32,296 records, 12.3s ← **UI uses this**

#### 7. Sail By Cabin Occupancy
- **sail_by_cabin_occupancy** (old): 2025-11-27 22:43:03, 16,086 records, 3.6s
- **sailByCabinOccupancy** (new): 2025-12-02 09:44:42, 16,086 records, 4.7s ← **UI uses this**

## The Root Cause

**sync.config.json** uses camelCase table names:
- `ships`, `cabinAvailability`, `masterSail`, `publishedRates`, etc.

**tableSources.js** uses snake_case syncType:
- `ships`, `cabin_availability`, `master_sail`, `published_rates`, etc.

**Result**: When sync runs, it stores metadata with camelCase name from sync.config.json, but UI looks for snake_case name from tableSources.js.

## Solution Required

1. **Standardize syncType naming**: Always use snake_case (match tableSources.js)
2. **Fix sync.config.json table keys**: Keep camelCase for internal use, but use snake_case for syncType
3. **Clean up duplicate entries**: Merge or delete old entries
4. **Ensure consistency**: All syncs must use same syncType as defined in tableSources.js

## Mapping Table

| sync.config.json Key | Should Use syncType | Current Status |
|----------------------|---------------------|----------------|
| ships | ships | ✅ OK (both same) |
| cabinAvailability | cabin_availability | ❌ Mismatch |
| masterSail | master_sail | ❌ Mismatch |
| publishedRates | published_rates | ❌ Mismatch |
| reservationPromotion | reservationPromotion | ✅ OK (both same) |
| reservations | reservation | ❌ Mismatch |
| sailByCabinOccupancy | sail_by_cabin_occupancy | ❌ Mismatch |
| competitor | competitor | ✅ OK (both same) |
| reservationChanges | reservation_changes | ✅ OK (both same) |

## Action Items

1. ✅ Fix `publishedRates` → `published_rates` (DONE)
2. ⏳ Fix all other mismatches
3. ⏳ Clean up duplicate metadata entries
4. ⏳ Update sync.config.json to use consistent naming or add syncType mapping

