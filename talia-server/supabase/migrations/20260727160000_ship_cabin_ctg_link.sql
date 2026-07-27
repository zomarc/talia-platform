-- Physical cabin → category link (fou.SHIP_CABIN_CTG_LINK).
-- Grain: ship_code + cabin_number (+ effective sail window). No customer/PII columns.
CREATE TABLE IF NOT EXISTS ship_cabin_ctg_link (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT,
  ship_code TEXT,
  cabin_number TEXT,
  cabin_category TEXT,
  eff_sail_from DATE,
  eff_sail_to DATE,
  rollaway_beds NUMERIC,
  cabin_capacity NUMERIC,
  is_active TEXT,
  child_beds NUMERIC,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  active_record_flag INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_ctg_link_ship_cabin
  ON ship_cabin_ctg_link(ship_code, cabin_number);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_ctg_link_category
  ON ship_cabin_ctg_link(cabin_category);

CREATE INDEX IF NOT EXISTS idx_ship_cabin_ctg_link_active
  ON ship_cabin_ctg_link(ship_code, active_record_flag)
  WHERE active_record_flag = 1;

CREATE INDEX IF NOT EXISTS idx_ship_cabin_ctg_link_eff_sail
  ON ship_cabin_ctg_link(ship_code, eff_sail_from, eff_sail_to);
