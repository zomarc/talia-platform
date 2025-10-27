#!/usr/bin/env node

/**
 * Supabase Setup Script for Talia Platform
 * 
 * This script helps you set up your local Supabase instance with sample data
 * and configure the connection to your Azure Synapse data warehouse.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54323';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Sample data for local development
const sampleData = {
  ships: [
    {
      Ship_Id: 1,
      Ship_Code: 'DIS',
      Ship_Name: 'Celestyal Discovery',
      Ship_Pax_Capacity: 950,
      Ship_Length: '180m',
      Ship_Tonnage: 45000
    },
    {
      Ship_Id: 2,
      Ship_Code: 'JRN',
      Ship_Name: 'Celestyal Journey',
      Ship_Pax_Capacity: 980,
      Ship_Length: '185m',
      Ship_Tonnage: 47000
    }
  ],
  
  sailings: [
    {
      Sailing_Id: 1,
      Ship_Id: 1,
      Sailing_Code: 'DIS-2025-001',
      Depart_Date: '2025-03-15',
      Return_Date: '2025-03-22',
      Status: 'Active',
      Booked_Cabins: 450,
      Available_Cabins: 500,
      Projected_Cabins: 475
    },
    {
      Sailing_Id: 2,
      Ship_Id: 2,
      Sailing_Code: 'JRN-2025-001',
      Depart_Date: '2025-03-20',
      Return_Date: '2025-03-27',
      Status: 'Active',
      Booked_Cabins: 520,
      Available_Cabins: 460,
      Projected_Cabins: 490
    }
  ],
  
  cabin_availability: [
    {
      Snapshot_Date: '2025-01-15',
      Sailing_Id: 1,
      Package_Name: '7N Islands',
      Sail_Days: 7,
      Cabin_Category: 'Interior',
      Available_Cabins: 120,
      Total_Cabins: 150,
      Available_Absolute: 120,
      Available_Weighted: 115.5,
      Availability_Result: 'Good',
      Nested_Cabins: 0
    },
    {
      Snapshot_Date: '2025-01-15',
      Sailing_Id: 1,
      Package_Name: '7N Islands',
      Sail_Days: 7,
      Cabin_Category: 'Ocean View',
      Available_Cabins: 80,
      Total_Cabins: 100,
      Available_Absolute: 80,
      Available_Weighted: 78.5,
      Availability_Result: 'Good',
      Nested_Cabins: 0
    }
  ],
  
  kpis: [
    {
      KPI_Id: 1,
      KPI_Name: 'Total Revenue',
      KPI_Value: 2500000,
      KPI_Target: 3000000,
      KPI_Unit: 'EUR',
      Trend: 'up',
      Change_Percentage: 15.5,
      Period: 'Q1 2025',
      User_Role: 'ADMIN'
    },
    {
      KPI_Id: 2,
      KPI_Name: 'Occupancy Rate',
      KPI_Value: 85.5,
      KPI_Target: 90.0,
      KPI_Unit: '%',
      Trend: 'up',
      Change_Percentage: 5.2,
      Period: 'Q1 2025',
      User_Role: 'MANAGER'
    }
  ],
  
  exceptions: [
    {
      Exception_Id: 1,
      Exception_Type: 'Low Availability',
      Severity: 'Medium',
      Message: 'Cabin availability below 20% for sailing DIS-2025-001',
      Sailing_Id: 1,
      Ship_Id: 1,
      Created_Date: '2025-01-15',
      Resolved: false,
      User_Role: 'MANAGER'
    }
  ]
};

// SQL schema for creating tables
const createTablesSQL = `
-- Ships table
CREATE TABLE IF NOT EXISTS ships (
  Ship_Id INTEGER PRIMARY KEY,
  Ship_Code VARCHAR(10) NOT NULL,
  Ship_Name VARCHAR(100) NOT NULL,
  Ship_Pax_Capacity INTEGER,
  Ship_Length VARCHAR(20),
  Ship_Tonnage INTEGER
);

-- Sailings table
CREATE TABLE IF NOT EXISTS sailings (
  Sailing_Id INTEGER PRIMARY KEY,
  Ship_Id INTEGER REFERENCES ships(Ship_Id),
  Sailing_Code VARCHAR(50) NOT NULL,
  Depart_Date DATE,
  Return_Date DATE,
  Status VARCHAR(20),
  Booked_Cabins INTEGER,
  Available_Cabins INTEGER,
  Projected_Cabins INTEGER
);

-- Cabin Availability table
CREATE TABLE IF NOT EXISTS cabin_availability (
  id SERIAL PRIMARY KEY,
  Snapshot_Date DATE,
  Sailing_Id INTEGER REFERENCES sailings(Sailing_Id),
  Package_Name VARCHAR(100),
  Sail_Days INTEGER,
  Cabin_Category VARCHAR(50),
  Available_Cabins INTEGER,
  Total_Cabins INTEGER,
  Available_Absolute INTEGER,
  Available_Weighted DECIMAL(10,2),
  Availability_Result VARCHAR(20),
  Nested_Cabins INTEGER
);

-- KPIs table
CREATE TABLE IF NOT EXISTS kpis (
  KPI_Id INTEGER PRIMARY KEY,
  KPI_Name VARCHAR(100) NOT NULL,
  KPI_Value DECIMAL(15,2),
  KPI_Target DECIMAL(15,2),
  KPI_Unit VARCHAR(20),
  Trend VARCHAR(10),
  Change_Percentage DECIMAL(5,2),
  Period VARCHAR(50),
  User_Role VARCHAR(20),
  Created_Date TIMESTAMP DEFAULT NOW()
);

-- Exceptions table
CREATE TABLE IF NOT EXISTS exceptions (
  Exception_Id INTEGER PRIMARY KEY,
  Exception_Type VARCHAR(50),
  Severity VARCHAR(20),
  Message TEXT,
  Sailing_Id INTEGER REFERENCES sailings(Sailing_Id),
  Ship_Id INTEGER REFERENCES ships(Ship_Id),
  Created_Date TIMESTAMP,
  Resolved BOOLEAN DEFAULT FALSE,
  User_Role VARCHAR(20)
);
`;

async function setupSupabase() {
  console.log('🚀 Setting up Supabase for Talia Platform...');
  
  try {
    // Test connection
    console.log('📡 Testing Supabase connection...');
    const { data, error } = await supabase.from('ships').select('count');
    
    if (error && error.code === 'PGRST116') {
      console.log('⚠️  Tables not found. You need to create them in your Supabase dashboard.');
      console.log('📋 Run this SQL in your Supabase SQL editor:');
      console.log(createTablesSQL);
      console.log('\n🔗 Supabase Dashboard: http://127.0.0.1:54323');
      return;
    }
    
    if (error) {
      console.error('❌ Connection error:', error);
      return;
    }
    
    console.log('✅ Connected to Supabase successfully!');
    
    // Insert sample data
    console.log('📊 Inserting sample data...');
    
    // Insert ships
    const { error: shipsError } = await supabase
      .from('ships')
      .upsert(sampleData.ships, { onConflict: 'Ship_Id' });
    
    if (shipsError) {
      console.error('❌ Error inserting ships:', shipsError);
    } else {
      console.log('✅ Ships data inserted');
    }
    
    // Insert sailings
    const { error: sailingsError } = await supabase
      .from('sailings')
      .upsert(sampleData.sailings, { onConflict: 'Sailing_Id' });
    
    if (sailingsError) {
      console.error('❌ Error inserting sailings:', sailingsError);
    } else {
      console.log('✅ Sailings data inserted');
    }
    
    // Insert cabin availability
    const { error: cabinError } = await supabase
      .from('cabin_availability')
      .upsert(sampleData.cabin_availability);
    
    if (cabinError) {
      console.error('❌ Error inserting cabin availability:', cabinError);
    } else {
      console.log('✅ Cabin availability data inserted');
    }
    
    // Insert KPIs
    const { error: kpisError } = await supabase
      .from('kpis')
      .upsert(sampleData.kpis, { onConflict: 'KPI_Id' });
    
    if (kpisError) {
      console.error('❌ Error inserting KPIs:', kpisError);
    } else {
      console.log('✅ KPIs data inserted');
    }
    
    // Insert exceptions
    const { error: exceptionsError } = await supabase
      .from('exceptions')
      .upsert(sampleData.exceptions, { onConflict: 'Exception_Id' });
    
    if (exceptionsError) {
      console.error('❌ Error inserting exceptions:', exceptionsError);
    } else {
      console.log('✅ Exceptions data inserted');
    }
    
    console.log('\n🎉 Supabase setup completed successfully!');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323');
    console.log('📊 You can now query your data through the GraphQL API');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSupabase();
}

export { setupSupabase, sampleData, createTablesSQL };

