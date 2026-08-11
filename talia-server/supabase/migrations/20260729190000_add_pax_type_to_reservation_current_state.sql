-- Carry Fact_Reservation pax_type (F/G) onto reservation_current_state so
-- Group/FIT reporting does not depend on sparse group_id.

ALTER TABLE reservation_current_state
  ADD COLUMN IF NOT EXISTS pax_type TEXT;

COMMENT ON COLUMN reservation_current_state.pax_type IS
  'Passenger type from reservation / Fact_Reservation (F=FIT, G=Group). Canonical Group/FIT signal.';

CREATE INDEX IF NOT EXISTS idx_reservation_current_state_pax_type
  ON reservation_current_state (pax_type);

-- One-shot backfill from reservation facts
UPDATE reservation_current_state AS rcs
SET pax_type = r.pax_type
FROM reservation AS r
WHERE r.res_id = rcs.res_id
  AND r.pax_type IS NOT NULL
  AND btrim(r.pax_type) <> ''
  AND (rcs.pax_type IS NULL OR rcs.pax_type IS DISTINCT FROM r.pax_type);
