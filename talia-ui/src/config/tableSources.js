/**
 * Table Sources Configuration
 * Maps Supabase table names to their Azure Synapse sources from sync.config.json
 */

// Mapping of Supabase table names to Azure Synapse sources
// Based on sync.config.json from talia-server
export const tableSources = {
  agency: {
    source: 'dwh.Dim_Agency',
    type: 'direct',
    dateColumns: [],
    syncType: 'agency'
  },
  market_roll_up: {
    source: 'lkp.MARKET_ROLL_UP',
    type: 'direct',
    dateColumns: [],
    syncType: 'marketRollUp'
  },
  cabin_ctg: {
    source: 'lkp.CABIN_CTG',
    type: 'direct',
    dateColumns: ['effective_from', 'effective_to'],
    dateRole: 'record_validity',
    intervalFrom: 'effective_from',
    intervalTo: 'effective_to',
    syncType: 'cabinCtg'
  },
  etl_table_parameters: {
    source: 'config.ETL_Table_Parameters',
    type: 'direct',
    dateColumns: [],
    syncType: 'etlTableParameters'
  },
  ship: {
    source: 'dwh.Dim_Ship',
    type: 'direct',
    dateColumns: [], // No date columns for ship table
    syncType: 'ships' // Match sync.config.json table key (plural)
  },
  ship_inventory_alloc: {
    // Prefer RES_CABIN_ALLOCATION_DETAIL — SHIP_INVENTORY_ALLOC stalled (last alloc ~2026-06-03).
    source: 'stg.RES_CABIN_ALLOCATION_DETAIL',
    type: 'direct',
    isLargeDataset: true,
    dateColumns: ['sail_date_from', 'sail_date_to'],
    dateRole: 'sailing_interval',
    intervalFrom: 'sail_date_from',
    intervalTo: 'sail_date_to',
    syncType: 'shipInventoryAlloc'
  },
  ship_cabin: {
    source: 'fou.SHIP_CABIN',
    type: 'direct',
    dateColumns: [],
    syncType: 'shipCabin'
  },
  ship_cabin_ctg_link: {
    source: 'fou.SHIP_CABIN_CTG_LINK',
    type: 'direct',
    dateColumns: ['eff_sail_from', 'eff_sail_to'],
    dateRole: 'sailing_interval',
    intervalFrom: 'eff_sail_from',
    intervalTo: 'eff_sail_to',
    sailCoverage: true,
    syncType: 'shipCabinCtgLink'
  },
  ship_cabin_reserve: {
    source: 'stg.SHIP_CABIN_RESERVE',
    type: 'direct',
    dateColumns: ['sail_date_from', 'sail_date_to'],
    dateRole: 'sailing_interval',
    intervalFrom: 'sail_date_from',
    intervalTo: 'sail_date_to',
    syncType: 'shipCabinReserve'
  },
  cabin_availability: {
    source: 'dwh.Dim_Cabin_Availability',
    type: 'direct',
    dateColumns: ['snapshot_date'],
    syncType: 'cabin_availability'
  },
  reservation: {
    // Point-in-time named bookings from RES_HEADER. Fact_Reservation enriches probs/EUR
    // and supplies synthetic group-OF res_ids (source_origin=fact_group_alloc) post-sync.
    // Weekly Mondays: dwh.Fact_Reservation_History → sail_booking_monday (not Fact_Reservation_daily).
    source: 'stg.RES_HEADER',
    type: 'direct',
    isLargeDataset: true, // Uses batch loading
    dateColumns: ['sail_from_date', 'sail_to_date', 'res_init_date', 'original_init_date'],
    dateRole: 'sailing_interval',
    intervalFrom: 'sail_from_date',
    intervalTo: 'sail_to_date',
    syncType: 'reservation'
  },
  master_sail: {
    source: 'dwh.Dim_Master_Sail',
    type: 'direct',
    dateColumns: ['sail_date_from', 'sail_date_to', 'vacation_date', 'master_voyage_departure_date'],
    dateRole: 'sailing_interval',
    intervalFrom: 'sail_date_from',
    intervalTo: 'sail_date_to',
    syncType: 'master_sail' // snake_case - standard naming convention
  },
  sail_by_cabin_occupancy: {
    source: 'dwh.Dim_Sail_By_Cabin_Occupancy',
    type: 'direct',
    dateColumns: ['sail_date_from', 'sail_itinerary_date'],
    syncType: 'sail_by_cabin_occupancy'
  },
  reservation_changes: {
    // Snapshot deltas for profiles (RES_HEADER_SNAPSHOT). Do not use Fact_Reservation_daily.
    source: 'stg.RES_HEADER_SNAPSHOT',
    type: 'derived',
    dateColumns: ['snapshot_date'],
    syncType: 'reservation_changes'
  },
  reservation_current_state: {
    // Latest snapshot state derived with reservation_changes (not Fact_Reservation_daily).
    source: 'stg.RES_HEADER_SNAPSHOT',
    type: 'derived',
    dateColumns: ['snapshot_date'],
    syncType: 'reservation_changes' // Shares sync metadata with reservation_changes
  },
  sail_booking_monday: {
    // Monday densify from dwh.Fact_Reservation_History (WC_Snapshot_Date).
    source: 'dwh.Fact_Reservation_History',
    type: 'derived',
    dateColumns: ['snapshot_date'],
    syncType: 'fact_reservation_history',
    loadMethod: 'Derived densify (sail × Monday Booked/Contracted/Estimated)'
  },
  published_rates: {
    source: 'fou.GQL_PUBLISHED_RATES',
    type: 'derived',
    dateColumns: ['snapshot_date', 'departure_date'],
    syncType: 'published_rates'
  },
  published_rates_changes: {
    source: 'fou.GQL_PUBLISHED_RATES',
    type: 'derived',
    dateColumns: ['snapshot_date', 'departure_date'],
    syncType: 'published_rates'
  },
  published_rates_current_state: {
    source: 'fou.GQL_PUBLISHED_RATES',
    type: 'derived',
    dateColumns: ['snapshot_date', 'departure_date'],
    syncType: 'published_rates'
  },
  competitor: {
    source: 'stg.COMPETITOR',
    type: 'derived',
    dateColumns: ['snapshot_date', 'departure_date'],
    syncType: 'competitor'
  },
  competitor_current_state: {
    source: 'stg.COMPETITOR',
    type: 'derived',
    dateColumns: ['snapshot_date', 'departure_date'],
    syncType: 'competitor'
  },
  competitor_benchmark: {
    source: 'dwh.vw_Competitor_Benchmarking',
    type: 'direct',
    isLargeDataset: true,
    dateColumns: ['departure_date'],
    syncType: 'competitorBenchmark'
  },
  cabin_allocation: {
    source: null, // Not in sync config
    type: 'unknown',
    dateColumns: ['allocation_date'],
    syncType: null
  },
  itinerary: {
    source: null, // Not in sync config
    type: 'unknown',
    dateColumns: ['sail_date'],
    syncType: null
  },
  gql_cabin_availability: {
    source: null, // Not in sync config
    type: 'unknown',
    dateColumns: ['snapshot_date'],
    syncType: null
  },
  sail_header: {
    source: null, // Not in sync config
    type: 'unknown',
    dateColumns: ['sail_date_from', 'sail_date_to'],
    syncType: null
  },
  reservation_promotion: {
    source: 'stg.RES_PROMOTION',
    type: 'direct',
    isLargeDataset: true, // Uses batch loading
    dateColumns: [], // No date columns, linked via res_id
    syncType: 'reservation_promotion' // snake_case - standard naming convention
  },
  operation_metadata: {
    source: null, // System table - unified metadata for sync, refresh, and backup
    type: 'system',
    dateColumns: ['last_run_at', 'created_at', 'updated_at'],
    syncType: null
  },
  sync_metadata: {
    source: null, // Archived - use operation_metadata instead
    type: 'system',
    dateColumns: ['last_sync_at', 'created_at', 'updated_at'],
    syncType: null
  },
  focuses: {
    source: null, // Application table
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  google_trends_data: {
    source: null, // Google Trends API
    type: 'application',
    dateColumns: ['date', 'created_at', 'updated_at'],
    syncType: null
  },
  google_trends_search_terms: {
    source: null, // Application table
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  data_refresh_metadata: {
    source: null, // Archived - use operation_metadata instead
    type: 'system',
    dateColumns: ['last_refreshed_at', 'created_at', 'updated_at'],
    syncType: null
  },
  booking_targets_supplied: {
    source: null, // CSV import via Data Management
    type: 'application',
    dateColumns: ['imported_at'],
    syncType: null,
    loadMethod: 'Import'
  },
  commercial_book_targets: {
    source: 'lkp.Commercial_Book_Targets',
    type: 'synapse',
    isLargeDataset: true,
    dateColumns: ['wc_snapshot_date', 'accounting_month'],
    dateRole: 'event',
    syncType: 'commercialBookTargets',
    loadMethod: 'Sync'
  },
  budget: {
    source: 'lkp.BUDGET',
    type: 'synapse',
    dateColumns: ['accounting_month', 'master_departure_date', 'effective_from', 'effective_to', 'created_at'],
    dateRole: 'event',
    syncType: 'budget',
    loadMethod: 'Sync'
  },
  inventory_target_profile: {
    source: null,
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  inventory_target_profile_node: {
    source: null,
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  target_profiles: {
    source: null, // Application table - Talia targets (user-edited)
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  target_mapping_config: {
    source: null, // Application table - CSV column mappings
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null
  },
  inventory_item: {
    source: null, // Talia canonical sailing mapping (refreshed from master_sail)
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null,
    loadMethod: 'Hierarchy refresh'
  },
  inventory_item_operational: {
    source: null,
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null,
    loadMethod: 'View'
  },
  sailing_master: {
    source: null,
    type: 'application',
    dateColumns: ['created_at', 'updated_at'],
    syncType: null,
    loadMethod: 'View'
  },
  sailing_hierarchy: {
    source: null,
    type: 'application',
    dateColumns: [],
    syncType: null,
    loadMethod: 'View'
  },
  inventory_status_by_day: {
    source: null,
    type: 'application',
    dateColumns: ['date', 'updated_at'],
    syncType: null,
    loadMethod: 'Derived sync'
  },
  ship_day_berth_status: {
    source: null,
    type: 'application',
    dateColumns: ['date'],
    syncType: null,
    loadMethod: 'View (physical berths + cabins)'
  },
  ship_day_capacity: {
    source: null,
    type: 'application',
    dateColumns: ['date'],
    syncType: null,
    loadMethod: 'View (nameplate + offsale + sellable)'
  },
  sail_booking_summary: {
    source: 'public.reservation',
    type: 'application',
    dateColumns: [],
    syncType: null,
    loadMethod: 'View (sail-level Booked/Contracted/Estimated densify)'
  },
  sailing_physical_day_map: {
    source: null,
    type: 'application',
    dateColumns: ['master_date_from', 'master_date_to', 'segment_date_from', 'segment_date_to'],
    syncType: null,
    loadMethod: 'View (selling map)'
  },
  inventory_item_profile_curve_point: {
    source: null, // Application table - unified REAL/TARGET/BUDGET/MODEL curve points
    type: 'application',
    dateColumns: ['as_of_date', 'created_at', 'updated_at'],
    syncType: null
  },
  port_city: {
    source: 'dwh.Dim_Port_City',
    type: 'direct',
    dateColumns: [],
    syncType: 'portCity'
  }
};

/**
 * Get source information for a table
 */
export const getTableSource = (tableName) => {
  return tableSources[tableName] || {
    source: null,
    type: 'unknown',
    dateColumns: [],
    syncType: null
  };
};

/**
 * Get all tables that have sync metadata
 */
export const getSyncedTables = () => {
  return Object.entries(tableSources)
    .filter(([, config]) => config.syncType !== null)
    .map(([tableName, config]) => ({ tableName, ...config }));
};

export default tableSources;



