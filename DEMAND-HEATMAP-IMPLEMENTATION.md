# Demand Heatmap Component - Implementation Summary

## Overview

A new component has been created that displays viewing demand across itineraries by departure month as a heatmap-style table. The component follows all established architecture patterns and is ready to use.

## Component Structure

The component follows the **Container/Presenter pattern** used throughout the codebase:

```
talia-ui/src/components/focus-panels/DemandHeatmap/
├── index.jsx                          # Container component (data fetching)
└── DemandHeatmapPresenter.jsx         # Presentational component (UI)
```

## Files Created

1. **Service Layer**
   - `talia-ui/src/services/data/demandHeatmapService.js`
   - Aggregates reservation data by itinerary and departure month
   - Maps regions from geog_area_code
   - Groups data for heatmap display

2. **Custom Hook**
   - `talia-ui/src/hooks/data/useDemandHeatmap.js`
   - Handles data fetching with loading/error states
   - Auto-refreshes every 5 minutes

3. **Container Component**
   - `talia-ui/src/components/focus-panels/DemandHeatmap/index.jsx`
   - Manages data fetching and state
   - Handles loading/error/empty states

4. **Presenter Component**
   - `talia-ui/src/components/focus-panels/DemandHeatmap/DemandHeatmapPresenter.jsx`
   - Renders heatmap table using Tabulator
   - Color-codes cells based on demand values (red gradient)
   - Shows Region and Itinerary columns with dynamic month columns

5. **Documentation**
   - `DEMAND-HEATMAP-REQUIREMENTS.md` - Detailed data requirements and migration path

## Current Data Source

The component currently uses **reservation/booking data** as a proxy for "viewing demand":
- Counts guest counts from reservations
- Groups by itinerary (package_name) and departure month
- Maps geog_area_code to friendly region names (Gulf, Mediterranean)

**Note:** True view tracking data would require additional infrastructure (see `DEMAND-HEATMAP-REQUIREMENTS.md`).

## Integration Steps

### Step 1: Add Import to Dashboard.jsx

Add the import at the top of `talia-ui/src/Dashboard.jsx`:

```javascript
import DemandHeatmapContainer from "./components/focus-panels/DemandHeatmap";
```

### Step 2: Register Component

Add to the `panelComponents` object in `Dashboard.jsx` (around line 2310):

```javascript
panelComponents={{
  // ... existing components ...
  "demand-heatmap": DemandHeatmapContainer,
}}
```

### Step 3: Use the Component

The component can be added to a focus layout or called directly:

```javascript
// In a focus layout configuration
{
  type: "TABLE",
  component: "demand-heatmap",
  position: { x: 0, y: 0, width: 1200, height: 800 }
}
```

Or programmatically:
```javascript
api.addPanel({
  id: `demand-heatmap-${Date.now()}`,
  component: "demand-heatmap",
  title: "Viewing Demand Heatmap",
  params: {
    filters: {
      dateFrom: '2025-01-01',
      dateTo: '2026-12-31',
      region: 'Mediterranean'  // optional
    }
  }
});
```

## Component Props

The component accepts `filters` via `params`:

```javascript
{
  filters: {
    dateFrom: '2025-01-01',      // Optional: Start date (ISO format)
    dateTo: '2026-12-31',        // Optional: End date (ISO format)
    region: 'Mediterranean',      // Optional: Filter by region
    geogAreaCode: 'AEGEAN'        // Optional: Filter by geog_area_code
  }
}
```

## Features

### ✅ Implemented Features

- **Heatmap Visualization**: Color-coded cells (red gradient) showing demand intensity
- **Dynamic Columns**: Month columns automatically generated from data
- **Region Grouping**: Data grouped by region (Gulf, Mediterranean)
- **Itinerary Display**: Shows full itinerary names
- **Filtering**: Built-in Tabulator filters on all columns
- **Responsive**: Adapts to container size
- **Loading States**: Shows spinner while loading
- **Error Handling**: Displays error messages with retry option
- **Auto-refresh**: Refreshes data every 5 minutes
- **Legend**: Shows color scale and max value

