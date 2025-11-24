import sql from 'mssql';

const SYNC_TYPE = 'published_rates';
const CURRENT_STATE_TABLE = 'published_rates_current_state';
const TARGET_TABLE = 'published_rates_changes';
const METADATA_TABLE = 'sync_metadata';

/**
 * Get the last processed date from sync metadata
 */
async function getLastProcessedDate(supabaseClient) {
  const { data, error } = await supabaseClient
    .from(METADATA_TABLE)
    .select('last_processed_date')
    .eq('sync_type', SYNC_TYPE)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Failed to get last processed date: ${error.message}`);
  }

  return data?.last_processed_date || null;
}

/**
 * Update sync metadata with last processed date and stats
 */
async function updateSyncMetadata(supabaseClient, lastProcessedDate, recordsProcessed, changesDetected) {
  const { error } = await supabaseClient
    .from(METADATA_TABLE)
    .upsert({
      sync_type: SYNC_TYPE,
      last_processed_date: lastProcessedDate,
      records_processed: recordsProcessed,
      changes_detected: changesDetected,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'sync_type'
    });

  if (error) {
    throw new Error(`Failed to update sync metadata: ${error.message}`);
  }
}

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
 */
async function loadCurrentState(supabaseClient) {
  console.log('📥 Loading current published rates state from database...');
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

  console.log(`✅ Loaded ${stateMap.size} published rate states`);
  return stateMap;
}

/**
 * Update current state table with new published rate states
 * For initial load: stores all unique rate records
 * For incremental: updates existing records and adds new ones
 */
async function updateCurrentState(supabaseClient, updatedStates) {
  if (updatedStates.length === 0) return;

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

  console.log(`📝 Updating ${statesToUpdate.length} published rate states (from ${updatedStates.length} processed records)...`);
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

  console.log(`✅ Updated ${statesToUpdate.length} published rate states`);
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
 */
async function insertChanges(supabaseClient, changes) {
  if (changes.length === 0) return;

  console.log(`📥 Inserting ${changes.length} published rate change rows...`);
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const { error } = await supabaseClient.from(TARGET_TABLE).insert(batch);
    if (error) {
      throw new Error(`Failed to insert published rate change batch: ${error.message}`);
    }
    inserted += batch.length;
    console.log(`   📊 Inserted ${inserted}/${changes.length} published rate change rows`);
  }

  console.log(`✅ Published rate change insert complete (${inserted} rows)`);
}

/**
 * Build row number query for pagination
 */
function buildRowNumberQuery({ source, columnsSql, whereClause, rowNumberOrder }) {
  const order = (rowNumberOrder && rowNumberOrder.length > 0)
    ? rowNumberOrder.join(', ')
    : '[SNAPSHOT_DATE]';

  return `
    SELECT ${columnsSql}, ROW_NUMBER() OVER (ORDER BY ${order}) as rn
    FROM ${source}
    ${whereClause ? `WHERE ${whereClause}` : ''}
  `;
}

/**
 * Sync published rates incrementally
 * 
 * Initial Load:
 *   - If no last_processed_date exists, processes all snapshots in dateRange
 *   - Builds current state, stores only actual changes
 * 
 * Incremental Update:
 *   - Processes only snapshots since last_processed_date
 *   - Compares to current state from database
 *   - Stores only new changes
 *   - Updates current state
 */
export async function syncPublishedRates({
  synapseConfig,
  supabaseClient,
  source,
  columns,
  dateColumn,
  dateRange,
  targetTable,
  rowNumberOrder,
  batchSize = 50000,
  forceFullSync = false
}) {
  if (!dateRange?.from || !dateRange?.to) {
    throw new Error('Published rates sync requires a dateRange with from/to values');
  }

  // Calculate today and yesterday dates (YYYY-MM-DD format)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  // Get last processed date
  let lastProcessedDate = forceFullSync ? null : await getLastProcessedDate(supabaseClient);
  
  // If no last_processed_date exists, initialize it to 2 days ago
  if (!lastProcessedDate && !forceFullSync) {
    lastProcessedDate = twoDaysAgoStr;
    console.log(`📅 No last processed date found. Initializing to 2 days ago: ${lastProcessedDate}`);
    // Store the initial date in metadata
    await updateSyncMetadata(supabaseClient, lastProcessedDate, 0, 0);
  }
  
  const isInitialLoad = forceFullSync;
  
  // Determine actual date range to process
  let processFrom, processTo;
  
  if (isInitialLoad) {
    // Initial load: use the configured date range
    processFrom = dateRange.from;
    processTo = dateRange.to;
    console.log(`🔄 INITIAL LOAD: Processing snapshots from ${processFrom} to ${processTo}`);
  } else {
    // Incremental sync: process from last_processed_date
    // If we're behind (last_processed_date < yesterday), catch up from there
    // Otherwise, process from last_processed_date to avoid reprocessing
    const lastProcessedDateObj = new Date(lastProcessedDate);
    const yesterdayObj = new Date(yesterdayStr);
    
    // Process from last_processed_date (or yesterday if we're behind)
    processFrom = lastProcessedDateObj < yesterdayObj ? lastProcessedDate : lastProcessedDate;
    processTo = null; // No upper bound for incremental syncs
    
    if (lastProcessedDateObj < yesterdayObj) {
      console.log(`🔄 INCREMENTAL UPDATE (CATCHING UP): Processing all snapshots since ${processFrom} (behind by ${Math.floor((yesterdayObj - lastProcessedDateObj) / (1000 * 60 * 60 * 24))} days, no upper bound)`);
    } else {
      console.log(`🔄 INCREMENTAL UPDATE: Processing all snapshots since ${processFrom} (no upper bound)`);
    }
  }

  // Load current state from database
  const currentState = await loadCurrentState(supabaseClient);

  const pool = await sql.connect(synapseConfig);
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  let totalChangesDetected = 0; // Track total changes across all batches
  let maxSnapshotDate = null; // Track the maximum Snapshot_Date processed
  const columnsSql = columns.join(', ');
  
  // Build WHERE clause based on sync type
  const whereClause = isInitialLoad
    ? `${dateColumn} >= '${processFrom}' AND ${dateColumn} <= '${processTo}'`
    : `${dateColumn} > '${processFrom}'`; // Incremental: use > to avoid reprocessing last processed date, no upper bound

  try {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${source}
      WHERE ${whereClause}
    `;

    const countResult = await pool.request().query(countQuery);
    const totalRows = countResult.recordset[0].total;
    console.log(`📊 Total rows to process: ${totalRows.toLocaleString()}`);

    if (totalRows === 0) {
      console.log('✅ No rows to process');
      return {
        success: true,
        recordsProcessed: 0,
        recordsUpdated: 0,
        message: 'No rows to process'
      };
    }

    const rowNumberQuery = buildRowNumberQuery({
      source,
      columnsSql,
      whereClause,
      rowNumberOrder
    });

    // Process in batches
    for (let offset = 0; offset < totalRows; offset += batchSize) {
      const batchQuery = `
        SELECT *
        FROM (
          ${rowNumberQuery}
        ) AS numbered
        WHERE rn > ${offset} AND rn <= ${offset + batchSize}
        ORDER BY rn
      `;

      console.log(`  Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalRows / batchSize)} (${offset + 1} to ${Math.min(offset + batchSize, totalRows)})...`);
      const batchResult = await pool.request().query(batchQuery);
      const batch = batchResult.recordset;
      if (!batch.length) {
        break;
      }

      const { changes, updatedStates } = processChangesBatch(batch, currentState);
      allChanges.push(...changes);
      allUpdatedStates.push(...updatedStates);
      totalProcessed += batch.length;
      
      // Track the maximum Snapshot_Date from this batch
      for (const row of batch) {
        if (row.SNAPSHOT_DATE) {
          const snapshotDate = new Date(row.SNAPSHOT_DATE);
          if (!maxSnapshotDate || snapshotDate > maxSnapshotDate) {
            maxSnapshotDate = snapshotDate;
          }
        }
      }

      // Insert changes in batches to avoid memory issues
      if (allChanges.length >= 10000) {
        await insertChanges(supabaseClient, allChanges);
        totalChangesDetected += allChanges.length;
        allChanges.length = 0;
      }

      // Update current state in batches
      if (allUpdatedStates.length >= 10000) {
        await updateCurrentState(supabaseClient, allUpdatedStates);
        allUpdatedStates.length = 0;
      }
    }

    // Insert remaining changes
    if (allChanges.length > 0) {
      await insertChanges(supabaseClient, allChanges);
      totalChangesDetected += allChanges.length;
    }

    // Update remaining states
    if (allUpdatedStates.length > 0) {
      await updateCurrentState(supabaseClient, allUpdatedStates);
    }

    // Update sync metadata with the actual maximum Snapshot_Date processed
    // For initial load, use processTo; for incremental, use maxSnapshotDate
    // CRITICAL: last_processed_date can NEVER be before today
    let newLastProcessedDate;
    if (isInitialLoad) {
      newLastProcessedDate = processTo;
    } else {
      // Use maxSnapshotDate if available, otherwise use processFrom
      const maxDateStr = maxSnapshotDate ? maxSnapshotDate.toISOString().split('T')[0] : processFrom;
      // Ensure we never set last_processed_date before today
      const maxDateObj = new Date(maxDateStr);
      newLastProcessedDate = maxDateObj >= today ? maxDateStr : todayStr;
    }
    
    await updateSyncMetadata(supabaseClient, newLastProcessedDate, totalProcessed, totalChangesDetected);

    console.log(`✅ Sync complete: Processed ${totalProcessed.toLocaleString()} rows, detected ${totalChangesDetected} changes`);
    if (!isInitialLoad) {
      const maxDateStr = maxSnapshotDate ? maxSnapshotDate.toISOString().split('T')[0] : processFrom;
      console.log(`📅 Max Snapshot_Date processed: ${maxDateStr}`);
      console.log(`📅 New last processed date: ${newLastProcessedDate} (never before today: ${todayStr})`);
    }

    return {
      success: true,
      recordsProcessed: totalProcessed,
      recordsUpdated: totalChangesDetected,
      message: `Processed ${totalProcessed.toLocaleString()} snapshot rows, detected ${totalChangesDetected} changes`
    };
  } finally {
    await pool.close();
  }
}

