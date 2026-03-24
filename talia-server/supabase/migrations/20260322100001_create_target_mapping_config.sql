-- Target mapping configuration - visual, editable mappings for CSV columns
-- Stored in central data store for reuse across imports

CREATE TABLE IF NOT EXISTS target_mapping_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Config shape: { sailCodeColumn, weekLabelColumn, weeksUntilColumn, targetBookingsColumn, targetGuestsColumn }
-- Example: { "sailCodeColumn": "sail_code", "targetBookingsColumn": "target_bookings", ... }

CREATE INDEX IF NOT EXISTS idx_target_mapping_config_active ON target_mapping_config(is_active) WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION update_target_mapping_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_target_mapping_config_updated_at
  BEFORE UPDATE ON target_mapping_config
  FOR EACH ROW
  EXECUTE FUNCTION update_target_mapping_config_updated_at();

COMMENT ON TABLE target_mapping_config IS 'Column mapping config for CSV target import - editable visually, stored centrally';
