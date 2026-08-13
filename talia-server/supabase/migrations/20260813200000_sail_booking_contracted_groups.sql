-- Update densify rules:
-- Booked = named BK (exclude fact_group_alloc)
-- Contracted = groups (pax_type G) + offers (OF/QT/WL) + fact_group_alloc
-- Estimated = contracted × probability

DROP VIEW IF EXISTS public.sail_booking_summary;

CREATE VIEW public.sail_booking_summary AS
SELECT
  r.sail_code,
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
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc' THEN COALESCE(r.guest_count, 0)
    WHEN UPPER(BTRIM(COALESCE(r.pax_type, ''))) LIKE 'G%' THEN COALESCE(r.guest_count, 0)
    WHEN UPPER(BTRIM(COALESCE(r.res_status, ''))) IN (
      'OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT'
    ) THEN COALESCE(r.guest_count, 0)
    ELSE 0
  END), 0)::numeric AS contracted_guests,
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc'
      OR UPPER(BTRIM(COALESCE(r.pax_type, ''))) LIKE 'G%'
      OR UPPER(BTRIM(COALESCE(r.res_status, ''))) IN (
        'OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT'
      )
    THEN COALESCE(r.guest_count, 0) * (
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
    ELSE 0
  END), 0)::numeric AS estimated_guests,
  COALESCE(SUM(CASE
    WHEN COALESCE(r.source_origin, '') = 'fact_group_alloc'
      OR UPPER(BTRIM(COALESCE(r.pax_type, ''))) LIKE 'G%'
      OR UPPER(BTRIM(COALESCE(r.res_status, ''))) IN (
        'OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT'
      )
    THEN (COALESCE(r.guest_count, 0) / 2.0) * (
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
    ELSE 0
  END), 0)::numeric AS guaranteed_cabins
FROM public.reservation r
WHERE r.sail_code IS NOT NULL
  AND BTRIM(r.sail_code) <> ''
  AND UPPER(BTRIM(COALESCE(r.res_status, ''))) NOT IN ('CX', 'CANCELLED', 'CANCELED', 'X')
GROUP BY r.sail_code;

COMMENT ON VIEW public.sail_booking_summary IS
  'Booked=named BK; Contracted=groups+offers+fact_group_alloc; Estimated=contracted×probability.';
