-- Talia-native sailing hierarchy on inventory_item.
-- inventory_item is the source-independent canonical layer; master_sail sync feeds hierarchy refresh.

-- ---------------------------------------------------------------------------
-- Columns (includes reference_sail_code from 20260311000000 if not yet applied)
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_item
  ADD COLUMN IF NOT EXISTS reference_sail_code TEXT;

ALTER TABLE public.inventory_item
  ADD COLUMN IF NOT EXISTS sailing_role TEXT NOT NULL DEFAULT 'segment';

ALTER TABLE public.inventory_item
  ADD COLUMN IF NOT EXISTS parent_inventory_item_id BIGINT
    REFERENCES public.inventory_item(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_item
  ADD COLUMN IF NOT EXISTS is_operational BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_item_sailing_role_check'
  ) THEN
    ALTER TABLE public.inventory_item
      ADD CONSTRAINT inventory_item_sailing_role_check
      CHECK (sailing_role IN ('master', 'segment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_item_reference_sail_code
  ON public.inventory_item(reference_sail_code);

CREATE INDEX IF NOT EXISTS idx_inventory_item_sailing_role
  ON public.inventory_item(sailing_role);

CREATE INDEX IF NOT EXISTS idx_inventory_item_parent_id
  ON public.inventory_item(parent_inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_operational
  ON public.inventory_item(is_operational)
  WHERE is_operational = true;

COMMENT ON COLUMN public.inventory_item.reference_sail_code IS
  'Management/master sailing code for grouping (equals sail_code for master rows).';
COMMENT ON COLUMN public.inventory_item.sailing_role IS
  'master = management head sailing; segment = subordinate sail code under a master.';
COMMENT ON COLUMN public.inventory_item.parent_inventory_item_id IS
  'FK to the master inventory_item row (NULL for masters).';
COMMENT ON COLUMN public.inventory_item.is_operational IS
  'False for cancelled (-CX), fake, or inactive sailings.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.talia_master_sail_is_operational(
  p_sail_code TEXT,
  p_is_fake TEXT,
  p_is_active TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_is_fake, 'N') <> 'Y'
     AND COALESCE(p_is_active, 'N') <> 'N'
     AND COALESCE(p_sail_code, '') NOT LIKE '%-CX%';
$$;

CREATE OR REPLACE FUNCTION public.talia_reporting_sail_code(
  p_sail_code TEXT,
  p_master_voyage1 TEXT,
  p_is_main INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_is_main, 0) = 1 THEN p_sail_code
    ELSE COALESCE(NULLIF(TRIM(p_master_voyage1), ''), p_sail_code)
  END;
$$;

-- ---------------------------------------------------------------------------
-- Refresh: upsert inventory_item rows and rebuild hierarchy from master_sail
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_inventory_item_sailing_hierarchy()
RETURNS TABLE (
  upserted_count INTEGER,
  hierarchy_updated_count INTEGER,
  parent_linked_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_upserted INTEGER := 0;
  v_hierarchy INTEGER := 0;
  v_parent INTEGER := 0;
  v_parent_fallback INTEGER := 0;
BEGIN
  WITH ms AS (
    SELECT DISTINCT ON (sail_code, ship_code)
      sail_code,
      ship_code,
      ship_name,
      sail_id,
      package_id
    FROM public.master_sail
    WHERE sail_code IS NOT NULL
      AND ship_code IS NOT NULL
    ORDER BY sail_code, ship_code, id DESC
  ),
  upserted AS (
    INSERT INTO public.inventory_item (
      sail_code,
      ship_code,
      ship_name,
      master_sail_id,
      package_id,
      source_table,
      source_row_id
    )
    SELECT
      ms.sail_code,
      ms.ship_code,
      ms.ship_name,
      ms.sail_id,
      ms.package_id,
      'master_sail',
      COALESCE(ms.sail_id::TEXT, ms.sail_code)
    FROM ms
    ON CONFLICT (sail_code, ship_code)
      WHERE sail_code IS NOT NULL AND ship_code IS NOT NULL
    DO UPDATE SET
      ship_name = EXCLUDED.ship_name,
      master_sail_id = EXCLUDED.master_sail_id,
      package_id = EXCLUDED.package_id,
      source_row_id = EXCLUDED.source_row_id,
      updated_at = NOW()
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_upserted FROM upserted;

  WITH updated AS (
    UPDATE public.inventory_item ii
    SET
      reference_sail_code = public.talia_reporting_sail_code(
        ms.sail_code,
        ms.master_voyage1,
        ms.is_main
      ),
      sailing_role = CASE
        WHEN COALESCE(ms.is_main, 0) = 1 THEN 'master'
        ELSE 'segment'
      END,
      is_operational = public.talia_master_sail_is_operational(
        ms.sail_code,
        ms.is_fake,
        ms.is_active
      ),
      master_sail_id = COALESCE(ii.master_sail_id, ms.sail_id),
      package_id = COALESCE(ii.package_id, ms.package_id),
      ship_name = COALESCE(ii.ship_name, ms.ship_name),
      updated_at = NOW()
    FROM public.master_sail ms
    WHERE ii.sail_code = ms.sail_code
      AND ii.ship_code = ms.ship_code
    RETURNING ii.id
  )
  SELECT COUNT(*)::INTEGER INTO v_hierarchy FROM updated;

  UPDATE public.inventory_item
  SET parent_inventory_item_id = NULL,
      updated_at = NOW()
  WHERE sailing_role = 'master';

  WITH linked AS (
    UPDATE public.inventory_item seg
    SET parent_inventory_item_id = mst.id,
        updated_at = NOW()
    FROM public.inventory_item mst
    WHERE seg.sailing_role = 'segment'
      AND mst.sailing_role = 'master'
      AND mst.sail_code = seg.reference_sail_code
      AND mst.ship_code = seg.ship_code
    RETURNING seg.id
  )
  SELECT COUNT(*)::INTEGER INTO v_parent FROM linked;

  WITH linked AS (
    UPDATE public.inventory_item seg
    SET parent_inventory_item_id = mst.id,
        updated_at = NOW()
    FROM public.inventory_item mst
    WHERE seg.sailing_role = 'segment'
      AND seg.parent_inventory_item_id IS NULL
      AND mst.sailing_role = 'master'
      AND mst.sail_code = seg.reference_sail_code
    RETURNING seg.id
  )
  SELECT COUNT(*)::INTEGER INTO v_parent_fallback FROM linked;

  v_parent := v_parent + v_parent_fallback;

  RETURN QUERY SELECT v_upserted, v_hierarchy, v_parent;
END;
$$;

-- ---------------------------------------------------------------------------
-- Views: clean Talia reporting surfaces
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.inventory_item_operational AS
SELECT *
FROM public.inventory_item
WHERE is_operational = true;

CREATE OR REPLACE VIEW public.sailing_master AS
SELECT *
FROM public.inventory_item
WHERE sailing_role = 'master'
  AND is_operational = true;

CREATE OR REPLACE VIEW public.sailing_hierarchy AS
SELECT
  seg.id,
  seg.local_key,
  seg.sail_code AS segment_sail_code,
  seg.ship_code,
  seg.ship_name,
  seg.sailing_role,
  seg.is_operational,
  seg.reference_sail_code AS master_sail_code,
  seg.parent_inventory_item_id,
  mst.id AS master_inventory_item_id,
  mst.sail_code AS master_sail_code_confirmed,
  ms.sail_date_from,
  ms.sail_date_to,
  ms.sail_days,
  ms.package_name,
  ms.package_type,
  ms.port_from,
  ms.port_to,
  ms.is_main,
  ms.is_primary
FROM public.inventory_item seg
LEFT JOIN public.inventory_item mst
  ON mst.id = seg.parent_inventory_item_id
LEFT JOIN public.master_sail ms
  ON ms.sail_code = seg.sail_code
 AND ms.ship_code = seg.ship_code
WHERE seg.sailing_role = 'segment';

COMMENT ON VIEW public.inventory_item_operational IS
  'Operational inventory_item rows (excludes -CX, fake, inactive).';
COMMENT ON VIEW public.sailing_master IS
  'Management-grain master sailings from Talia inventory_item.';
COMMENT ON VIEW public.sailing_hierarchy IS
  'Segment sailings linked to their master inventory_item row.';

-- Initial backfill
SELECT * FROM public.refresh_inventory_item_sailing_hierarchy();
