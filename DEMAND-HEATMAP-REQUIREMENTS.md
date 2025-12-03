# Demand Heatmap Component - Data Requirements

## Overview

The Demand Heatmap component displays viewing demand across itineraries by departure month. The component has been created following the established architecture patterns, but currently uses **reservation/booking data as a proxy** for viewing demand since actual view tracking data is not available.

## Current Implementation

### What We Have

The component currently uses:
- **Reservation data** (`reservation` table) - Guest counts grouped by sail code and departure date
- **Master Sail data** (`master_sail` table) - Itinerary names, regions (geog_area_code), and departure dates
- **Aggregation logic** - Groups reservations by itinerary and departure month to show "demand"

### Data Flow

1. Fetch reservations filtered by date range
2. Fetch master_sail data to get itinerary names and regions
3. Join data by sail_code
4. Aggregate guest counts by:
   - Region (mapped from geog_area_code)
   - Itinerary (package_name)
   - Departure month (extracted from sail_date_from)
5. Display as heatmap table with color-coded cells

## Missing Data - True View Tracking

### What's Missing

To accurately represent "Viewing Demand" as shown in the reference image, we need:

#### 1. View/Impression Tracking Data

**Required Fields:**
- `view_id` - Unique identifier for each view
- `itinerary_code` or `package_name` - Which itinerary was viewed
- `view_timestamp` - When the view occurred
- `departure_month` - The departure month being viewed
- `region` or `geog_area_code` - Geographic region
- `user_session_id` (optional) - For deduplication
- `source` (optional) - Where the view came from (website, mobile, etc.)

**Suggested Table Structure:**

```sql
CREATE TABLE IF NOT EXISTS itinerary_views (
  id SERIAL PRIMARY KEY,
  view_id TEXT UNIQUE,
  itinerary_code TEXT,
  package_name TEXT,
  sail_code TEXT,
  departure_date DATE,
  departure_month DATE,  -- First day of month
  region TEXT,
  geog_area_code TEXT,
  view_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_session_id TEXT,
  source TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_itinerary_views_package_name ON itinerary_views(package_name);
CREATE INDEX idx_itinerary_views_departure_month ON itinerary_views(departure_month);
CREATE INDEX idx_itinerary_views_region ON itinerary_views(region);
CREATE INDEX idx_itinerary_views_view_timestamp ON itinerary_views(view_timestamp);
```

#### 2. Integration Points

**Where to Track Views:**

1. **Website/Booking Engine**
   - Track when user views an itinerary page
   - Track when user views departure dates for an itinerary
   - Send events to backend API

2. **Mobile App** (if applicable)
   - Track itinerary views
   - Track departure date selections

3. **Backend API Endpoint**
   - Accept view tracking events
   - Store in database
   - Handle deduplication (same user viewing multiple times)

#### 3. Data Collection Example

**API Endpoint:**
```
POST /api/track-view
Body: {
  itineraryCode: "ICONIC_GREEK_ISLANDS_3N",
  packageName: "Iconic Greek Islands 3 Nights",
  sailCode: "CJ250601",
  departureDate: "2026-04-01",
  region: "Mediterranean",
  source: "website",
  sessionId: "abc123"
}
```

#### 4. GraphQL Schema Extension

Add to `talia-server/src/api/schema.ts`:

```graphql
type ItineraryView {
  id: ID!
  itineraryCode: String!
  packageName: String!
  sailCode: String
  departureDate: String!
  departureMonth: String!  # YYYY-MM format
  region: String!
  viewTimestamp: String!
  source: String
}

type ViewDemandData {
  region: String!
  itinerary: String!
  months: [MonthViewCount!]!
}

type MonthViewCount {
  month: String!  # YYYY-MM format
  views: Int!
}

type Query {
  itineraryViews(filters: ItineraryViewFilters): [ItineraryView!]!
  viewDemandHeatmap(filters: ViewDemandFilters): [ViewDemandData!]!
}

input ItineraryViewFilters {
  region: String
  itineraryCode: String
  departureMonth: String  # YYYY-MM format
  dateFrom: String
  dateTo: String
}

input ViewDemandFilters {
  region: String
  dateFrom: String
  dateTo: String
  groupBy: ViewGroupBy  # "itinerary" | "month" | "both"
}

enum ViewGroupBy {
  ITINERARY
  MONTH
  BOTH
}
```

## Implementation Recommendations

### Phase 1: Use Current Reservation-Based Approach (Current)

- ✅ Component is functional using reservations as proxy
- ✅ Shows booking trends which correlate with interest
- ⚠️ Not true "viewing" data but still valuable

### Phase 2: Add View Tracking Infrastructure

