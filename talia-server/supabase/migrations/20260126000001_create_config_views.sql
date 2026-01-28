-- ============================================================================
-- Create Views for talia_config Schema Access
-- 
-- Supabase PostgREST doesn't support schema-qualified table names directly.
-- These views in the public schema expose talia_config tables for client access.
-- ============================================================================

-- Integration Date Range View
CREATE OR REPLACE VIEW public.integration_date_range AS
SELECT * FROM talia_config.integration_date_range;

-- Data Source View  
CREATE OR REPLACE VIEW public.data_source AS
SELECT * FROM talia_config.data_source;

-- Environment View
CREATE OR REPLACE VIEW public.config_environment AS
SELECT * FROM talia_config.environment;

-- Settings View
CREATE OR REPLACE VIEW public.config_setting AS
SELECT * FROM talia_config.setting;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_date_range TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_date_range TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_source TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_source TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_environment TO authenticated;
GRANT SELECT ON public.config_environment TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_setting TO authenticated;
GRANT SELECT ON public.config_setting TO anon;

-- Create trigger functions for updatable views
CREATE OR REPLACE FUNCTION public.integration_date_range_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO talia_config.integration_date_range 
    (integration_name, display_name, description, date_from, date_to, date_column, is_active, is_default, created_by, updated_by)
    VALUES 
    (NEW.integration_name, NEW.display_name, NEW.description, NEW.date_from, NEW.date_to, NEW.date_column, NEW.is_active, NEW.is_default, NEW.created_by, NEW.updated_by)
    RETURNING * INTO NEW;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE talia_config.integration_date_range 
    SET integration_name = NEW.integration_name,
        display_name = NEW.display_name,
        description = NEW.description,
        date_from = NEW.date_from,
        date_to = NEW.date_to,
        date_column = NEW.date_column,
        is_active = NEW.is_active,
        is_default = NEW.is_default,
        updated_by = NEW.updated_by,
        updated_at = NOW()
    WHERE id = OLD.id
    RETURNING * INTO NEW;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM talia_config.integration_date_range WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.data_source_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO talia_config.data_source 
    (source_name, display_name, source_type, connection_config, is_active, is_available, health_status, description)
    VALUES 
    (NEW.source_name, NEW.display_name, NEW.source_type, NEW.connection_config, NEW.is_active, NEW.is_available, NEW.health_status, NEW.description)
    RETURNING * INTO NEW;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE talia_config.data_source 
    SET source_name = NEW.source_name,
        display_name = NEW.display_name,
        source_type = NEW.source_type,
        connection_config = NEW.connection_config,
        is_active = NEW.is_active,
        is_available = NEW.is_available,
        health_status = NEW.health_status,
        last_health_check = NEW.last_health_check,
        description = NEW.description,
        updated_at = NOW()
    WHERE id = OLD.id
    RETURNING * INTO NEW;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM talia_config.data_source WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on the views
DROP TRIGGER IF EXISTS integration_date_range_trigger ON public.integration_date_range;
CREATE TRIGGER integration_date_range_trigger
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.integration_date_range
  FOR EACH ROW EXECUTE FUNCTION public.integration_date_range_update();

DROP TRIGGER IF EXISTS data_source_trigger ON public.data_source;  
CREATE TRIGGER data_source_trigger
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.data_source
  FOR EACH ROW EXECUTE FUNCTION public.data_source_update();

-- Comments
COMMENT ON VIEW public.integration_date_range IS 'View into talia_config.integration_date_range for Supabase client access';
COMMENT ON VIEW public.data_source IS 'View into talia_config.data_source for Supabase client access';
COMMENT ON VIEW public.config_environment IS 'View into talia_config.environment for Supabase client access';
COMMENT ON VIEW public.config_setting IS 'View into talia_config.setting for Supabase client access';
