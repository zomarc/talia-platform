# Google Trends for Cruise Holidays - Integration Plan

## Overview
Integrate Google Trends to show **what people are actually searching for** related to cruise holidays. This is about understanding the broader market - seeing historical search interest for generic cruise holiday terms, not tracking specific products or local data.

## Goal
- **Show historical Google Trends data** for generic cruise holiday search queries
- **Display what people are searching for** in the cruise holiday space
- **Visualize trends** showing search interest over time (historical data)
- **Understand market interest** in cruise-related search terms

**Key Point**: This is about seeing what the general public searches for, not tracking our own searches or product-specific terms.

---

## Generic Cruise Holiday Search Terms to Track

Based on Talia's geographic areas and cruise types, we should track trends for **generic search terms** that people use:

### 1. **General Cruise Terms**
- "cruise holidays"
- "cruise vacation"
- "cruise packages"
- "cruise deals"

### 2. **Destination-Based (Relevant to Talia's Areas)**
- "Greek islands cruise"
- "Mediterranean cruise"
- "Aegean cruise"
- "Red Sea cruise"
- "Gulf cruise"
- "Arabian cruise"
- "Adriatic cruise"

### 3. **Duration-Based**
- "3 night cruise"
- "4 night cruise"
- "7 night cruise"
- "14 night cruise"

### 4. **Seasonal/Event-Based**
- "Christmas cruise"
- "summer cruise"
- "winter cruise"

---

## Architecture

### Option 1: Google Trends API (Recommended - Requires Access)
- **API**: Official Google Trends API (currently in alpha/early access)
- **Data**: Historical search interest over past 5 years
- **Granularity**: Daily, weekly, monthly, yearly
- **Comparison**: Compare multiple queries
- **Regional**: Filter by geographic region

### Option 2: PyTrends Library (Unofficial but Reliable)
- **Library**: `pytrends` (Python) or Node.js equivalent
- **Data**: Scrapes Google Trends website
- **Advantages**: No API key needed, free
- **Limitations**: Rate limits, may break if Google changes site

### Option 3: Third-Party Service
- Services like Google Trends API wrappers
- Some paid services provide historical trends data

---

## Recommended Approach: Google Trends API Integration

### Option 1: Official Google Trends API (If Available)
- Apply for early access at: https://developers.google.com/search/apis/trends
- Provides historical data going back 5+ years
- Official support and reliability

### Option 2: Node.js Google Trends Library (Unofficial)
- Use `google-trends-api` npm package (unofficial but reliable)
- Scrapes Google Trends website
- No API key needed, free to use
- May have rate limits

### Implementation Steps

1. **Add Google Trends Library**
   - Install `google-trends-api` npm package
   - Create service to fetch historical trends data

2. **Define Generic Search Terms**
   - List of generic cruise holiday search queries (see above)
   - These are what people search for, not product names

3. **Trend Data Storage**
   - Table: `google_trends_data`
   - Store: search_query, date, interest_score (0-100), region, category

4. **GraphQL Schema**
   - Query: `googleTrends(query, dateRange, region)`
   - Type: `GoogleTrendSeries` with historical data points

5. **UI Component**
   - Display historical trends for generic cruise terms
   - Show line charts of search interest over time
   - Compare multiple search terms
   - Filter by region/time period

---

## Data Structure

### Generic Search Terms to Track

```javascript
const cruiseHolidaySearchTerms = [
  // General
  'cruise holidays',
  'cruise vacation',
  'cruise packages',
  
  // Destinations (relevant to Talia's geographic areas)
  'Greek islands cruise',
  'Mediterranean cruise',
  'Aegean cruise',
  'Red Sea cruise',
  'Gulf cruise',
  'Arabian cruise',
  'Adriatic cruise',
  
  // Duration-based
  '3 night cruise',
  '4 night cruise',
  '7 night cruise',
  '14 night cruise',
  
  // Seasonal
  'Christmas cruise',
  'summer cruise',
  'winter cruise'
];
```

### Database Schema

```sql
CREATE TABLE google_trends_data (
  id SERIAL PRIMARY KEY,
  search_query TEXT NOT NULL,
  date DATE NOT NULL,
  interest_score INTEGER, -- 0-100 from Google Trends
  region TEXT, -- e.g., 'US', 'GB', 'GR', 'World'
  category TEXT, -- e.g., 'Travel'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(search_query, date, region)
);
```

---

## Implementation Plan

### Phase 1: Research & Setup
1. Research Google Trends API/library options
2. Choose implementation method (official API vs library)
3. Define list of generic cruise holiday search terms
4. Test fetching historical trends data

### Phase 2: Backend Implementation
1. Install Google Trends library (`google-trends-api`)
2. Create `GoogleTrendsService` to fetch historical data
3. Create database table `google_trends_data` for storage
4. Build GraphQL schema and resolvers
5. Add method to fetch and store historical trends

### Phase 3: Data Collection
1. Fetch historical trends for all generic search terms
2. Store in database (backfill historical data)
3. Set up periodic updates (daily/weekly) for new data
4. Support multiple regions (World, US, UK, Greece, etc.)

### Phase 4: Frontend Component
1. Create `GoogleTrends` component
2. Display historical trends as line charts
3. Show multiple search terms for comparison
4. Filter by region and time period
5. Show what people are searching for (clean UI)

---

## Next Steps

1. **Choose Library**: Install `google-trends-api` npm package
2. **Create Service**: Build `GoogleTrendsService` to fetch historical data
3. **Database**: Create `google_trends_data` table
4. **Backfill**: Fetch and store historical trends for all generic terms
5. **GraphQL**: Add queries for trend data
6. **Component**: Build UI to display historical trends

---

## Expected Output

A component showing:
- **Historical search trends** for generic cruise holiday terms
- **What people are searching for** (not our products, but general terms)
- **Search interest over time** (line charts showing historical data)
- **Comparisons** between different search terms
- **Regional insights** (which markets search for what)
- **Market intelligence** - understanding search behavior in cruise holiday space

## Key Differentiators

- **NOT tracking local searches** - this is Google Trends data
- **NOT product-specific** - generic cruise holiday terms
- **Historical data** - showing trends over time (months/years)
- **Market intelligence** - what the general public searches for

