-- Create reservation_changes table
-- This table tracks only changes (deltas) in reservation data from Fact_Reservation_daily
-- Used for building selling profiles

CREATE TABLE IF NOT EXISTS reservation_changes (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  res_id BIGINT NOT NULL,
  sail_code TEXT,
  agency_id DECIMAL(9,0),
  group_id DECIMAL(18,0),
  guest_count DECIMAL(5,0),
  guest_count_delta DECIMAL(5,0) NOT NULL,
  sail_code_changed BOOLEAN DEFAULT FALSE,
  agency_id_changed BOOLEAN DEFAULT FALSE,
  group_id_changed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservation_changes_res_id ON reservation_changes(res_id);
CREATE INDEX IF NOT EXISTS idx_reservation_changes_snapshot_date ON reservation_changes(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reservation_changes_sail_code ON reservation_changes(sail_code);
CREATE INDEX IF NOT EXISTS idx_reservation_changes_agency_id ON reservation_changes(agency_id);
CREATE INDEX IF NOT EXISTS idx_reservation_changes_group_id ON reservation_changes(group_id);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_reservation_changes_res_date ON reservation_changes(res_id, snapshot_date);
