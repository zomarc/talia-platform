-- Create sail_by_cabin_occupancy table
-- Contains cabin-level occupancy data by sailing and cabin category
-- Date range: September 2025 sailings only (matches sync configuration)

CREATE TABLE IF NOT EXISTS sail_by_cabin_occupancy (
  id SERIAL PRIMARY KEY,
  sail_id BIGINT,
  sail_code TEXT,
  sail_days INTEGER,
  sail_date_from DATE,
  master_voyage TEXT,
  sail_itinerary_date DATE,
  sail_itinerary_night INTEGER,
  port_code TEXT,
  ship_code TEXT,
  ship_name TEXT,
  package_type TEXT,
  package_name TEXT,
  geog_area_code TEXT,
  season_code TEXT,
  is_fake TEXT,
  is_active TEXT,
  is_package_active TEXT,
  cabin_category TEXT,
  cabin_capacity INTEGER,
  total_cabins INTEGER,
  occupied_cabins INTEGER,
  remaining_cabins INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sail_by_cabin_occupancy_sail_id ON sail_by_cabin_occupancy(sail_id);
CREATE INDEX IF NOT EXISTS idx_sail_by_cabin_occupancy_sail_code ON sail_by_cabin_occupancy(sail_code);
CREATE INDEX IF NOT EXISTS idx_sail_by_cabin_occupancy_sail_date_from ON sail_by_cabin_occupancy(sail_date_from);
CREATE INDEX IF NOT EXISTS idx_sail_by_cabin_occupancy_cabin_category ON sail_by_cabin_occupancy(cabin_category);
CREATE INDEX IF NOT EXISTS idx_sail_by_cabin_occupancy_ship_code ON sail_by_cabin_occupancy(ship_code);

