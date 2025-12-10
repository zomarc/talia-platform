# Data Debug View Implementation

## Overview
Created a comprehensive data debugging component accessible in test mode that provides visibility into data quality, table statistics, and change tracking.

## Features Implemented

### 1. Data Debug View Component
- **Location**: `talia-ui/src/components/TestPage/DataDebugView.jsx`
- **Access**: Available in TestPage component selector under "Debugging" category
- **Features**:
  - Ship code filtering
  - Sailing days aggregation (by day with capacity/booked)
  - Year/Month breakdown
  - Total capacity and booked metrics
  - Table overview with:
    - Row counts for all synced tables
    - Last snapshot dates
    - Changes from last sync (from sync_metadata)
    - Changes in last 24 hours (physical data changes)
    - Changes in last month (physical data changes)

### 2. Backend GraphQL API
- **Schema**: Added `DataDebugOverview`, `SailingDayInfo`, `YearMonthInfo`, `TableDebugInfo`, `DataDebugResponse` types
- **Resolver**: `dataDebugInfo` query resolver in `Query` section
- **Data Sources**: All queries use local Supabase joins (no external Synapse queries)
- **Tables Monitored**: 
  - reservation, reservation_changes, reservation_current_state
  - cabin_availability, master_sail, inventory_status_by_day
  - published_rates, sail_by_cabin_occupancy, ship
  - competitor_current_state, published_rates_current_state, reservation_promotion

### 3. Development Improvements
- **Watch Mode**: Updated `dev` script to use `tsx watch` for automatic server reload
- **Theme Handling**: Improved theme handling with proper defaults and separation
- **Error Handling**: Enhanced error messages with helpful debugging information

## Files Created

### Backend
- `talia-server/src/api/schema.ts` - Added GraphQL types
- `talia-server/src/api/resolvers.ts` - Added `dataDebugInfo` resolver

### Frontend
- `talia-ui/src/components/TestPage/DataDebugView.jsx` - Main component
- `talia-ui/src/hooks/data/useDataDebugInfo.js` - GraphQL hook

### Modified Files
- `talia-server/package.json` - Updated dev script to use watch mode
- `talia-server/src/index.ts` - Added watch mode message
- `talia-ui/src/components/TestPage/componentRegistry.js` - Registered component
- `talia-ui/src/components/TestPage.jsx` - Added props handling

## Testing
- ✅ All GraphQL queries working
- ✅ Component renders correctly
- ✅ Data aggregation working
- ✅ Table statistics accurate
- ✅ Change metrics calculated correctly
- ✅ Server auto-reloads on file changes

## Usage

### Access the Component
1. Open TestPage in test mode
2. Select "DataDebugView" from component dropdown
3. View comprehensive data debugging information

### Server Development
- Server runs in watch mode: `npm run dev` in `talia-server`
- Automatically reloads when schema/resolver files change
- No manual restarts needed

## Architecture

```
Frontend (DataDebugView)
  ↓ GraphQL Query
Backend (dataDebugInfo resolver)
  ↓ Local Supabase Queries
Supabase Database
  - Aggregates from reservation, cabin_availability
  - Queries sync_metadata for change tracking
  - Calculates statistics for all synced tables
```

## Benefits
- **Data Visibility**: Clear view of data quality and completeness
- **Debugging**: Easy identification of data issues
- **Change Tracking**: Monitor data changes over time
- **Development**: Faster iteration with watch mode
- **Local Processing**: All joins done locally (faster, more reliable)

