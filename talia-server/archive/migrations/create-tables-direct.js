#!/usr/bin/env node

/**
 * Create tables directly using Supabase client with raw SQL execution
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

async function createTablesDirect() {
  console.log('🏗️  Creating tables directly...\n');
  
  const tableDefinitions = [
    {
      name: 'cabin_allocation',
      sql: `
        CREATE TABLE IF NOT EXISTS cabin_allocation (
          id SERIAL PRIMARY KEY,
          res_id BIGINT,
          ship_code TEXT,
          cabin_category TEXT,
          cabin_number TEXT,
          occupancy INTEGER,
          price_category TEXT,
          cabin_seq_number INTEGER,
          inventory_request_type TEXT,
          inventory_result_type TEXT,
          allocation_owner_type TEXT,
          probability DECIMAL(5,2),
          allocation_id BIGINT,
          allocation_owner_id BIGINT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'master_sail',
      sql: `
        CREATE TABLE IF NOT EXISTS master_sail (
          id SERIAL PRIMARY KEY,
          sail_id BIGINT,
          ship_code TEXT,
          ship_name TEXT,
          sail_date_from DATE,
          port_from TEXT,
          sail_date_to DATE,
          port_to TEXT,
          package_id BIGINT,
          package_type TEXT,
          sail_code TEXT,
          package_name TEXT,
          sail_days INTEGER,
          geog_area_code TEXT,
          vacation_date DATE,
          season_code TEXT,
          is_fake TEXT,
          is_active TEXT,
          is_package_active TEXT,
          master_voyage_departure_date DATE,
          master_voyage1 TEXT,
          master_voyage1_length INTEGER,
          master_voyage1_sail_days INTEGER,
          master_voyage2 TEXT,
          master_voyage2_length INTEGER,
          master_voyage2_sail_days INTEGER,
          is_main INTEGER,
          is_primary INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'ship',
      sql: `
        CREATE TABLE IF NOT EXISTS ship (
          id SERIAL PRIMARY KEY,
          ship_id INTEGER,
          ship_code TEXT,
          ship_name TEXT,
          ship_pax_capacity TEXT,
          ship_length TEXT,
          ship_tonnage TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'itinerary',
      sql: `
        CREATE TABLE IF NOT EXISTS itinerary (
          id SERIAL PRIMARY KEY,
          sail_code TEXT,
          itinerary_code TEXT,
          package_name TEXT,
          cruise_day DECIMAL(5,2),
          port_code TEXT,
          port_name TEXT,
          sail_date DATE,
          arrival_time TEXT,
          departure_time TEXT,
          first_day INTEGER,
          last_day INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'reservation',
      sql: `
        CREATE TABLE IF NOT EXISTS reservation (
          id SERIAL PRIMARY KEY,
          res_id BIGINT,
          res_status TEXT,
          source_code TEXT,
          res_probability DECIMAL(5,2),
          pax_type TEXT,
          pax_status TEXT,
          ship TEXT,
          sail_code TEXT,
          sail_duration INTEGER,
          sail_from_date DATE,
          sail_to_date DATE,
          agency_id BIGINT,
          sec_agency_id BIGINT,
          agency_channel TEXT,
          agency_country_code TEXT,
          agency_market TEXT,
          cabin_type TEXT,
          cabin_category TEXT,
          ticket_type TEXT,
          promo_code INTEGER,
          currency TEXT,
          currency_rate DECIMAL(10,6),
          guest_count DECIMAL(5,2),
          foc_guest_count DECIMAL(5,2),
          gross_published_fare DECIMAL(15,2),
          gross_selling_fare DECIMAL(15,2),
          net_selling_fare DECIMAL(15,2),
          cruise_fare_comm DECIMAL(15,2),
          published_discount DECIMAL(15,2),
          promotional_discounts DECIMAL(15,2),
          total_discounts DECIMAL(15,2),
          gross_ticket_revenue DECIMAL(15,2),
          net_ticket_revenue DECIMAL(15,2),
          net_invoice_revenue DECIMAL(15,2),
          gross_ticket_revenue_eur DECIMAL(15,2),
          net_ticket_revenue_eur DECIMAL(15,2),
          net_invoice_revenue_eur DECIMAL(15,2),
          total_discounts_eur DECIMAL(15,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'gql_cabin_availability',
      sql: `
        CREATE TABLE IF NOT EXISTS gql_cabin_availability (
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
      `
    },
    {
      name: 'sail_header',
      sql: `
        CREATE TABLE IF NOT EXISTS sail_header (
          id SERIAL PRIMARY KEY,
          sk_id INTEGER,
          sail_id BIGINT,
          ship_code TEXT,
          sail_date_from DATE,
          sail_date_to DATE,
          rel_day_from INTEGER,
          rel_day_to INTEGER,
          season_code TEXT,
          port_from TEXT,
          port_to TEXT,
          geog_area_code TEXT,
          is_fake TEXT,
          is_active TEXT,
          comments TEXT,
          sail_status TEXT,
          sail_code TEXT,
          dep_ref_id BIGINT,
          arr_ref_id BIGINT,
          route_code TEXT,
          is_locked TEXT,
          effective_from TIMESTAMP WITH TIME ZONE,
          effective_to TIMESTAMP WITH TIME ZONE,
          active_record_flag INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'ship_cabin',
      sql: `
        CREATE TABLE IF NOT EXISTS ship_cabin (
          id SERIAL PRIMARY KEY,
          ship_code TEXT,
          cabin_number TEXT,
          cabin_id BIGINT,
          deck_number INTEGER,
          cabin_name TEXT,
          comments TEXT,
          image_id BIGINT,
          cabin_rank INTEGER,
          firezone_code TEXT,
          ext_cabin_id BIGINT,
          record_added_manually TEXT,
          effective_from TIMESTAMP WITH TIME ZONE,
          effective_to TIMESTAMP WITH TIME ZONE,
          active_record_flag INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ];
  
  for (const table of tableDefinitions) {
    console.log(`🏗️  Creating table ${table.name}...`);
    
    try {
      // Try to execute raw SQL using rpc
      const { data, error } = await supabase.rpc('exec', { 
        sql: table.sql 
      });
      
      if (error) {
        console.log(`⚠️  Table ${table.name}: ${error.message}`);
      } else {
        console.log(`✅ Table ${table.name} created successfully`);
      }
    } catch (e) {
      console.log(`❌ Table ${table.name} error:`, e.message);
    }
  }
  
  console.log('\n🎉 Table creation completed!');
  console.log('📊 All business tables should now exist');
  console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
}

// Run the table creation
createTablesDirect().catch(console.error);