-- Fact group-OF explode lineage + origin on reservation.
ALTER TABLE reservation ADD COLUMN IF NOT EXISTS group_id BIGINT;
ALTER TABLE reservation ADD COLUMN IF NOT EXISTS source_origin TEXT;
ALTER TABLE reservation ADD COLUMN IF NOT EXISTS allocation_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_reservation_source_origin ON reservation(source_origin);
CREATE INDEX IF NOT EXISTS idx_reservation_group_id ON reservation(group_id);
CREATE INDEX IF NOT EXISTS idx_reservation_status_origin ON reservation(res_status, source_origin);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservation_res_id ON reservation(res_id);

COMMENT ON COLUMN reservation.source_origin IS
  'res_header | fact_group_alloc (Fact group-OF cabin explode)';
COMMENT ON COLUMN reservation.group_id IS
  'Group id; set on Fact group-OF explode and group bookings when available';
COMMENT ON COLUMN reservation.allocation_id IS
  'Allocation lineage for fact_group_alloc rows when known';

UPDATE reservation SET source_origin = 'res_header' WHERE source_origin IS NULL;
