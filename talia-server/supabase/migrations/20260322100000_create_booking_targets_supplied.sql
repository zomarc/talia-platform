-- Booking targets supplied (CSV import from Data Management)
-- Company target data imported from BOOKINGTARGET_*.csv files

CREATE TABLE IF NOT EXISTS booking_targets_supplied (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sail_code TEXT NOT NULL,
  ship_code TEXT,
  week_label TEXT NOT NULL,
  weeks_until_sailing INT,
  target_bookings INT NOT NULL DEFAULT 0,
  target_guests INT NOT NULL DEFAULT 0,
  import_batch_id UUID NOT NULL,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_targets_supplied_sail_code ON booking_targets_supplied(sail_code);
CREATE INDEX IF NOT EXISTS idx_booking_targets_supplied_import_batch ON booking_targets_supplied(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_booking_targets_supplied_imported_at ON booking_targets_supplied(imported_at DESC);

COMMENT ON TABLE booking_targets_supplied IS 'Company target data imported from CSV (BOOKINGTARGET_*.csv) via Data Management';
