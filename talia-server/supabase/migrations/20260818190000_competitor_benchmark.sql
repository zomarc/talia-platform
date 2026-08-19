-- Competitor benchmark feed from dwh.vw_Competitor_Benchmarking (RateGain).
-- Separate from stg.COMPETITOR / competitor_current_state.
-- Grain: snapshot × cruise line × ship × departure × cabin type × market.
-- Ship_Code is the competitor ship, not Celestyal inventory_item.ship_code.

CREATE TABLE IF NOT EXISTS competitor_benchmark (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE,
  is_latest_snapshot TEXT,
  wc_snapshot_date DATE,
  source_market TEXT,
  cruise_line_code TEXT,
  ship_code TEXT,
  cruise_line_name TEXT,
  website TEXT,
  source_ship_name TEXT,
  departure_date DATE,
  wc_departure_date DATE,
  disembark_date DATE,
  cruise_duration NUMERIC,
  departure_country TEXT,
  departure_port TEXT,
  disembarkation_port TEXT,
  disembarkation_port_unlocode TEXT,
  source_destination TEXT,
  cabin_type TEXT,
  rate_pp NUMERIC,
  port_charges_gratuity NUMERIC,
  total_rate_pp NUMERIC,
  pppd NUMERIC,
  total_rate_pp_eur NUMERIC,
  itinerary_port_content TEXT,
  itinerary_code TEXT,
  three_port_match TEXT,
  has_home_port TEXT,
  source_currency TEXT,
  currency_code TEXT,
  available_offer TEXT,
  availability TEXT,
  source TEXT,
  frequency TEXT,
  rate_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_benchmark_latest_depart
  ON competitor_benchmark (is_latest_snapshot, departure_date);

CREATE INDEX IF NOT EXISTS idx_competitor_benchmark_snapshot
  ON competitor_benchmark (snapshot_date);

CREATE INDEX IF NOT EXISTS idx_competitor_benchmark_line_ship
  ON competitor_benchmark (cruise_line_code, ship_code, departure_date);

COMMENT ON TABLE competitor_benchmark IS
  'dwh.vw_Competitor_Benchmarking (RateGain). Distinct from stg.COMPETITOR pricing.';
