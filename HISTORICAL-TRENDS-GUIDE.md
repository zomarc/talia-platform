# Historical Search Trends - Implementation Guide

## Overview
Get historical search trends data to see what people have been searching for over time.

## Implementation

### ✅ What's Available

1. **Historical Trends Query**: `historicalSearchTrends` GraphQL query
   - Fetches historical data from stored trends
   - Date range filtering
   - Interval-based data points

2. **Backfill Mutation**: `backfillHistoricalTrends` mutation
   - Populates historical data for a query
   - Uses date-restricted searches to simulate historical trends
   - Stores data points in `google_search_trends` table

3. **UI Integration**: SearchTrends component
   - Backfill form in empty state
   - Historical data display in trends

## How It Works

### Current Data
- Searches performed today are automatically tracked
- Data accumulates over time as you search
- Each search creates a data point

### Historical Backfill
The backfill feature:
1. Takes a query (e.g., "cruise holidays")
2. Performs searches with date restrictions
3. Stores results as historical data points
4. Builds trend data over time

### Limitations
- Google Custom Search API doesn't provide true historical data
- Backfill uses current search results with date filters
- For true historical trends, Google Trends API access is needed (requires early access)

## Usage

### Get Historical Trends
```graphql
query GetHistoricalTrends($query: String!, $startDate: String!, $endDate: String!) {
  historicalSearchTrends(query: $query, startDate: $startDate, endDate: $endDate) {
    date
    totalResults
    searchTime
  }
}
```

### Backfill Historical Data
```graphql
mutation BackfillTrends($query: String!, $monthsBack: Int) {
  backfillHistoricalTrends(query: $query, monthsBack: $monthsBack) {
    query
    dataPointsStored
    dateRange {
      from
      to
    }
  }
}
```

### In UI
1. Go to SearchTrends component
2. If no data, use the backfill form
3. Enter query (e.g., "cruise holidays")
4. Select time period (3, 6, or 12 months)
5. Click "Get Historical Data"
6. View trends once data is populated

## Future: Google Trends API

For true historical trends data:
1. Apply for Google Trends API early access
2. Once approved, integrate the official API
3. Get accurate historical search interest data

## Status: ✅ Ready to Use

The backfill feature is implemented and ready. Start building historical data by using the backfill feature in the SearchTrends component.

