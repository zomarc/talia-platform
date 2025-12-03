# Competitor Pricing Component - Implementation Plan

## Overview
Recreate the Power BI "Competitor Pricing | Latest Prices By Cabin Type" report as a React component following all established architecture rules.

## Power BI Report Analysis

### Key Features
1. **Title**: "Competitor Pricing | Andy-Demo | Latest Prices By Cabin Type"
2. **Filters** (top section):
   - Currency_Code (e.g., "EUR")
   - Cruise_Duration (e.g., "7")
   - Source_Destination (e.g., "Med")
   - Cabin Type (e.g., "All")
   - Departure Month (e.g., "May")
3. **Visualizations** (2x2 grid of scatter plots):
   - BALCONY (top-left)
   - INSIDE (top-right)
   - OUTSIDE (bottom-left)
   - SUITE (bottom-right)
   - Each plot: X-axis = Departure Date, Y-axis = PPPD (0-600)
   - Legend: Cruise lines with different colors
4. **Filter Pane** (right side):
   - Is_Latest filter
   - Additional filters
5. **Data Table** (bottom):
   - Columns: Cruise_Line_Name, Currency, Ship_Code, Source_Ship_Name, Cabin_Type, Departure_Date, Departure_Port, Source_Destination, Market, Itinerary_Code, Available_Offer, Total_Rate_PP, Min of PPPD

## Data Requirements

### Database Tables
- **Primary**: `competitor_current_state` (latest competitor pricing data)
- **Historical**: `competitor` (for change tracking, if needed)

### Key Fields
- `cruise_line` → Cruise_Line_Name
- `currency` → Currency_Code
- `duration` → Cruise_Duration
- `destination` → Source_Destination
- `departure_date` → WC_Departure_Date
- `departure_port` → Departure_Port
- `ship_name` → Source_Ship_Name
- `market` → Market
- `lowest_inside`, `lowest_outside`, `lowest_balcony`, `lowest_suite` → Cabin Type prices
- `snapshot_date` → For "Is_Latest" filter

### Calculated Fields
- **PPPD** (Price Per Person Per Day) = `lowest_price / duration` (or cabin-specific price / duration)
- **Departure Month** = Extract month from `departure_date`

## Component Architecture

### File Structure
```
talia-ui/src/
├── components/
│   └── focus-panels/
│       └── CompetitorPricing/
│           ├── index.jsx                          # Container component
│           ├── CompetitorPricingPresenter.jsx     # Presentational component
│           └── components/
│               ├── CompetitorScatterChart.jsx    # 2x2 grid of scatter plots
│               ├── CompetitorPricingTable.jsx    # Detailed data table
│               └── CompetitorPricingFilters.jsx   # Filter controls
├── services/
│   └── data/
│       └── competitorPricingService.js           # Service layer
└── hooks/
    └── data/
        └── useCompetitorPricing.js                # Custom hook
```

### Backend Structure
```
talia-server/src/
├── api/
│   ├── schema.ts                                  # GraphQL schema extension
│   └── resolvers.ts                               # Resolver implementation
```

## Implementation Steps

### Phase 1: Backend (GraphQL)

#### 1.1 GraphQL Schema Extension
**File**: `talia-server/src/api/schema.ts`

Add types:
```graphql
type CompetitorPricingData {
  id: ID!
  cruiseLine: String!
  currency: String!
  shipCode: String
  shipName: String!
  cabinType: String!
  departureDate: String!
  departurePort: String
  destination: String!
  market: String
  duration: Float!
  pppd: Float!
  totalRatePP: Float!
  snapshotDate: String!
  availableOffer: String
  itineraryCode: String
}

input CompetitorPricingFilters {
  currency: String
  duration: Float
  destination: String
  cabinType: String  # "ALL", "INSIDE", "OUTSIDE", "BALCONY", "SUITE"
  departureMonth: Int  # 1-12
  isLatest: Boolean
  cruiseLine: String
  market: String
}

type Query {
  competitorPricing(filters: CompetitorPricingFilters): [CompetitorPricingData!]!
}
```

