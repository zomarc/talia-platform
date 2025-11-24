-- Add departure_port column to competitor_current_state table
ALTER TABLE competitor_current_state ADD COLUMN IF NOT EXISTS departure_port TEXT;

-- Add departure_port column to competitor table
ALTER TABLE competitor ADD COLUMN IF NOT EXISTS departure_port TEXT;

-- Create index for departure_port
CREATE INDEX IF NOT EXISTS idx_competitor_current_state_departure_port ON competitor_current_state(departure_port);
CREATE INDEX IF NOT EXISTS idx_competitor_departure_port ON competitor(departure_port);







