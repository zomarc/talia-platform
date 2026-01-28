-- ============================================================================
-- Fix Permissions for talia_config Schema
-- 
-- Grants necessary permissions on talia_config schema and tables to allow
-- the views and triggers to work properly with Supabase client.
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA talia_config TO anon;
GRANT USAGE ON SCHEMA talia_config TO authenticated;
GRANT USAGE ON SCHEMA talia_config TO service_role;

-- Grant full permissions on tables to service_role
GRANT ALL ON ALL TABLES IN SCHEMA talia_config TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA talia_config TO service_role;

-- Grant permissions on tables to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON talia_config.integration_date_range TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON talia_config.data_source TO authenticated;
GRANT SELECT, UPDATE ON talia_config.environment TO authenticated;
GRANT SELECT, UPDATE ON talia_config.setting TO authenticated;

-- Grant permissions on tables to anon (for development)
GRANT SELECT, INSERT, UPDATE, DELETE ON talia_config.integration_date_range TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON talia_config.data_source TO anon;
GRANT SELECT ON talia_config.environment TO anon;
GRANT SELECT ON talia_config.setting TO anon;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA talia_config TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA talia_config TO anon;

-- Re-grant on public views to ensure they work
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_date_range TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_date_range TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_source TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_source TO anon;
