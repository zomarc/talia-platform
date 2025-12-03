# Demand Heatmap - GraphQL Query Details

## Exact Query Being Used

The component uses the following GraphQL query:

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

## Query Variables

### Current Default Variables (No Filters)

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

### With Date Filters

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

## Test This Query in GraphQL Playground

Open: **http://localhost:4000**

Paste this query:

```graphql
query GetDemandHeatmapData {
  reservations(filters: { limit: 100 }) {
    sail_code
    sail_from_date
    guest_count
  }
  masterSail(filters: { limit: 100 }) {
    sail_code
    package_name
    geog_area_code
    sail_date_from
  }
}
```

## Check Available Date Ranges

To see what dates are available in your data:

```graphql
query GetDateRanges {
  reservations(filters: { limit: 1000 }) {
    sail_from_date
  }
  masterSail(filters: { limit: 1000 }) {
    sail_date_from
    package_name
    geog_area_code
  }
}
```

## Expected Response Format

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

