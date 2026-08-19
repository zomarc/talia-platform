-- Canonical current + historic (voyage-day) capacity.
-- Physical nameplate stays on occupancy; true offsale cabins from
-- ship_cabin_reserve reduce sellable / available. Segment and constrained
-- holds are classified but do not reduce capacity.
--
-- Grain: ship_code × sail_code × itinerary date (same as ship_day_berth_status).
-- Consumers must still attach physical numbers to the reference sail only.

CREATE OR REPLACE FUNCTION public.cabin_reserve_kind(p_reserve_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t IN (
      'RESERVED', 'BROKEN', 'OUT OF ORDER', 'EMERGENCY',
      'WAREHOUSE', 'CREW', 'OVER'
    ) THEN 'offsale'
    WHEN t = 'HANDICAP' OR t LIKE 'VIP%' THEN 'constrained'
    ELSE 'segment'
  END
  FROM (SELECT UPPER(BTRIM(COALESCE(p_reserve_type, ''))) AS t) s;
$$;

COMMENT ON FUNCTION public.cabin_reserve_kind(text) IS
  'Classify Seaware SHIP_CABIN_RESERVE types: offsale reduces sellable; constrained/segment do not.';

CREATE OR REPLACE VIEW public.ship_day_offsale AS
SELECT
  days.ship_code,
  days.date,
  COUNT(*)::numeric AS offsale_cabins,
  SUM(COALESCE(cap.cabin_capacity, 2))::numeric AS offsale_berths
FROM (
  SELECT DISTINCT ship_code, date
  FROM public.ship_day_berth_status
  WHERE ship_code IS NOT NULL AND date IS NOT NULL
) days
INNER JOIN (
  SELECT DISTINCT
    ship_code,
    UPPER(BTRIM(cabin_number)) AS cabin_number,
    sail_date_from,
    sail_date_to
  FROM public.ship_cabin_reserve
  WHERE public.cabin_reserve_kind(reserve_type) = 'offsale'
    AND cabin_number IS NOT NULL
    AND BTRIM(cabin_number) <> ''
) r
  ON r.ship_code = days.ship_code
 AND (r.sail_date_from IS NULL OR r.sail_date_from <= days.date)
 AND (r.sail_date_to IS NULL OR r.sail_date_to >= days.date)
LEFT JOIN (
  SELECT DISTINCT ON (ship_code, UPPER(BTRIM(cabin_number)))
    ship_code,
    UPPER(BTRIM(cabin_number)) AS cabin_number,
    COALESCE(NULLIF(cabin_capacity, 0), 2) AS cabin_capacity
  FROM public.ship_cabin_ctg_link
  WHERE COALESCE(is_active, 'Y') NOT IN ('N', '0')
  ORDER BY ship_code, UPPER(BTRIM(cabin_number)), eff_sail_to DESC NULLS LAST
) cap
  ON cap.ship_code = r.ship_code
 AND cap.cabin_number = r.cabin_number
GROUP BY days.ship_code, days.date;

COMMENT ON VIEW public.ship_day_offsale IS
  'Distinct offsale cabins/berths by ship × itinerary date (capacity-reducing reserve types only).';

CREATE OR REPLACE VIEW public.ship_day_capacity AS
SELECT
  b.ship_code,
  b.sail_code,
  b.date,
  b.total_cabins AS nameplate_cabins,
  b.berth_capacity AS nameplate_berths,
  COALESCE(o.offsale_cabins, 0) AS offsale_cabins,
  COALESCE(o.offsale_berths, 0) AS offsale_berths,
  GREATEST(b.total_cabins - COALESCE(o.offsale_cabins, 0), 0) AS sellable_cabins,
  GREATEST(b.berth_capacity - COALESCE(o.offsale_berths, 0), 0) AS sellable_berths,
  b.occupied_cabins,
  b.berths_occupied AS occupied_berths,
  GREATEST(
    GREATEST(b.total_cabins - COALESCE(o.offsale_cabins, 0), 0) - b.occupied_cabins,
    0
  ) AS available_cabins,
  GREATEST(
    GREATEST(b.berth_capacity - COALESCE(o.offsale_berths, 0), 0) - b.berths_occupied,
    0
  ) AS available_berths,
  b.cabin_categories,
  b.berth_capacity,
  b.berths_occupied,
  GREATEST(
    GREATEST(b.berth_capacity - COALESCE(o.offsale_berths, 0), 0) - b.berths_occupied,
    0
  ) AS berths_available,
  b.total_cabins
FROM public.ship_day_berth_status b
LEFT JOIN public.ship_day_offsale o
  ON o.ship_code = b.ship_code
 AND o.date = b.date;

COMMENT ON VIEW public.ship_day_capacity IS
  'Canonical voyage-day capacity: nameplate, offsale, sellable, occupied, available. Physical identity still attaches via inventory_item.reference_sail_code.';
