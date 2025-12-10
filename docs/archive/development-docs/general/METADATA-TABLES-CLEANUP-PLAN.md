# Metadata Tables Cleanup Plan

## Overview

After testing the unified `operation_metadata` table, we need to clean up the old tables and ensure everything is working correctly.

## Testing Checklist

Before cleanup, verify:

- [ ] All sync operations write to `operation_metadata`
- [ ] All refresh operations write to `operation_metadata`
- [ ] Backup script writes to `operation_metadata`
- [ ] GraphQL queries return correct data
- [ ] Frontend displays backup status correctly
- [ ] Data Management Page shows all metadata correctly
- [ ] No errors in backend logs
- [ ] No errors in frontend console

## Cleanup Steps

### Step 1: Verify Data Migration

```sql
-- Check sync data was migrated
SELECT COUNT(*) FROM sync_metadata;
SELECT COUNT(*) FROM operation_metadata WHERE operation_type = 'sync';
-- Counts should match

-- Check refresh data was migrated
SELECT COUNT(*) FROM data_refresh_metadata;
SELECT COUNT(*) FROM operation_metadata WHERE operation_type = 'refresh';
-- Counts should match

-- Verify backup record exists
SELECT * FROM operation_metadata WHERE operation_type = 'backup';
```

### Step 2: Archive Old Tables (Keep for Reference)

```sql
-- Rename old tables to archive (DO NOT DELETE YET)
ALTER TABLE sync_metadata RENAME TO sync_metadata_archive;
ALTER TABLE data_refresh_metadata RENAME TO data_refresh_metadata_archive;
```

### Step 3: Update Code References (Final Cleanup)

After confirming everything works for 1-2 weeks:

1. **Remove old table references** (if any remain):
   - Search codebase for `sync_metadata_archive` or `data_refresh_metadata_archive`
   - Remove any remaining references

2. **Update tableSources config**:
   - Remove `sync_metadata` and `data_refresh_metadata` from known tables list
   - Add `operation_metadata` if needed

3. **Update documentation**:
   - Update any docs that reference old tables
   - Document the unified `operation_metadata` table

### Step 4: Delete Archived Tables (After Extended Testing)

**Only after 1-2 months of successful operation:**

```sql
-- Final cleanup - delete archived tables
-- WARNING: Only do this after extended testing period
DROP TABLE IF EXISTS sync_metadata_archive;
DROP TABLE IF EXISTS data_refresh_metadata_archive;
```

## Rollback Plan

If issues are discovered:

```sql
-- Restore old tables
ALTER TABLE sync_metadata_archive RENAME TO sync_metadata;
ALTER TABLE data_refresh_metadata_archive RENAME TO data_refresh_metadata;

-- Revert code changes (git revert)
```

## Migration Verification Queries

```sql
-- Verify all sync types migrated
SELECT 
  operation_type,
  operation_name,
  last_run_at,
  status,
  records_processed
FROM operation_metadata
WHERE operation_type = 'sync'
ORDER BY operation_name;

-- Verify all refresh sources migrated
SELECT 
  operation_type,
  operation_name,
  last_run_at,
  status,
  records_updated
FROM operation_metadata
WHERE operation_type = 'refresh'
ORDER BY operation_name;

-- Check backup record
SELECT 
  operation_type,
  operation_name,
  last_run_at,
  backup_status,
  backup_file_path,
  backup_size_human
FROM operation_metadata
WHERE operation_type = 'backup';
```

## Timeline

1. **Week 1**: Monitor for any issues
2. **Week 2**: Archive old tables (rename)
3. **Week 3-4**: Continue monitoring
4. **Month 2+**: Consider deleting archived tables

## Notes

- Old tables are renamed, not deleted, for safety
- Can rollback easily if needed
- All data is preserved in `operation_metadata`
- Backup metadata is now tracked in the unified table

