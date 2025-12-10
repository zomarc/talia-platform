# Reservation Sail Code Fix - Debugging Guide

## Changes Made

1. **Updated `sync.config.json`**: Added `SAIL_CODE` to the columns list for `reservationChanges`
2. **Updated `reservation-changes-sync.js`**:
   - Modified `buildRowNumberQuery()` to join `stg.RES_HEADER_SNAPSHOT` with `stg.RES_HEADER` on `RES_ID`
   - Updated count query to include the same join
   - Added case-insensitive fallback for `SAIL_CODE` column access (`row.SAIL_CODE || row.Sail_Code || row.sail_code`)
   - Added debug logging to show available columns in the first batch

## Potential Issues

### Issue 1: Column Name Mismatch
The column in `stg.RES_HEADER` might not be named `SAIL_CODE`. It could be:
- `Sail_Code` (mixed case)
- `sail_code` (lowercase)
- A different name entirely

**Solution**: The code now tries multiple case variations. Check the debug logs to see what columns are actually returned.

### Issue 2: Column Doesn't Exist in RES_HEADER
If `SAIL_CODE` doesn't exist in `stg.RES_HEADER`, the join will return NULL.

**Solution**: Verify the column exists by checking:
```sql
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'stg' 
  AND TABLE_NAME = 'RES_HEADER'
  AND COLUMN_NAME LIKE '%SAIL%'
```

### Issue 3: Join Not Matching
If there are RES_IDs in `RES_HEADER_SNAPSHOT` that don't exist in `RES_HEADER`, those rows will be excluded from the join.

**Solution**: Check for orphaned RES_IDs:
```sql
SELECT COUNT(*) 
FROM stg.RES_HEADER_SNAPSHOT rhs
LEFT JOIN stg.RES_HEADER rh ON rhs.[RES_ID] = rh.[RES_ID]
WHERE rh.[RES_ID] IS NULL
```

### Issue 4: Data Not Being Synced At All
If no data is being populated, the issue might be:
- Date range filters excluding all data
- No matching RES_IDs in the date range
- Connection issues

## Testing Steps

1. **Run the sync with debug logging**:
   ```bash
   cd talia-server
   npm run sync-reservationChanges
   ```

2. **Check the logs** for:
   - "Available columns in batch: ..." - This will show what columns are actually returned
   - "SAIL_CODE check: ..." - This will show if SAIL_CODE was found
   - Any warnings about SAIL_CODE not being found

3. **Verify the data** after sync:
   ```sql
   -- Check if sail_code is populated
   SELECT 
     COUNT(*) as total_rows,
     COUNT(sail_code) as rows_with_sail_code,
     COUNT(*) - COUNT(sail_code) as rows_without_sail_code
   FROM reservation_current_state;
   
   -- Sample rows
   SELECT res_id, snapshot_date, sail_code, agency_id
   FROM reservation_current_state
   LIMIT 10;
   ```

4. **If sail_code is still NULL**, check:
   - What columns are actually in RES_HEADER
   - If the join is working (check if any data is being returned)
   - If there's a different table that contains sail_code for reservations

## Next Steps Based on Results

### If Debug Logs Show SAIL_CODE Column Exists:
- The join is working, but the column name might be different
- Update the code to use the correct column name from the logs

### If Debug Logs Show SAIL_CODE NOT Found:
- Check if the column exists in RES_HEADER with a different name
- Check if sail_code needs to come from a different table (e.g., master_sail joined on sail_date_from)
- Verify the join condition is correct

### If No Data is Being Synced:
- Check date range filters
- Verify there are RES_IDs in the date range
- Check connection to Azure Synapse

## Alternative Approach: Join with master_sail

If `SAIL_CODE` doesn't exist in `RES_HEADER`, we might need to join with `master_sail` using `SAIL_DATE_FROM`:

```sql
FROM stg.RES_HEADER_SNAPSHOT rhs
INNER JOIN stg.RES_HEADER rh ON rhs.[RES_ID] = rh.[RES_ID]
INNER JOIN dwh.Dim_Master_Sail ms ON rh.[SAIL_DATE_FROM] = ms.[Sail_Date_From]
```

This would require additional changes to the query building logic.

