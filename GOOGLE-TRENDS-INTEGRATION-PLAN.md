# Google Trends Integration Plan for Talia Products

## Overview
Integrate Google Trends API to fetch historical search trends for cruise-related queries and map them to Talia products (itineraries, regions, ships, destinations).

## Goals
1. **Historical Trends**: Get Google Trends data (not Custom Search) for cruise-related searches
2. **Product Mapping**: Map search trends to Talia products (itineraries, regions, ships, ports)
3. **Relevant Insights**: Show which products have increasing/decreasing search interest
4. **Time Series**: Display trends over time (daily, weekly, monthly)

## Talia Products to Map

### 1. **Itineraries** (from `master_sail.package_name`)
- Examples: "Aegean Gems", "Idyllic Aegean", "Three Continents"
- Search terms: `package_name + "cruise"`, `package_name + "holiday"`

### 2. **Regions** (from `master_sail.geog_area_code`)
- Examples: "AEGEAN", "MEDITERRANEAN", "ADRIATIC"
- Search terms: `region + "cruise"`, `region + "cruise holidays"`

### 3. **Ships** (from `master_sail.ship_name`)
- Examples: "Celestyal Olympia", "Celestyal Crystal"
- Search terms: `ship_name + "cruise"`, `ship_name + "reviews"`

### 4. **Destinations/Ports** (from `itinerary.port_name`, `master_sail.port_from`, `master_sail.port_to`)
- Examples: "Mykonos", "Santorini", "Kusadasi", "Piraeus"
- Search terms: `port_name + "cruise"`, `port_name + "cruise port"`

### 5. **Package Types** (from `master_sail.package_type`)
- Search terms: `package_type + "cruise"`

### 6. **Duration-Based** (from `master_sail.sail_days`)
- Search terms: "3 day cruise", "4 day cruise", "7 day cruise"

## Implementation Plan

### Phase 1: Google Trends Service Setup

#### 1.1 Install Google Trends Library
```bash
cd talia-server
npm install google-trends-api
```

**Alternative**: Use `pytrends` via a Python microservice, or use the official Google Trends API (if access granted)

#### 1.2 Create Google Trends Service
**File**: `talia-server/src/services/google-trends-service.js`

**Features**:
- Fetch interest over time for queries
- Fetch interest by region
- Fetch related queries
- Fetch related topics
- Support date ranges (last 5 years)
- Support granularity (daily, weekly, monthly)

**Methods**:
```javascript
- getInterestOverTime(keywords, options)
- getInterestByRegion(keywords, options)
- getRelatedQueries(keywords, options)
- getRelatedTopics(keywords, options)
```

### Phase 2: Product-to-Query Mapping

#### 2.1 Create Product Query Mapper
**File**: `talia-server/src/services/product-query-mapper.js`

**Purpose**: Map Talia products to relevant Google Trends search queries

**Mapping Strategy**:
```javascript
// Itinerary → Queries
"Aegean Gems" → ["Aegean Gems cruise", "Aegean cruise", "Greek islands cruise"]

// Region → Queries
"AEGEAN" → ["Aegean cruise", "Aegean cruise holidays", "Greek cruise"]

// Ship → Queries
"Celestyal Olympia" → ["Celestyal Olympia", "Celestyal Olympia cruise", "Celestyal cruise reviews"]

// Port → Queries
"Mykonos" → ["Mykonos cruise", "Mykonos cruise port", "cruise to Mykonos"]

// Duration → Queries
sail_days: 3 → ["3 day cruise", "short cruise", "3 night cruise"]
sail_days: 7 → ["7 day cruise", "week cruise", "7 night cruise"]
```

#### 2.2 Query Generation Rules
1. **Primary Query**: Product name + "cruise"
2. **Secondary Queries**: Product name + variations ("holiday", "vacation", "trip")
3. **Regional Queries**: Region + "cruise" + variations
4. **Seasonal Queries**: Add season context if available

### Phase 3: Database Schema

#### 3.1 Create Google Trends Data Table
**File**: `talia-server/supabase/migrations/20251205000000_create_google_trends_data_table.sql`

```sql
CREATE TABLE IF NOT EXISTS google_trends_data (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  product_type TEXT NOT NULL, -- 'itinerary', 'region', 'ship', 'port', 'duration'
  product_id TEXT, -- Reference to product (sail_code, geog_area_code, ship_code, etc.)
  product_name TEXT, -- Human-readable product name
  date DATE NOT NULL,
  interest_score INTEGER, -- 0-100 from Google Trends
  interest_by_region JSONB, -- Regional breakdown
  related_queries JSONB, -- Related queries data
  related_topics JSONB, -- Related topics data
  granularity TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(query, date, granularity)
);

CREATE INDEX idx_google_trends_query ON google_trends_data(query);
CREATE INDEX idx_google_trends_product ON google_trends_data(product_type, product_id);
CREATE INDEX idx_google_trends_date ON google_trends_data(date);
```

#### 3.2 Create Product-Trend Mapping Table
```sql
CREATE TABLE IF NOT EXISTS product_trend_mappings (
  id SERIAL PRIMARY KEY,
  product_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  search_queries TEXT[] NOT NULL, -- Array of search queries
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_type, product_id)
);
```

### Phase 4: GraphQL Schema & Resolvers

#### 4.1 Add GraphQL Types
**File**: `talia-server/src/api/schema.ts`

