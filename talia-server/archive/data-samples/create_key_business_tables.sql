-- Create key business tables for 2025-2026 data migration

-- Cabin Availability Table
CREATE TABLE IF NOT EXISTS cabin_availability (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE,
  sail_code TEXT,
  package_name TEXT,
  sail_days INTEGER,
  cabin_category TEXT,
  available_cabins INTEGER,
  total_cabins INTEGER,
  available_absolute INTEGER,
  available_weighted DECIMAL(10,2),
  availability_result TEXT,
  nested_cabins INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cabin_availability_snapshot_date ON cabin_availability(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_sail_code ON cabin_availability(sail_code);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_cabin_category ON cabin_availability(cabin_category);

-- Cabin Allocation Table
CREATE TABLE IF NOT EXISTS cabin_allocation (
  id SERIAL PRIMARY KEY,
  allocation_date DATE,
  sail_code TEXT,
  cabin_category TEXT,
  allocated_cabins INTEGER,
  total_cabins INTEGER,
  allocation_percentage DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cabin_allocation_allocation_date ON cabin_allocation(allocation_date);
CREATE INDEX IF NOT EXISTS idx_cabin_allocation_sail_code ON cabin_allocation(sail_code);
CREATE INDEX IF NOT EXISTS idx_cabin_allocation_cabin_category ON cabin_allocation(cabin_category);

-- Master Sail Table
CREATE TABLE IF NOT EXISTS master_sail (
  id SERIAL PRIMARY KEY,
  sail_code TEXT,
  ship_code TEXT,
  departure_date DATE,
  arrival_date DATE,
  itinerary_code TEXT,
  package_name TEXT,
  sail_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_master_sail_sail_code ON master_sail(sail_code);
CREATE INDEX IF NOT EXISTS idx_master_sail_departure_date ON master_sail(departure_date);
CREATE INDEX IF NOT EXISTS idx_master_sail_ship_code ON master_sail(ship_code);

-- Ship Table
CREATE TABLE IF NOT EXISTS ship (
  id SERIAL PRIMARY KEY,
  ship_code TEXT,
  ship_name TEXT,
  capacity INTEGER,
  built_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ship_ship_code ON ship(ship_code);
CREATE INDEX IF NOT EXISTS idx_ship_ship_name ON ship(ship_name);

-- Itinerary Table
CREATE TABLE IF NOT EXISTS itinerary (
  id SERIAL PRIMARY KEY,
  itinerary_code TEXT,
  itinerary_name TEXT,
  region TEXT,
  duration_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_itinerary_itinerary_code ON itinerary(itinerary_code);
CREATE INDEX IF NOT EXISTS idx_itinerary_region ON itinerary(region);

-- Reservation Table
CREATE TABLE IF NOT EXISTS reservation (
  id SERIAL PRIMARY KEY,
  reservation_id TEXT,
  booking_date DATE,
  sail_code TEXT,
  cabin_category TEXT,
  passenger_count INTEGER,
  total_revenue DECIMAL(15,2),
  currency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservation_reservation_id ON reservation(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_booking_date ON reservation(booking_date);
CREATE INDEX IF NOT EXISTS idx_reservation_sail_code ON reservation(sail_code);

-- GQL Cabin Availability Table
CREATE TABLE IF NOT EXISTS gql_cabin_availability (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE,
  sail_code TEXT,
  cabin_category TEXT,
  available_cabins INTEGER,
  total_cabins INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gql_cabin_availability_snapshot_date ON gql_cabin_availability(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_gql_cabin_availability_sail_code ON gql_cabin_availability(sail_code);

-- Sail Header Table
CREATE TABLE IF NOT EXISTS sail_header (
  id SERIAL PRIMARY KEY,
  sail_code TEXT,
  ship_code TEXT,
  departure_date DATE,
  arrival_date DATE,
  itinerary_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sail_header_sail_code ON sail_header(sail_code);
CREATE INDEX IF NOT EXISTS idx_sail_header_departure_date ON sail_header(departure_date);
CREATE INDEX IF NOT EXISTS idx_sail_header_ship_code ON sail_header(ship_code);

-- Ship Cabin Table
CREATE TABLE IF NOT EXISTS ship_cabin (
  id SERIAL PRIMARY KEY,
  ship_code TEXT,
  cabin_category TEXT,
  cabin_name TEXT,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ship_cabin_ship_code ON ship_cabin(ship_code);
CREATE INDEX IF NOT EXISTS idx_ship_cabin_cabin_category ON ship_cabin(cabin_category);


