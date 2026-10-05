-- Aggregated grains for commercial book targets.
-- The base table is weekly pace (~1.1M rows). Panels read these views, scoped
-- by voyage, and only when the header commercial-targets switch is on.

CREATE OR REPLACE VIEW public.commercial_book_target_sail AS
SELECT
  master_voyage,
  pax_type,
  MAX(master_voyage_length) AS master_voyage_length,
  SUM(guest_count)::float8 AS guest_count,
  SUM(gross_ticket_revenue_eur)::float8 AS gross_ticket_revenue_eur,
  SUM(pax_nights)::float8 AS pax_nights
FROM public.commercial_book_targets
GROUP BY master_voyage, pax_type;

COMMENT ON VIEW public.commercial_book_target_sail IS
  'Voyage totals of weekly commercial pace, split by pax type (F/G/A). Sum of weeks, not the latest week.';

CREATE OR REPLACE VIEW public.commercial_book_target_voyage AS
SELECT
  master_voyage,
  pax_type,
  market_grouping,
  agency_market,
  agency_channel,
  MAX(master_voyage_length) AS master_voyage_length,
  SUM(guest_count)::float8 AS guest_count,
  SUM(gross_ticket_revenue_eur)::float8 AS gross_ticket_revenue_eur,
  SUM(pax_nights)::float8 AS pax_nights
FROM public.commercial_book_targets
GROUP BY master_voyage, pax_type, market_grouping, agency_market, agency_channel;

COMMENT ON VIEW public.commercial_book_target_voyage IS
  'Voyage commercial pace rolled by market group, market, channel, and pax type.';

CREATE OR REPLACE VIEW public.commercial_book_target_week AS
SELECT
  master_voyage,
  wc_snapshot_date,
  pax_type,
  market_grouping,
  agency_market,
  agency_channel,
  MAX(master_voyage_length) AS master_voyage_length,
  SUM(guest_count)::float8 AS guest_count,
  SUM(gross_ticket_revenue_eur)::float8 AS gross_ticket_revenue_eur,
  SUM(pax_nights)::float8 AS pax_nights
FROM public.commercial_book_targets
GROUP BY master_voyage, wc_snapshot_date, pax_type, market_grouping, agency_market, agency_channel;

COMMENT ON VIEW public.commercial_book_target_week IS
  'Weekly commercial pace for one voyage. Cumulative curves are built in the client from this grain.';

GRANT SELECT ON public.commercial_book_target_sail TO anon, authenticated, service_role;
GRANT SELECT ON public.commercial_book_target_voyage TO anon, authenticated, service_role;
GRANT SELECT ON public.commercial_book_target_week TO anon, authenticated, service_role;
