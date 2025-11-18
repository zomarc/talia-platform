-- Create reservation_current_state table
-- Stores the current/latest state of each reservation for comparison
-- This enables incremental change detection without reprocessing history

CREATE TABLE IF NOT EXISTS reservation_current_state (
  res_id BIGINT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  sail_code TEXT,
  agency_id DECIMAL(9,0),
  group_id DECIMAL(18,0),
  guest_count DECIMAL(5,0),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservation_current_state_snapshot_date ON reservation_current_state(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reservation_current_state_sail_code ON reservation_current_state(sail_code);

-- Create sync_metadata table
-- Tracks the last processed snapshot date for each sync operation
-- Enables incremental updates without reprocessing old data

CREATE TABLE IF NOT EXISTS sync_metadata (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL UNIQUE, -- e.g., 'reservation_changes'
  last_processed_date DATE NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  records_processed BIGINT DEFAULT 0,
  changes_detected BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for sync metadata lookups
CREATE INDEX IF NOT EXISTS idx_sync_metadata_sync_type ON sync_metadata(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_last_processed_date ON sync_metadata(last_processed_date);

-- Insert initial sync metadata record if it doesn't exist
INSERT INTO sync_metadata (sync_type, last_processed_date, records_processed, changes_detected)
VALUES ('reservation_changes', '2025-09-01', 0, 0)
ON CONFLICT (sync_type) DO NOTHING;

