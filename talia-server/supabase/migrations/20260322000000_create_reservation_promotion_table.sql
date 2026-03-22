-- Create reservation_promotion table used by reservationPromotion sync target.
-- This table is referenced by sync.config.json and synapse-sync transform logic.

CREATE TABLE IF NOT EXISTS reservation_promotion (
  id BIGSERIAL PRIMARY KEY,
  res_promo_id BIGINT,
  res_id BIGINT,
  guest_id BIGINT,
  promo_code TEXT,
  is_excluded TEXT,
  is_active TEXT,
  res_package_id BIGINT,
  is_manual TEXT,
  promo_value NUMERIC(15, 4),
  promo_value_type TEXT,
  is_static TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_promotion_res_id ON reservation_promotion(res_id);
CREATE INDEX IF NOT EXISTS idx_reservation_promotion_res_promo_id ON reservation_promotion(res_promo_id);
CREATE INDEX IF NOT EXISTS idx_reservation_promotion_guest_id ON reservation_promotion(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservation_promotion_is_active ON reservation_promotion(is_active);

