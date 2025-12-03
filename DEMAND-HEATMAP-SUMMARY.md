# Demand Heatmap - Implementation Summary

## Overview
Aggregated demand visualization showing guest counts by itinerary and departure month with color-coded heatmap cells.

## Architecture
- **Table**: `demand_heatmap_data` (pre-aggregated)
- **GraphQL Query**: `demandHeatmapData(filters, includeMockData)`
- **Component**: `DemandHeatmapContainer` → `DemandHeatmapPresenter`
- **Service**: `demandHeatmapService.js` (uses new aggregated table)

## Data Flow
```
Frontend → demandHeatmapService → GraphQL → demandHeatmapData resolver → 
SupabaseDataService.getDemandHeatmapData() → demand_heatmap_data table
```

## Key Files
- **Backend**: `talia-server/src/api/resolvers.ts` (demandHeatmapData resolver)
- **Backend**: `talia-server/src/services/supabase.js` (getDemandHeatmapData method)
- **Backend**: `talia-server/src/api/schema.ts` (DemandHeatmapResult types)
- **Frontend**: `talia-ui/src/services/data/demandHeatmapService.js`
- **Frontend**: `talia-ui/src/components/focus-panels/DemandHeatmap/`

## Mock Data
- **Table**: `demand_heatmap_data` with `is_mock_data = true`
- **Records**: 33 rows covering 12 months, 2 regions, 5 itineraries
- **TestPage Indicator**: Shows "🧪 MOCK DATA" badge

## Status: ✅ Complete