```graphql
type GoogleTrendsData {
  id: ID!
  query: String!
  productType: String!
  productId: String
  productName: String
  date: String!
  interestScore: Int!
  interestByRegion: JSON
  relatedQueries: JSON
  relatedTopics: JSON
  granularity: String!
}

type ProductTrendMapping {
  id: ID!
  productType: String!
  productId: String!
  productName: String!
  searchQueries: [String!]!
  isActive: Boolean!
}

type TrendSeries {
  productId: String!
  productName: String!
  productType: String!
  query: String!
  dataPoints: [TrendDataPoint!]!
  averageInterest: Float!
  trendDirection: TrendDirection!
  changePercent: Float!
}

type TrendDataPoint {
  date: String!
  interestScore: Int!
}

input GoogleTrendsFilters {
  productType: String # 'itinerary', 'region', 'ship', 'port', 'duration'
  productId: String
  query: String
  dateFrom: String
  dateTo: String
  granularity: String # 'daily', 'weekly', 'monthly'
}

input ProductTrendMappingInput {
  productType: String!
  productId: String!
  productName: String!
  searchQueries: [String!]!
}
```

#### 4.2 Add Queries & Mutations
```graphql
type Query {
  # Get trends for products
  productTrends(filters: GoogleTrendsFilters!): [TrendSeries!]!
  
  # Get trends for specific product
  productTrend(productType: String!, productId: String!): TrendSeries
  
  # Get all product mappings
  productTrendMappings(productType: String): [ProductTrendMapping!]!
  
  # Get related queries for a product
  productRelatedQueries(productType: String!, productId: String!): JSON
}

type Mutation {
  # Fetch and store trends for a product
  fetchProductTrends(productType: String!, productId: String!, dateFrom: String, dateTo: String): Boolean!
  
  # Create/update product mapping
  upsertProductTrendMapping(input: ProductTrendMappingInput!): ProductTrendMapping!
  
  # Auto-generate mappings for all products
  generateProductMappings(productType: String): Int!
}
```

### Phase 5: Backend Service Implementation

#### 5.1 Google Trends Service
**File**: `talia-server/src/services/google-trends-service.js`

**Key Features**:
- Use `google-trends-api` npm package
- Handle rate limiting
- Cache results
- Error handling for API limits

#### 5.2 Product Query Mapper
**File**: `talia-server/src/services/product-query-mapper.js`

**Key Features**:
- Generate queries from product data
- Support multiple query variations
- Handle special characters and encoding
- Cache mappings

#### 5.3 Trends Data Service
**File**: `talia-server/src/services/trends-data-service.js`

**Key Features**:
- Fetch trends for products
- Store in database
- Aggregate data
- Calculate trend metrics (direction, change %)

### Phase 6: Frontend Component

#### 6.1 Product Trends Component
**File**: `talia-ui/src/components/focus-panels/ProductTrends/`

**Structure**:
- `index.jsx` - Container
- `ProductTrendsPresenter.jsx` - UI

**Features**:
- Filter by product type (itinerary, region, ship, port)
- Filter by product
- Date range selector
- Trend charts (line charts showing interest over time)
- Trend indicators (up/down arrows, % change)
- Comparison view (compare multiple products)
- Regional breakdown (if available)
- Related queries display

**UI Elements**:
1. **Product Selector**: Dropdown to select product type and specific product
2. **Date Range Picker**: Select historical period
3. **Trend Chart**: Line chart showing interest over time
4. **Trend Cards**: Cards for each product showing:
   - Current interest score
   - Trend direction (↑/↓)
   - % change
   - Average interest
5. **Regional Map**: If interest by region available
6. **Related Queries**: Show what else people search for

### Phase 7: Data Fetching Strategy

#### 7.1 Initial Population
- Create a script to generate mappings for all existing products
- Fetch trends for last 12 months initially
- Store in database

#### 7.2 Ongoing Updates
- Daily job to fetch latest trends
- Weekly job to fetch weekly aggregates
- Monthly job to fetch monthly aggregates

#### 7.3 Caching Strategy
- Cache Google Trends API responses (they update daily)
- Store in database for historical access
- Refresh cache daily

## Implementation Steps

### Step 1: Setup & Dependencies
1. Install `google-trends-api` package
2. Create database tables
3. Create base service files

### Step 2: Product Mapping
1. Create product query mapper
2. Generate initial mappings for all products
3. Store mappings in database

### Step 3: Trends Fetching
1. Implement Google Trends service
2. Create resolver to fetch trends
3. Store trends in database

### Step 4: GraphQL API
1. Add schema types
2. Add queries and mutations
3. Implement resolvers

### Step 5: Frontend Component
1. Create ProductTrends component
2. Add service and hook
3. Implement UI with charts

### Step 6: Testing & Refinement
1. Test with sample products
2. Verify data accuracy
3. Optimize performance
4. Add error handling

## Technical Considerations

### Rate Limiting
- Google Trends API has rate limits
- Implement request queuing
- Cache aggressively
- Batch requests when possible

### Data Normalization
- Google Trends returns 0-100 scores (normalized)
- Scores are relative, not absolute
- Compare trends, not absolute values

### Query Variations
- Test multiple query variations
- Use most relevant queries
- Combine results if needed

### Error Handling
- Handle API failures gracefully
- Retry with exponential backoff
- Log errors for debugging

## Expected Outcomes

1. **Historical Trends**: See how search interest in products has changed over time
2. **Product Insights**: Identify which products are trending up/down
3. **Seasonal Patterns**: Identify seasonal trends
4. **Regional Insights**: See which regions have more interest
5. **Competitive Intelligence**: Compare trends across products

## Next Steps

1. Review and approve plan
2. Start with Phase 1 (Setup)
3. Iterate through phases
4. Test with real products
5. Deploy and monitor

