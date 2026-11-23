-- Add missing `error` column to sync_metadata.
--
-- The later migration 20251207000000_create_unified_operation_metadata.sql
-- copies data out of sync_metadata with `SELECT ... error ... FROM sync_metadata`.
-- sync_metadata was originally created (20251117100000) without an `error`
-- column and only had `duration_ms` added (20251126122640), so a fresh
-- `supabase start` / `supabase db reset` aborts with
-- `ERROR: column "error" does not exist (SQLSTATE 42703)`.
--
-- Adding the column here (idempotently, before the unified migration runs)
-- lets the migration chain apply cleanly on a clean database. This is safe on
-- existing databases because of IF NOT EXISTS.

ALTER TABLE sync_metadata
ADD COLUMN IF NOT EXISTS error TEXT;

COMMENT ON COLUMN sync_metadata.error IS 'Last sync error message, if any (used by unified operation_metadata migration)';
