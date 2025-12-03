-- Google Search Trends Table
-- Stores historical search data to track trends over time

CREATE TABLE IF NOT EXISTS google_search_trends (
  id SERIAL PRIMARY KEY,
  
  -- Search query information
  query TEXT NOT NULL,
  
  -- Search metrics
  total_results INTEGER NOT NULL,
  search_time DECIMAL(10, 3), -- Search execution time in seconds
  
  -- Date tracking
  search_date DATE NOT NULL DEFAULT CURRENT_DATE,
  search_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Metadata
  notes TEXT,
  created_by TEXT,
  
  -- Indexes for efficient querying
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate entries for same query on same day
  CONSTRAINT unique_query_date UNIQUE (query, search_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_search_trends_query ON google_search_trends(query);
CREATE INDEX IF NOT EXISTS idx_google_search_trends_date ON google_search_trends(search_date);
CREATE INDEX IF NOT EXISTS idx_google_search_trends_timestamp ON google_search_trends(search_timestamp);
CREATE INDEX IF NOT EXISTS idx_google_search_trends_query_date ON google_search_trends(query, search_date DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_google_search_trends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_google_search_trends_updated_at
  BEFORE UPDATE ON google_search_trends
  FOR EACH ROW
  EXECUTE FUNCTION update_google_search_trends_updated_at();

-- Comments
COMMENT ON TABLE google_search_trends IS 'Stores historical Google search data to track trends over time';
COMMENT ON COLUMN google_search_trends.query IS 'The search query text';
COMMENT ON COLUMN google_search_trends.total_results IS 'Total number of search results returned';
COMMENT ON COLUMN google_search_trends.search_date IS 'Date of the search (for daily aggregation)';
COMMENT ON COLUMN google_search_trends.search_timestamp IS 'Exact timestamp when search was performed';

