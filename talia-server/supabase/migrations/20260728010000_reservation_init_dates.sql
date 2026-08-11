-- Original booking dates from stg.RES_HEADER for reservation-based booking profiles.

ALTER TABLE reservation ADD COLUMN IF NOT EXISTS res_init_date DATE;
ALTER TABLE reservation ADD COLUMN IF NOT EXISTS original_init_date DATE;

CREATE INDEX IF NOT EXISTS idx_reservation_res_init_date ON reservation(res_init_date);
CREATE INDEX IF NOT EXISTS idx_reservation_original_init_date ON reservation(original_init_date);

COMMENT ON COLUMN reservation.res_init_date IS 'stg.RES_HEADER.RES_INIT_DATE — booking initiation';
COMMENT ON COLUMN reservation.original_init_date IS 'stg.RES_HEADER.ORIGINAL_INIT_DATE — original booked date for profile curves';
