-- Profile system v1: editable sail ↔ model (history) binding + active target flag.

CREATE TABLE IF NOT EXISTS profile_model_map (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  model_inventory_item_id BIGINT REFERENCES inventory_item(id) ON DELETE SET NULL,
  model_sail_code TEXT,
  match_mode TEXT NOT NULL DEFAULT 'lazy'
    CHECK (match_mode IN ('lazy', 'manual')),
  notes TEXT,
  confidence NUMERIC,
  matched_dow INT,
  matched_duration INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_edited_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_model_map_model_item
  ON profile_model_map (model_inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_profile_model_map_model_sail
  ON profile_model_map (model_sail_code);

CREATE OR REPLACE FUNCTION update_profile_model_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_model_map_updated_at ON profile_model_map;
CREATE TRIGGER trigger_update_profile_model_map_updated_at
  BEFORE UPDATE ON profile_model_map
  FOR EACH ROW EXECUTE FUNCTION update_profile_model_map_updated_at();

COMMENT ON TABLE profile_model_map IS
  'Editable binding from a current/future inventory_item to a history model peer (lazy default or manual override)';

-- One active target profile per inventory item (MSE review uses this).
ALTER TABLE inventory_target_profile
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_target_profile_one_active
  ON inventory_target_profile (inventory_item_id)
  WHERE is_active = true;

COMMENT ON COLUMN inventory_target_profile.is_active IS
  'When true, this named target is the default goal curve for the inventory item (ProfileCompare / MSE review)';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profile_model_map TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE profile_model_map_id_seq TO anon, authenticated, service_role;
