const SYNC_TYPE = 'published_rates';
const CURRENT_STATE_TABLE = 'published_rates_current_state';
const TARGET_TABLE = 'published_rates_changes';
const SNAPSHOT_COLUMN = 'SNAPSHOT_DATE';

/**
 * Generate a unique key for a published rate record
 * Key format: sail_code|cabin_category|rate_type|promo_name
 * Works with both raw Synapse rows and transformed state objects
 */
function getPublishedRateKey(row) {
  // Handle both raw rows and transformed rows
  const sailCode = row.SAIL_CODE || row.sail_code || 'NULL';
  const cabinCategory = row.CABIN_CATEGORY || row.cabin_category || 'NULL';
  const rateType = row.RATE_TYPE || row.rate_type || 'NULL';
  const promoName = row.PROMO_NAME || row.promo_name || 'NULL';
  
  return `${sailCode}|${cabinCategory}|${rateType}|${promoName}`;
}

/**
 * Load current state of all published rates from database
 * Returns a Map<rate_key, currentState>
 * 
 * Exported for use by sync service batching wrapper
 */
export async function loadPublishedRatesCurrentState(supabaseClient, logger = null) {
  // Logging removed - SyncOperation handles all logging
  const stateMap = new Map();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .select('*', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to load current state: ${error.message}`);
    }

    if (data && data.length > 0) {
      for (const row of data) {
        stateMap.set(row.rate_key, {
          snapshot_date: row.snapshot_date,
          sail_code: row.sail_code,
          ship_code: row.ship_code,
          package_name: row.package_name,
          region: row.region,
          rate_type: row.rate_type,
          sail_days: row.sail_days,
          departure_date: row.departure_date,
          cabin_category: row.cabin_category,
          promo_name: row.promo_name,
          promo_type: row.promo_type,
          currency_code: row.currency_code,
          fare_per_person: row.fare_per_person,
          port_taxes_services: row.port_taxes_services,
          extra_adult: row.extra_adult,
          extra_child: row.extra_child,
          discount: row.discount
        });
      }
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return stateMap;
}

/**
 * Update current state table with new published rate states
 * For initial load: stores all unique rate records
 * For incremental: updates existing records and adds new ones
 * 
 * Exported for use by sync service batching wrapper
 */
export async function updatePublishedRatesCurrentState(supabaseClient, updatedStates, logger = null) {
  if (updatedStates.length === 0) return;
  
  // Pure data update - logging handled by sync service
  
  // Deduplicate: keep only the latest snapshot_date for each rate_key
  const stateMap = new Map();
  for (const state of updatedStates) {
    const key = state.rate_key;
    const existing = stateMap.get(key);
    if (!existing || new Date(state.snapshot_date) > new Date(existing.snapshot_date)) {
      stateMap.set(key, state);
    }
  }

  const statesToUpdate = Array.from(stateMap.values());

  const batchSize = 1000;

  for (let i = 0; i < statesToUpdate.length; i += batchSize) {
    const batch = statesToUpdate.slice(i, i + batchSize);
    const { error } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .upsert(batch, {
        onConflict: 'rate_key'
      });

    if (error) {
      throw new Error(`Failed to update current state: ${error.message}`);
    }
  }
}

/**
 * Transform Synapse row to Supabase format
 */
function transformRow(row) {
  return {
    rate_key: getPublishedRateKey(row),
    snapshot_date: row.SNAPSHOT_DATE ? new Date(row.SNAPSHOT_DATE).toISOString().split('T')[0] : null,
    sail_code: row.SAIL_CODE || null,
    ship_code: row.SHIP_CODE || null,
    package_name: row.PACKAGE_NAME || null,
    region: row.REGION || null,
    rate_type: row.RATE_TYPE || null,
    sail_days: row.SAIL_DAYS ? parseFloat(row.SAIL_DAYS) : null,
    departure_date: row.DEPARTURE_DATE ? new Date(row.DEPARTURE_DATE).toISOString().split('T')[0] : null,
    cabin_category: row.CABIN_CATEGORY || null,
    promo_name: row.PROMO_NAME || null,
    promo_type: row.PROMO_TYPE || null,
    currency_code: row.CURRENCY_CODE || null,
    fare_per_person: row.FARE_PER_PERSON ? parseFloat(row.FARE_PER_PERSON) : null,
    port_taxes_services: row.PORT_TAXES_SERVICES ? parseFloat(row.PORT_TAXES_SERVICES) : null,
    extra_adult: row.EXTRA_ADULT ? parseFloat(row.EXTRA_ADULT) : null,
    extra_child: row.EXTRA_CHILD ? parseFloat(row.EXTRA_CHILD) : null,
    discount: row.DISCOUNT ? parseFloat(row.DISCOUNT) : null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Process a batch of published rate records and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 * 
 * This function is used by the sync service's batching wrapper.
 * The sync service handles all querying, batching, and data insertion.
 */
export function processPublishedRatesBatch(batch, currentState, logger = null) {
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  
  log(`🔄 Transforming ${batch.length.toLocaleString()} records for published rates...`);
  const result = processChangesBatch(batch, currentState);
  log(`✅ Processed ${batch.length.toLocaleString()} records (${result.changes.length} changes detected)`);
  
  return result;
}

/**
 * Process a batch of published rate records and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 * Internal function - use processPublishedRatesBatch instead
 */
function processChangesBatch(batch, currentState) {
  const changes = [];
  const updatedStates = [];

  // Sort batch by rate_key, then by snapshot_date
  const sorted = batch.sort((a, b) => {
    const keyA = getPublishedRateKey(a);
    const keyB = getPublishedRateKey(b);
    if (keyA !== keyB) {
      return keyA.localeCompare(keyB);
    }
    return new Date(a.SNAPSHOT_DATE) - new Date(b.SNAPSHOT_DATE);
  });

  for (const row of sorted) {
    const transformed = transformRow(row);
    const key = transformed.rate_key;
    const previous = currentState.get(key);

    // Always update current state with latest snapshot
    updatedStates.push(transformed);

    // Only store a change if there's a previous state AND something changed
    if (previous) {
      const hasChange = 
        previous.fare_per_person !== transformed.fare_per_person ||
        previous.port_taxes_services !== transformed.port_taxes_services ||
        previous.extra_adult !== transformed.extra_adult ||
        previous.extra_child !== transformed.extra_child ||
        previous.discount !== transformed.discount ||
        previous.promo_type !== transformed.promo_type ||
        previous.region !== transformed.region;

      if (hasChange) {
        // Remove updated_at from changes (it's only for current_state table)
        const { updated_at, ...changeData } = transformed;
        changes.push({
          ...changeData,
          fare_per_person_delta: (transformed.fare_per_person || 0) - (previous.fare_per_person || 0),
          port_taxes_services_delta: (transformed.port_taxes_services || 0) - (previous.port_taxes_services || 0),
          extra_adult_delta: (transformed.extra_adult || 0) - (previous.extra_adult || 0),
          extra_child_delta: (transformed.extra_child || 0) - (previous.extra_child || 0),
          discount_delta: (transformed.discount || 0) - (previous.discount || 0),
          created_at: new Date().toISOString()
        });
      }
    }
    // Note: We don't store initial state as a change - it's just the baseline

    // Update in-memory state for next comparison
    currentState.set(key, transformed);
  }

  return { changes, updatedStates };
}

/**
 * Insert changes into published_rates_changes table
 * Exported for use by sync service batching wrapper
 */
export async function insertPublishedRatesChanges(supabaseClient, changes, logger = null) {
  if (changes.length === 0) return;

  // Pure data insertion - logging handled by sync service
  const batchSize = 1000;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const { error } = await supabaseClient.from(TARGET_TABLE).insert(batch);
    if (error) {
      throw new Error(`Failed to insert published rate change batch: ${error.message}`);
    }
  }
}


