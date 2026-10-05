-- Cruise, Celestyal, airport, and region flags on the port catalog.
-- This table is the working source for port identity. CSV export is the
-- path back into the warehouse until the warehouse load is built.

ALTER TABLE public.port_city
  ADD COLUMN IF NOT EXISTS wpi TEXT,
  ADD COLUMN IF NOT EXISTS is_cruise BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_airport BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_celestyal BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS port_address TEXT,
  ADD COLUMN IF NOT EXISTS address_label TEXT;

CREATE INDEX IF NOT EXISTS idx_port_city_is_cruise ON public.port_city (is_cruise);
CREATE INDEX IF NOT EXISTS idx_port_city_is_celestyal ON public.port_city (is_celestyal);
CREATE INDEX IF NOT EXISTS idx_port_city_is_airport ON public.port_city (is_airport);
CREATE INDEX IF NOT EXISTS idx_port_city_region ON public.port_city (region);
CREATE INDEX IF NOT EXISTS idx_port_city_wpi ON public.port_city (wpi);

COMMENT ON COLUMN public.port_city.wpi IS 'NGA World Port Index number when this UN/LOCODE is in Pub 150. Comparison key.';
COMMENT ON COLUMN public.port_city.is_cruise IS 'Port appears on a cruise itinerary in the competitor set, or is a Celestyal port.';
COMMENT ON COLUMN public.port_city.is_celestyal IS 'Embark or regular call port used by Celestyal.';
COMMENT ON COLUMN public.port_city.port_address IS 'Street or terminal address for a primary Celestyal port.';
