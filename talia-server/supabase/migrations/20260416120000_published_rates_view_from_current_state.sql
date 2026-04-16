-- Legacy `published_rates` table was not populated by the Synapse publishedRates sync
-- (that pipeline writes published_rates_current_state + published_rates_changes).
-- Expose the same rows under published_rates so catalog / tableData counts stay accurate.

DROP TABLE IF EXISTS public.published_rates CASCADE;

CREATE VIEW public.published_rates AS
SELECT
  (ROW_NUMBER() OVER (ORDER BY rate_key))::integer AS id,
  snapshot_date,
  sail_code,
  ship_code,
  package_name,
  region,
  rate_type,
  sail_days,
  departure_date,
  cabin_category,
  promo_name,
  promo_type,
  currency_code,
  fare_per_person,
  port_taxes_services,
  extra_adult,
  extra_child,
  discount,
  updated_at AS created_at
FROM public.published_rates_current_state;

GRANT SELECT ON public.published_rates TO anon, authenticated, service_role;
