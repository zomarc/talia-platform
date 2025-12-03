# Demand Heatmap - Complete GraphQL Query Documentation

## 📊 Query Overview

The Demand Heatmap component fetches data using **TWO parallel GraphQL queries** that are joined together in the service layer.

---

## 🔍 Exact Query Structure

### GraphQL Query (from `demandHeatmapService.js`)

```graphql
query GetDemandHeatmapData($reservationFilters: ReservationFilters, $masterSailFilters: MasterSailFilters) {
  reservations(filters: $reservationFilters) {
    sail_code
    sail_from_date
    guest_count
  }
  masterSail(filters: $masterSailFilters) {
    sail_code
    package_name
    geog_area_code
    sail_date_from
  }
}
```

---

## 📝 Query Variables

### Current Configuration (No Filters - Gets ALL Data)

**Default behavior:** Fetches all available data without date restrictions.

```json
{
  "reservationFilters": {
    "limit": 10000
  },
  "masterSailFilters": {
    "limit": 10000
  }
}
```

### With Optional Date Filters

If you want to filter by date range:

```json
{
  "reservationFilters": {
    "sail_from_date_from": "2025-01-01",
    "sail_from_date_to": "2026-12-31",
    "limit": 10000
  },
  "masterSailFilters": {
    "sail_date_from": "2025-01-01",
    "sail_date_to": "2026-12-31",
    "limit": 10000
  }
}
```

### With Region Filter

```json
{
  "reservationFilters": {
    "limit": 10000
  },
  "masterSailFilters": {
    "geog_area_code": "AEGEAN",
    "limit": 10000
  }
}
```

---

## 🧪 Testing in GraphQL Playground

### GraphQL Playground URL
**http://localhost:4000**

### Test Query 1: Get All Data (Current Behavior)

```graphql
query GetDemandHeatmapData {
  reservations(filters: { limit: 1000 }) {
    sail_code
    sail_from_date
    guest_count
  }
  masterSail(filters: { limit: 1000 }) {
    sail_code
    package_name
    geog_area_code
    sail_date_from
  }
}
```

### Test Query 2: Check Available Date Ranges

```graphql
query CheckDateRanges {
  reservations(filters: { limit: 100 }) {
    sail_from_date
  }
  masterSail(filters: { limit: 100 }) {
    sail_date_from
    package_name
  }
}
```

### Test Query 3: Count Records

```graphql
query CountRecords {
  reservations(filters: { limit: 1 }) {
    sail_code
  }
  masterSail(filters: { limit: 1 }) {
    sail_code
  }
}
```

---

## 🔄 Data Processing Flow

```
1. GraphQL Query
   ↓
2. Fetch Reservations (sail_code, sail_from_date, guest_count)
   ↓
3. Fetch MasterSail (sail_code, package_name, geog_area_code, sail_date_from)
   ↓
4. Join by sail_code
   ↓
5. Group by:
   - Region (from geog_area_code)
   - Itinerary (package_name)
   - Departure Month (YYYY-MM from sail_date_from)
   ↓
6. Aggregate guest_count by month
   ↓
7. Create table with:
   - Row: Region + Itinerary
   - Columns: Dynamic month columns (2025-12, 2026-01, etc.)
   - Values: Guest count totals
```

---

## 📋 Expected Response Structure

### GraphQL Response

```json
{
  "data": {
    "reservations": [
      {
        "sail_code": "CJ250601",
        "sail_from_date": "2026-04-01",
        "guest_count": 2.0
      },
      {
        "sail_code": "CJ250602",
        "sail_from_date": "2026-04-08",
        "guest_count": 4.0
      }
    ],
    "masterSail": [
      {
        "sail_code": "CJ250601",
        "package_name": "Iconic Greek Islands 3 Nights",
        "geog_area_code": "AEGEAN",
        "sail_date_from": "2026-04-01"
      },
      {
        "sail_code": "CJ250602",
        "package_name": "Iconic Greek Islands 3 Nights",
        "geog_area_code": "AEGEAN",
        "sail_date_from": "2026-04-08"
      }
    ]
  }
}
```

### Processed Output (After Aggregation)

```json
{
  "data": [
    {
      "region": "Mediterranean",
      "itinerary": "Iconic Greek Islands 3 Nights",
      "geog_area_code": "AEGEAN",
      "2026-04": 6.0,
      "2026-05": 8.0
    }
  ],
  "months": ["2026-04", "2026-05", "2026-06"]
}
```

---

## 🎯 Key Points

### What's Being Queried

1. **Reservations Table**
   - All reservations (up to 10,000)
   - Fields: `sail_code`, `sail_from_date`, `guest_count`
   - **No date filtering by default** - gets ALL available reservations

2. **MasterSail Table**
   - All sailings (up to 10,000)
   - Fields: `sail_code`, `package_name`, `geog_area_code`, `sail_date_from`
   - **No date filtering by default** - gets ALL available sailings

### How Data is Joined

- Reservations and MasterSail are joined by matching `sail_code`
- If a reservation has no matching masterSail record, it's skipped
- If a masterSail has no reservations, it still appears in the table (with 0 counts)

### Region Mapping

- `AEGEAN`, `ADRIATIC` → `Mediterranean`
- `GULF`, `ARABIA`, `RED_SEA` → `Gulf`
- Other codes → `Unknown`

### Month Format

- Extracted from `sail_date_from` or `sail_from_date`
- Format: `YYYY-MM` (e.g., "2026-04")
- Sorted chronologically

---

## 🐛 Troubleshooting

### If No Data Appears

1. **Check if reservations exist:**
   ```graphql
   query { reservations(filters: { limit: 10 }) { sail_code } }
   ```

2. **Check if masterSail exists:**
   ```graphql
   query { masterSail(filters: { limit: 10 }) { sail_code } }
   ```

3. **Check if sail_codes match:**
   - Reservation sail_code must match masterSail sail_code
   - Both must have valid dates

4. **Check console logs:**
   - Look for `[DemandHeatmapService]` logs
   - See what data counts are being received

### Common Issues

- **No matching sail_codes:** Reservations and masterSail must have matching sail_code values
- **Invalid dates:** Dates must be valid ISO format strings
- **Missing package_name:** masterSail records need package_name to show itinerary
- **Empty geog_area_code:** Will map to "Unknown" region

---

## 📍 Files

- **Service:** `talia-ui/src/services/data/demandHeatmapService.js`
- **Hook:** `talia-ui/src/hooks/data/useDemandHeatmap.js`
- **Container:** `talia-ui/src/components/focus-panels/DemandHeatmap/index.jsx`
- **Presenter:** `talia-ui/src/components/focus-panels/DemandHeatmap/DemandHeatmapPresenter.jsx`

---

## 🔗 GraphQL Endpoint

- **URL:** `/api/graphql` (proxied to `http://localhost:4000/graphql`)
- **Playground:** `http://localhost:4000`
- **Method:** POST
- **Content-Type:** application/json

---

**Last Updated:** Based on current implementation
**Component Status:** ✅ Ready - fetches all available data without date restrictions

