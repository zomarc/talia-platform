# Plan: Booking Profile Component with Year-on-Year Comparison

## Overview

Create a component that displays a booking profile for a sailing, showing booking trends over time with year-on-year comparison capabilities.

## Data Verification Results

### ✅ Current Data Available
- **Reservations**: 31,330 reservations (2025-09-01 to 2025-12-29)
- **Reservation Changes**: 848,906 changes tracked over 78 unique dates
- **Master Sail**: 213 sailings with sail codes
- **Sail Code Resolution**: Can join `reservation` with `master_sail` on `ship_code` + `sail_date_from` to get `sail_code`

### ⚠️ Data Gaps
- **Sail Code**: Not in `reservation` table directly (need to join with `master_sail`)
- **Previous Year Data**: Only 2025 data currently synced (need to sync 2024 data)
- **Reservation Changes**: Has `sail_code_changed` flag but `sail_code` is NULL (not available in snapshot table)

## Component Requirements

### 1. Booking Profile Display
**Purpose**: Show booking trends for a specific sailing over time

**Data Needed**:
- Current bookings (reservations) for the sailing
- Booking changes over time (from `reservation_changes`)
- Booking velocity (new bookings per day/week)
- Guest count trends
- Status changes (BK, CX, etc.)

**Key Metrics**:
- Total reservations
- Total guests
- Booking velocity (bookings per day)
- Cancellation rate
- Net bookings (new - cancellations)

### 2. Year-on-Year Comparison
**Purpose**: Compare current sailing with same sailing from previous year

**Data Needed**:
- Current year data (2025)
- Previous year data (2024) - **NEEDS TO BE SYNCED**
- Same sailing code pattern (e.g., CJ07250901 vs CJ07240901)
- Same relative date (e.g., 90 days before sailing)

**Comparison Metrics**:
- Bookings at same point in time
- Guest count comparison
- Booking velocity comparison
- Occupancy percentage comparison

## Implementation Plan

### Phase 1: Data Preparation

#### Step 1.1: Sync Previous Year Data
**Tasks**:
- [ ] Update sync config to include 2024 date range
- [ ] Sync reservations for 2024 (Sept-Dec 2024)
- [ ] Sync reservation changes for 2024
- [ ] Sync master_sail for 2024 (if available)

**Files to Modify**:
- `talia-server/sync.config.json` - Add 2024 dataset or extend date range
- May need to create new dataset: `sept-dec-2024`

**Considerations**:
- Need to ensure no conflicts with existing 2025 data
- May need separate dataset or careful date filtering

#### Step 1.2: Create Booking Profile Query/Service
**Tasks**:
- [ ] Create GraphQL query or REST endpoint for booking profile data
- [ ] Join reservations with master_sail to get sail_code
- [ ] Aggregate reservation changes by date for a sailing
- [ ] Calculate booking velocity and trends

**Data Structure**:
```sql
-- Booking profile for a sailing
SELECT 
  ms.sail_code,
  ms.sail_date_from,
  ms.ship_name,
  DATE_TRUNC('day', rc.snapshot_date) as booking_date,
  COUNT(DISTINCT rc.res_id) as bookings,
  SUM(rc.guest_count) as guests,
  COUNT(*) FILTER (WHERE rc.guest_count_delta > 0) as new_bookings,
  COUNT(*) FILTER (WHERE rc.guest_count_delta < 0) as cancellations
FROM reservation_changes rc
JOIN reservation r ON rc.res_id = r.res_id
JOIN master_sail ms ON r.ship = ms.ship_code AND r.sail_from_date = ms.sail_date_from
WHERE ms.sail_code = $1
GROUP BY ms.sail_code, ms.sail_date_from, ms.ship_name, DATE_TRUNC('day', rc.snapshot_date)
ORDER BY booking_date;
```

**Files to Create**:
- `talia-server/src/api/resolvers.ts` - Add `bookingProfile` query
- `talia-server/src/api/schema.ts` - Add `BookingProfile` type
- `talia-ui/src/services/data/bookingProfileService.js` - Frontend service

