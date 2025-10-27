-- Create published_rates table
CREATE TABLE IF NOT EXISTS published_rates (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_published_rates_snapshot_date ON published_rates(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_published_rates_sail_code ON published_rates(sail_code);
CREATE INDEX IF NOT EXISTS idx_published_rates_departure_date ON published_rates(departure_date);
CREATE INDEX IF NOT EXISTS idx_published_rates_cabin_category ON published_rates(cabin_category);
CREATE INDEX IF NOT EXISTS idx_published_rates_rate_type ON published_rates(rate_type);


