# Google Trends Search Terms Configuration

This document explains how to use the search terms configuration file to generate Google Trends data.

## Overview

The search terms are organized into categories and stored in:
- **Frontend**: `talia-ui/src/config/googleTrendsQueries.js`
- **Backend**: `talia-server/src/config/googleTrendsQueries.js`

These files contain **all the search queries** that people are using to find cruise holiday information. These are generic search terms (not product-specific) that help understand search trends and demand patterns.

## Categories

1. **generic** - General Mediterranean cruise searches (43 queries)
2. **destination_focused** - Specific destinations and routes (28 queries)
3. **gulf_and_middle_east** - Gulf and Middle East cruises (20 queries)
4. **brand_and_ship** - Brand-specific searches (25 queries)
5. **departure_and_duration** - Departure ports and durations (20 queries)
6. **audience_and_style** - Audience and style preferences (13 queries)

**Total: 149 search queries**

## Usage

### 1. GraphQL Queries

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

### 2. GraphQL Mutations

#### Fetch Trends for a Specific Category
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

### 3. Command Line Script

Use the Node.js script to fetch trends for all queries:

```bash
cd talia-server

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

# Help
node scripts/fetch-google-trends.js --help
```

## How It Works

1. **Configuration File**: Contains all 149 search queries organized by category
2. **API Service**: Uses `google-trends-api` package to fetch historical interest data
3. **Database Storage**: Stores all trends data in `google_trends_data` table
4. **Rate Limiting**: Automatically adds delays between API calls to respect rate limits
5. **Deduplication**: Skips queries that already have data in the database

## Adding New Search Terms

To add new search terms:

1. Edit `talia-server/src/config/googleTrendsQueries.js`
2. Add queries to the appropriate category (or create a new category)
3. Copy the same changes to `talia-ui/src/config/googleTrendsQueries.js`
4. The new queries will be automatically available for fetching

Example:
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

## Data Volume

- Each query typically returns **weekly data points** for the specified date range
- For 1 year of data: ~52 data points per query
- For 149 queries: ~7,748 data points total
- The script automatically skips queries that already have data

## Notes

- The script includes rate limiting (2 second delay between queries)
- Data is stored permanently in the database
- Duplicate requests for the same query/date range are skipped
- You can run the script multiple times safely - it will only fetch missing data

