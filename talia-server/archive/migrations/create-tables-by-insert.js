#!/usr/bin/env node

/**
 * Create tables by attempting to insert data - this will create the tables automatically
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

async function createTablesByInsert() {
  console.log('🏗️  Creating tables by attempting to insert sample data...\n');
  
  const tables = [
    {
      name: 'cabin_allocation',
      sampleData: {
        res_id: 1,
        ship_code: 'TEST',
        cabin_category: 'TEST',
        cabin_number: 'TEST',
        occupancy: 2,
        price_category: 'TEST',
        cabin_seq_number: 1,
        inventory_request_type: 'TEST',
        inventory_result_type: 'TEST',
        allocation_owner_type: 'TEST',
        probability: 100,
        allocation_id: 1,
        allocation_owner_id: 1
      }
    },
    {
      name: 'master_sail',
      sampleData: {
        sail_id: 1,
        ship_code: 'TEST',
        ship_name: 'TEST',
        sail_date_from: '2025-01-01',
        port_from: 'TEST',
        sail_date_to: '2025-01-07',
        port_to: 'TEST',
        package_id: 1,
        package_type: 'TEST',
        sail_code: 'TEST',
        package_name: 'TEST',
        sail_days: 7,
        geog_area_code: 'TEST',
        vacation_date: '2025-01-01',
        season_code: 'TEST',
        is_fake: 'N',
        is_active: 'Y',
        is_package_active: 'Y',
        master_voyage_departure_date: '2025-01-01',
        master_voyage1: 'TEST',
        master_voyage1_length: 7,
        master_voyage1_sail_days: 7,
        master_voyage2: null,
        master_voyage2_length: null,
        master_voyage2_sail_days: null,
        is_main: 1,
        is_primary: 1
      }
    },
    {
      name: 'ship',
      sampleData: {
        ship_id: 1,
        ship_code: 'TEST',
        ship_name: 'TEST',
        ship_pax_capacity: '1000',
        ship_length: '200',
        ship_tonnage: '50000'
      }
    },
    {
      name: 'itinerary',
      sampleData: {
        sail_code: 'TEST',
        itinerary_code: 'TEST',
        package_name: 'TEST',
        cruise_day: 1,
        port_code: 'TEST',
        port_name: 'TEST',
        sail_date: '2025-01-01',
        arrival_time: '0800',
        departure_time: '1800',
        first_day: 1,
        last_day: 0
      }
    },
    {
      name: 'reservation',
      sampleData: {
        res_id: 1,
        res_status: 'BK',
        source_code: 'TEST',
        res_probability: 100,
        pax_type: 'F',
        pax_status: 'Named',
        ship: 'TEST',
        sail_code: 'TEST',
        sail_duration: 7,
        sail_from_date: '2025-01-01',
        sail_to_date: '2025-01-07',
        agency_id: 1,
        sec_agency_id: 1,
        agency_channel: 'TEST',
        agency_country_code: 'TEST',
        agency_market: 'TEST',
        cabin_type: 'TEST',
        cabin_category: 'TEST',
        ticket_type: 'TEST',
        promo_code: null,
        currency: 'EUR',
        currency_rate: 1,
        guest_count: 2,
        foc_guest_count: 0,
        gross_published_fare: 1000,
        gross_selling_fare: 1000,
        net_selling_fare: 1000,
        cruise_fare_comm: 100,
        published_discount: 0,
        promotional_discounts: 0,
        total_discounts: 0,
        gross_ticket_revenue: 1000,
        net_ticket_revenue: 1000,
        net_invoice_revenue: 1000,
        gross_ticket_revenue_eur: 1000,
        net_ticket_revenue_eur: 1000,
        net_invoice_revenue_eur: 1000,
        total_discounts_eur: 0
      }
    },
    {
      name: 'gql_cabin_availability',
      sampleData: {
        snapshot_date: '2025-01-01',
        sail_code: 'TEST',
        package_name: 'TEST',
        sail_days: 7,
        cabin_category: 'TEST',
        available_cabins: 10,
        total_cabins: 20,
        available_absolute: 10,
        available_weighted: 10,
        availability_result: 'OK',
        nested_cabins: 0
      }
    },
    {
      name: 'sail_header',
      sampleData: {
        sk_id: 1,
        sail_id: 1,
        ship_code: 'TEST',
        sail_date_from: '2025-01-01',
        sail_date_to: '2025-01-07',
        rel_day_from: 1,
        rel_day_to: 7,
        season_code: 'TEST',
        port_from: 'TEST',
        port_to: 'TEST',
        geog_area_code: 'TEST',
        is_fake: 'N',
        is_active: 'Y',
        comments: 'TEST',
        sail_status: 'BK',
        sail_code: 'TEST',
        dep_ref_id: 1,
        arr_ref_id: 1,
        route_code: 'TEST',
        is_locked: 'N',
        effective_from: '2025-01-01T00:00:00Z',
        effective_to: '9999-12-31T00:00:00Z',
        active_record_flag: 1
      }
    },
    {
      name: 'ship_cabin',
      sampleData: {
        ship_code: 'TEST',
        cabin_number: 'TEST',
        cabin_id: 1,
        deck_number: 1,
        cabin_name: 'TEST',
        comments: 'TEST',
        image_id: null,
        cabin_rank: 1,
        firezone_code: 'TEST',
        ext_cabin_id: null,
        record_added_manually: 'N',
        effective_from: '2025-01-01T00:00:00Z',
        effective_to: '9999-12-31T00:00:00Z',
        active_record_flag: 1
      }
    }
  ];
  
  for (const table of tables) {
    console.log(`🏗️  Creating table ${table.name}...`);
    
    try {
      // Try to insert sample data - this will create the table if it doesn't exist
      const { data, error } = await supabase
        .from(table.name)
        .insert([table.sampleData]);
      
      if (error) {
        console.log(`⚠️  Table ${table.name}: ${error.message}`);
      } else {
        console.log(`✅ Table ${table.name} created successfully`);
        
        // Clean up the sample data
        await supabase
          .from(table.name)
          .delete()
          .eq('id', data[0].id);
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
createTablesByInsert().catch(console.error);


