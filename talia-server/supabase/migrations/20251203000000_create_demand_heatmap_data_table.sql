-- Demand Heatmap Test/Mock Data Table
-- This table aggregates the minimal data needed for the demand heatmap
-- and allows for both real data and mock data for testing purposes

CREATE TABLE IF NOT EXISTS demand_heatmap_data (
  id SERIAL PRIMARY KEY,
  
  -- Core identifiers
  sail_code TEXT NOT NULL,
  region TEXT, -- Pre-computed region (Mediterranean, Gulf, Unknown)
  itinerary TEXT, -- package_name from master_sail
  
  -- Date information
  departure_month TEXT NOT NULL, -- Format: YYYY-MM (e.g., "2026-04")
  departure_date DATE, -- Full date for reference
  
  -- Demand metrics
  guest_count DECIMAL(10, 2) DEFAULT 0,
  reservation_count INTEGER DEFAULT 0,
  
  -- Geographic metadata
  geog_area_code TEXT,
  ship_code TEXT,
  ship_name TEXT,
  
  -- Data source flag
  is_mock_data BOOLEAN DEFAULT false, -- true for test/mock data, false for real data
  data_source TEXT, -- 'synapse', 'mock', 'manual'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_sail_code ON demand_heatmap_data(sail_code);
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_departure_month ON demand_heatmap_data(departure_month);
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_region ON demand_heatmap_data(region);
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_itinerary ON demand_heatmap_data(itinerary);
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_is_mock ON demand_heatmap_data(is_mock_data);
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_month_region ON demand_heatmap_data(departure_month, region);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_demand_heatmap_region_itinerary_month 
  ON demand_heatmap_data(region, itinerary, departure_month);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_demand_heatmap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_demand_heatmap_updated_at
  BEFORE UPDATE ON demand_heatmap_data
  FOR EACH ROW
  EXECUTE FUNCTION update_demand_heatmap_updated_at();

-- View for aggregated heatmap data (groups by region, itinerary, month)
CREATE OR REPLACE VIEW demand_heatmap_aggregated AS
SELECT 
  region,
  itinerary,
  departure_month,
  SUM(guest_count) as total_guest_count,
  SUM(reservation_count) as total_reservation_count,
  COUNT(DISTINCT sail_code) as unique_sail_count,
  BOOL_OR(is_mock_data) as contains_mock_data,
  STRING_AGG(DISTINCT geog_area_code, ', ' ORDER BY geog_area_code) as geog_areas
FROM demand_heatmap_data
WHERE is_mock_data = false OR is_mock_data IS NULL -- Default to real data, allow override
GROUP BY region, itinerary, departure_month
ORDER BY region, itinerary, departure_month;

-- Comment on table
COMMENT ON TABLE demand_heatmap_data IS 
'Stores aggregated demand data for heatmap visualization. Supports both real and mock data for testing.';

COMMENT ON COLUMN demand_heatmap_data.is_mock_data IS 
'Flag to distinguish test/mock data from real production data. Filter by this when querying.';

COMMENT ON VIEW demand_heatmap_aggregated IS 
'Aggregated view of demand heatmap data grouped by region, itinerary, and month.';