#### 1.2 GraphQL Resolver
**File**: `talia-server/src/api/resolvers.ts`

Implement resolver that:
1. Queries `competitor_current_state` table
2. Applies filters (currency, duration, destination, cabin type, month)
3. Calculates PPPD for each cabin type
4. Filters by `isLatest` (latest snapshot_date)
5. Returns formatted data

**Key Logic**:
- For "ALL" cabin type, return all cabin types separately
- Calculate PPPD: `(lowest_inside|outside|balcony|suite) / duration`
- Filter by month: Extract month from `departure_date`
- Group by cruise line for legend colors

### Phase 2: Frontend Service Layer

#### 2.1 Service Implementation
**File**: `talia-ui/src/services/data/competitorPricingService.js`

```javascript
import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_COMPETITOR_PRICING = gql`
  query GetCompetitorPricing($filters: CompetitorPricingFilters) {
    competitorPricing(filters: $filters) {
      id
      cruiseLine
      currency
      shipCode
      shipName
      cabinType
      departureDate
      departurePort
      destination
      market
      duration
      pppd
      totalRatePP
      snapshotDate
      availableOffer
      itineraryCode
    }
  }
`;

class CompetitorPricingService {
  async fetch(filters = {}) {
    const { data } = await apolloClient.query({
      query: GET_COMPETITOR_PRICING,
      variables: { filters },
      fetchPolicy: 'network-only'
    });
    return data.competitorPricing;
  }
}

export default new CompetitorPricingService();
```

### Phase 3: Frontend Hook

#### 3.1 Custom Hook
**File**: `talia-ui/src/hooks/data/useCompetitorPricing.js`

```javascript
import { useState, useEffect } from 'react';
import competitorPricingService from '../../services/data/competitorPricingService';

export const useCompetitorPricing = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const result = await competitorPricingService.fetch(filters);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [JSON.stringify(filters)]);

  return { data, loading, error, refetch: () => fetch() };
};
```

### Phase 4: Frontend Components

#### 4.1 Container Component
**File**: `talia-ui/src/components/focus-panels/CompetitorPricing/index.jsx`

- Uses `useCompetitorPricing` hook
- Manages filter state
- Handles loading/error states
- Passes data to presenter

#### 4.2 Presenter Component
**File**: `talia-ui/src/components/focus-panels/CompetitorPricing/CompetitorPricingPresenter.jsx`

**Layout**:
1. **Title Section**: "Competitor Pricing | Latest Prices By Cabin Type"
2. **Filter Section**: Dropdowns for Currency, Duration, Destination, Cabin Type, Departure Month
3. **Main Content** (2 columns):
   - **Left**: 2x2 grid of scatter plots
   - **Right**: Filter pane (Is_Latest, etc.)
4. **Table Section**: Detailed data table below

**Features**:
- Theme integration
- Responsive layout
- Filter state management
- Data transformation for charts

#### 4.3 Scatter Chart Component
**File**: `talia-ui/src/components/focus-panels/CompetitorPricing/components/CompetitorScatterChart.jsx`

**Implementation**:
- Uses Chart.js scatter chart type
- 2x2 grid layout (BALCONY, INSIDE, OUTSIDE, SUITE)
- X-axis: Departure Date (time scale)
- Y-axis: PPPD (0-600)
- Legend: Cruise lines with distinct colors
- Tooltips: Show cruise line, date, PPPD, ship name

**Color Scheme** (for cruise lines):
- CELEBRITY CRUISES: Blue
- MSC CRUISES: Dark Blue
- ROYAL CARIBBEAN: Orange
- VIRGIN VOYAGES CRUISES: Purple
- Others: Auto-assign from palette

#### 4.4 Pricing Table Component
**File**: `talia-ui/src/components/focus-panels/CompetitorPricing/components/CompetitorPricingTable.jsx`

