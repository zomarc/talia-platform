-- ============================================================================
-- Integration Data Ranges Compatibility View
--
-- Some services expect integration.data_ranges. Keep it in sync by exposing
-- talia_config.integration_date_range through a compatibility view.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS integration;

CREATE OR REPLACE VIEW integration.data_ranges AS
SELECT * FROM talia_config.integration_date_range;

CREATE OR REPLACE FUNCTION integration.data_ranges_update()
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

DROP TRIGGER IF EXISTS data_ranges_trigger ON integration.data_ranges;
CREATE TRIGGER data_ranges_trigger
  INSTEAD OF INSERT OR UPDATE OR DELETE ON integration.data_ranges
  FOR EACH ROW EXECUTE FUNCTION integration.data_ranges_update();

GRANT USAGE ON SCHEMA integration TO authenticated;
GRANT USAGE ON SCHEMA integration TO anon;
GRANT USAGE ON SCHEMA integration TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON integration.data_ranges TO authenticated;
GRANT SELECT ON integration.data_ranges TO anon;
GRANT ALL ON integration.data_ranges TO service_role;

COMMENT ON VIEW integration.data_ranges IS 'Compatibility view for talia_config.integration_date_range';