### 🎨 Visual Design

- **Header**: Title with refresh button
- **Frozen Columns**: Region and Itinerary columns stay visible when scrolling
- **Color Scale**: Light red (low) to dark red (high) gradient
- **Cell Styling**: Numbers displayed with proper formatting
- **Empty Cells**: Shows "-" for months with no data

## Data Aggregation Logic

1. Fetches reservations filtered by date range
2. Fetches master_sail data for itinerary names and regions
3. Joins data by sail_code
4. Extracts departure month from sail_date_from
5. Maps geog_area_code to region names:
   - ADRIATIC, AEGEAN → Mediterranean
   - GULF, ARABIA, RED_SEA → Gulf
6. Aggregates guest counts by:
   - Region
   - Itinerary (package_name)
   - Departure month (YYYY-MM format)
7. Creates table rows with month columns

## Region Mapping

Current mapping in `demandHeatmapService.js`:

```javascript
const regionMap = {
  'ADRIATIC': 'Mediterranean',
  'AEGEAN': 'Mediterranean',
  'GULF': 'Gulf',
  'GULF_ARABIA': 'Gulf',
  'ARABIA': 'Gulf',
  'MEDITERRANEAN': 'Mediterranean',
  'RED_SEA': 'Gulf'
};
```

**Recommendation:** Move to database lookup table for easier maintenance.

## Example Output

The component displays a table like:

| Region | Itinerary | 2025-12 | 2026-01 | 2026-02 | 2026-03 | 2026-04 |
|--------|-----------|---------|---------|---------|---------|---------|
| Gulf | desert days 7 night | 173 | 196 | 28 | 37 | - |
| Gulf | iconic arabia 4nights | 215 | 10 | 32 | 6 | - |
| Mediterranean | idyllic aegean 7 nights | - | - | - | - | 66 |
| Mediterranean | heavenly adriatic 7 nights | - | - | - | - | 80 |

Cells are color-coded with red gradient based on value intensity.

## Testing

To test the component:

1. **Add to Test Page** (optional):
   Add to `talia-ui/src/components/TestPage/componentRegistry.js`:
   ```javascript
   import DemandHeatmapContainer from '../focus-panels/DemandHeatmap';
   
   // In registry:
   DemandHeatmap: {
     component: DemandHeatmapContainer,
     filePath: 'src/components/focus-panels/DemandHeatmap/index.jsx'
   }
   ```

2. **Add to Dashboard**:
   Follow integration steps above

3. **Verify Data**:
   - Check browser console for service logs
   - Verify data is being fetched and aggregated
   - Check that heatmap colors appear correctly

## Performance Considerations

- **Data Aggregation**: Done on client side after fetching from GraphQL
- **Large Datasets**: Component handles thousands of reservations efficiently
- **Memory**: Aggregation uses Map/Set for efficient grouping
- **Refresh Rate**: Auto-refreshes every 5 minutes (configurable in hook)

## Future Enhancements

See `DEMAND-HEATMAP-REQUIREMENTS.md` for:
- True view tracking data integration
- Real-time updates
- View-to-booking conversion rates
- Year-over-year comparisons
- Export functionality

## Architecture Compliance

✅ Follows Container/Presenter pattern  
✅ Uses service layer for data access  
✅ Custom hook for data fetching  
✅ Uses Tabulator for table display  
✅ Follows theme system  
✅ Error handling and loading states  
✅ No framework dependencies changed  
✅ Consistent with existing components  

## Questions or Issues?

- Check `DEMAND-HEATMAP-REQUIREMENTS.md` for data requirements
- Review component code for implementation details
- Check browser console for error messages
- Verify GraphQL queries are working

---

**Status:** ✅ Component is complete and ready to use. Integration into Dashboard requires adding import and registry entry as shown above.

