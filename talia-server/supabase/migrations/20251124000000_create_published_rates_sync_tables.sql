-- Create published_rates_current_state table
-- Stores the current/latest state of each published rate for comparison
-- This enables incremental change detection without reprocessing history

CREATE TABLE IF NOT EXISTS published_rates_current_state (
  rate_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  sail_code TEXT,
  ship_code TEXT,
  package_name TEXT,
  region TEXT,
  rate_type TEXT,
  sail_days DECIMAL(5,2),
  departure_date DATE,
  cabin_category TEXT,
  promo_name TEXT,
  promo_type TEXT,
  currency_code TEXT,
  fare_per_person DECIMAL(15,2),
  port_taxes_services DECIMAL(15,2),
  extra_adult DECIMAL(15,2),
  extra_child DECIMAL(15,2),
  discount DECIMAL(15,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_published_rates_current_state_snapshot_date ON published_rates_current_state(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_published_rates_current_state_sail_code ON published_rates_current_state(sail_code);
CREATE INDEX IF NOT EXISTS idx_published_rates_current_state_departure_date ON published_rates_current_state(departure_date);
CREATE INDEX IF NOT EXISTS idx_published_rates_current_state_cabin_category ON published_rates_current_state(cabin_category);

-- Create published_rates_changes table
-- Stores detected changes to published rates during sync

CREATE TABLE IF NOT EXISTS published_rates_changes (
  id SERIAL PRIMARY KEY,
  rate_key TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  sail_code TEXT,
  ship_code TEXT,
  package_name TEXT,
  region TEXT,
  rate_type TEXT,
  sail_days DECIMAL(5,2),
  departure_date DATE,
  cabin_category TEXT,
  promo_name TEXT,
  promo_type TEXT,
  currency_code TEXT,
  fare_per_person DECIMAL(15,2),
  port_taxes_services DECIMAL(15,2),
  extra_adult DECIMAL(15,2),
  extra_child DECIMAL(15,2),
  discount DECIMAL(15,2),
  fare_per_person_delta DECIMAL(15,2),
  port_taxes_services_delta DECIMAL(15,2),
  extra_adult_delta DECIMAL(15,2),
  extra_child_delta DECIMAL(15,2),
  discount_delta DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for published_rates_changes table
CREATE INDEX IF NOT EXISTS idx_published_rates_changes_snapshot_date ON published_rates_changes(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_published_rates_changes_rate_key ON published_rates_changes(rate_key);
CREATE INDEX IF NOT EXISTS idx_published_rates_changes_sail_code ON published_rates_changes(sail_code);
CREATE INDEX IF NOT EXISTS idx_published_rates_changes_departure_date ON published_rates_changes(departure_date);

-- Insert initial sync metadata record for published_rates if it doesn't exist
INSERT INTO sync_metadata (sync_type, last_processed_date, records_processed, changes_detected)
VALUES ('published_rates', (CURRENT_DATE - INTERVAL '2 days')::DATE, 0, 0)
ON CONFLICT (sync_type) DO NOTHING;


