-- Densify Booked / Contracted / Estimated for MSE from local reservation
-- (RES_HEADER today + Fact_Reservation synthetic group-OF).
-- Monday history aggregates for over-time curves (Fact_Reservation_History).

CREATE TABLE IF NOT EXISTS public.sail_booking_monday (
  sail_code text NOT NULL,
  snapshot_date date NOT NULL,
  booked_guests numeric NOT NULL DEFAULT 0,
  contracted_guests numeric NOT NULL DEFAULT 0,
  estimated_guests numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (sail_code, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sail_booking_monday_snapshot
  ON public.sail_booking_monday (snapshot_date);

COMMENT ON TABLE public.sail_booking_monday IS
  'Sail × Monday (WC_Snapshot_Date) Booked/Contracted/Estimated densified from dwh.Fact_Reservation_History — not Fact_Reservation_daily.';

DROP VIEW IF EXISTS public.sail_booking_summary;

CREATE VIEW public.sail_booking_summary AS
SELECT
  r.sail_code,
  -- guest_count = Booked (compat with existing MSE transform)
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc' THEN 0
    WHEN UPPER(BTRIM(COALESCE(r.res_status, ''))) IN ('BK', 'BOOKED', 'BKD')
      THEN COALESCE(r.guest_count, 0)
    ELSE 0
  END), 0)::numeric AS guest_count,
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc' THEN 0
    WHEN UPPER(BTRIM(COALESCE(r.res_status, ''))) IN ('BK', 'BOOKED', 'BKD')
      THEN COALESCE(r.guest_count, 0)
    ELSE 0
  END), 0)::numeric AS booked_guests,
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc'
      THEN COALESCE(r.guest_count, 0)
    ELSE 0
  END), 0)::numeric AS contracted_guests,
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') <> 'fact_group_alloc' THEN 0
    ELSE COALESCE(r.guest_count, 0) * (
      CASE
        WHEN r.group_probability IS NOT NULL AND r.group_probability > 1
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.group_probability / 100.0))
        WHEN r.group_probability IS NOT NULL
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.group_probability))
        WHEN r.res_probability IS NOT NULL AND r.res_probability > 1
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.res_probability / 100.0))
        WHEN r.res_probability IS NOT NULL
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.res_probability))
        ELSE 1::numeric
      END
    )
  END), 0)::numeric AS estimated_guests,
  -- Legacy Res C: estimated cabins ≈ estimated guests / 2
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') <> 'fact_group_alloc' THEN 0
    ELSE (COALESCE(r.guest_count, 0) / 2.0) * (
      CASE
        WHEN r.group_probability IS NOT NULL AND r.group_probability > 1
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.group_probability / 100.0))
        WHEN r.group_probability IS NOT NULL
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.group_probability))
        WHEN r.res_probability IS NOT NULL AND r.res_probability > 1
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.res_probability / 100.0))
        WHEN r.res_probability IS NOT NULL
          THEN LEAST(1::numeric, GREATEST(0::numeric, r.res_probability))
        ELSE 1::numeric
      END
    )
  END), 0)::numeric AS guaranteed_cabins
FROM public.reservation r
WHERE r.sail_code IS NOT NULL
  AND BTRIM(r.sail_code) <> ''
  AND UPPER(BTRIM(COALESCE(r.res_status, ''))) NOT IN ('CX', 'CANCELLED', 'CANCELED', 'X')
GROUP BY r.sail_code;

COMMENT ON VIEW public.sail_booking_summary IS
  'Sail-level Booked/Contracted/Estimated from reservation (RES_HEADER + Fact group-OF). guest_count = booked.';
