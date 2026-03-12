-- Add canonical reference sail code for master-level pricing/grouping.
-- This keeps physical sail_code segments while allowing grouped "master sailing" selection.

ALTER TABLE IF EXISTS public.inventory_item
  ADD COLUMN IF NOT EXISTS reference_sail_code TEXT;

UPDATE public.inventory_item
SET reference_sail_code = sail_code
WHERE reference_sail_code IS NULL
  AND sail_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_reference_sail_code
  ON public.inventory_item(reference_sail_code);

COMMENT ON COLUMN public.inventory_item.reference_sail_code
  IS 'Canonical reference sail code used for pricing/master sailing grouping.';
