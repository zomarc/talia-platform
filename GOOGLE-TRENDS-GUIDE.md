# Google Trends Integration - Complete Guide

## Overview

Google Trends integration shows **what people are searching for** related to cruise holidays. This is about understanding the broader market - seeing historical search interest for generic cruise holiday terms, not tracking specific products or local data.

**Key Points:**
- Shows historical Google Trends data for generic cruise holiday search queries
- Displays what people are searching for in the cruise holiday space
- Visualizes trends showing search interest over time
- Data is stored as **monthly summaries only** (efficient storage)
- Supports 149 pre-configured search queries organized by category

---

## Quick Start

### 1. Fetch Mediterranean (MED) Cruise Trends

```bash
cd talia-server

# Fetch all MED trends (monthly summaries)
node scripts/fetch-med-trends.js --start-date 2023-01-01 --end-date 2024-12-31

# List all MED queries
node scripts/fetch-med-trends.js --list-queries
```

### 2. Fetch All Categories

```bash
cd talia-server

# Fetch trends for a specific category
node scripts/fetch-google-trends.js --category generic

# Fetch all categories
node scripts/fetch-google-trends.js

# List all categories
node scripts/fetch-google-trends.js --list-categories
```

### 3. View in UI

Navigate to the Google Trends component in the Talia dashboard to see:
- Historical search interest trends
- Monthly summaries of interest scores (0-100)
- Comparison across multiple search queries
- Filtering by region and date range

---

## Configuration

### Search Query Categories

Search terms are organized into 6 categories (149 total queries):

1. **generic** (43 queries) - General Mediterranean cruise searches
   - Example: "mediterranean cruise 2024", "med cruise holidays 2025"

2. **destination_focused** (28 queries) - Specific destinations and routes
   - Example: "greek islands mediterranean cruise", "barcelona to rome cruise"

3. **gulf_and_middle_east** (20 queries) - Gulf and Middle East cruises
   - Example: "gulf cruise 2024", "dubai cruise 2025"

4. **brand_and_ship** (25 queries) - Brand-specific searches
   - Example: "royal caribbean mediterranean cruise", "msc mediterranean cruises"

5. **departure_and_duration** (20 queries) - Departure ports and durations
   - Example: "cruises from southampton to mediterranean", "7 night med cruise"

6. **audience_and_style** (13 queries) - Audience and style preferences
   - Example: "family friendly mediterranean cruises", "luxury mediterranean cruise"

### Configuration Files

- **Backend**: `talia-server/src/config/googleTrendsQueries.js`
- **Frontend**: `talia-ui/src/config/googleTrendsQueries.js`

To add new queries, edit both files and add queries to the appropriate category.

---

## Data Storage

### Monthly Summarization

Data is stored as **monthly summaries only** - not daily or weekly:

- **Dates**: Normalized to first of month (YYYY-MM-01 format)
- **Interest Scores**: Averaged across all data points within each month
- **Storage**: ~12-24 data points per query per year (vs 52-365 for daily)
- **Table**: `google_trends_data`

### Database Schema

```sql
CREATE TABLE google_trends_data (
  id SERIAL PRIMARY KEY,
  search_query TEXT NOT NULL,
  date DATE NOT NULL,              -- YYYY-MM-01 format
  interest_score INTEGER NOT NULL, -- 0-100 from Google Trends
  region TEXT NOT NULL DEFAULT '', -- Empty = worldwide, or country code
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(search_query, date, region)
);
```

### Benefits of Monthly Summarization

- **Reduced storage**: 12-24 points per query/year vs 52-365
- **Clear trends**: Monthly patterns easier to visualize
- **Efficient queries**: Faster retrieval for trend analysis
- **Trend focus**: Only storing trend data, not raw daily points

---

## Scripts

### 1. Fetch MED Trends (Mediterranean Only)

**Script**: `talia-server/scripts/fetch-med-trends.js`

Automatically filters to only Mediterranean/Med-related queries (117 queries):

```bash
# Fetch all MED trends for last year (default)
node scripts/fetch-med-trends.js

# Fetch with custom date range
node scripts/fetch-med-trends.js --start-date 2023-01-01 --end-date 2024-12-31

# Fetch for specific region
node scripts/fetch-med-trends.js --region GB

# List all MED queries
node scripts/fetch-med-trends.js --list-queries
```

### 2. Fetch All Categories

**Script**: `talia-server/scripts/fetch-google-trends.js`

Fetches trends for all 149 queries organized by category:

```bash
# Fetch all queries
node scripts/fetch-google-trends.js

# Fetch a specific category
node scripts/fetch-google-trends.js --category generic

# Fetch with date range
node scripts/fetch-google-trends.js --start-date 2024-01-01 --end-date 2024-12-31

# Fetch with region
node scripts/fetch-google-trends.js --category destination_focused --region GB

# List all categories
node scripts/fetch-google-trends.js --list-categories
```

### Script Features

- **Rate Limiting**: 2 second delay between queries
- **Duplicate Detection**: Automatically skips queries that already have data
- **Error Handling**: Gracefully handles queries with no Google Trends data
- **Monthly Granularity**: Automatically stores monthly summaries only

---

## GraphQL API

### Queries

#### Get All Categories
```graphql
query {
  googleTrendsCategories
}
```

#### Get Queries for a Category
```graphql
query {
  googleTrendsQueriesByCategory(category: "generic")
}
```

#### Get Available Queries (with data)
```graphql
query {
  googleTrendsQueries
}
```

#### Get Trends Data
```graphql
query {
  googleTrends(filters: {
    queries: ["cruise holidays", "mediterranean cruise 2024"]
    startDate: "2023-01-01"
    endDate: "2024-12-31"
    region: "GB"
  }) {
    queries
    totalDataPoints
    series {
      query
      avgScore
      maxScore
      minScore
      dataPoints {
        date
        interestScore
      }
    }
  }
}
```

