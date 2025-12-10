-- Populate sail_code in reservation table by joining with master_sail
-- This migration updates existing reservation records with sail_code from master_sail
-- based on matching sail_from_date and ship_code

-- Update reservation.sail_code by joining with master_sail
UPDATE reservation r
SET sail_code = ms.sail_code
FROM master_sail ms
WHERE r.sail_code IS NULL
  AND r.sail_from_date IS NOT NULL
  AND r.ship IS NOT NULL
  AND r.sail_from_date = ms.sail_date_from
  AND r.ship = ms.ship_code;

-- Log statistics
DO $$
DECLARE
  updated_count INTEGER;
  total_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM reservation;
  SELECT COUNT(*) INTO null_count FROM reservation WHERE sail_code IS NULL;
  SELECT COUNT(*) INTO updated_count FROM reservation WHERE sail_code IS NOT NULL;
  
  RAISE NOTICE 'Reservation sail_code update complete:';
  RAISE NOTICE '  Total reservations: %', total_count;
  RAISE NOTICE '  With sail_code: %', updated_count;
  RAISE NOTICE '  Without sail_code: %', null_count;
END $$;

