-- Populate Demand Heatmap with Mock Data for Testing
-- This script creates realistic mock data across multiple months and regions
-- Run this after creating the demand_heatmap_data table

-- Clear existing mock data (optional - comment out if you want to keep existing mock data)
DELETE FROM demand_heatmap_data WHERE is_mock_data = true;

-- Insert mock data for Mediterranean region
INSERT INTO demand_heatmap_data (
  sail_code, region, itinerary, departure_month, departure_date,
  guest_count, reservation_count, geog_area_code, ship_code, ship_name,
  is_mock_data, data_source
) VALUES
-- 2025 Q4 - Mediterranean
('MOCK-CJ-2025-10', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2025-10', '2025-10-15', 120.0, 60, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2025-11', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2025-11', '2025-11-12', 145.0, 72, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2025-12', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2025-12', '2025-12-10', 98.0, 49, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),

-- 2026 Q1 - Mediterranean
('MOCK-CJ-2026-01', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-01', '2026-01-14', 165.0, 82, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-02', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-02', '2026-02-11', 180.0, 90, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-03', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-03', '2026-03-18', 210.0, 105, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),

-- 2026 Q2 - Mediterranean
('MOCK-CJ-2026-04', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-04', '2026-04-15', 285.0, 142, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-05', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-05', '2026-05-13', 320.0, 160, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-06', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-06', '2026-06-10', 350.0, 175, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),

-- Mediterranean - Different Itineraries
('MOCK-CJ-2026-04-LA', 'Mediterranean', '5 Nights Legendary Aegean', '2026-04', '2026-04-22', 185.0, 92, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-05-LA', 'Mediterranean', '5 Nights Legendary Aegean', '2026-05', '2026-05-20', 220.0, 110, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-06-LA', 'Mediterranean', '5 Nights Legendary Aegean', '2026-06', '2026-06-17', 240.0, 120, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),

('MOCK-CJ-2026-04-14N', 'Mediterranean', '14 Nights Legendary Aegean & Ionian', '2026-04', '2026-04-08', 95.0, 47, 'ADRIATIC', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-05-14N', 'Mediterranean', '14 Nights Legendary Aegean & Ionian', '2026-05', '2026-05-06', 110.0, 55, 'ADRIATIC', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-06-14N', 'Mediterranean', '14 Nights Legendary Aegean & Ionian', '2026-06', '2026-06-03', 125.0, 62, 'ADRIATIC', 'CJ', 'Celestyal Journey', true, 'mock'),

-- Gulf Region
('MOCK-CJ-2025-10-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2025-10', '2025-10-18', 85.0, 42, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2025-11-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2025-11', '2025-11-15', 92.0, 46, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2025-12-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2025-12', '2025-12-13', 78.0, 39, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),

('MOCK-CJ-2026-01-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-01', '2026-01-17', 105.0, 52, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-02-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-02', '2026-02-14', 115.0, 57, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-03-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-03', '2026-03-21', 130.0, 65, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),

('MOCK-CJ-2026-04-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-04', '2026-04-18', 145.0, 72, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-05-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-05', '2026-05-16', 160.0, 80, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-06-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-06', '2026-06-13', 175.0, 87, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),

('MOCK-CJ-2026-04-AR-7N', 'Gulf', 'Iconic Arabia from Abu Dhabi - 7 Nights', '2026-04', '2026-04-25', 68.0, 34, 'GULF', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-05-AR-7N', 'Gulf', 'Iconic Arabia from Abu Dhabi - 7 Nights', '2026-05', '2026-05-23', 82.0, 41, 'GULF', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-06-AR-7N', 'Gulf', 'Iconic Arabia from Abu Dhabi - 7 Nights', '2026-06', '2026-06-20', 95.0, 47, 'GULF', 'CJ', 'Celestyal Journey', true, 'mock'),

-- Add more months to create a full heatmap view
('MOCK-CJ-2026-07-IGI', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-07', '2026-07-08', 380.0, 190, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-08-IGI', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-08', '2026-08-05', 395.0, 197, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-09-IGI', 'Mediterranean', 'Iconic Greek Islands 3 Nights', '2026-09', '2026-09-09', 340.0, 170, 'AEGEAN', 'CJ', 'Celestyal Journey', true, 'mock'),

('MOCK-CJ-2026-07-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-07', '2026-07-11', 185.0, 92, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-08-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-08', '2026-08-08', 195.0, 97, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock'),
('MOCK-CJ-2026-09-AR', 'Gulf', 'Iconic Arabia - 3Nights', '2026-09', '2026-09-12', 180.0, 90, 'ARABIA', 'CJ', 'Celestyal Journey', true, 'mock');

-- Display summary
SELECT 
  region,
  itinerary,
  COUNT(DISTINCT departure_month) as months_count,
  SUM(guest_count) as total_guests,
  SUM(reservation_count) as total_reservations
FROM demand_heatmap_data
WHERE is_mock_data = true
GROUP BY region, itinerary
ORDER BY region, itinerary;

