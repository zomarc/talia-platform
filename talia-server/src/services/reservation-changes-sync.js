import sql from 'mssql';

const SYNC_TYPE = 'reservation_changes';
const CURRENT_STATE_TABLE = 'reservation_current_state';
const CHANGES_TABLE = 'reservation_changes';
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
 * Load current state of all reservations from database
 * Returns a Map<res_id, currentState>
 * Paginates to load all records (Supabase defaults to 1000 row limit)
 */
async function loadCurrentState(supabaseClient) {
  console.log('📥 Loading current reservation state from database...');
  const stateMap = new Map();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error, count } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .select('*', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to load current state: ${error.message}`);
    }

    if (data && data.length > 0) {
      for (const row of data) {
        stateMap.set(row.res_id, {
          snapshot_date: row.snapshot_date,
          sail_code: row.sail_code,
          agency_id: row.agency_id,
          group_id: row.group_id,
          guest_count: row.guest_count
        });
      }
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Loaded ${stateMap.size} reservation states`);
  return stateMap;
}

/**
 * Update current state table with new reservation states
 * Deduplicates by res_id to keep only the latest snapshot_date
 */
async function updateCurrentState(supabaseClient, updatedStates) {
  if (updatedStates.length === 0) return;

  // Deduplicate: keep only the latest snapshot_date for each res_id
  const stateMap = new Map();
  for (const state of updatedStates) {
    const existing = stateMap.get(state.res_id);
    if (!existing || new Date(state.snapshot_date) > new Date(existing.snapshot_date)) {
      stateMap.set(state.res_id, state);
    }
  }

  const deduplicatedStates = Array.from(stateMap.values());
  console.log(`📝 Updating ${deduplicatedStates.length} reservation states (deduplicated from ${updatedStates.length})...`);
  const batchSize = 1000;

  for (let i = 0; i < deduplicatedStates.length; i += batchSize) {
    const batch = deduplicatedStates.slice(i, i + batchSize);
    const { error } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .upsert(batch, {
        onConflict: 'res_id'
      });

    if (error) {
      throw new Error(`Failed to update current state: ${error.message}`);
    }
  }

  console.log(`✅ Updated ${deduplicatedStates.length} reservation states`);
}

/**
 * Process a batch of snapshots and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 */
function processChangesBatch(batch, currentState) {
  const changes = [];
  const updatedStates = [];

  // Sort batch by res_id, then by snapshot_date
  const sorted = batch.sort((a, b) => {
    if (a.RES_ID !== b.RES_ID) {
      return a.RES_ID - b.RES_ID;
    }
    return new Date(a.Snapshot_Date) - new Date(b.Snapshot_Date);
  });

  for (const row of sorted) {
    const resId = row.RES_ID;
    const snapshotDate = row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null;

    const current = {
      snapshot_date: snapshotDate,
      res_id: resId,
      sail_code: row.Sail_code || null,
      agency_id: row.Agency_ID || null,
      group_id: row.Group_ID || null,
      guest_count: row.Guest_Count ? parseFloat(row.Guest_Count) : null,
    };

    const previous = currentState.get(resId);

    // Always update current state with latest snapshot
    updatedStates.push({
      res_id: resId,
      snapshot_date: current.snapshot_date,
      sail_code: current.sail_code,
      agency_id: current.agency_id,
      group_id: current.group_id,
      guest_count: current.guest_count,
      updated_at: new Date().toISOString()
    });

    // Only store a change if there's a previous state AND something changed
    if (previous) {
      const hasChange = 
        previous.guest_count !== current.guest_count ||
        previous.sail_code !== current.sail_code ||
        previous.agency_id !== current.agency_id ||
        previous.group_id !== current.group_id;

      if (hasChange) {
        changes.push({
          snapshot_date: current.snapshot_date,
          res_id: resId,
          sail_code: current.sail_code,
          agency_id: current.agency_id,
          group_id: current.group_id,
          guest_count: current.guest_count,
          guest_count_delta: (current.guest_count || 0) - (previous.guest_count || 0),
          sail_code_changed: previous.sail_code !== current.sail_code,
          agency_id_changed: previous.agency_id !== current.agency_id,
          group_id_changed: previous.group_id !== current.group_id,
        });
      }
    }
    // Note: We don't store initial state as a change - it's just the baseline

    // Update in-memory state for next comparison
    currentState.set(resId, {
      snapshot_date: current.snapshot_date,
      sail_code: current.sail_code,
      agency_id: current.agency_id,
      group_id: current.group_id,
      guest_count: current.guest_count
    });
  }

  return { changes, updatedStates };
}