### Phase 2: Backend API Development

#### Step 2.1: GraphQL Schema
**Tasks**:
- [ ] Define `BookingProfile` type
- [ ] Define `BookingDataPoint` type (daily/weekly aggregates)
- [ ] Define `YearOverYearComparison` type
- [ ] Add `bookingProfile` query

**Schema Example**:
```graphql
type BookingDataPoint {
  date: String!
  bookings: Int!
  guests: Int!
  newBookings: Int!
  cancellations: Int!
  netBookings: Int!
}

type BookingProfile {
  sailCode: String!
  sailDate: String!
  shipName: String!
  currentBookings: Int!
  currentGuests: Int!
  bookingDataPoints: [BookingDataPoint!]!
  bookingVelocity: Float! # bookings per day
  cancellationRate: Float!
}

type YearOverYearComparison {
  currentYear: BookingProfile!
  previousYear: BookingProfile
  comparison: ComparisonMetrics
}

type ComparisonMetrics {
  bookingsDifference: Int!
  bookingsPercentageChange: Float!
  guestsDifference: Int!
  velocityDifference: Float!
}
```

#### Step 2.2: Resolvers
**Tasks**:
- [ ] Implement `bookingProfile` resolver
- [ ] Implement year-over-year comparison logic
- [ ] Handle edge cases (no previous year data, etc.)

**Files to Modify**:
- `talia-server/src/api/schema.ts`
- `talia-server/src/api/resolvers.ts`
- `talia-server/src/services/supabase.js` - Add booking profile queries

### Phase 3: Frontend Component Development

#### Step 3.1: Create Booking Profile Component
**Tasks**:
- [ ] Create `BookingProfile` component structure
- [ ] Create hook `useBookingProfile(sailCode)`
- [ ] Display booking trends chart
- [ ] Display key metrics (KPI cards)
- [ ] Display booking velocity

**Component Structure**:
```
BookingProfile/
  ├── index.jsx (container)
  ├── BookingProfilePresenter.jsx (presentation)
  ├── BookingTrendChart.jsx (Chart.js chart)
  ├── BookingMetrics.jsx (KPI cards)
  └── YearOverYearComparison.jsx (comparison view)
```

**Files to Create**:
- `talia-ui/src/components/focus-panels/BookingProfile/index.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingProfilePresenter.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingTrendChart.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingMetrics.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/YearOverYearComparison.jsx`
- `talia-ui/src/hooks/data/useBookingProfile.js`
- `talia-ui/src/services/data/bookingProfileService.js`

#### Step 3.2: Integrate with Existing Components
**Tasks**:
- [ ] Add BookingProfile to component registry
- [ ] Add to TestPage for testing
- [ ] Add to Dashboard/Focus panels if needed
- [ ] Ensure it works with existing theme system

**Files to Modify**:
- `talia-ui/src/components/TestPage/componentRegistry.js`
- `talia-ui/src/components/Dashboard.jsx` (if needed)

### Phase 4: Year-on-Year Comparison

#### Step 4.1: Previous Year Data Sync
**Tasks**:
- [ ] Create 2024 dataset configuration
- [ ] Sync 2024 reservations
- [ ] Sync 2024 reservation changes
- [ ] Verify data quality

**Files to Create/Modify**:
- `talia-server/sync.config.json` - Add `sept-dec-2024` dataset

#### Step 4.2: Comparison Logic
**Tasks**:
- [ ] Implement sailing code pattern matching (e.g., CJ07250901 → CJ07240901)
- [ ] Implement relative date comparison (e.g., 90 days before sailing)
- [ ] Calculate comparison metrics
- [ ] Handle missing previous year data gracefully

**Implementation**:
- Match sailings by: ship_code + relative_date (e.g., 7-day sailing on Sept 1)
- Compare at same point in booking cycle (e.g., 90 days before sailing)

## Technical Considerations

