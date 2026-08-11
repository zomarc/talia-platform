-- Multi-perspective nested load-factor target profiles per inventory item.
-- Tree: voyage → market_group → market → currency; metric is always load_factor %.

CREATE TABLE IF NOT EXISTS inventory_target_profile (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  perspective TEXT NOT NULL DEFAULT 'commercial',
  description TEXT,
  metric TEXT NOT NULL DEFAULT 'load_factor'
    CHECK (metric IN ('load_factor')),
  profile_scope TEXT NOT NULL DEFAULT 'system'
    CHECK (profile_scope IN ('system', 'global', 'user')),
  owner_key TEXT DEFAULT 'talia',
  last_edited_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (inventory_item_id, name, perspective)
);

CREATE INDEX IF NOT EXISTS idx_inventory_target_profile_item
  ON inventory_target_profile (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_target_profile_perspective
  ON inventory_target_profile (inventory_item_id, perspective);

CREATE TABLE IF NOT EXISTS inventory_target_profile_node (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES inventory_target_profile(id) ON DELETE CASCADE,
  dimension_level TEXT NOT NULL
    CHECK (dimension_level IN ('voyage', 'market_group', 'market', 'currency')),
  dimension_key TEXT NOT NULL,
  parent_node_id BIGINT REFERENCES inventory_target_profile_node(id) ON DELETE CASCADE,
  week_label TEXT,
  weeks_until_sailing INT,
  lf_pct NUMERIC NOT NULL DEFAULT 0,
  point_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_target_profile_node_profile
  ON inventory_target_profile_node (profile_id);
CREATE INDEX IF NOT EXISTS idx_inventory_target_profile_node_parent
  ON inventory_target_profile_node (parent_node_id);
CREATE INDEX IF NOT EXISTS idx_inventory_target_profile_node_dim
  ON inventory_target_profile_node (profile_id, dimension_level, dimension_key);

CREATE OR REPLACE FUNCTION update_inventory_target_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_target_profile_updated_at ON inventory_target_profile;
CREATE TRIGGER trigger_update_inventory_target_profile_updated_at
  BEFORE UPDATE ON inventory_target_profile
  FOR EACH ROW EXECUTE FUNCTION update_inventory_target_profile_updated_at();

DROP TRIGGER IF EXISTS trigger_update_inventory_target_profile_node_updated_at ON inventory_target_profile_node;
CREATE TRIGGER trigger_update_inventory_target_profile_node_updated_at
  BEFORE UPDATE ON inventory_target_profile_node
  FOR EACH ROW EXECUTE FUNCTION update_inventory_target_profile_updated_at();

COMMENT ON TABLE inventory_target_profile IS
  'Named multi-perspective nested load-factor target profiles per inventory item';
COMMENT ON TABLE inventory_target_profile_node IS
  'Nested LF nodes: voyage -> market_group -> market -> currency, optional week grid';
