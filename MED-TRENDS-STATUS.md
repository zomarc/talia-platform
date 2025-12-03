# Mediterranean (MED) Cruise Trends - Current Status

## ✅ Data Summary

**Current Status**: Script is running and storing monthly summarized trends

- **Unique queries with data**: 17 (out of 117 total MED queries)
- **Total monthly data points**: 408
- **Date range**: 2023-01-01 to 2024-12-01
- **Granularity**: Monthly (one data point per month)
- **Format**: Dates normalized to first of month (YYYY-MM-01)

## 📊 What's Being Stored

### Monthly Summaries Only
- ✅ Dates normalized to monthly boundaries (2023-01-01, 2023-02-01, etc.)
- ✅ Interest scores averaged per month
- ✅ Not storing daily or weekly data points
- ✅ Efficient storage: ~24 data points per query per year

### Example Data Structure
```sql
search_query: "mediterranean cruise 2024"
date: "2023-01-01" (represents January 2023)
interest_score: 65 (average for that month)
```

## 🔄 Script Progress

The fetch script is currently running and will:
1. Process all 117 MED-related queries
2. Store monthly summaries for each
3. Skip queries that already have data
4. Handle queries with no Google Trends data gracefully

## 📝 Queries Being Processed

Sample of MED queries:
- "mediterranean cruise 2024" ✅
- "med cruise holidays 2024" ✅
- "western mediterranean cruise 2024" ✅
- "eastern mediterranean cruise 2025" ✅
- ... (113 more queries)

## ✅ Verification

All data is stored with:
- **Monthly granularity only** (not daily/weekly)
- **Normalized dates** (first of month)
- **Average interest scores** per month
- **Efficient storage** (trend data, not raw data points)

## 📈 Next Steps

Once the script completes, you'll have:
- Monthly trend data for all MED cruise queries
- Easy-to-query trend patterns
- Reduced storage volume compared to daily data
- Clean monthly summaries for visualization

To check progress:
```bash
cd talia-server
tail -f /tmp/med-trends-fetch.log
```

To verify stored data:
```sql
SELECT 
  search_query,
  COUNT(*) as monthly_points,
  MIN(date) as first_month,
  MAX(date) as last_month
FROM google_trends_data 
WHERE search_query LIKE '%mediterranean%' 
   OR search_query LIKE '%med cruise%'
GROUP BY search_query
ORDER BY search_query;
```

