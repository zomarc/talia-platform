/**
 * Table Sources Configuration
 * Maps Supabase table names to their Azure Synapse sources from sync.config.json
 */

// Mapping of Supabase table names to Azure Synapse sources
// Based on sync.config.json from talia-server
export const tableSources = {
  ship: {
    source: 'dwh.Dim_Ship',
    type: 'direct',
    dateColumns: [], // No date columns for ship table
    syncType: 'ships' // Match sync.config.json table key (plural)
  },
  cabin_availability: {
    source: 'dwh.Dim_Cabin_Availability',
    type: 'direct',
    dateColumns: ['snapshot_date'],
    syncType: 'cabin_availability'
  },
  reservation: {
    source: 'stg.RES_HEADER',
    type: 'direct',
    isLargeDataset: true, // Uses batch loading
    dateColumns: ['sail_from_date', 'sail_to_date'],
    syncType: 'reservation'
  },
  master_sail: {
    source: 'dwh.Dim_Master_Sail',
    type: 'direct',
    dateColumns: ['sail_date_from', 'sail_date_to', 'vacation_date', 'master_voyage_departure_date'],
    syncType: 'master_sail' // snake_case - standard naming convention
  },
  sail_by_cabin_occupancy: {
    source: 'dwh.Dim_Sail_By_Cabin_Occupancy',
    type: 'direct',
    dateColumns: ['sail_date_from', 'sail_itinerary_date'],
    syncType: 'sail_by_cabin_occupancy'
  },
  reservation_changes: {
    source: 'fou.Fact_Reservation_daily',
    type: 'derived',
    dateColumns: ['snapshot_date'],
    syncType: 'reservation_changes'
  },
  reservation_current_state: {
    source: 'fou.Fact_Reservation_daily',
    type: 'derived',
    dateColumns: ['snapshot_date'],
    syncType: 'reservation_changes' // Shares sync metadata with reservation_changes
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
  ship_cabin: {
    source: null, // Not in sync config
    type: 'unknown',
    dateColumns: [],
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
    .filter(([_, config]) => config.syncType !== null)
    .map(([tableName, config]) => ({ tableName, ...config }));
};

export default tableSources;



