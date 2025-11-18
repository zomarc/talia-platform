# Monitoring Reservation Changes Sync

## Current Status

The incremental sync is running in the background. Here's how to monitor it:

### Check if sync is running:
```bash
ps aux | grep "sync-cli.js sync-table reservationChanges" | grep -v grep
```

### View live progress:
```bash
tail -f sync-reservation-changes.log
```

### Check database progress:
```sql
-- Check changes detected
SELECT COUNT(*) as total_changes FROM reservation_changes;

-- Check current state tracked
SELECT COUNT(*) as tracked_reservations FROM reservation_current_state;

-- Check sync metadata
SELECT last_processed_date, records_processed, changes_detected, last_sync_at 
FROM sync_metadata 
WHERE sync_type = 'reservation_changes';

-- Check latest change date
SELECT MAX(snapshot_date) as latest_change_date FROM reservation_changes;
```

### Stop the sync (if needed):
```bash
pkill -f "sync-cli.js sync-table reservationChanges"
```

## Expected Behavior

- **Initial Load**: Processing ~27M rows from 2025-09-01 to 2025-12-31
- **Progress**: ~50k rows per batch
- **Changes**: Only actual changes are stored (not all snapshots)
- **State**: Current state is updated incrementally

## Performance Notes

- Processing 27M rows will take several hours
- Each batch processes ~50k rows
- Changes are detected and stored efficiently
- Current state is deduplicated before upsert

## After Initial Load Completes

Once the initial load finishes, future syncs will be **much faster** because:
- Only new snapshots since last sync will be processed
- Current state is already built
- Incremental updates take minutes instead of hours

