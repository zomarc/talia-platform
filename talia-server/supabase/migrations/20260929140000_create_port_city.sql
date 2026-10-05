-- UN/LOCODE port/city dimension from dwh.Dim_Port_City.
-- latitude/longitude are parsed from Latitude_Longitude (DDMMH DDDMMH).
-- nearest_* is the closest row with Function_Name = Port.

CREATE TABLE IF NOT EXISTS public.port_city (
  id BIGSERIAL PRIMARY KEY,
  country_location TEXT NOT NULL,
  country_code TEXT,
  location_code TEXT,
  port_name TEXT,
  port_city TEXT,
  name_wo_diacritics TEXT,
  function_code TEXT,
  function_name TEXT,
  status_code TEXT,
  latitude_longitude TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_port BOOLEAN NOT NULL DEFAULT FALSE,
  nearest_port_code TEXT,
  nearest_port_name TEXT,
  nearest_distance_nm DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_port_city_country_location ON public.port_city (country_location);
CREATE INDEX IF NOT EXISTS idx_port_city_country_code ON public.port_city (country_code);
CREATE INDEX IF NOT EXISTS idx_port_city_function_name ON public.port_city (function_name);
CREATE INDEX IF NOT EXISTS idx_port_city_port_name ON public.port_city (port_name);
CREATE INDEX IF NOT EXISTS idx_port_city_nearest_port_code ON public.port_city (nearest_port_code);
CREATE INDEX IF NOT EXISTS idx_port_city_latitude_longitude ON public.port_city (latitude_longitude);

COMMENT ON TABLE public.port_city IS 'Local mirror of dwh.Dim_Port_City with parsed coordinates and nearest port label.';
