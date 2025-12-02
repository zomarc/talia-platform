# ALL SYNC STATUS - Current Database State

## Summary

**Total sync_type entries**: 16
**Unique tables**: 9
**Duplicates**: 7 pairs of duplicate entries

---

## Detailed Status

### 1. SHIPS
- **sync_type**: `ships`
- **Last Sync**: 2025-12-02 21:25:57
- **Records Processed**: 4
- **Duration**: 2.8 seconds
- **Status**: ✅ Working

### 2. CABIN AVAILABILITY  
- **sync_type**: `cabinAvailability` (NEW - UI uses this)
- **Last Sync**: 2025-12-02 03:17:37
- **Records Processed**: 11,167
- **Duration**: 3.8 seconds
- **Duplicate**: `cabin_availability` (OLD - 2025-11-27)
- **Status**: ⚠️ Has duplicate

### 3. MASTER SAIL
- **sync_type**: `masterSail` (NEW - UI uses this)
- **Last Sync**: 2025-12-02 09:43:44
- **Records Processed**: 213
- **Duration**: 3.6 seconds
- **Duplicate**: `master_sail` (OLD - 2025-11-27)
- **Status**: ⚠️ Has duplicate

### 4. PUBLISHED RATES
- **sync_type**: `publishedRates` (NEW - created today)
- **Last Sync**: 2025-12-02 21:33:28
- **Records Processed**: 0
- **Changes Detected**: 0
- **Duration**: 3.0 seconds
- **Last Processed Snapshot**: 2025-12-02
- **Latest Available Snapshot**: 2025-12-02
- **Dataset**: sept-dec-2025
- **Duplicate**: `published_rates` (OLD - 2025-11-28)
- **Status**: ❌ UI looks for `published_rates` (snake_case) but sync creates `publishedRates` (camelCase)

### 5. RESERVATION PROMOTION
- **sync_type**: `reservationPromotion` (NEW - UI uses this)
- **Last Sync**: 2025-12-02 03:18:50
- **Records Processed**: 179,326
- **Duration**: 56.7 seconds
- **Duplicate**: `reservation_promotion` (OLD - 2025-12-02)
- **Status**: ⚠️ Has duplicate

### 6. RESERVATIONS
- **sync_type**: `reservations` (NEW - UI uses this)
- **Last Sync**: 2025-12-02 21:34:42
- **Records Processed**: 32,296
- **Duration**: 12.3 seconds
- **Duplicate**: `reservation` (OLD - 2025-12-02)
- **Status**: ⚠️ Has duplicate

### 7. SAIL BY CABIN OCCUPANCY
- **sync_type**: `sailByCabinOccupancy` (NEW - UI uses this)
- **Last Sync**: 2025-12-02 09:44:42
- **Records Processed**: 16,086
- **Duration**: 4.7 seconds
- **Duplicate**: `sail_by_cabin_occupancy` (OLD - 2025-11-27)
- **Status**: ⚠️ Has duplicate

### 8. COMPETITOR
- **sync_type**: `competitor`
- **Last Sync**: 2025-12-02 21:14:54
- **Records Processed**: 598
- **Changes Detected**: 596
- **Duration**: 5.7 seconds
- **Last Processed Snapshot**: 2025-12-02
- **Latest Available Snapshot**: 2025-12-02
- **Dataset**: sept-dec-2025
- **Status**: ✅ Working correctly

### 9. RESERVATION CHANGES
- **sync_type**: `reservation_changes`
- **Last Sync**: 2025-12-02 02:57:30
- **Records Processed**: 0
- **Changes Detected**: 0
- **Duration**: 25.8 seconds
- **Last Processed Snapshot**: 2025-12-01
- **Latest Available Snapshot**: 2027-03-20 (⚠️ Future date - likely error)
- **Dataset**: sept-dec-2025
- **Status**: ⚠️ No records processed, future snapshot date

---

## The Problem

**syncType naming inconsistency**:
- sync.config.json uses: `publishedRates` (camelCase)
- tableSources.js expects: `published_rates` (snake_case)
- Sync creates metadata with: `publishedRates`
- UI looks for metadata with: `published_rates`
- **Result**: UI can't find the sync status! ❌

## The Fix

All syncType values must match what's defined in `tableSources.js`:

| sync.config.json | Should Use syncType | Current Issue |
|------------------|---------------------|---------------|
| publishedRates | published_rates | ❌ Mismatch |
| cabinAvailability | cabin_availability | ❌ Mismatch |
| masterSail | master_sail | ❌ Mismatch |
| reservations | reservation | ❌ Mismatch |
| sailByCabinOccupancy | sail_by_cabin_occupancy | ❌ Mismatch |
| reservationPromotion | reservationPromotion | ✅ OK |
| ships | ships | ✅ OK |
| competitor | competitor | ✅ OK |
| reservationChanges | reservation_changes | ✅ OK |