### Sail Code Resolution
**Current Issue**: `sail_code` is NULL in reservation table

**Solution**: Join with `master_sail` table
```sql
JOIN master_sail ms ON 
  r.ship = ms.ship_code 
  AND r.sail_from_date = ms.sail_date_from
```

**Alternative**: Update reservation sync to include sail_code from master_sail during transform

### Previous Year Data
**Challenge**: Need to sync 2024 data without conflicts

**Options**:
1. **Separate Dataset**: Create `sept-dec-2024` dataset
2. **Extended Date Range**: Extend current dataset to include 2024
3. **Separate Tables**: Use date-based partitioning (not recommended)

**Recommendation**: Use separate dataset `sept-dec-2024` for clarity

### Performance
**Considerations**:
- Booking profile queries may be expensive (aggregating changes)
- Consider caching for frequently accessed sailings
- Use indexes on `sail_code`, `snapshot_date`, `res_id`

**Indexes Needed**:
```sql
CREATE INDEX IF NOT EXISTS idx_reservation_changes_snapshot_date ON reservation_changes(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reservation_changes_res_id ON reservation_changes(res_id);
CREATE INDEX IF NOT EXISTS idx_master_sail_sail_code ON master_sail(sail_code);
CREATE INDEX IF NOT EXISTS idx_reservation_sail_from_date ON reservation(sail_from_date);
```

## Testing Strategy

### Unit Tests
- [ ] Test booking profile query with sample data
- [ ] Test year-over-year comparison logic
- [ ] Test edge cases (no data, missing previous year)

### Integration Tests
- [ ] Test component with real data
- [ ] Test year-over-year comparison with 2024/2025 data
- [ ] Test performance with large datasets

### User Acceptance
- [ ] Verify booking trends display correctly
- [ ] Verify year-over-year comparison is accurate
- [ ] Verify component integrates well with existing UI

## Success Criteria

- [ ] Component displays booking profile for a sailing
- [ ] Shows booking trends over time
- [ ] Shows key metrics (bookings, guests, velocity)
- [ ] Year-on-year comparison works correctly
- [ ] Previous year data is synced and accessible
- [ ] Component integrates without breaking existing functionality
- [ ] Performance is acceptable (< 2 seconds to load)

## Implementation Order

1. **Phase 1.1** - Sync previous year data (2024)
2. **Phase 1.2** - Create booking profile query/service
3. **Phase 2** - Backend API (GraphQL schema + resolvers)
4. **Phase 3.1** - Frontend component (basic booking profile)
5. **Phase 4** - Year-on-year comparison
6. **Phase 3.2** - Integration and polish

## Files Summary

### Backend (New)
- `talia-server/src/api/schema.ts` - Add BookingProfile types
- `talia-server/src/api/resolvers.ts` - Add bookingProfile resolver
- `talia-server/src/services/supabase.js` - Add booking profile queries

### Backend (Modify)
- `talia-server/sync.config.json` - Add 2024 dataset

### Frontend (New)
- `talia-ui/src/components/focus-panels/BookingProfile/index.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingProfilePresenter.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingTrendChart.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/BookingMetrics.jsx`
- `talia-ui/src/components/focus-panels/BookingProfile/YearOverYearComparison.jsx`
- `talia-ui/src/hooks/data/useBookingProfile.js`
- `talia-ui/src/services/data/bookingProfileService.js`

### Frontend (Modify)
- `talia-ui/src/components/TestPage/componentRegistry.js` - Add BookingProfile

## Risks & Mitigation

**Risk 1**: Previous year data may not be available in Synapse
- **Mitigation**: Check availability first, handle gracefully if missing

**Risk 2**: Sail code matching between years may be complex
- **Mitigation**: Use ship_code + relative_date pattern matching

**Risk 3**: Performance issues with large datasets
- **Mitigation**: Add indexes, consider caching, optimize queries

**Risk 4**: Breaking existing functionality
- **Mitigation**: Test thoroughly, add component to TestPage first, use feature flags if needed


