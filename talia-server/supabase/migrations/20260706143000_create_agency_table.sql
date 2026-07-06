-- Agency dimension from dwh.Dim_Agency (data lake)

CREATE TABLE IF NOT EXISTS agency (
  id SERIAL PRIMARY KEY,
  parent_agency_id INTEGER,
  consortium_id INTEGER,
  agency_id INTEGER,
  agency_name TEXT,
  iata_number TEXT,
  clia_number TEXT,
  is_domestic TEXT,
  is_internal TEXT,
  is_gsa TEXT,
  consortium_type TEXT,
  is_consortium TEXT,
  agency_type TEXT,
  brand TEXT,
  default_currency TEXT,
  use_dflt_consortium TEXT,
  bc_type_id NUMERIC,
  taxpayer_type TEXT,
  taxpayer_number TEXT,
  contact_name TEXT,
  web_address TEXT,
  office_code TEXT,
  ag_entity_type TEXT,
  agency_code TEXT,
  fpr_at_gross TEXT,
  valid_currencies TEXT,
  market TEXT,
  address_line1 TEXT,
  address_city TEXT,
  state_code TEXT,
  zip TEXT,
  country_code TEXT,
  country TEXT,
  status TEXT,
  sfdc_id TEXT,
  sfdc_parent_id TEXT,
  sfdc_owner_id TEXT,
  sfdc_owner_name TEXT,
  sfdc_cm_name TEXT,
  sfdc_vp_name TEXT,
  sfdc_id_link TEXT,
  is_web INTEGER,
  commission NUMERIC,
  inherit_parent_commission INTEGER,
  is_market_standard INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_agency_id ON agency(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_market ON agency(market);
CREATE INDEX IF NOT EXISTS idx_agency_status ON agency(status);
CREATE INDEX IF NOT EXISTS idx_agency_agency_type ON agency(agency_type);
CREATE INDEX IF NOT EXISTS idx_agency_country_code ON agency(country_code);
CREATE INDEX IF NOT EXISTS idx_agency_parent_agency_id ON agency(parent_agency_id);
