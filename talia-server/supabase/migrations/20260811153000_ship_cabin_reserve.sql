-- Offsale / reserved cabins from Seaware via STAR STG (stg.SHIP_CABIN_RESERVE).
-- Used for capacity reporting: cabins held offsale are not sellable inventory.
-- Grain: ship_code + cabin_number + sail date window (+ reserve_type).

CREATE TABLE IF NOT EXISTS ship_cabin_reserve (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT,
  ship_code TEXT,
  cabin_number TEXT,
  rel_day_from NUMERIC,
  rel_day_to NUMERIC,
  sail_date_from DATE,
  sail_date_to DATE,
  reserve_type TEXT,
  comments TEXT,
  guest_count NUMERIC,
  dep_ref_id NUMERIC,
  arr_ref_id NUMERIC,
  allow_segments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_reserve_ship_cabin
  ON ship_cabin_reserve(ship_code, cabin_number);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_reserve_sail_dates
  ON ship_cabin_reserve(ship_code, sail_date_from, sail_date_to);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_reserve_record_id
  ON ship_cabin_reserve(record_id);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_reserve_type
  ON ship_cabin_reserve(reserve_type);

COMMENT ON TABLE ship_cabin_reserve IS
  'Seaware SHIP_CABIN_RESERVE via stg — cabins reserved/offsale by ship and sail window.';
