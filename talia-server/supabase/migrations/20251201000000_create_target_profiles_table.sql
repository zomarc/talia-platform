-- Create target_profiles table for storing booking target curves
-- This table stores target booking profiles that can be used for comparison with actual bookings

CREATE TABLE IF NOT EXISTS target_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sail_code TEXT,
  ship_code TEXT,
  package_type TEXT,
  season_code TEXT,
  geog_area_code TEXT,
  
  -- Build curve data stored as JSONB for flexibility
  -- Structure: [{"weekLabel": "W-12", "weeksUntilSailing": 12, "targetBookings": 100, "targetGuests": 200}, ...]
  build_curves JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata about which historic sailings were used as baseline
  based_on_historic JSONB DEFAULT '[]'::jsonb, -- Array of sail codes used as baseline
  
  -- User who created this profile
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_target_profiles_sail_code ON target_profiles(sail_code);
CREATE INDEX IF NOT EXISTS idx_target_profiles_ship_code ON target_profiles(ship_code);
CREATE INDEX IF NOT EXISTS idx_target_profiles_package_type ON target_profiles(package_type);
CREATE INDEX IF NOT EXISTS idx_target_profiles_season_code ON target_profiles(season_code);
CREATE INDEX IF NOT EXISTS idx_target_profiles_created_by ON target_profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_target_profiles_is_active ON target_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_target_profiles_created_at ON target_profiles(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_target_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_target_profiles_updated_at
  BEFORE UPDATE ON target_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_target_profiles_updated_at();

-- Add comment to table
COMMENT ON TABLE target_profiles IS 'Stores target booking profiles with build curves for comparison with actual bookings';
COMMENT ON COLUMN target_profiles.build_curves IS 'JSONB array of build curve points: [{"weekLabel": "W-12", "weeksUntilSailing": 12, "targetBookings": 100, "targetGuests": 200}]';
COMMENT ON COLUMN target_profiles.based_on_historic IS 'JSONB array of sail codes used as baseline for generating this target profile';

