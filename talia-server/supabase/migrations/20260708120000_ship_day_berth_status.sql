-- Physical ship × day berth facts (separate from selling sail_code hierarchy).
-- One row per ship, sail_code, and itinerary date with berth capacity and occupancy.

CREATE OR REPLACE VIEW public.ship_day_berth_status AS
SELECT
  o.ship_code,
  o.sail_code,
  o.sail_itinerary_date AS date,
  SUM(o.cabin_capacity * o.total_cabins) AS berth_capacity,
  SUM(o.cabin_capacity * o.occupied_cabins) AS berths_occupied,
  GREATEST(
    SUM(o.cabin_capacity * o.total_cabins)
    - SUM(o.cabin_capacity * o.occupied_cabins),
    0
  ) AS berths_available,
  COUNT(DISTINCT o.cabin_category) AS cabin_categories
FROM public.sail_by_cabin_occupancy o
WHERE o.ship_code IS NOT NULL
  AND o.sail_code IS NOT NULL
  AND o.sail_itinerary_date IS NOT NULL
  AND COALESCE(o.is_fake, 'N') <> 'Y'
  AND COALESCE(o.is_active, 'N') <> 'N'
GROUP BY o.ship_code, o.sail_code, o.sail_itinerary_date;

COMMENT ON VIEW public.ship_day_berth_status IS
  'Physical berth capacity and occupancy by ship, sail_code, and itinerary date (selling structure).';

-- Map master sailings to the physical sail_code used for berth snapshots on each calendar day.
CREATE OR REPLACE VIEW public.sailing_physical_day_map AS
SELECT
  mst.sail_code AS master_sail_code,
  mst.ship_code,
  mst.sail_date_from AS master_date_from,
  mst.sail_date_to AS master_date_to,
  seg.sail_code AS segment_sail_code,
  seg.sail_date_from AS segment_date_from,
  seg.sail_date_to AS segment_date_to,
  ii.reference_sail_code,
  ii.sailing_role,
  ii.is_operational
FROM public.master_sail mst
LEFT JOIN public.inventory_item ii
  ON ii.sail_code = mst.sail_code
 AND ii.ship_code = mst.ship_code
LEFT JOIN public.master_sail seg
  ON seg.master_voyage1 = mst.sail_code
 AND seg.ship_code = mst.ship_code
 AND seg.is_main = 0
 AND COALESCE(seg.is_fake, 'N') <> 'Y'
 AND COALESCE(seg.is_active, 'N') <> 'N'
WHERE mst.is_main = 1
  AND COALESCE(mst.is_fake, 'N') <> 'Y'
  AND COALESCE(mst.is_active, 'N') <> 'N';

COMMENT ON VIEW public.sailing_physical_day_map IS
  'Links master sailings to segment sail_codes for selling structure (physical berths use ship_day_berth_status).';
