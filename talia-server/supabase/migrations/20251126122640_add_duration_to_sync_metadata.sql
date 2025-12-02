-- Add duration_ms column to sync_metadata table
-- Tracks the duration of the last sync operation in milliseconds

ALTER TABLE sync_metadata 
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Add comment to document the column
COMMENT ON COLUMN sync_metadata.duration_ms IS 'Duration of the last sync operation in milliseconds';

