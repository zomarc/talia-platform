-- Unified profile curves for inventory item mappings
-- Supports REAL, TARGET, BUDGET, MODEL series with minimal point structure.

CREATE TABLE IF NOT EXISTS inventory_item_profile_curve_point (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  series_kind TEXT NOT NULL CHECK (series_kind IN ('REAL', 'TARGET', 'BUDGET', 'MODEL')),
  model_key TEXT,
  model_label TEXT,
  point_order INT NOT NULL DEFAULT 0,
  week_label TEXT NOT NULL,
  weeks_until_sailing INT,
  value_bookings NUMERIC,
  value_guests NUMERIC,
  as_of_date DATE,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_profile_point_item_kind
  ON inventory_item_profile_curve_point (inventory_item_id, series_kind);

CREATE INDEX IF NOT EXISTS idx_inventory_profile_point_model
  ON inventory_item_profile_curve_point (inventory_item_id, model_key);

CREATE INDEX IF NOT EXISTS idx_inventory_profile_point_order
  ON inventory_item_profile_curve_point (inventory_item_id, series_kind, point_order);

CREATE OR REPLACE FUNCTION update_inventory_item_profile_curve_point_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_item_profile_curve_point_updated_at
  ON inventory_item_profile_curve_point;

CREATE TRIGGER trigger_update_inventory_item_profile_curve_point_updated_at
  BEFORE UPDATE ON inventory_item_profile_curve_point
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_item_profile_curve_point_updated_at();

COMMENT ON TABLE inventory_item_profile_curve_point IS
  'Normalized curve points by inventory item and series kind (REAL, TARGET, BUDGET, MODEL)';
