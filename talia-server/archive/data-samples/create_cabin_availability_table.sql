-- Create cabin_availability table
CREATE TABLE IF NOT EXISTS cabin_availability (
  id SERIAL PRIMARY KEY,
  Snapshot_Date DATE,
  Sail_Code TEXT,
  Package_Name TEXT,
  Sail_Days INTEGER,
  Cabin_Category TEXT,
  Available_Cabins INTEGER,
  Total_Cabins INTEGER,
  Available_Absolute INTEGER,
  Available_Weighted DECIMAL(10,2),
  Availability_Result TEXT,
  Nested_Cabins INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_cabin_availability_snapshot_date ON cabin_availability(Snapshot_Date);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_sail_code ON cabin_availability(Sail_Code);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_cabin_category ON cabin_availability(Cabin_Category);
