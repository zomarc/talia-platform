-- Create inventory_status_by_day table
-- This table aggregates current inventory status by day, showing capacity, sold, and available cabins
-- Data is aggregated from cabin_availability and reservation tables

CREATE TABLE IF NOT EXISTS inventory_status_by_day (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  ship_code TEXT NOT NULL,
  sail_code TEXT,
  capacity INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, ship_code, sail_code)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_date ON inventory_status_by_day(date);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_ship_code ON inventory_status_by_day(ship_code);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_sail_code ON inventory_status_by_day(sail_code);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_date_ship ON inventory_status_by_day(date, ship_code);

-- Add comment to table
COMMENT ON TABLE inventory_status_by_day IS 'Current inventory status aggregated by day, showing capacity, sold, and available cabins per ship and sail';

