-- ============================================================================
-- Talia Configuration Schema
-- 
-- A dedicated schema for application configuration that is:
-- - Separate from business data for easy migration
-- - Environment-aware (local/staging/production can have different configs)
-- - Editable from UI without server restart
-- ============================================================================

-- Create the dedicated configuration schema
CREATE SCHEMA IF NOT EXISTS talia_config;

-- ============================================================================
-- 1. ENVIRONMENT CONFIGURATION
-- Stores the active environment and global settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS talia_config.environment (
  id SERIAL PRIMARY KEY,
  environment_name TEXT NOT NULL DEFAULT 'local',  -- local, staging, production
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one active environment
CREATE UNIQUE INDEX IF NOT EXISTS idx_environment_active 
  ON talia_config.environment(is_active) WHERE is_active = true;

-- Insert default environment
INSERT INTO talia_config.environment (environment_name, description, is_active)
VALUES ('local', 'Local development environment', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. INTEGRATION DATE RANGES
-- Configurable date ranges for data integrations - editable from UI
-- ============================================================================
CREATE TABLE IF NOT EXISTS talia_config.integration_date_range (
  id SERIAL PRIMARY KEY,
  
  -- Integration identification
  integration_name TEXT NOT NULL UNIQUE,  -- 'synapse', 'google_trends', 'inventory_status'
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Date range configuration
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  
  -- Optional: specific date column this range applies to
  date_column TEXT,  -- e.g., 'sail_date_from', 'snapshot_date'
  
  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,  -- Can be marked as the default range
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  
  -- Validation
  CONSTRAINT valid_date_range CHECK (date_from <= date_to)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_integration_date_range_name 
  ON talia_config.integration_date_range(integration_name);
CREATE INDEX IF NOT EXISTS idx_integration_date_range_active 
  ON talia_config.integration_date_range(is_active);

-- ============================================================================
-- 3. DATA SOURCES
-- Registry of all data sources and their connection details
-- ============================================================================
CREATE TABLE IF NOT EXISTS talia_config.data_source (
  id SERIAL PRIMARY KEY,
  
  -- Source identification
  source_name TEXT NOT NULL UNIQUE,  -- 'azure_synapse', 'google_trends_api', 'celestyal_b2b_api'
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'database', 'api', 'file'
  
  -- Connection details (stored as JSONB for flexibility)
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN DEFAULT true,  -- Can be toggled when source is offline
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status TEXT DEFAULT 'unknown',  -- 'healthy', 'degraded', 'offline', 'unknown'
  
  -- Metadata
  description TEXT,
  documentation_url TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. SYNC TABLE CONFIGURATION  
-- Maps tables to their sources and sync settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS talia_config.sync_table (
  id SERIAL PRIMARY KEY,
  
  -- Table identification
  table_name TEXT NOT NULL UNIQUE,  -- Supabase target table name
  display_name TEXT NOT NULL,
  
  -- Source configuration
  source_id INTEGER REFERENCES talia_config.data_source(id),
  source_schema TEXT,  -- 'dwh', 'stg', 'fou'
  source_table TEXT,   -- Source table/view name
  
  -- Sync settings
  sync_type TEXT NOT NULL DEFAULT 'direct',  -- 'direct', 'derived', 'aggregated'
  is_large_dataset BOOLEAN DEFAULT false,
  batch_size INTEGER DEFAULT 1000,
  
  -- Date range (references integration_date_range or uses custom)
  date_range_id INTEGER REFERENCES talia_config.integration_date_range(id),
  date_column TEXT,  -- Column used for date filtering
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  sync_order INTEGER DEFAULT 100,  -- For controlling sync sequence
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for sync order
CREATE INDEX IF NOT EXISTS idx_sync_table_order 
  ON talia_config.sync_table(sync_order, is_active);

-- ============================================================================
-- 5. APPLICATION SETTINGS
-- Key-value store for miscellaneous settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS talia_config.setting (
  id SERIAL PRIMARY KEY,
  
  -- Setting identification
  category TEXT NOT NULL,  -- 'ui', 'sync', 'api', 'general'
  setting_key TEXT NOT NULL,
  
  -- Value (stored as JSONB for flexibility)
  setting_value JSONB NOT NULL,
  
  -- Metadata
  display_name TEXT,
  description TEXT,
  is_editable BOOLEAN DEFAULT true,  -- Can this be edited from UI?
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(category, setting_key)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_setting_category_key 
  ON talia_config.setting(category, setting_key);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION talia_config.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_environment_updated_at
  BEFORE UPDATE ON talia_config.environment
  FOR EACH ROW EXECUTE FUNCTION talia_config.update_updated_at();

CREATE TRIGGER trigger_integration_date_range_updated_at
  BEFORE UPDATE ON talia_config.integration_date_range
  FOR EACH ROW EXECUTE FUNCTION talia_config.update_updated_at();

CREATE TRIGGER trigger_data_source_updated_at
  BEFORE UPDATE ON talia_config.data_source
  FOR EACH ROW EXECUTE FUNCTION talia_config.update_updated_at();

CREATE TRIGGER trigger_sync_table_updated_at
  BEFORE UPDATE ON talia_config.sync_table
  FOR EACH ROW EXECUTE FUNCTION talia_config.update_updated_at();

CREATE TRIGGER trigger_setting_updated_at
  BEFORE UPDATE ON talia_config.setting
  FOR EACH ROW EXECUTE FUNCTION talia_config.update_updated_at();

-- ============================================================================
-- SEED DATA: Default integration date ranges
-- ============================================================================
INSERT INTO talia_config.integration_date_range 
  (integration_name, display_name, description, date_from, date_to, date_column, is_active, is_default)
VALUES 
  ('synapse_default', 'Azure Synapse (Default)', 
   'Default date range for Azure Synapse data integration', 
   '2025-09-01', '2025-12-31', 'sail_date_from', true, true),
  ('synapse_q4_2025', 'Q4 2025 Sailings', 
   'October through December 2025 sailings only',
   '2025-10-01', '2025-12-31', 'sail_date_from', true, false),
  ('synapse_recent', 'Recent 2 Months', 
   'Recent 2 months of data for fast local development',
   '2025-11-01', '2025-12-31', 'sail_date_from', true, false),
  ('google_trends', 'Google Trends', 
   'Date range for Google Trends data collection',
   '2024-01-01', '2025-12-31', 'date', true, false)
ON CONFLICT (integration_name) DO NOTHING;

-- ============================================================================
-- SEED DATA: Data sources
-- ============================================================================
INSERT INTO talia_config.data_source 
  (source_name, display_name, source_type, description, connection_config, is_active)
VALUES 
  ('azure_synapse', 'Azure Synapse Analytics', 'database',
   'Celestyal Data Platform - Production Data Warehouse',
   '{"server": "celestyaldataplatform-prd.sql.azuresynapse.net", "database": "CDP_Dedicated_SQL_DWH", "port": 1433}'::jsonb,
   true),
  ('google_trends_api', 'Google Trends API', 'api',
   'Google Trends data for search interest metrics',
   '{"base_url": "https://trends.google.com"}'::jsonb,
   true),
  ('celestyal_b2b_api', 'Celestyal B2B GraphQL', 'api',
   'Celestyal B2B API for real-time availability',
   '{"endpoint": "https://thaliatest.b2b.celestyal.com:3000/graphql"}'::jsonb,
   true),
  ('local_supabase', 'Local Supabase', 'database',
   'Local Supabase PostgreSQL database',
   '{"url": "http://127.0.0.1:54321"}'::jsonb,
   true)
ON CONFLICT (source_name) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default settings
-- ============================================================================
INSERT INTO talia_config.setting 
  (category, setting_key, setting_value, display_name, description, is_editable)
VALUES 
  ('sync', 'default_batch_size', '1000'::jsonb, 
   'Default Batch Size', 'Default number of records per batch during sync', true),
  ('sync', 'default_date_range_id', '1'::jsonb, 
   'Default Date Range', 'ID of the default integration date range', true),
  ('ui', 'logs_max_entries', '500'::jsonb, 
   'Max Log Entries', 'Maximum number of log entries to keep in UI', true),
  ('ui', 'auto_refresh_interval_ms', '30000'::jsonb, 
   'Auto Refresh Interval', 'Interval for auto-refreshing status in milliseconds', true)
ON CONFLICT (category, setting_key) DO NOTHING;

-- ============================================================================
-- VIEWS for easy access
-- ============================================================================
CREATE OR REPLACE VIEW talia_config.active_date_range AS
SELECT 
  idr.*,
  e.environment_name
FROM talia_config.integration_date_range idr
CROSS JOIN talia_config.environment e
WHERE idr.is_active = true 
  AND e.is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON SCHEMA talia_config IS 'Configuration schema for Talia application - separate from business data';
COMMENT ON TABLE talia_config.environment IS 'Active environment configuration';
COMMENT ON TABLE talia_config.integration_date_range IS 'Configurable date ranges for data integrations';
COMMENT ON TABLE talia_config.data_source IS 'Registry of all data sources';
COMMENT ON TABLE talia_config.sync_table IS 'Configuration for each synced table';
COMMENT ON TABLE talia_config.setting IS 'Key-value store for application settings';

-- ============================================================================
-- GRANT permissions to authenticated users
-- ============================================================================
GRANT USAGE ON SCHEMA talia_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA talia_config TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA talia_config TO authenticated;

-- Also grant to anon for public access (adjust based on security needs)
GRANT USAGE ON SCHEMA talia_config TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA talia_config TO anon;