/**
 * Insert changes into reservation_changes table
 */
async function insertChanges(supabaseClient, changes) {
  if (changes.length === 0) return;

  console.log(`📥 Inserting ${changes.length} reservation change rows...`);
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const { error } = await supabaseClient.from(CHANGES_TABLE).insert(batch);
    if (error) {
      throw new Error(`Failed to insert reservation change batch: ${error.message}`);
    }
    inserted += batch.length;
    console.log(`   📊 Inserted ${inserted}/${changes.length} reservation change rows`);
  }

  console.log(`✅ Reservation change insert complete (${inserted} rows)`);
}

/**
 * Build row number query for pagination
 */
function buildRowNumberQuery({ source, columnsSql, whereClause, rowNumberOrder }) {
  const order = (rowNumberOrder && rowNumberOrder.length > 0)
    ? rowNumberOrder.join(', ')
    : '[RES_ID]';

  return `
    SELECT ${columnsSql}, ROW_NUMBER() OVER (ORDER BY ${order}) as rn
    FROM ${source}
    ${whereClause ? `WHERE ${whereClause}` : ''}
  `;
}

/**
 * Sync reservation changes incrementally
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
export async function syncReservationChanges({
  synapseConfig,
  supabaseClient,
  source,
  columns,
  dateColumn,
  supabaseDateColumn,
  dateRange,
  targetTable,
  rowNumberOrder,
  batchSize = 50000,
  forceFullSync = false
}) {
  if (!dateRange?.from || !dateRange?.to) {
    throw new Error('Reservation changes sync requires a dateRange with from/to values');
  }

  // Get last processed date
  const lastProcessedDate = forceFullSync ? null : await getLastProcessedDate(supabaseClient);
  
  // Determine actual date range to process
  const processFrom = lastProcessedDate && !forceFullSync 
    ? new Date(lastProcessedDate) > new Date(dateRange.from)
      ? lastProcessedDate 
      : dateRange.from
    : dateRange.from;
  
  const processTo = dateRange.to;

  // If incremental and no new data, skip
  if (lastProcessedDate && !forceFullSync && processFrom >= processTo) {
    console.log(`✅ No new data to process. Last processed: ${lastProcessedDate}, Requested to: ${processTo}`);
    return {
      success: true,
      recordsProcessed: 0,
      changesDetected: 0,
      message: 'No new data to process'
    };
  }

  const isInitialLoad = !lastProcessedDate || forceFullSync;
  console.log(`${isInitialLoad ? '🔄 INITIAL LOAD' : '🔄 INCREMENTAL UPDATE'}: Processing snapshots from ${processFrom} to ${processTo}`);

  // Load current state from database
  const currentState = await loadCurrentState(supabaseClient);

  const pool = await sql.connect(synapseConfig);
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  const columnsSql = columns.join(', ');
  const whereClause = `${dateColumn} >= '${processFrom}' AND ${dateColumn} <= '${processTo}'`;

  try {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ${source}
      WHERE ${whereClause}
    `;

    const countResult = await pool.request().query(countQuery);
    const totalRows = countResult.recordset[0].total;
    console.log(`📊 Total rows to process: ${totalRows}`);

    if (totalRows === 0) {
      console.log('✅ No rows to process');
      return {
        success: true,
        recordsProcessed: 0,
        changesDetected: 0,
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

      console.log(`  Processing batch ${offset + 1} to ${Math.min(offset + batchSize, totalRows)}...`);
      const batchResult = await pool.request().query(batchQuery);
      const batch = batchResult.recordset;
      if (!batch.length) {
        break;
      }

      const { changes, updatedStates } = processChangesBatch(batch, currentState);
      allChanges.push(...changes);
      allUpdatedStates.push(...updatedStates);
      totalProcessed += batch.length;

      // Insert changes in batches to avoid memory issues
      if (allChanges.length >= 10000) {
        await insertChanges(supabaseClient, allChanges);
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
    }

    // Update remaining states
    if (allUpdatedStates.length > 0) {
      await updateCurrentState(supabaseClient, allUpdatedStates);
    }

    // Update sync metadata
    await updateSyncMetadata(supabaseClient, processTo, totalProcessed, allChanges.length);

    console.log(`✅ Sync complete: Processed ${totalProcessed} rows, detected ${allChanges.length} changes`);

    return {
      success: true,
      recordsProcessed: totalProcessed,
      changesDetected: allChanges.length,
      message: `Processed ${totalProcessed} snapshot rows, detected ${allChanges.length} changes`
    };
  } finally {
    await pool.close();
  }
}
