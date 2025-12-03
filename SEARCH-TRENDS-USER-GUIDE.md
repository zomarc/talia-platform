# Search Trends Component - User Guide

## Overview
The Search Trends component provides a clean, informative UI that shows **what people are searching for** over time. It displays search query trends with visual charts and metrics.

## Features

### ✨ Visual Display
- **Trend Cards**: Each search query displayed in its own card
- **Mini Charts**: Visual bar charts showing trends over time
- **Change Indicators**: Shows if searches are trending up 📈 or down 📉
- **Latest Results**: Current total results count for each query
- **Tracked Queries List**: Shows all queries being monitored

### 📊 Information Displayed
- **Query Name**: What people are searching for
- **Latest Count**: Current number of search results
- **Trend Percentage**: Change over time period
- **Data Points**: Number of historical measurements
- **Date Range**: Time period covered

## How It Works

### 1. Track Searches
When you search using the Google Search component, searches can be automatically tracked. The system stores:
- The search query
- Total results count
- Date and timestamp
- Search execution time

### 2. View Trends
Navigate to the SearchTrends component to see:
- All tracked queries
- Trend visualizations
- Change metrics

## Usage

### View Search Trends
1. Go to Test Page (http://localhost:5173)
2. Select **"SearchTrends"** from the component list
3. View all tracked search queries and their trends

### Track a Search Query
To start tracking a query like "cruise holidays":
1. Use the Google Search component
2. Search for "cruise holidays"
3. The search results are automatically tracked
4. View trends in the SearchTrends component

### Example Queries to Track
- "cruise holidays"
- "Mediterranean cruises"
- "Greek islands cruise"
- "cruise packages 2026"
- "Celestyal cruises"

## Visual Guide

### Trend Card Shows:
```
┌─────────────────────────────────────┐
│ "cruise holidays"                   │
│ Latest: 12,500,000 results          │
│                                      │
│ 📈 +5.2% (+650,000 results)         │
│                                      │
│ [Mini Chart - Visual Trend]         │
│ ▁▂▃▄▅▆▇█ (bar chart)                │
│                                      │
│ 7 data points                        │
└─────────────────────────────────────┘
```

## What People Are Looking For

The component clearly displays:
- **Which queries** are being tracked
- **How popular** each query is (result count)
- **Trend direction** (increasing/decreasing interest)
- **Historical data** (trends over time)

## Data Storage

- Data is stored in the `google_search_trends` table
- One entry per query per day
- Historical data builds over time
- Can track multiple queries simultaneously

## Status: ✅ Ready to Use!

The component is fully implemented and ready to display search trends. Start tracking searches to see trends over time!

