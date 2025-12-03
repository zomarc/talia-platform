# Mediterranean (MED) Cruise Trends - Fetch Summary

## Overview

This document summarizes the process of fetching Google Trends data for Mediterranean cruise searches with monthly summarization.

## Implementation

### 1. Monthly Summarization

Data is stored as **monthly summaries only** - not daily data points:
- Dates are normalized to the first of each month (YYYY-MM-01 format)
- Interest scores are averaged across all data points within each month
- Reduces data volume while maintaining trend visibility

### 2. Query Filtering

The script automatically filters all queries to only Mediterranean/Med-related searches:
- Queries containing "mediterranean"
- Queries containing "med cruise"
- Queries containing "med " (with word boundary)

**Total MED queries found: 117**

### 3. Fetch Script

Location: `talia-server/scripts/fetch-med-trends.js`

Usage:
```bash
cd talia-server

# Fetch all MED trends for last year (default)
node scripts/fetch-med-trends.js

# Fetch with custom date range
node scripts/fetch-med-trends.js --start-date 2023-01-01 --end-date 2024-12-31

# Fetch for specific region
node scripts/fetch-med-trends.js --region GB

# List all MED queries
node scripts/fetch-med-trends.js --list-queries
```

### 4. Data Storage

- **Table**: `google_trends_data`
- **Granularity**: Monthly (one data point per month per query)
- **Date Format**: YYYY-MM-01 (first of month)
- **Interest Score**: Average of all data points within the month (0-100 scale)

## Monthly Aggregation Logic

The service automatically aggregates data to monthly summaries:

1. Collects all daily/weekly data points from Google Trends API
2. Groups by month (YYYY-MM)
3. Calculates average interest score per month
4. Normalizes date to first of month (YYYY-MM-01)
5. Stores only the monthly summary

This ensures:
- **Reduced storage**: ~12-24 data points per query per year (instead of 52-365)
- **Clear trends**: Monthly patterns are easier to visualize
- **Efficient queries**: Faster retrieval for trend analysis

## Rate Limiting

- 2 second delay between queries
- Automatic duplicate detection (skips existing data)
- Error handling for queries with no data

## Status

The fetch process is running and will:
- Process all 117 MED queries
- Store monthly summaries only
- Skip queries that already have data
- Handle errors gracefully

## Query Examples

Sample MED queries being fetched:
- "mediterranean cruise 2024"
- "med cruise holidays 2024"
- "western mediterranean cruise 2024"
- "greek islands mediterranean cruise 2024"
- "med cruise deals 2024"
- ... (113 more queries)

## Verification

To verify stored data:
```sql
SELECT 
  search_query,
  COUNT(*) as monthly_data_points,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM google_trends_data 
WHERE search_query LIKE '%mediterranean%' 
   OR search_query LIKE '%med cruise%'
   OR search_query LIKE '%med %'
GROUP BY search_query
ORDER BY search_query;
```

This will show:
- How many monthly data points exist per query
- The date range covered
- All MED queries in the database

