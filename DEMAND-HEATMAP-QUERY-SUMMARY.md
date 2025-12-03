# Demand Heatmap - GraphQL Query Summary

## Exact Query Being Executed

The DemandHeatmap component executes this GraphQL query:

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

## Current Query Variables (No Date Filters - Gets ALL Data)

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

## Test This Query

### In GraphQL Playground: http://localhost:4000

**Full Query:**
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

### Check What Dates Are Available

```graphql
query CheckAvailableDates {
  reservations(filters: { limit: 1000 }) {
    sail_code
    sail_from_date
  }
  masterSail(filters: { limit: 1000 }) {
    sail_code
    package_name
    sail_date_from
    geog_area_code
  }
}
```

## How Data is Processed

1. **Fetches reservations** - All reservations with sail_code, sail_from_date, guest_count
2. **Fetches masterSail** - All sailings with sail_code, package_name, geog_area_code, sail_date_from
3. **Joins by sail_code** - Matches reservations to masterSail records
4. **Groups by:**
   - Region (mapped from geog_area_code)
   - Itinerary (package_name)
   - Departure month (YYYY-MM format from sail_date_from)
5. **Aggregates guest_count** by month
6. **Returns table format** with dynamic month columns

## Expected Response

```json
{
  "data": {
    "reservations": [
      {
        "sail_code": "CJ250601",
        "sail_from_date": "2026-04-01",
        "guest_count": 2.0
      }
    ],
    "masterSail": [
      {
        "sail_code": "CJ250601",
        "package_name": "Iconic Greek Islands 3 Nights",
        "geog_area_code": "AEGEAN",
        "sail_date_from": "2026-04-01"
      }
    ]
  }
}
```

## Component Updates Made

1. ✅ Removed default date filters - now fetches ALL available data
2. ✅ Shows all itineraries from masterSail (even without reservations)
3. ✅ Auto-detects available months from data
4. ✅ Enhanced logging to show what data is received
5. ✅ Handles invalid dates gracefully

## Current Status

The component is configured to:
- Fetch **all** reservations and masterSail records (no date filtering)
- Display **all** available itineraries and months
- Show data from whatever date range exists in your database

## Next Steps

1. Test the query in GraphQL Playground at http://localhost:4000
2. Check console logs to see what data is being received
3. Verify reservations have matching masterSail records (same sail_code)
4. Confirm date formats are correct (ISO date strings)

