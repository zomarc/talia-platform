# Google Search Trends Component - Implementation Guide

## Overview
Track search query trends over time (e.g., "cruise holidays") and visualize them in a line chart showing how search interest changes.

## Architecture

### Database
- **Table**: `google_search_trends`
  - Stores: query, total_results, search_date, search_timestamp
  - Unique constraint on (query, search_date) to prevent duplicates

### Data Flow
```
User searches → GoogleSearchService.searchAndTrack() → 
  Store metrics in google_search_trends table → 
  GraphQL query retrieves trends → 
  Component displays line chart
```

## Implementation Steps

### 1. Database Migration ✅
- Migration file created: `20251204000000_create_google_search_trends_table.sql`
- Run migration to create table

### 2. Backend Service Methods
- Add `storeSearchTrend()` to SupabaseDataService
- Add `getSearchTrends()` to retrieve trend data
- Add `searchAndTrack()` method to GoogleSearchService (already added)

### 3. GraphQL Schema
- Add `GoogleSearchTrend` type
- Add `googleSearchTrends` query
- Add mutation to track a search

### 4. Frontend Component
- Create SearchTrendsContainer
- Create SearchTrendsPresenter with line chart
- Use Chart.js or similar for visualization

## Usage

### Track a search:
```graphql
mutation TrackSearch($query: String!) {
  trackGoogleSearch(query: $query) {
    success
    trendId
  }
}
```

### Get trends:
```graphql
query GetSearchTrends($filters: GoogleSearchTrendFilters!) {
  googleSearchTrends(filters: $filters) {
    query
    dataPoints {
      date
      totalResults
    }
  }
}
```

## Next Steps
1. Run the migration
2. Add service methods
3. Create GraphQL schema
4. Build the component

