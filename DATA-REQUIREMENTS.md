# Additional Data Requirements
## For Booking Profile Build Curves and Target Profiles

This document outlines the additional data requirements from the source database (Azure Synapse) needed to support the new booking profile build curves and target profile editing functionality.

---

## Current Data Available

### ✅ Already Available in Supabase

1. **Reservation Data** (`reservation` table)
   - `res_id`, `sail_code`, `sail_from_date`, `sail_to_date`
   - `guest_count`, `res_status`
   - All necessary for calculating current bookings

2. **Reservation Changes** (`reservation_changes` table)
   - `snapshot_date` - **Critical for build curves**
   - `res_id`, `guest_count`, `guest_count_delta`
   - Tracks booking changes over time
   - **This is the primary data source for build curves**

3. **Master Sail** (`master_sail` table)
   - `sail_code`, `sail_date_from`, `sail_date_to`
   - `ship_code`, `ship_name`
   - `package_type`, `season_code`, `geog_area_code`
   - Provides sailing metadata

---

## Data Requirements for Build Curves

### ✅ **NO ADDITIONAL DATA REQUIRED**

The build curves feature uses **existing data** from:
- `reservation_changes.snapshot_date` - to determine booking state at specific dates
- `master_sail.sail_date_from` - to calculate weeks until sailing
- `reservation_changes.guest_count` - to get booking counts at each snapshot

**Calculation Method:**
1. For each week interval (W-12, W-10, W-8, W-6, W-4, W-2, Sail):
   - Calculate target date: `sail_date_from - (weeks * 7 days)`
   - Find the latest `snapshot_date` on or before target date
   - Use `guest_count` from that snapshot
   - Aggregate across all reservations for the sailing

**Implementation Status:** ✅ **COMPLETE**
- Service method: `getBookingProfileWithCurves()` in `supabase.js`
- GraphQL query: `bookingProfileWithCurves`
- Frontend hook: `useBookingProfileWithCurves()`

---

## Data Requirements for Target Profiles

### ✅ **NO ADDITIONAL DATA REQUIRED FROM SOURCE**

Target profiles are **user-created** and stored locally in Supabase:
- New table: `target_profiles` (created via migration)
- Stores user-defined target curves
- Can be based on historic sailings (using existing booking profile data)

**Data Flow:**
1. User creates target profile → Stored in `target_profiles` table
2. User can base it on historic sailings → Uses existing `bookingProfile` query
3. Target profiles are compared with actual bookings → Uses existing `bookingProfileWithCurves` query

**Implementation Status:** ✅ **COMPLETE**
- Database table: `target_profiles` (migration created)
- Service methods: `getTargetProfiles()`, `createTargetProfile()`, `updateTargetProfile()`, `deleteTargetProfile()`
- GraphQL queries/mutations: `targetProfiles`, `targetProfile`, `createTargetProfile`, `updateTargetProfile`, `deleteTargetProfile`
- Frontend service: `targetProfileService.js`
- Frontend hooks: `useTargetProfiles()`, `useTargetProfile()`, `useTargetProfileMutation()`

---

## Optional Enhancements (Future)

### Potential Additional Data (Not Required for Initial Implementation)

1. **Booking Source Data**
   - Could track booking sources/channels for more detailed analysis
   - **Status:** Not required - can be added later if needed

2. **Cabin Category Breakdown**
   - Could show build curves by cabin category
   - **Status:** Not required - uses existing `cabin_category` in reservation table if needed

3. **Market/Region Breakdown**
   - Could show build curves by market or region
   - **Status:** Not required - uses existing `agency_market` in reservation table if needed

---

## Summary

### ✅ **NO ADDITIONAL DATA SYNC REQUIRED**

Both features use **existing data** that is already synced from Azure Synapse:

1. **Build Curves:**
   - Uses `reservation_changes` table (already synced)
   - Uses `master_sail` table (already synced)
   - Uses `reservation` table (already synced)

2. **Target Profiles:**
   - User-created data stored in new `target_profiles` table
   - Can reference historic sailings using existing data
   - No source database dependency

### Data Sources Used

| Feature | Data Source | Table | Status |
|--------|------------|-------|--------|
| Build Curves | Reservation Changes | `reservation_changes` | ✅ Available |
| Build Curves | Sail Metadata | `master_sail` | ✅ Available |
| Target Profiles | User Data | `target_profiles` | ✅ New Table (Local) |
| Target Profiles | Historic Reference | `reservation_changes` | ✅ Available |

---

## Next Steps

1. ✅ Database migration for `target_profiles` table - **COMPLETE**
2. ✅ GraphQL schema extensions - **COMPLETE**
3. ✅ Service layer implementation - **COMPLETE**
4. ✅ Frontend components - **COMPLETE**
5. ⏳ Test with real data
6. ⏳ Apply migration to database
7. ⏳ Register components in App.jsx

---

## Notes

- All required data is already available in Supabase
- No changes needed to sync process
- Target profiles are purely local (Supabase) data
- Build curves are calculated from existing reservation change history