**Implementation**:
- Uses Tabulator (consistent with existing tables)
- Columns: Cruise_Line_Name, Currency, Ship_Code, Source_Ship_Name, Cabin_Type, Departure_Date, Departure_Port, Source_Destination, Market, Itinerary_Code, Available_Offer, Total_Rate_PP, Min of PPPD
- Sortable, filterable
- Theme integration

#### 4.5 Filters Component
**File**: `talia-ui/src/components/focus-panels/CompetitorPricing/components/CompetitorPricingFilters.jsx`

**Filters**:
- Currency dropdown (from distinct values)
- Duration dropdown (from distinct values)
- Destination dropdown (from distinct values)
- Cabin Type dropdown (ALL, INSIDE, OUTSIDE, BALCONY, SUITE)
- Departure Month dropdown (1-12, or "All")
- Is_Latest checkbox/toggle

## Data Transformation Logic

### For Scatter Charts
```javascript
// Group data by cabin type
const dataByCabinType = {
  BALCONY: data.filter(d => d.cabinType === 'BALCONY'),
  INSIDE: data.filter(d => d.cabinType === 'INSIDE'),
  OUTSIDE: data.filter(d => d.cabinType === 'OUTSIDE'),
  SUITE: data.filter(d => d.cabinType === 'SUITE')
};

// Group by cruise line for legend
const cruiseLines = [...new Set(data.map(d => d.cruiseLine))];

// Create datasets for each cruise line
const datasets = cruiseLines.map((cruiseLine, index) => ({
  label: cruiseLine,
  data: dataByCabinType[cabinType]
    .filter(d => d.cruiseLine === cruiseLine)
    .map(d => ({
      x: new Date(d.departureDate),
      y: d.pppd
    })),
  backgroundColor: getColorForCruiseLine(cruiseLine, index),
  pointRadius: 4,
  pointHoverRadius: 6
}));
```

### For Table
- Direct mapping from GraphQL response
- Calculate "Min of PPPD" per row (already calculated in backend)
- Format dates appropriately

## Component Registration

### In App.jsx or Dashboard.jsx
```javascript
import CompetitorPricing from "./components/focus-panels/CompetitorPricing";

const panelComponent = {
  // ... existing components
  'competitor-pricing': CompetitorPricing,
};
```

### In FocusLayoutEditor.jsx
```javascript
const availableComponentTypes = [
  // ... existing types
  { id: 'competitor-pricing', name: 'Competitor Pricing', icon: '💰' },
];
```

## Testing Checklist

- [ ] GraphQL query returns correct data
- [ ] Filters work correctly (currency, duration, destination, cabin type, month)
- [ ] Scatter plots display correctly for all 4 cabin types
- [ ] Legend shows all cruise lines with distinct colors
- [ ] Tooltips show correct information
- [ ] Table displays all columns correctly
- [ ] Table is sortable and filterable
- [ ] Theme integration works
- [ ] Loading states display
- [ ] Error handling works
- [ ] Responsive layout works
- [ ] Performance is acceptable with large datasets

## Performance Considerations

1. **Data Filtering**: Do as much filtering as possible in the backend/GraphQL resolver
2. **Chart Rendering**: Limit data points if dataset is very large (e.g., max 1000 points per chart)
3. **Memoization**: Use React.memo for chart components
4. **Debouncing**: Debounce filter changes to avoid excessive queries

## Future Enhancements

1. Export to PDF/Excel
2. Comparison mode (compare multiple time periods)
3. Price trend lines
4. Interactive filtering on charts (click to filter table)
5. Drill-down to competitor details

## Notes

- Follow Container/Presenter pattern strictly
- Use existing Chart.js setup (already in use)
- Use existing Tabulator setup (already in use)
- Integrate with theme system
- Follow error handling patterns from existing components
- Use LoadingSpinner and ErrorMessage shared components

