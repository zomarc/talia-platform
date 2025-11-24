-- Create competitor_current_state table
-- Stores the current/latest state of each competitor pricing record for comparison
-- This enables incremental change detection without reprocessing history

CREATE TABLE IF NOT EXISTS competitor_current_state (
  competitor_key TEXT PRIMARY KEY,
  currency TEXT,
  departure_date DATE,
  duration DECIMAL(5,0),
  week_number DECIMAL(5,0),
  year DECIMAL(5,0),
  lowest_price DECIMAL(10,2),
  lowest_inside DECIMAL(10,2),
  lowest_outside DECIMAL(10,2),
  lowest_balcony DECIMAL(10,2),
  lowest_suite DECIMAL(10,2),
  taxes DECIMAL(10,2),
  cruise_line TEXT,
  destination TEXT,
  cruise_name TEXT,
  ship_name TEXT,
  ports TEXT,
  market TEXT,
  source TEXT,
  snapshot_date DATE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_competitor_current_state_snapshot_date ON competitor_current_state(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_competitor_current_state_departure_date ON competitor_current_state(departure_date);
CREATE INDEX IF NOT EXISTS idx_competitor_current_state_cruise_line ON competitor_current_state(cruise_line);
CREATE INDEX IF NOT EXISTS idx_competitor_current_state_ship_name ON competitor_current_state(ship_name);

-- Create competitor table
-- Stores competitor pricing changes detected during sync

CREATE TABLE IF NOT EXISTS competitor (
  id SERIAL PRIMARY KEY,
  competitor_key TEXT NOT NULL,
  currency TEXT,
  departure_date DATE,
  duration DECIMAL(5,0),
  week_number DECIMAL(5,0),
  year DECIMAL(5,0),
  lowest_price DECIMAL(10,2),
  lowest_inside DECIMAL(10,2),
  lowest_outside DECIMAL(10,2),
  lowest_balcony DECIMAL(10,2),
  lowest_suite DECIMAL(10,2),
  taxes DECIMAL(10,2),
  cruise_line TEXT,
  destination TEXT,
  cruise_name TEXT,
  ship_name TEXT,
  ports TEXT,
  market TEXT,
  source TEXT,
  snapshot_date DATE NOT NULL,
  lowest_price_delta DECIMAL(10,2),
  lowest_inside_delta DECIMAL(10,2),
  lowest_outside_delta DECIMAL(10,2),
  lowest_balcony_delta DECIMAL(10,2),
  lowest_suite_delta DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for competitor table
CREATE INDEX IF NOT EXISTS idx_competitor_snapshot_date ON competitor(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_competitor_competitor_key ON competitor(competitor_key);
CREATE INDEX IF NOT EXISTS idx_competitor_departure_date ON competitor(departure_date);
CREATE INDEX IF NOT EXISTS idx_competitor_cruise_line ON competitor(cruise_line);
CREATE INDEX IF NOT EXISTS idx_competitor_ship_name ON competitor(ship_name);

-- Insert initial sync metadata record for competitor if it doesn't exist
INSERT INTO sync_metadata (sync_type, last_processed_date, records_processed, changes_detected)
VALUES ('competitor', '2025-09-01', 0, 0)
ON CONFLICT (sync_type) DO NOTHING;
