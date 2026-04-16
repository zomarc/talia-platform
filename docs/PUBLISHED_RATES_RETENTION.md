# Published rates changes: retention, indexes, backups

## Why this matters

`public.published_rates_changes` can grow very large. Backups already **exclude row data** by default (schema only); see [backup-db.sh](../talia-server/scripts/backup-db.sh) and [BACKUP-RESTORE.md](../talia-server/scripts/BACKUP-RESTORE.md).

## Indexes

Migration `20260415120000_published_rates_changes_indexes.sql` adds composite indexes suited for:

- UI / GraphQL: `sail_code` + `departure_date` + `snapshot_date` (newest-first ordering in API)
- Lookups: `rate_key` + `snapshot_date`

## Retention (manual or cron)

There is **no** automatic delete in application code. Use a scheduled job (e.g. weekly) if you need to cap history.

**Example: delete changes older than 18 months** (adjust interval; **take a backup first**):

```sql
DELETE FROM public.published_rates_changes
WHERE created_at < NOW() - INTERVAL '18 months';
```

**Lighter alternative:** archive to a file/table, then `TRUNCATE` the live table if you only need recent history in Talia.

## Partitioning (optional, larger migration)

For very large deployments, consider **native partitioning** by month on `snapshot_date` or `created_at`. That requires creating a new partitioned parent table, attaching partitions, and **one-time** data move—plan a maintenance window. The indexes above help before you take that step.

## UI query bounds

The GraphQL `tableData` resolver orders `published_rates_changes` by `snapshot_date` / `id` descending and supports optional `departure_date_from` / `departure_date_to` filters. The Published Rates grid merges dashboard global date criteria when present so responses stay bounded.
