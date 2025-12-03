-- Populate Demand Heatmap from Real Data
-- This script aggregates data from master_sail and reservation tables
-- and populates the demand_heatmap_data table with real production data

-- Clear existing real data (optional - comment out if you want to keep existing data)
-- DELETE FROM demand_heatmap_data WHERE is_mock_data = false;

-- Function to map geog_area_code to region
CREATE OR REPLACE FUNCTION map_to_region(geog_area TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE
    WHEN geog_area IN ('AEGEAN', 'ADRIATIC', 'MEDITERRANEAN') THEN RETURN 'Mediterranean';
    WHEN geog_area IN ('GULF', 'GULF_ARABIA', 'ARABIA', 'RED_SEA') THEN RETURN 'Gulf';
    ELSE RETURN 'Unknown';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Insert aggregated real data from master_sail and reservation tables
INSERT INTO demand_heatmap_data (
  sail_code, region, itinerary, departure_month, departure_date,
  guest_count, reservation_count, geog_area_code, ship_code, ship_name,
  is_mock_data, data_source
)
SELECT 
  ms.sail_code,
  map_to_region(ms.geog_area_code) as region,
  ms.package_name as itinerary,
  TO_CHAR(COALESCE(r.sail_from_date, ms.sail_date_from), 'YYYY-MM') as departure_month,
  COALESCE(r.sail_from_date, ms.sail_date_from) as departure_date,
  COALESCE(SUM(r.guest_count), 0) as guest_count,
  COUNT(r.id) as reservation_count,
  ms.geog_area_code,
  ms.ship_code,
  ms.ship_name,
  false as is_mock_data,
  'synapse' as data_source
FROM master_sail ms
LEFT JOIN reservation r ON ms.sail_code = r.sail_code
WHERE 
  ms.package_name IS NOT NULL 
  AND ms.sail_date_from IS NOT NULL
  AND ms.sail_code IS NOT NULL
GROUP BY 
  ms.sail_code,
  ms.package_name,
  ms.geog_area_code,
  ms.ship_code,
  ms.ship_name,
  COALESCE(r.sail_from_date, ms.sail_date_from),
  TO_CHAR(COALESCE(r.sail_from_date, ms.sail_date_from), 'YYYY-MM')
ON CONFLICT DO NOTHING; -- Skip duplicates

-- Alternative: Insert just from master_sail (even without reservations)
-- This ensures all sailings appear in the heatmap
INSERT INTO demand_heatmap_data (
  sail_code, region, itinerary, departure_month, departure_date,
  guest_count, reservation_count, geog_area_code, ship_code, ship_name,
  is_mock_data, data_source
)
SELECT DISTINCT
  ms.sail_code,
  map_to_region(ms.geog_area_code) as region,
  ms.package_name as itinerary,
  TO_CHAR(ms.sail_date_from, 'YYYY-MM') as departure_month,
  ms.sail_date_from as departure_date,
  0 as guest_count,
  0 as reservation_count,
  ms.geog_area_code,
  ms.ship_code,
  ms.ship_name,
  false as is_mock_data,
  'synapse' as data_source
FROM master_sail ms
WHERE 
  ms.package_name IS NOT NULL 
  AND ms.sail_date_from IS NOT NULL
  AND ms.sail_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM demand_heatmap_data dhd
    WHERE dhd.sail_code = ms.sail_code
    AND dhd.departure_month = TO_CHAR(ms.sail_date_from, 'YYYY-MM')
  );

-- Display summary of real data
SELECT 
  region,
  itinerary,
  COUNT(DISTINCT departure_month) as months_count,
  SUM(guest_count) as total_guests,
  SUM(reservation_count) as total_reservations,
  MIN(departure_month) as earliest_month,
  MAX(departure_month) as latest_month
FROM demand_heatmap_data
WHERE is_mock_data = false
GROUP BY region, itinerary
ORDER BY region, itinerary;

