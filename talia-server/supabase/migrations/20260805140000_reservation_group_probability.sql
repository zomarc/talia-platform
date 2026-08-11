-- Prefer Fact_Reservation probabilities over RES_HEADER (PROBABILITY often stuck at 100).
ALTER TABLE reservation ADD COLUMN IF NOT EXISTS group_probability NUMERIC;

COMMENT ON COLUMN reservation.group_probability IS
  'From dwh.Fact_Reservation.Group_Probability; used for Group expected value.';
COMMENT ON COLUMN reservation.res_probability IS
  'Prefer Fact_Reservation.Res_Probability over RES_HEADER PROBABILITY (often stuck at 100).';