1. **Create view tracking table** (migration)
2. **Create API endpoint** for tracking views
3. **Add tracking code** to frontend (website/app)
4. **Update GraphQL schema** with view queries
5. **Update service** to fetch real view data
6. **Update component** to use view data instead of reservations

### Phase 3: Enhanced Features

- Time-based filtering (last 7 days, 30 days, etc.)
- View-to-booking conversion rates
- Trend analysis (views increasing/decreasing)
- Comparative views (year-over-year)

## Migration Path

### Step 1: Keep Reservation-Based (Current)

The component works with existing data:
```javascript
// Current: Uses reservations
const { data, months } = useDemandHeatmap({
  dateFrom: '2025-01-01',
  dateTo: '2026-12-31'
});
```

### Step 2: Add View Tracking Table

Create migration to add `itinerary_views` table:
```sql
-- Migration: 20251202_create_itinerary_views_table.sql
-- (See suggested schema above)
```

### Step 3: Create Tracking API

Add endpoint to track views:
```javascript
// talia-server/src/api/routes/tracking.js
router.post('/track-view', async (req, res) => {
  // Store view in itinerary_views table
});
```

### Step 4: Update Service

Modify `demandHeatmapService.js` to optionally use view data:
```javascript
async fetch(filters = {}, useViews = false) {
  if (useViews) {
    // Fetch from itinerary_views table
    return this.fetchFromViews(filters);
  } else {
    // Current: Fetch from reservations
    return this.fetchFromReservations(filters);
  }
}
```

### Step 5: Update Component

Add toggle or prop to switch between views and bookings:
```javascript
<DemandHeatmapContainer 
  filters={filters}
  dataSource="views"  // or "bookings"
/>
```

## Data Quality Considerations

### Deduplication

- Same user viewing multiple times in a session - count once?
- Same IP viewing multiple times - count once?
- Bot traffic - filter out?

**Recommendation:** Count all views initially, add deduplication as a filter option later.

### Real-time vs. Aggregated

- **Real-time**: Show views as they happen (requires WebSocket/SSE)
- **Aggregated**: Show daily/hourly aggregates (better performance)

**Recommendation:** Start with hourly aggregates, add real-time option later.

### Region Mapping

Current mapping logic in `demandHeatmapService.js`:
```javascript
const regionMap = {
  'ADRIATIC': 'Mediterranean',
  'AEGEAN': 'Mediterranean',
  'GULF': 'Gulf',
  // ... more mappings
};
```

**Recommendation:** Move region mapping to database lookup table for easier maintenance.

## Component Usage

### Current Usage (Reservation-Based)

```jsx
import DemandHeatmapContainer from './components/focus-panels/DemandHeatmap';

<DemandHeatmapContainer 
  filters={{
    dateFrom: '2025-01-01',
    dateTo: '2026-12-31',
    region: 'Mediterranean'  // optional
  }}
/>
```

### Future Usage (View-Based)

```jsx
<DemandHeatmapContainer 
  filters={{
    dateFrom: '2025-01-01',
    dateTo: '2026-12-31',
    region: 'Mediterranean'
  }}
  dataSource="views"  // Use view tracking data
/>
```

## Summary

### ✅ What's Working Now

- Component structure and architecture following established patterns
- Heatmap visualization with color-coded cells
- Uses reservation data as proxy for demand
- Filtering and grouping by region and itinerary
- Dynamic month columns based on available data

### ⚠️ What's Missing

- **True view tracking data** - Currently using reservations/bookings as proxy
- **View tracking infrastructure** - Table, API endpoint, frontend tracking
- **GraphQL queries** - For fetching view data
- **Region mapping table** - Currently hardcoded in service

### 🔄 Migration Path

1. Component is ready - works with current data
2. Add view tracking table and API
3. Update service to fetch view data
4. Optionally toggle between views and bookings

## Files Created

- `talia-ui/src/services/data/demandHeatmapService.js` - Service layer
- `talia-ui/src/hooks/data/useDemandHeatmap.js` - Custom hook
- `talia-ui/src/components/focus-panels/DemandHeatmap/index.jsx` - Container
- `talia-ui/src/components/focus-panels/DemandHeatmap/DemandHeatmapPresenter.jsx` - Presenter

## Next Steps

1. **Review component** - Test with existing reservation data
2. **Plan view tracking** - Decide on tracking strategy and infrastructure
3. **Create tracking table** - Database migration
4. **Implement tracking API** - Backend endpoint
5. **Add frontend tracking** - Website/app integration
6. **Update component** - Switch to view data when available

---

**Note:** The component follows all established patterns and is production-ready. It currently provides value using reservation data as a demand indicator, and can be easily upgraded to use true view tracking data when that infrastructure is in place.

