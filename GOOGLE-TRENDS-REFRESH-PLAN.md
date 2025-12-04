# Google Trends Refresh System - Implementation Plan

## Goals
1. Add refresh status indicator showing last refresh time
2. Add refresh button to manually trigger data refresh
3. Store last refresh timestamp in database metadata
4. Make refresh pattern reusable for other components

## Implementation Steps

### Phase 1: Database Schema
1. Create `data_refresh_metadata` table to store refresh timestamps
   - `id` (SERIAL PRIMARY KEY)
   - `data_source` (TEXT) - e.g., 'google_trends'
   - `last_refreshed_at` (TIMESTAMP WITH TIME ZONE)
   - `refresh_status` (TEXT) - 'success', 'error', 'in_progress'
   - `refresh_error` (TEXT) - error message if failed
   - `records_updated` (INTEGER)
   - `created_at`, `updated_at`

### Phase 2: Backend (GraphQL)
1. Add `refreshMetadata` query to get last refresh info
2. Add `refreshGoogleTrends` mutation to trigger refresh
3. Update refresh metadata after successful refresh

### Phase 3: Frontend Components
1. Create reusable `RefreshStatus` component
   - Shows last refresh time
   - Shows refresh status (idle, refreshing, error)
   - Refresh button
   - Auto-refresh indicator
   
2. Integrate into GoogleTrendsPresenter
   - Display refresh status
   - Handle refresh button click
   - Show loading state during refresh

### Phase 4: UI Fixes
1. Fix quick filter buttons - radio button style (only one active)
2. Fix collapse state persistence in localStorage
3. Improve search box theme consistency

## Pattern for Reusability
- RefreshStatus component accepts:
  - `dataSource` prop (e.g., 'google_trends')
  - `onRefresh` callback
  - `loading` state
  - `lastRefreshTime` from metadata query

## Testing
1. Test refresh button triggers refresh
2. Test status updates correctly
3. Test metadata stored in database
4. Test quick filters work correctly
5. Test collapse state persists
