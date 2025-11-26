# Migration to stg.* Tables - Changes Summary

## Files Updated

### 1. sync.config.json

#### Reservations Table
- **Changed source:** `dwh.Fact_Reservation_History` → `stg.RES_HEADER`
- **Updated columns:** Changed to match stg.RES_HEADER column names
  - `[WC_Snapshot_Date]` → Removed (not needed for current state)
  - `[Res_ID]` → `[RES_ID]`
  - `[Ship]` → `[SHIP_CODE]`
  - `[Sail_code]` → Removed (not in RES_HEADER, may need to derive)
  - `[Sail_From_Date]` → `[SAIL_DATE_FROM]`
  - `[Sail_To_Date]` → `[SAIL_DATE_TO]`
  - `[Agency_ID]` → `[AGENCY_ID]`
  - Added: `[SOURCE_CODE]`, `[PROBABILITY]`, `[RES_GUEST_COUNT]`, `[SEC_AGENCY_ID]`, `[PACKAGE_TYPE]`, `[CURRENCY_CODE]`, `[CURRENCY_RATE]`, `[LAST_UPDATED_AT]`
- **Updated filter:** `[Sail_From_Date]` → `[SAIL_DATE_FROM]`

#### Reservation Changes Table
- **Changed source:** `fou.Fact_Reservation_daily` → `stg.RES_HEADER_SNAPSHOT`
- **Updated columns:** Changed to match stg.RES_HEADER_SNAPSHOT column names
  - `Sail_code` → Removed (not in SNAPSHOT table)
  - `RES_ID` → `RES_ID` (same)
  - `Agency_ID` → `AGENCY_ID`
  - `Group_ID` → `GROUP_ID`
  - `Guest_Count` → `RES_GUEST_COUNT`
  - Added: `SHIP`, `RES_STATUS`, `PROBABILITY`, `CABIN_CATEGORY`

### 2. src/services/synapse-sync.js

#### Transform Logic for Reservations
- **Updated:** `transformData` function for `'reservations'` case
- **Column mappings:**
  - `row.Res_ID` → `row.RES_ID`
  - `row.Res_Status` → `row.RES_STATUS`
  - `row.Ship` → `row.SHIP_CODE`
  - `row.Sail_From_Date` → `row.SAIL_DATE_FROM` (with date conversion)
  - `row.Sail_To_Date` → `row.SAIL_DATE_TO` (with date conversion)
  - `row.Agency_ID` → `row.AGENCY_ID`
  - `row.Cabin_Category` → `row.CABIN_CATEGORY`
  - `row.Guest_Count` → `row.RES_GUEST_COUNT`
  - Added mappings for: `source_code`, `res_probability`, `sec_agency_id`, `currency`, `currency_rate`
- **Note:** Many fields set to `null` as they're not available in RES_HEADER (may be in SNAPSHOT tables)

### 3. src/services/reservation-changes-sync.js

#### Active Reservations Query
- **Changed source:** `dwh.Fact_Reservation_History` → `stg.RES_HEADER`
- **Updated filter:** `Sail_From_Date` → `SAIL_DATE_FROM`

#### Query Building
- **Changed table alias:** `frd` (Fact_Reservation_daily) → `rhs` (RES_HEADER_SNAPSHOT)
- **Updated:** `buildRowNumberQuery` function to use `rhs` alias

#### Column References
- **Updated in `processChangesBatch`:**
  - `row.Sail_code` → `null` (not available in SNAPSHOT)
  - `row.Agency_ID` → `row.AGENCY_ID`
  - `row.Group_ID` → `row.GROUP_ID`
  - `row.Guest_Count` → `row.RES_GUEST_COUNT`

## Key Improvements

1. **Simpler Filtering:** No more complex EXISTS subqueries - just filter by `SAIL_DATE_FROM` directly
2. **Better Performance:** Filter active reservations first, then process snapshots
3. **Current State:** Using `stg.RES_HEADER` gives us actual current reservation state
4. **Change Tracking:** Using `stg.RES_HEADER_SNAPSHOT` with `Snapshot_Date` for proper historical tracking

## Known Limitations

1. **Sail Code:** Not available in `stg.RES_HEADER_SNAPSHOT` - may need to:
   - Join with `master_sail` table using `SAIL_ID` (if available)
   - Or derive from `stg.RES_HEADER` by joining on `RES_ID`
   - Or leave as `null` if not critical for change tracking

2. **Revenue Fields:** Not available in `stg.RES_HEADER` - these may be:
   - Only in SNAPSHOT tables
   - Or need to join with other tables
   - Currently set to `null` in transform

3. **Some Fields Missing:** Fields like `pax_status`, `pax_type`, `agency_channel`, etc. are not in `stg.RES_HEADER`
   - May need to join with other stg.* tables
   - Or accept as limitation

## Next Steps

1. ✅ **Config Updated** - sync.config.json uses stg.* tables
2. ✅ **Transform Updated** - Column mappings updated
3. ✅ **Change Tracking Updated** - Uses stg.RES_HEADER_SNAPSHOT
4. ⏭️ **Test Sync** - Run reservation sync and verify data
5. ⏭️ **Test Change Tracking** - Run reservationChanges sync and verify
6. ⏭️ **Enhance if Needed** - Add joins for missing fields if required

## Testing Checklist

- [ ] Run `npm run sync-reservations` and verify:
  - [ ] Data loads correctly
  - [ ] Date filtering works
  - [ ] Column mappings are correct
  - [ ] Data quality is good

- [ ] Run `npm run sync-reservationChanges` and verify:
  - [ ] Only active reservations are processed
  - [ ] Changes are detected correctly
  - [ ] Performance is acceptable
  - [ ] No errors

- [ ] Verify in Supabase:
  - [ ] Reservation table has data
  - [ ] Reservation changes table has data
  - [ ] Data looks correct
  - [ ] Date ranges are correct


