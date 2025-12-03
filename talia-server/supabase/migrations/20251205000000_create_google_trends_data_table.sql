-- Google Trends Data Table
-- Stores historical Google Trends interest scores for generic cruise holiday search terms
-- This is what people are searching for (not our searches, but Google Trends data)

CREATE TABLE IF NOT EXISTS google_trends_data (
  id SERIAL PRIMARY KEY,
  
  -- Search query information
  search_query TEXT NOT NULL,
  
  -- Trend data
  date DATE NOT NULL,
  interest_score INTEGER NOT NULL, -- 0-100 from Google Trends
  
  -- Geographic region (empty string = worldwide, or 'US', 'GB', 'GR', etc.)
  region TEXT NOT NULL DEFAULT '',
  
  -- Category (if applicable)
  category TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate entries for same query, date, and region
  CONSTRAINT unique_query_date_region UNIQUE (search_query, date, region)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_trends_data_query ON google_trends_data(search_query);
CREATE INDEX IF NOT EXISTS idx_google_trends_data_date ON google_trends_data(date);
CREATE INDEX IF NOT EXISTS idx_google_trends_data_region ON google_trends_data(region);
CREATE INDEX IF NOT EXISTS idx_google_trends_data_query_date ON google_trends_data(search_query, date DESC);
CREATE INDEX IF NOT EXISTS idx_google_trends_data_query_region_date ON google_trends_data(search_query, region, date DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_google_trends_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_google_trends_data_updated_at
  BEFORE UPDATE ON google_trends_data
  FOR EACH ROW
  EXECUTE FUNCTION update_google_trends_data_updated_at();

-- Comments
COMMENT ON TABLE google_trends_data IS 'Stores historical Google Trends interest scores for cruise holiday search terms - what people are searching for';
COMMENT ON COLUMN google_trends_data.search_query IS 'The search query (e.g., "cruise holidays", "Greek islands cruise")';
COMMENT ON COLUMN google_trends_data.date IS 'Date of the trend data point';
COMMENT ON COLUMN google_trends_data.interest_score IS 'Google Trends interest score (0-100, where 100 is peak popularity)';
COMMENT ON COLUMN google_trends_data.region IS 'Geographic region (empty = worldwide, or country code like US, GB, GR)';