### Mutations

#### Fetch Trends for a Category
```graphql
mutation {
  fetchTrendsForCategory(
    category: "generic"
    startDate: "2023-01-01"
    endDate: "2024-12-31"
    region: "GB"
  ) {
    query
    dataPointsStored
    dateRange {
      from
      to
    }
  }
}
```

#### Fetch Trends for All Queries
```graphql
mutation {
  fetchTrendsForAllQueries(
    startDate: "2023-01-01"
    endDate: "2024-12-31"
    region: "GB"
  ) {
    query
    dataPointsStored
    dateRange {
      from
      to
    }
  }
}
```

#### Backfill Historical Trends
```graphql
mutation {
  backfillGoogleTrends(
    queries: ["cruise holidays", "mediterranean cruise"]
    startDate: "2023-01-01"
    endDate: "2024-12-31"
    region: "GB"
  ) {
    query
    dataPointsStored
    dateRange {
      from
      to
    }
  }
}
```

---

## UI Component

### Google Trends Component

Location: `talia-ui/src/components/focus-panels/GoogleTrends/`

**Features:**
- Displays historical search interest trends
- Shows monthly summaries with mini charts
- Comparison across multiple search queries
- Filter by region and date range
- Sort by most searched (average interest score)
- Color-coded trend lines for easy comparison

**Sorting:**
- Sort by "Most Searched" to see queries with highest average interest scores first
- Helps identify which search terms are most popular

---

## Adding New Search Terms

1. **Edit Configuration Files**:
   - `talia-server/src/config/googleTrendsQueries.js`
   - `talia-ui/src/config/googleTrendsQueries.js`

2. **Add to Appropriate Category**:
   ```javascript
   export const GOOGLE_TRENDS_QUERIES = {
     generic: [
       // ... existing queries
       "new search term 2024",
       "another search term 2025"
     ],
     // ... other categories
   };
   ```

3. **Fetch Trends**:
   ```bash
   node scripts/fetch-google-trends.js --category generic
   ```

---

## Verification

### Check Stored Data

```sql
-- Count queries and data points
SELECT 
  COUNT(DISTINCT search_query) as unique_queries,
  COUNT(*) as total_monthly_data_points,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM google_trends_data;

-- Check specific category
SELECT 
  search_query,
  COUNT(*) as monthly_points,
  MIN(date) as first_month,
  MAX(date) as last_month,
  AVG(interest_score) as avg_interest
FROM google_trends_data 
WHERE search_query LIKE '%mediterranean%'
GROUP BY search_query
ORDER BY avg_interest DESC;
```

### Verify Monthly Summarization

All dates should be normalized to the first of the month:
```sql
SELECT DISTINCT date 
FROM google_trends_data 
ORDER BY date
LIMIT 20;
-- Should show: 2023-01-01, 2023-02-01, 2023-03-01, etc.
```

---

## Architecture

### Services

- **GoogleTrendsService** (`talia-server/src/services/google-trends-service.js`)
  - Fetches historical trends from Google Trends API
  - Aggregates to monthly summaries
  - Handles rate limiting

- **SupabaseDataService** (`talia-server/src/services/supabase.js`)
  - Stores/retrieves trends data
  - Handles batch operations

### Components

- **GoogleTrendsContainer** (`talia-ui/src/components/focus-panels/GoogleTrends/index.jsx`)
  - Container component managing state and data fetching

- **GoogleTrendsPresenter** (`talia-ui/src/components/focus-panels/GoogleTrends/GoogleTrendsPresenter.jsx`)
  - Presenter component displaying trends with charts and sorting

---

## Best Practices

1. **Use Monthly Summarization**: Always fetch with `granularity: 'monthly'` for efficient storage

2. **Rate Limiting**: Scripts automatically include 2-second delays between queries

3. **Duplicate Detection**: Scripts skip queries that already have data to avoid re-fetching

4. **Error Handling**: Queries with no Google Trends data are handled gracefully

5. **Regional Data**: Use region codes (GB, US, GR) for geographic filtering

6. **Date Ranges**: Use 1-2 year ranges for optimal data volume

---

## Troubleshooting

### No Data Showing

1. **Check if data exists**:
   ```sql
   SELECT COUNT(*) FROM google_trends_data;
   ```

2. **Check available queries**:
   ```graphql
   query { googleTrendsQueries }
   ```

3. **Fetch missing data**:
   ```bash
   node scripts/fetch-med-trends.js
   ```

### Script Errors

- **Rate Limiting**: Scripts include delays, but Google may still rate limit
- **No Data**: Some queries may not have Google Trends data available
- **Network Issues**: Check internet connection and Google Trends API availability

### Performance

- Monthly summarization reduces data volume significantly
- Indexes on `search_query`, `date`, and `region` optimize queries
- Batch operations for storing multiple data points efficiently

---

## Summary

**What it does:**
- Shows what people are searching for (Google Trends data)
- Historical search interest for generic cruise holiday terms
- Monthly summarized trends for efficient storage

**How to use:**
1. Run fetch scripts to collect trends data
2. View trends in the UI component
3. Sort by "Most Searched" to see popular queries first

**Key files:**
- Config: `talia-server/src/config/googleTrendsQueries.js`
- Fetch MED: `talia-server/scripts/fetch-med-trends.js`
- Fetch All: `talia-server/scripts/fetch-google-trends.js`
- Component: `talia-ui/src/components/focus-panels/GoogleTrends/`

---

## Next Steps

1. Run fetch scripts to populate initial data
2. Explore trends in the UI component
3. Add new search queries as needed
4. Monitor trends over time for market insights

