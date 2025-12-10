-- Unified Operation Metadata Table
-- Combines sync_metadata and data_refresh_metadata into a single table
-- Also tracks backup operations

CREATE TABLE IF NOT EXISTS operation_metadata (
  id SERIAL PRIMARY KEY,
  
  -- Operation identification
  operation_type TEXT NOT NULL, -- 'sync', 'refresh', 'backup'
  operation_name TEXT NOT NULL, -- sync_type, data_source, or 'database_backup'
  UNIQUE(operation_type, operation_name),
  
  -- Common fields for all operations
  last_run_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'idle', -- 'idle', 'in_progress', 'success', 'error', 'completed'
  error TEXT,
  duration_ms INTEGER,
  
  -- Sync-specific fields (nullable)
  last_processed_date DATE,
  records_processed BIGINT,
  changes_detected BIGINT,
  records_updated INTEGER, -- For refresh operations
  
  -- Backup-specific fields (nullable)
  backup_file_path TEXT,
  backup_size_bytes BIGINT,
  backup_size_human TEXT, -- e.g., "1.2 GB"
  backup_status TEXT, -- 'success', 'failed', 'in_progress'
  
  -- Flexible metadata (JSONB)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_operation_metadata_type_name ON operation_metadata(operation_type, operation_name);
CREATE INDEX IF NOT EXISTS idx_operation_metadata_last_run ON operation_metadata(last_run_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_metadata_status ON operation_metadata(status);
CREATE INDEX IF NOT EXISTS idx_operation_metadata_operation_type ON operation_metadata(operation_type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_operation_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_operation_metadata_updated_at
  BEFORE UPDATE ON operation_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_operation_metadata_updated_at();

-- Comments
COMMENT ON TABLE operation_metadata IS 'Unified metadata table for sync, refresh, and backup operations';
COMMENT ON COLUMN operation_metadata.operation_type IS 'Type of operation: sync, refresh, or backup';
COMMENT ON COLUMN operation_metadata.operation_name IS 'Name/identifier for the operation (sync_type, data_source, or backup name)';
COMMENT ON COLUMN operation_metadata.last_run_at IS 'Timestamp of last run (replaces last_sync_at and last_refreshed_at)';
COMMENT ON COLUMN operation_metadata.status IS 'Current status: idle, in_progress, success, error, completed';
COMMENT ON COLUMN operation_metadata.backup_file_path IS 'Path to backup file (for backup operations)';
COMMENT ON COLUMN operation_metadata.backup_size_bytes IS 'Backup file size in bytes';
COMMENT ON COLUMN operation_metadata.backup_size_human IS 'Human-readable backup size (e.g., "1.2 GB")';

-- Migrate data from sync_metadata
INSERT INTO operation_metadata (
  operation_type,
  operation_name,
  last_run_at,
  status,
  error,
  duration_ms,
  last_processed_date,
  records_processed,
  changes_detected,
  created_at,
  updated_at
)
SELECT 
  'sync' as operation_type,
  sync_type as operation_name,
  last_sync_at as last_run_at,
  CASE 
    WHEN last_sync_at IS NOT NULL THEN 'completed'
    ELSE 'idle'
  END as status,
  error,
  duration_ms,
  last_processed_date,
  records_processed,
  changes_detected,
  created_at,
  updated_at
FROM sync_metadata
ON CONFLICT (operation_type, operation_name) DO NOTHING;

-- Migrate data from data_refresh_metadata
INSERT INTO operation_metadata (
  operation_type,
  operation_name,
  last_run_at,
  status,
  error,
  records_updated,
  metadata,
  created_at,
  updated_at
)
SELECT 
  'refresh' as operation_type,
  data_source as operation_name,
  last_refreshed_at as last_run_at,
  COALESCE(refresh_status, 'idle') as status,
  refresh_error as error,
  records_updated,
  metadata,
  created_at,
  updated_at
FROM data_refresh_metadata
ON CONFLICT (operation_type, operation_name) DO NOTHING;

-- Create initial backup record
INSERT INTO operation_metadata (
  operation_type,
  operation_name,
  status,
  backup_status
) VALUES (
  'backup',
  'database_backup',
  'idle',
  'idle'
) ON CONFLICT (operation_type, operation_name) DO NOTHING;

