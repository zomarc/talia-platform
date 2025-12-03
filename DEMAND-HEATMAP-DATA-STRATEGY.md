# Demand Heatmap Data Strategy

## Overview

The Demand Heatmap component requires aggregated data from two source tables:
1. **`master_sail`** - Contains sail information (sail_code, package_name, geog_area_code, sail_date_from)
2. **`reservation`** - Contains booking data (sail_code, sail_from_date, guest_count)

However, with limited date ranges in production data, we've created a hybrid solution that supports both real and mock data.

---

## Tables Required

### Source Tables (Existing)
- ✅ `master_sail` - Already exists
- ✅ `reservation` - Already exists

### New Aggregation Table
- 🆕 **`demand_heatmap_data`** - Pre-aggregated data for heatmap visualization

---

## Solution: `demand_heatmap_data` Table

### Benefits
1. **Pre-aggregated** - Reduces query complexity and improves performance
2. **Supports mock data** - Testing without large data volumes
3. **Flexible filtering** - Easy to switch between real and mock data
4. **Volume control** - Only store what you need for testing

### Schema

```sql
demand_heatmap_data
├── id (SERIAL PRIMARY KEY)
├── sail_code (TEXT)
├── region (TEXT) -- Pre-computed: Mediterranean, Gulf, Unknown
├── itinerary (TEXT) -- package_name
├── departure_month (TEXT) -- Format: YYYY-MM
├── departure_date (DATE)
├── guest_count (DECIMAL) -- Aggregated demand
├── reservation_count (INTEGER)
├── geog_area_code (TEXT)
├── ship_code (TEXT)
├── ship_name (TEXT)
├── is_mock_data (BOOLEAN) -- Flag to distinguish test data
├── data_source (TEXT) -- 'synapse', 'mock', 'manual'
└── timestamps
```

### Key Features

1. **Mock Data Flag**: `is_mock_data` column allows filtering
   - `false` = Real production data
   - `true` = Test/mock data

2. **Pre-computed Region**: Region mapping is done at insert time
   - AEGEAN, ADRIATIC → Mediterranean
   - GULF, ARABIA → Gulf

3. **Month Format**: Stored as `YYYY-MM` (e.g., "2026-04")
   - Easy to query and sort
   - Directly usable for column headers

4. **Aggregated View**: `demand_heatmap_aggregated` view provides ready-to-use data
   - Groups by region, itinerary, month
   - Sums guest counts
   - Filters mock data by default

---

## Data Population Options

### Option 1: Mock Data Only (Recommended for Testing)

**Use case**: Development, testing, demos

```bash
# Run migration to create table
# Then populate with mock data
psql -d talia -f scripts/populate-demand-heatmap-mock-data.sql
```

**Advantages:**
- ✅ Consistent data across all environments
- ✅ No dependency on production data
- ✅ Full date range for testing (multiple months)
- ✅ Predictable results

**Data Volume**: ~30-50 rows (small, manageable)

---

### Option 2: Real Data Only

**Use case**: Production, staging

```bash
# Run migration
# Then populate from real tables
psql -d talia -f scripts/populate-demand-heatmap-from-real-data.sql
```

**Advantages:**
- ✅ Real production data
- ✅ Accurate insights
- ✅ Automatic updates from sync

**Data Volume**: Depends on your data range (can be large)

**Note**: You may need to filter by date range to limit volume:
```sql
WHERE ms.sail_date_from >= '2026-01-01'
  AND ms.sail_date_from <= '2026-12-31'
```

---

### Option 3: Hybrid (Real + Mock)

**Use case**: Testing with some real data + extended date range

```sql
-- 1. Populate real data (limited date range)
-- 2. Populate mock data for months without real data
-- 3. Query filters by is_mock_data = false for production
```

**Advantages:**
- ✅ Real data where available
- ✅ Complete date range for UI testing
- ✅ Easy to switch between modes

---

## GraphQL Integration

### Current Implementation (Uses Source Tables)
- Queries `master_sail` and `reservation` directly
- Aggregates on-the-fly
- Requires both tables to have matching data

### Recommended: Use Aggregated Table

Update `demandHeatmapService.js` to query the new table:

