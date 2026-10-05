import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const syncConfig = require('../../sync.config.json');

const tableDefinitions = syncConfig.tables || {};

const targetToConfigMap = Object.entries(tableDefinitions).reduce((acc, [configName, definition]) => {
  if (definition?.target) {
    acc[definition.target] = configName;
  }
  return acc;
}, {});

const tableAliasToConfigMap = {
  ...targetToConfigMap,
  // Legacy/derived reporting table names should map to the same sync config.
  published_rates: 'publishedRates',
  reservation_current_state: 'reservationChanges',
  published_rates_changes: 'publishedRates',
  published_rates_current_state: 'publishedRates',
  competitor_current_state: 'competitor',
  sail_booking_monday: 'factReservationHistory',
};

export const DATE_ROLES = {
  SAILING_INTERVAL: 'sailing_interval',
  RECORD_VALIDITY: 'record_validity',
  EVENT: 'event',
  LOAD: 'load',
};

const tableDateColumns = {
  agency: [],
  ship: [],
  ship_cabin: [],
  ship_cabin_ctg_link: ['eff_sail_from', 'eff_sail_to'],
  ship_cabin_reserve: ['sail_date_from', 'sail_date_to'],
  market_roll_up: [],
  cabin_ctg: ['effective_from', 'effective_to'],
  commercial_book_targets: ['wc_snapshot_date', 'accounting_month'],
  budget: ['accounting_month', 'effective_from', 'effective_to'],
  etl_table_parameters: [],
  ship_inventory_alloc: ['sail_date_from', 'sail_date_to'],
  cabin_availability: ['snapshot_date'],
  gql_cabin_availability: ['snapshot_date'],
  reservation: ['sail_from_date', 'sail_to_date'],
  reservation_promotion: [],
  master_sail: ['sail_date_from', 'sail_date_to', 'vacation_date', 'master_voyage_departure_date'],
  sail_by_cabin_occupancy: ['sail_date_from', 'sail_itinerary_date'],
  reservation_changes: ['snapshot_date'],
  reservation_current_state: ['snapshot_date'],
  sail_booking_monday: ['snapshot_date'],
  published_rates: ['snapshot_date', 'departure_date'],
  published_rates_changes: ['snapshot_date', 'departure_date'],
  published_rates_current_state: ['snapshot_date', 'departure_date'],
  competitor: ['snapshot_date', 'departure_date'],
  competitor_current_state: ['snapshot_date', 'departure_date'],
  competitor_benchmark: ['snapshot_date', 'departure_date'],
  inventory_status_by_day: ['snapshot_date', 'sail_date'],
  google_trends_data: ['date'],
  google_trends_search_terms: ['created_at', 'updated_at'],
  sail_header: ['sail_date_from', 'sail_date_to'],
  itinerary: ['sail_date'],
  cabin_allocation: ['allocation_date'],
  sync_metadata: ['last_sync_at', 'created_at', 'updated_at'],
  focuses: ['created_at', 'updated_at'],
  port_city: [],
  data_refresh_metadata: ['last_refreshed_at', 'created_at', 'updated_at'],
};

// Explicit roles for tables whose first date column is not a snapshot/event series.
const tableDateRoleOverrides = {
  ship_cabin_ctg_link: { dateRole: DATE_ROLES.SAILING_INTERVAL, sailCoverage: true },
  ship_cabin_reserve: { dateRole: DATE_ROLES.SAILING_INTERVAL },
  ship_inventory_alloc: { dateRole: DATE_ROLES.SAILING_INTERVAL },
  reservation: { dateRole: DATE_ROLES.SAILING_INTERVAL },
  master_sail: { dateRole: DATE_ROLES.SAILING_INTERVAL },
  sail_header: { dateRole: DATE_ROLES.SAILING_INTERVAL },
  cabin_ctg: { dateRole: DATE_ROLES.RECORD_VALIDITY },
  commercial_book_targets: { dateRole: DATE_ROLES.EVENT },
  budget: { dateRole: DATE_ROLES.EVENT },
};

const defaultDateColumns = [
  'sail_date_from',
  'sail_date_to',
  'departure_date',
  'snapshot_date',
  'sail_from_date',
  'sail_to_date',
  'created_at',
  'updated_at',
];

export const getSyncConfigNameForTable = (tableName) => {
  if (!tableName || typeof tableName !== 'string') {
    return tableName;
  }
  if (tableDefinitions[tableName]) {
    return tableName;
  }
  return tableAliasToConfigMap[tableName] || tableName;
};

export const getSyncTypeForTable = (tableName) => {
  const configName = getSyncConfigNameForTable(tableName);
  const definition = tableDefinitions[configName];
  if (definition?.target) {
    return definition.target;
  }
  return tableName;
};

export const hasSyncConfigForTable = (tableName) => {
  const configName = getSyncConfigNameForTable(tableName);
  return Boolean(tableDefinitions[configName]);
};

export const getAvailableSyncConfigTableNames = () => Object.keys(tableDefinitions);

export const getDateColumnsForTable = (tableName) => {
  const syncType = getSyncTypeForTable(tableName);
  if (syncType in tableDateColumns) {
    return tableDateColumns[syncType];
  }
  if (tableName in tableDateColumns) {
    return tableDateColumns[tableName];
  }
  return defaultDateColumns;
};

const LOAD_DATE_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'last_sync_at',
  'last_run_at',
  'last_refreshed_at',
  'imported_at',
]);

const findIntervalPair = (dateColumns = []) => {
  for (const fromCol of dateColumns) {
    const toCol = fromCol.replace(/from/i, 'to');
    if (toCol !== fromCol && dateColumns.includes(toCol)) {
      return { intervalFrom: fromCol, intervalTo: toCol };
    }
  }
  return { intervalFrom: null, intervalTo: null };
};

const inferDateRole = (dateColumns = []) => {
  if (!dateColumns.length) return DATE_ROLES.LOAD;
  if (dateColumns.every((column) => LOAD_DATE_COLUMNS.has(column))) return DATE_ROLES.LOAD;
  const { intervalFrom, intervalTo } = findIntervalPair(dateColumns);
  if (intervalFrom && intervalTo) {
    if (/^effective_from$/.test(intervalFrom) && !/sail/.test(intervalFrom)) {
      return DATE_ROLES.RECORD_VALIDITY;
    }
    return DATE_ROLES.SAILING_INTERVAL;
  }
  return DATE_ROLES.EVENT;
};

export const getDateProfileForTable = (tableName) => {
  const dateColumns = getDateColumnsForTable(tableName);
  const inferredPair = findIntervalPair(dateColumns);
  const override = tableDateRoleOverrides[tableName]
    || tableDateRoleOverrides[getSyncTypeForTable(tableName)]
    || {};
  const dateRole = override.dateRole || inferDateRole(dateColumns);
  const usesInterval = dateRole === DATE_ROLES.SAILING_INTERVAL || dateRole === DATE_ROLES.RECORD_VALIDITY;
  return {
    dateColumns,
    dateRole,
    intervalFrom: usesInterval ? (override.intervalFrom || inferredPair.intervalFrom) : null,
    intervalTo: usesInterval ? (override.intervalTo || inferredPair.intervalTo) : null,
    sailCoverage: override.sailCoverage === true,
  };
};

