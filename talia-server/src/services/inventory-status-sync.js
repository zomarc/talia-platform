/**
 * Inventory Status Sync Service
 * Aggregates data from cabin_availability and reservation tables
 * to populate inventory_status_by_day table with current status by day
 */

import { supabaseDataService } from './supabase.js';

/**
 * Sync inventory status by day
 * Aggregates capacity from cabin_availability and sold count from reservations
 * 
 * @param {Object} options
 * @param {string} options.dateFrom - Start date (YYYY-MM-DD)
 * @param {string} options.dateTo - End date (YYYY-MM-DD)
 * @param {Object} logger - Optional logger instance
 */
export async function syncInventoryStatusByDay({ dateFrom, dateTo, logger = null }) {
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  const logError = (...args) => logger ? logger.error(...args) : console.error(...args);
  
  const startTime = Date.now();
  
  try {
    log(`🔄 Starting inventory status sync for date range ${dateFrom} to ${dateTo}...`);
    
    // Step 1: Get capacity data from cabin_availability grouped by date, ship, and sail_code
    log(`📊 Aggregating capacity data from cabin_availability...`);
    
    // First get cabin_availability records
    const { data: cabinData, error: cabinError } = await supabaseDataService.client
      .from('cabin_availability')
      .select('snapshot_date, sail_code, total_cabins')
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .not('sail_code', 'is', null);
    
    if (cabinError) {
      throw new Error(`Failed to query cabin_availability: ${cabinError.message}`);
    }
    
    log(`   Found ${cabinData?.length || 0} cabin availability records`);
    
    // Get unique sail_codes to look up ship_code from master_sail
    // Batch queries to avoid "URI too long" error
    const sailCodes = [...new Set(cabinData?.map(r => r.sail_code).filter(Boolean) || [])];
    const sailCodeToShipMap = new Map();
    
    if (sailCodes.length > 0) {
      log(`   Looking up ship_code for ${sailCodes.length} unique sail_codes...`);
      const batchSize = 100; // Supabase has URL length limits, so batch queries
      
      for (let i = 0; i < sailCodes.length; i += batchSize) {
        const batch = sailCodes.slice(i, i + batchSize);
        
        const { data: masterSailData, error: msError } = await supabaseDataService.client
          .from('master_sail')
          .select('sail_code, ship_code, sail_date_from')
          .in('sail_code', batch);
        
        if (msError) {
          log(`⚠️  Could not load master_sail data for batch ${Math.floor(i/batchSize) + 1}: ${msError.message}`);
        } else if (masterSailData) {
          masterSailData.forEach(ms => {
            sailCodeToShipMap.set(ms.sail_code, ms.ship_code);
          });
        }
      }
      
      log(`   Found ship_code for ${sailCodeToShipMap.size} sail_codes`);
    }
    
    // Combine cabin_availability with ship_code from master_sail
    const capacityData = cabinData?.map(cabin => ({
      snapshot_date: cabin.snapshot_date,
      sail_code: cabin.sail_code,
      total_cabins: cabin.total_cabins,
      ship_code: sailCodeToShipMap.get(cabin.sail_code) || null
    })).filter(c => c.ship_code) || [];
    
    // Step 2: Get sold count from reservations grouped by date, ship, and sail_code
    log(`📊 Aggregating sold data from reservations...`);
    
    // Query reservations - include all active statuses (actual values are 'CX', 'BK', etc.)
    // We'll filter out cancelled/inactive statuses if needed, but for now include all with sail_code
    const { data: reservationData, error: reservationError } = await supabaseDataService.client
      .from('reservation')
      .select(`
        sail_from_date,
        sail_code,
        ship,
        guest_count,
        res_status
      `)
      .gte('sail_from_date', dateFrom)
      .lte('sail_from_date', dateTo)
      .not('sail_code', 'is', null)
      .not('ship', 'is', null);
    
    if (reservationError) {
      throw new Error(`Failed to query reservations: ${reservationError.message}`);
    }
    
    log(`   Found ${reservationData?.length || 0} reservation records`);
    
    // Step 3: Aggregate capacity by date, ship_code, sail_code
    const capacityMap = new Map();
    
    if (capacityData) {
      for (const record of capacityData) {
        const date = record.snapshot_date;
        const shipCode = record.ship_code;
        const sailCode = record.sail_code;
        const totalCabins = record.total_cabins || 0;
        
        if (!date || !shipCode || !sailCode) continue;
        
        const key = `${date}_${shipCode}_${sailCode}`;
        const existing = capacityMap.get(key) || { date, ship_code: shipCode, sail_code: sailCode, capacity: 0 };
        existing.capacity = Math.max(existing.capacity, totalCabins); // Use max capacity for the day
        capacityMap.set(key, existing);
      }
    }
    
    // Step 4: Aggregate sold count by date, ship_code, sail_code
    const soldMap = new Map();
    
    if (reservationData) {
      for (const record of reservationData) {
        const date = record.sail_from_date;
        const shipCode = record.ship;
        const sailCode = record.sail_code;
        const guestCount = parseFloat(record.guest_count) || 0;
        
        if (!date || !shipCode || !sailCode) continue;
        
        const key = `${date}_${shipCode}_${sailCode}`;
        const existing = soldMap.get(key) || { date, ship_code: shipCode, sail_code: sailCode, sold: 0 };
        existing.sold += guestCount;
        soldMap.set(key, existing);
      }
    }
    
    // Step 5: Combine data and calculate available
    const inventoryRecords = [];
    const allKeys = new Set([...capacityMap.keys(), ...soldMap.keys()]);
    
    for (const key of allKeys) {
      const capacity = capacityMap.get(key);
      const sold = soldMap.get(key);
      
      const record = {
        date: capacity?.date || sold?.date,
        ship_code: capacity?.ship_code || sold?.ship_code,
        sail_code: capacity?.sail_code || sold?.sail_code,
        capacity: capacity?.capacity || 0,
        sold: sold?.sold || 0,
        available: (capacity?.capacity || 0) - (sold?.sold || 0)
      };
      
      inventoryRecords.push(record);
    }
    
    log(`📊 Generated ${inventoryRecords.length} inventory status records`);
    
    // Step 6: Upsert into inventory_status_by_day table
    if (inventoryRecords.length > 0) {
      const batchSize = 1000;
      let totalUpserted = 0;
      
      for (let i = 0; i < inventoryRecords.length; i += batchSize) {
        const batch = inventoryRecords.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabaseDataService.client
          .from('inventory_status_by_day')
          .upsert(batch, {
            onConflict: 'date,ship_code,sail_code',
            ignoreDuplicates: false
          });
        
        if (upsertError) {
          throw new Error(`Failed to upsert inventory status: ${upsertError.message}`);
        }
        
        totalUpserted += batch.length;
        log(`   Upserted ${totalUpserted}/${inventoryRecords.length} records...`);
      }
      
      log(`✅ Successfully synced ${totalUpserted} inventory status records`);
    } else {
      log(`⚠️  No inventory records to sync`);
    }
    
    const duration = Date.now() - startTime;
    return {
      success: true,
      recordsProcessed: inventoryRecords.length,
      duration,
      message: `Successfully synced ${inventoryRecords.length} inventory status records`
    };
    
  } catch (error) {
    logError(`❌ Inventory status sync failed:`, error.message);
    const duration = Date.now() - startTime;
    return {
      success: false,
      recordsProcessed: 0,
      duration,
      error: error.message
    };
  }
}

