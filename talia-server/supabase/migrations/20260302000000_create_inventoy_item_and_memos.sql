-- Source-of-truth mapping table for inventory-linked records
-- Note: table name intentionally follows requested name "inventoy_item"

CREATE TABLE IF NOT EXISTS inventoy_item (
  id BIGSERIAL PRIMARY KEY,
  local_key UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  sail_code TEXT,
  mmsi TEXT,
  imo_number TEXT,
  ship_code TEXT,
  ship_name TEXT,
  master_sail_id DOUBLE PRECISION,
  package_id DOUBLE PRECISION,
  source_table TEXT DEFAULT 'master_sail',
  source_row_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventoy_item_sail_code ON inventoy_item(sail_code);
CREATE INDEX IF NOT EXISTS idx_inventoy_item_mmsi ON inventoy_item(mmsi);
CREATE INDEX IF NOT EXISTS idx_inventoy_item_ship_code ON inventoy_item(ship_code);
CREATE INDEX IF NOT EXISTS idx_inventoy_item_master_sail_id ON inventoy_item(master_sail_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventoy_item_sail_ship_unique
  ON inventoy_item(sail_code, ship_code)
  WHERE sail_code IS NOT NULL AND ship_code IS NOT NULL;

CREATE OR REPLACE FUNCTION update_inventoy_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventoy_item_updated_at ON inventoy_item;
CREATE TRIGGER trigger_update_inventoy_item_updated_at
  BEFORE UPDATE ON inventoy_item
  FOR EACH ROW
  EXECUTE FUNCTION update_inventoy_item_updated_at();

-- Memo table linked to inventoy_item
CREATE TABLE IF NOT EXISTS inventory_item_memo (
  id BIGSERIAL PRIMARY KEY,
  inventory_item_id BIGINT NOT NULL REFERENCES inventoy_item(id) ON DELETE CASCADE,
  memo_text TEXT NOT NULL,
  memo_type TEXT DEFAULT 'note',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_memo_item_id ON inventory_item_memo(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_item_memo_created_at ON inventory_item_memo(created_at DESC);

CREATE OR REPLACE FUNCTION update_inventory_item_memo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_item_memo_updated_at ON inventory_item_memo;
CREATE TRIGGER trigger_update_inventory_item_memo_updated_at
  BEFORE UPDATE ON inventory_item_memo
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_item_memo_updated_at();

-- Seed mapping rows from master_sail where possible
INSERT INTO inventoy_item (
  sail_code,
  mmsi,
  imo_number,
  ship_code,
  ship_name,
  master_sail_id,
  package_id,
  source_table,
  source_row_id
)
SELECT DISTINCT
  ms.sail_code,
  CASE
    WHEN UPPER(ms.ship_name) LIKE '%DISCOVERY%' THEN '310872000'
    WHEN UPPER(ms.ship_name) LIKE '%JOURNEY%' THEN '310811000'
    ELSE NULL
  END AS mmsi,
  CASE
    WHEN UPPER(ms.ship_name) LIKE '%DISCOVERY%' THEN '9221566'
    WHEN UPPER(ms.ship_name) LIKE '%JOURNEY%' THEN '8919269'
    ELSE NULL
  END AS imo_number,
  ms.ship_code,
  ms.ship_name,
  ms.sail_id,
  ms.package_id,
  'master_sail' AS source_table,
  COALESCE(ms.sail_id::TEXT, ms.sail_code) AS source_row_id
FROM master_sail ms
WHERE ms.sail_code IS NOT NULL
  AND ms.ship_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM inventoy_item ii
    WHERE ii.sail_code = ms.sail_code
      AND ii.ship_code = ms.ship_code
  );

COMMENT ON TABLE inventoy_item IS 'Canonical mapping table for sail_code, MMSI, ship references and external data links';
COMMENT ON TABLE inventory_item_memo IS 'User memos linked to canonical inventoy_item records';
