# STG.RES_PROMOTION Sync Implementation Plan

## Table Analysis

### Source Table: `stg.RES_PROMOTION`

**Structure:**
- **Total Rows**: 1,283,633
- **Unique Reservations**: 299,414 (average ~4 promotions per reservation)
- **Primary Key**: `RES_PROMO_ID` (decimal)
- **Foreign Key**: `RES_ID` (links to `stg.RES_HEADER`)

**Columns:**
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| RES_PROMO_ID | decimal(9,0) | NULL | Primary key, unique promotion record ID |
| RES_ID | decimal(9,0) | NULL | **Foreign key** - Links to reservation |
| GUEST_ID | decimal(9,0) | NULL | Links to guest |
| PROMO_CODE | nvarchar(60) | NULL | Promotion code (e.g., "GOFURTHER5", "CELESTYAL-ONE") |
| IS_EXCLUDED | nvarchar(4) | NULL | Exclusion flag (Y/N) |
| IS_ACTIVE | nvarchar(4) | NULL | Active flag (Y/N) |
| RES_PACKAGE_ID | decimal(9,0) | NULL | Links to reservation package |
| IS_MANUAL | nvarchar(4) | NULL | Manual entry flag (Y/N) |
| PROMO_VALUE | decimal(10,2) | NULL | Promotion value amount |
| PROMO_VALUE_TYPE | nvarchar(60) | NULL | Value type (percentage, fixed, etc.) |
| IS_STATIC | nvarchar(4) | NULL | Static flag (Y/N) |

**Key Observations:**
- ✅ **No snapshot date column** - This is a current-state reference table
- ✅ **Strong relationship** - 100% of RES_IDs match `stg.RES_HEADER`
- ✅ **Useful data** - Contains promotion codes and values linked to reservations
- ✅ **Multiple promotions per reservation** - Average 4 promotions per reservation

## Table Type Decision

**Type: DIRECT TABLE**

**Rationale:**
1. No `Snapshot_Date` column - not a time-series table
2. Current state reference data - not tracking changes over time
3. Links to reservations via `RES_ID` - should sync based on reservation date range
4. Similar pattern to `reservations` table (direct sync)

## Sync Strategy

### 1. Filtering Strategy
- **Filter by**: `RES_ID` relationships with reservations in date range
- **Join**: `stg.RES_PROMOTION` → `stg.RES_HEADER` (via `RES_ID`)
- **Date Filter**: Use `SAIL_DATE_FROM` from `RES_HEADER` to determine which promotions to sync
- **Logic**: Only sync promotions for reservations where `SAIL_DATE_FROM` is in the dataset date range

### 2. Replace Strategy
- **Strategy**: `delete-range` based on `RES_ID` relationships
- **Approach**: 
  1. Get all `RES_ID`s from `reservation` table in date range
  2. Delete all `reservation_promotion` records where `res_id` IN (those RES_IDs)
  3. Insert new promotion records for those RES_IDs

### 3. Sync Order
- **Must sync AFTER**: `reservations` table
- **Reason**: Need `reservation` table populated first to determine which `RES_ID`s to sync

## Implementation Steps

### Step 1: Create Supabase Table Schema
Create `reservation_promotion` table with:
- Primary key: `id` (SERIAL)
- Foreign key: `res_id` (BIGINT) - links to `reservation.res_id`
- All columns from source table (snake_case)
- Indexes: `res_id`, `promo_code`

### Step 2: Create Transform Function
- Map column names: `RES_PROMO_ID` → `res_promo_id`, etc.
- Handle NULL values appropriately
- Convert `nvarchar(4)` flags to boolean or keep as text
- Transform decimal types

### Step 3: Create Sync Function
- Follow `SYNC_PRINCIPLES.md` template
- Use `SyncOperation` wrapper for logging
- Filter by joining with `stg.RES_HEADER` on `RES_ID`
- Use `SAIL_DATE_FROM` for date range filtering
- Implement batch processing (similar to reservations)

### Step 4: Add to sync.config.json
- Add table definition under `tables`
- Add to dataset `tableSequence` (after `reservations`)
- Configure filters and replace strategy

### Step 5: Test Sync
- Test with small date range
- Verify data integrity
- Check relationships with reservation table

## Data Usefulness Assessment

### ✅ Highly Useful
1. **Promotion Analysis**: Track which promotions are applied to reservations
2. **Revenue Impact**: `PROMO_VALUE` shows discount amounts
3. **Promotion Performance**: Link promotions to reservation outcomes
4. **Guest Segmentation**: `GUEST_ID` allows guest-level promotion analysis

### ✅ Business Value
- **Marketing Analytics**: Which promo codes drive bookings?
- **Revenue Management**: Track discount amounts per reservation
- **Customer Insights**: Understand promotion preferences
- **Operational**: Manual vs automatic promotion tracking

## Table Relationships

```
reservation (res_id)
    ↓ (1:many)
reservation_promotion (res_id)
    ↓ (many:1)
reservation (res_id) [for date filtering]
```

## Configuration Example

```json
{
  "reservationPromotion": {
    "type": "direct",
    "source": "stg.RES_PROMOTION",
    "target": "reservation_promotion",
    "columns": [
      "[RES_PROMO_ID]",
      "[RES_ID]",
      "[GUEST_ID]",
      "[PROMO_CODE]",
      "[IS_EXCLUDED]",
      "[IS_ACTIVE]",
      "[RES_PACKAGE_ID]",
      "[IS_MANUAL]",
      "[PROMO_VALUE]",
      "[PROMO_VALUE_TYPE]",
      "[IS_STATIC]"
    ],
    "transformKey": "reservationPromotion",
    "isLargeDataset": true,
    "rowNumberOrder": ["[RES_ID]", "[RES_PROMO_ID]"]
  }
}
```

## Dataset Configuration

```json
{
  "reservationPromotion": {
    "filters": [
      {
        "column": "[RES_ID]",
        "operator": "in",
        "joinTable": "stg.RES_HEADER",
        "joinColumn": "[RES_ID]",
        "dateColumn": "[SAIL_DATE_FROM]",
        "from": "2025-09-01",
        "to": "2025-12-31"
      }
    ],
    "replace": {
      "strategy": "delete-range",
      "column": "res_id",
      "joinTable": "reservation",
      "joinColumn": "res_id",
      "dateColumn": "sail_from_date",
      "from": "2025-09-01",
      "to": "2025-12-31"
    }
  }
}
```

## Next Steps

1. ✅ Analyze table structure - **COMPLETE**
2. ⏳ Create Supabase migration for table schema
3. ⏳ Create sync function following SYNC_PRINCIPLES.md
4. ⏳ Add to sync.config.json
5. ⏳ Test sync functionality
6. ⏳ Verify data relationships

