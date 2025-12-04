-- Data Refresh Metadata Table
-- Stores refresh timestamps and status for various data sources
-- Reusable pattern for tracking data refresh across different components

CREATE TABLE IF NOT EXISTS data_refresh_metadata (
  id SERIAL PRIMARY KEY,
  
  -- Data source identifier (e.g., 'google_trends', 'demand_heatmap', etc.)
  data_source TEXT NOT NULL UNIQUE,
  
  -- Refresh information
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  refresh_status TEXT DEFAULT 'idle', -- 'idle', 'in_progress', 'success', 'error'
  refresh_error TEXT,
  records_updated INTEGER,
  
  -- Additional metadata stored as JSONB for flexibility
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_refresh_metadata_data_source ON data_refresh_metadata(data_source);
CREATE INDEX IF NOT EXISTS idx_data_refresh_metadata_last_refreshed_at ON data_refresh_metadata(last_refreshed_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_data_refresh_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_data_refresh_metadata_updated_at
  BEFORE UPDATE ON data_refresh_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_data_refresh_metadata_updated_at();

-- Comments
COMMENT ON TABLE data_refresh_metadata IS 'Stores refresh timestamps and status for various data sources - reusable pattern';
COMMENT ON COLUMN data_refresh_metadata.data_source IS 'Identifier for the data source (e.g., "google_trends", "demand_heatmap")';
COMMENT ON COLUMN data_refresh_metadata.last_refreshed_at IS 'Timestamp of last successful refresh';
COMMENT ON COLUMN data_refresh_metadata.refresh_status IS 'Current refresh status: idle, in_progress, success, error';
COMMENT ON COLUMN data_refresh_metadata.metadata IS 'Additional metadata stored as JSONB for flexibility';

