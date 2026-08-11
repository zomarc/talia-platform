-- Densify cabin facts into ship_day_berth_status so MSE does not need
-- category-grain sail_by_cabin_occupancy for Bk C / Tot C.
-- Also provide sail-level booking aggregates for the MSE grid (guest + guaranteed).
--
-- DROP + CREATE is required: CREATE OR REPLACE cannot rename/reorder view columns
-- (cabin_categories would collide with new total_cabins at the same ordinal).

DROP VIEW IF EXISTS public.ship_day_berth_status;

CREATE VIEW public.ship_day_berth_status AS
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
  SUM(o.total_cabins) AS total_cabins,
  SUM(o.occupied_cabins) AS occupied_cabins,
  GREATEST(
    COALESCE(SUM(o.remaining_cabins), SUM(o.total_cabins) - SUM(o.occupied_cabins)),
    0
  ) AS available_cabins,
  COUNT(DISTINCT o.cabin_category) AS cabin_categories
FROM public.sail_by_cabin_occupancy o
WHERE o.ship_code IS NOT NULL
  AND o.sail_code IS NOT NULL
  AND o.sail_itinerary_date IS NOT NULL
  AND COALESCE(o.is_fake, 'N') <> 'Y'
  AND COALESCE(o.is_active, 'N') <> 'N'
GROUP BY o.ship_code, o.sail_code, o.sail_itinerary_date;

COMMENT ON VIEW public.ship_day_berth_status IS
  'Physical berth + cabin capacity/occupancy by ship, sail_code, and itinerary date (densified from sail_by_cabin_occupancy).';

-- One row per sail_code for MSE grid metrics (avoids shipping full reservation_current_state).
-- Guaranteed-cabin rule mirrors masterSailingExplorerTransform.buildGuaranteedCabinsBySailCode:
-- only rows without a res_id contribute (guest_count/2). Probability column is not on
-- reservation_current_state; treat missing probability as 1.0 (same as transform default).
CREATE OR REPLACE VIEW public.sail_booking_summary AS
SELECT
  rcs.sail_code,
  COALESCE(SUM(CASE
    WHEN COALESCE(rcs.guest_count, 0) > 0 THEN rcs.guest_count
    ELSE 0
  END), 0)::numeric AS guest_count,
  COALESCE(SUM(CASE
    WHEN rcs.res_id IS NOT NULL THEN 0
    WHEN COALESCE(rcs.guest_count, 0) <= 0 THEN 0
    ELSE (rcs.guest_count::numeric / 2.0)
  END), 0)::numeric AS guaranteed_cabins
FROM public.reservation_current_state rcs
WHERE rcs.sail_code IS NOT NULL
  AND btrim(rcs.sail_code) <> ''
GROUP BY rcs.sail_code;

COMMENT ON VIEW public.sail_booking_summary IS
  'Sail-level guest and guaranteed-cabin aggregates for Master Sailing Explorer (preemptive densify).';