```javascript
query GetDemandHeatmapData($filters: DemandHeatmapFilters) {
  demandHeatmapData(filters: $filters) {
    region
    itinerary
    departure_month
    guest_count
    reservation_count
    is_mock_data
  }
}
```

**Benefits:**
- ✅ Single table query (faster)
- ✅ Pre-aggregated (simpler)
- ✅ Can filter mock data easily
- ✅ Better performance

---

## Data Volume Management

### Recommendations

1. **For Testing**: Use mock data only
   - Small volume (~30-50 rows)
   - Full date range
   - Consistent results

2. **For Production**: Use real data with date filters
   ```sql
   -- Limit to reasonable date range
   WHERE departure_date >= CURRENT_DATE - INTERVAL '18 months'
     AND departure_date <= CURRENT_DATE + INTERVAL '12 months'
   ```

3. **For Development**: Hybrid approach
   - Real data for current/upcoming months
   - Mock data to fill gaps

### Volume Estimates

| Data Type | Rows | Size |
|-----------|------|------|
| Mock Data | 30-50 | ~5 KB |
| Real Data (6 months) | 100-500 | ~50 KB |
| Real Data (2 years) | 1000-5000 | ~500 KB |

---

## Migration Steps

### Step 1: Create Table
```bash
cd talia-server
supabase migration new create_demand_heatmap_data_table
# Copy migration SQL
supabase migration up
```

### Step 2: Populate with Mock Data (Testing)
```bash
psql -d talia -f scripts/populate-demand-heatmap-mock-data.sql
```

### Step 3: Verify Data
```sql
SELECT 
  is_mock_data,
  COUNT(*) as row_count,
  COUNT(DISTINCT departure_month) as months,
  MIN(departure_month) as earliest,
  MAX(departure_month) as latest
FROM demand_heatmap_data
GROUP BY is_mock_data;
```

### Step 4: Update Service (Optional)
Update `demandHeatmapService.js` to use the aggregated table instead of joining source tables.

---

## Maintenance

### Updating Real Data

**Option A: Manual Refresh**
```sql
-- Clear and repopulate
DELETE FROM demand_heatmap_data WHERE is_mock_data = false;
-- Run populate script again
```

**Option B: Automated Sync**
- Add to SynapseSyncService
- Run after reservation/master_sail sync
- Update only changed records

**Option C: Materialized View (Advanced)**
```sql
CREATE MATERIALIZED VIEW demand_heatmap_data AS ...
-- Refresh periodically
REFRESH MATERIALIZED VIEW demand_heatmap_data;
```

### Adding More Mock Data

Simply insert more rows:
```sql
INSERT INTO demand_heatmap_data (..., is_mock_data = true, ...) VALUES ...
```

---

## Query Examples

### Get Heatmap Data (Exclude Mock)
```sql
SELECT * FROM demand_heatmap_aggregated
WHERE contains_mock_data = false
ORDER BY region, itinerary, departure_month;
```

### Get Heatmap Data (Include Mock)
```sql
SELECT * FROM demand_heatmap_data
ORDER BY region, itinerary, departure_month;
```

### Filter by Date Range
```sql
SELECT * FROM demand_heatmap_data
WHERE departure_date >= '2026-01-01'
  AND departure_date <= '2026-12-31'
  AND is_mock_data = false;
```

---

## Next Steps

1. ✅ **Create migration** - `20251203000000_create_demand_heatmap_data_table.sql`
2. ✅ **Create mock data script** - `populate-demand-heatmap-mock-data.sql`
3. ✅ **Create real data script** - `populate-demand-heatmap-from-real-data.sql`
4. ⏭️ **Run migration** - Apply to your Supabase instance
5. ⏭️ **Populate mock data** - For testing
6. ⏭️ **Update service** (optional) - Use aggregated table instead of joins

---

## Files Created

- `talia-server/supabase/migrations/20251203000000_create_demand_heatmap_data_table.sql`
- `scripts/populate-demand-heatmap-mock-data.sql`
- `scripts/populate-demand-heatmap-from-real-data.sql`
- `DEMAND-HEATMAP-DATA-STRATEGY.md` (this file)

---

**Recommendation**: Start with **Option 1 (Mock Data)** for immediate testing, then add real data as needed.

