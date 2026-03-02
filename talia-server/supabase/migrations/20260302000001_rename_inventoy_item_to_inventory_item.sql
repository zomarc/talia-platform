-- Rename typo table inventoy_item -> inventory_item
-- Preserves existing data and FK links by renaming in place.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inventoy_item'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inventory_item'
  ) THEN
    ALTER TABLE inventoy_item RENAME TO inventory_item;
  END IF;
END $$;

-- Normalize trigger function/table names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_inventoy_item_updated_at'
  ) THEN
    ALTER FUNCTION update_inventoy_item_updated_at() RENAME TO update_inventory_item_updated_at;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_update_inventoy_item_updated_at ON inventory_item;
DROP TRIGGER IF EXISTS trigger_update_inventory_item_updated_at ON inventory_item;
CREATE TRIGGER trigger_update_inventory_item_updated_at
  BEFORE UPDATE ON inventory_item
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_item_updated_at();

-- Keep index naming consistent after rename (optional but clean)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inventoy_item_sail_code') THEN
    ALTER INDEX idx_inventoy_item_sail_code RENAME TO idx_inventory_item_sail_code;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inventoy_item_mmsi') THEN
    ALTER INDEX idx_inventoy_item_mmsi RENAME TO idx_inventory_item_mmsi;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inventoy_item_ship_code') THEN
    ALTER INDEX idx_inventoy_item_ship_code RENAME TO idx_inventory_item_ship_code;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inventoy_item_master_sail_id') THEN
    ALTER INDEX idx_inventoy_item_master_sail_id RENAME TO idx_inventory_item_master_sail_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inventoy_item_sail_ship_unique') THEN
    ALTER INDEX idx_inventoy_item_sail_ship_unique RENAME TO idx_inventory_item_sail_ship_unique;
  END IF;
END $$;

COMMENT ON TABLE inventory_item IS 'Canonical mapping table for sail_code, MMSI, ship references and external data links';
