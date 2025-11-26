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
async function updateSyncMetadata(supabaseClient, lastProcessedDate, recordsProcessed, changesDetected, durationMs = null) {
  const { error } = await supabaseClient
    .from(METADATA_TABLE)
    .upsert({
      sync_type: SYNC_TYPE,
      last_processed_date: lastProcessedDate,
      records_processed: recordsProcessed,
      changes_detected: changesDetected,
      duration_ms: durationMs,
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
 * Load current state of reservations from database
 * Only loads reservations that are in the provided activeResIds list
 * Returns a Map<res_id, currentState>
 * Loads all states and filters in memory to avoid URI length limits
 */
async function loadCurrentState(supabaseClient, dateRange, activeResIds) {
  console.log('📥 Loading current reservation state from database...');
  const stateMap = new Map();
  
  if (!activeResIds || activeResIds.length === 0) {
    console.log('✅ No active reservations to load state for');
    return stateMap;
  }

  // Create a Set for fast lookup
  const activeResIdsSet = new Set(activeResIds.map(id => Number(id)));

  // Load all current states and filter in memory (avoids URI length limits)
  // Paginate through all records
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  let totalLoaded = 0;
  let filteredCount = 0;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to load current state: ${error.message}`);
    }

    if (data && data.length > 0) {
      for (const row of data) {
        totalLoaded++;
        // Only include states for active reservations
        if (activeResIdsSet.has(Number(row.res_id))) {
          stateMap.set(row.res_id, {
            snapshot_date: row.snapshot_date,
            sail_code: row.sail_code,
            agency_id: row.agency_id,
            group_id: row.group_id,
            guest_count: row.guest_count
          });
          filteredCount++;
        }
      }
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Loaded ${stateMap.size} reservation states (filtered from ${totalLoaded} total rows)`);
  return stateMap;
}

/**
 * Clean up reservations from current_state where sailing dates have passed
 * Only keep reservations for active sailings (within date range)
 * Uses reservation table to identify which res_ids to remove
 */
async function cleanupOldReservations(supabaseClient, dateRange) {
  console.log(`🧹 Cleaning up reservations with sailing dates outside range ${dateRange.from} to ${dateRange.to}...`);
  
  try {
    // Get reservations from reservation table that are outside the sailing date range
    // We'll use the reservation table to find which res_ids to remove from current_state
    const { data: oldReservations, error: fetchError } = await supabaseClient
      .from('reservation')
      .select('res_id')
      .or(`sail_from_date.lt.${dateRange.from},sail_from_date.gt.${dateRange.to}`);

    if (fetchError) {
      // If reservation table doesn't exist or has no data, skip cleanup
      if (fetchError.code === 'PGRST116' || fetchError.code === '42P01') {
        console.log('ℹ️  Reservation table not available for cleanup check - skipping');
        return;
      }
      console.warn(`⚠️  Could not fetch old reservations for cleanup: ${fetchError.message}`);
      return;
    }

    if (!oldReservations || oldReservations.length === 0) {
      console.log('✅ No old reservations to clean up');
      return;
    }

    const resIdsToRemove = oldReservations.map(r => r.res_id).filter(Boolean);
    if (resIdsToRemove.length === 0) {
      console.log('✅ No old reservations to clean up');
      return;
    }

    console.log(`🗑️  Removing ${resIdsToRemove.length} old reservations from current_state...`);
    
    // Delete in batches (Supabase has limits on IN clause size)
    const batchSize = 1000;
    let deletedCount = 0;
    for (let i = 0; i < resIdsToRemove.length; i += batchSize) {
      const batch = resIdsToRemove.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from(CURRENT_STATE_TABLE)
        .delete()
        .in('res_id', batch);

      if (error) {
        console.warn(`⚠️  Error cleaning up batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        deletedCount += batch.length;
      }
    }

    console.log(`✅ Cleaned up ${deletedCount} old reservations from current_state`);
  } catch (error) {
    // Don't fail the sync if cleanup fails
    console.warn(`⚠️  Cleanup failed (non-fatal): ${error.message}`);
  }
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

  // Sort batch by res_id, then by snapshot_date (ascending - oldest first)
  const sorted = batch.sort((a, b) => {
    if (a.RES_ID !== b.RES_ID) {
      return a.RES_ID - b.RES_ID;
    }
    return new Date(a.Snapshot_Date) - new Date(b.Snapshot_Date);
  });

  // First pass: Process all rows sequentially to detect changes correctly
  // (We need to process chronologically to detect intermediate changes)
  for (const row of sorted) {
    const resId = row.RES_ID;
    const snapshotDate = row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null;

    const current = {
      snapshot_date: snapshotDate,
      res_id: resId,
      sail_code: null, // Not available in RES_HEADER_SNAPSHOT (may need to join or derive)
      agency_id: row.AGENCY_ID || null,
      group_id: row.GROUP_ID || null,
      guest_count: row.RES_GUEST_COUNT ? parseFloat(row.RES_GUEST_COUNT) : null,
    };

    const previous = currentState.get(resId);

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

  // Second pass: Extract only the LATEST state per reservation for updatedStates
  // This prevents adding 50,000 states when we only have ~590 unique reservations
  const latestStatePerReservation = new Map();
  for (const row of sorted) {
    const resId = row.RES_ID;
    const snapshotDate = row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null;
    
    const existing = latestStatePerReservation.get(resId);
    if (!existing || new Date(snapshotDate) > new Date(existing.snapshot_date)) {
      latestStatePerReservation.set(resId, {
        res_id: resId,
        snapshot_date: snapshotDate,
        sail_code: null, // Not available in RES_HEADER_SNAPSHOT
        agency_id: row.AGENCY_ID || null,
        group_id: row.GROUP_ID || null,
        guest_count: row.RES_GUEST_COUNT ? parseFloat(row.RES_GUEST_COUNT) : null,
        updated_at: new Date().toISOString()
      });
    }
  }

  // Only add the latest state per reservation
  updatedStates.push(...Array.from(latestStatePerReservation.values()));

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
 * Uses table alias for stg.RES_HEADER_SNAPSHOT
 */
function buildRowNumberQuery({ source, columnsSql, whereClause, rowNumberOrder }) {
  const order = (rowNumberOrder && rowNumberOrder.length > 0)
    ? rowNumberOrder.join(', ')
    : '[RES_ID]';

  // Use table alias for RES_HEADER_SNAPSHOT
  const tableAlias = 'rhs'; // RES_HEADER_SNAPSHOT alias
  
  // Map columns to use alias - handle brackets and table prefixes
  const columnsWithAlias = columnsSql.split(',').map(col => {
    const trimmed = col.trim();
    // Remove brackets and add alias
    const colName = trimmed.replace(/\[/g, '').replace(/\]/g, '');
    return `${tableAlias}.[${colName}]`;
  }).join(', ');

  // Map order columns to use alias
  const orderWithAlias = order.split(',').map(col => {
    const trimmed = col.trim();
    const colName = trimmed.replace(/\[/g, '').replace(/\]/g, '');
    return `${tableAlias}.[${colName}]`;
  }).join(', ');

  return `
    SELECT ${columnsWithAlias}, ROW_NUMBER() OVER (ORDER BY ${orderWithAlias}) as rn
    FROM ${source} ${tableAlias}
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
  const startTime = Date.now();
  
  if (!dateRange?.from || !dateRange?.to) {
    throw new Error('Reservation changes sync requires a dateRange with from/to values');
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
    await updateSyncMetadata(supabaseClient, lastProcessedDate, 0, 0, null);
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
    // Incremental sync: process snapshots from last_processed_date up to yesterday
    // This ensures we catch up if behind, but don't process future dates
    const lastProcessedDateObj = new Date(lastProcessedDate);
    const yesterdayObj = new Date(yesterdayStr);
    
    // Process from last_processed_date (or yesterday if we're behind)
    processFrom = lastProcessedDateObj <= yesterdayObj ? lastProcessedDate : yesterdayStr;
    // CRITICAL: Always set an upper bound to yesterday to prevent processing infinite data
    // This ensures we only process historical snapshots, not future dates
    processTo = yesterdayStr;
    console.log(`🔄 INCREMENTAL UPDATE: Processing snapshots from ${processFrom} to ${processTo} (yesterday)`);
  }

  // Clean up old reservations from current_state (sailings that have passed)
  await cleanupOldReservations(supabaseClient, dateRange);

  // STEP 1: Get reservation IDs for sailings within the date range from stg.RES_HEADER
  console.log(`🔍 Finding reservations for sailings ${dateRange.from} to ${dateRange.to}...`);
  const pool = await sql.connect(synapseConfig);
  
  const activeResQuery = `
    SELECT DISTINCT RES_ID
    FROM stg.RES_HEADER
    WHERE SAIL_DATE_FROM >= '${dateRange.from}'
      AND SAIL_DATE_FROM <= '${dateRange.to}'
  `;
  
  const activeResResult = await pool.request().query(activeResQuery);
  const activeResIds = activeResResult.recordset.map(row => row.RES_ID).filter(Boolean);
  console.log(`✅ Found ${activeResIds.length} reservations for sailings in date range`);
  
  if (activeResIds.length === 0) {
    console.log('✅ No reservations found - nothing to process');
    await pool.close();
    return {
      success: true,
      recordsProcessed: 0,
      changesDetected: 0,
      message: 'No reservations in sailing date range'
    };
  }

  // STEP 2: Load current state from database (only for active reservations)
  const currentState = await loadCurrentState(supabaseClient, dateRange, activeResIds);

  // STEP 3: Process snapshots only for these reservations
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  let maxSnapshotDate = null;
  const columnsSql = columns.join(', ');
  
  // Process in batches if we have too many reservation IDs
  // SQL Server can handle large IN clauses, but we use 5000 as a safe batch size for performance
  const maxInClauseSize = 5000; // Reduced from 10000 for better performance and reliability
  const resIdBatches = [];
  for (let i = 0; i < activeResIds.length; i += maxInClauseSize) {
    resIdBatches.push(activeResIds.slice(i, i + maxInClauseSize));
  }
  
  console.log(`📋 Processing ${activeResIds.length} reservations in ${resIdBatches.length} batch(es) of up to ${maxInClauseSize} reservations each`);
  console.log(`📅 Snapshot date range: ${processFrom} to ${processTo}`);
  console.log(`📅 Sailing date range: ${dateRange.from} to ${dateRange.to}`);
  
  try {
    // Process each batch of reservation IDs
    for (let batchIdx = 0; batchIdx < resIdBatches.length; batchIdx++) {
      const resIdBatch = resIdBatches[batchIdx];
      const resIdsList = resIdBatch.map(id => id.toString()).join(', ');
      
      // Build WHERE clause - Filter by snapshot date AND reservation IDs
      // Use alias 'rhs' for RES_HEADER_SNAPSHOT
      // CRITICAL: Only process snapshots for reservations within sailing date range
      const dateCol = dateColumn.replace(/\[/g, '').replace(/\]/g, '');
      const whereClause = `rhs.[${dateCol}] >= '${processFrom}' AND rhs.[${dateCol}] <= '${processTo}' AND rhs.RES_ID IN (${resIdsList})`;
      
      console.log(`\n📦 Processing reservation batch ${batchIdx + 1}/${resIdBatches.length} (${resIdBatch.length} reservations)...`);

      // Count query needs to use the same alias and WHERE clause
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${source} rhs
        WHERE ${whereClause}
      `;

      const countResult = await pool.request().query(countQuery);
      const totalRows = countResult.recordset[0].total;
      console.log(`  📊 Found ${totalRows.toLocaleString()} snapshot rows for this batch`);
      
      if (totalRows === 0) {
        console.log(`  ✅ No snapshots found for this batch - skipping`);
        continue; // Skip to next batch
      }
      
      if (totalRows > 500000) {
        console.log(`  ⚠️  WARNING: Large batch (${totalRows.toLocaleString()} rows) - this may take a while`);
      }
      
      const rowNumberQuery = buildRowNumberQuery({
        source,
        columnsSql,
        whereClause,
        rowNumberOrder
      });

      // Process snapshot rows in batches (within each reservation batch)
      const snapshotBatchCount = Math.ceil(totalRows / batchSize);
      console.log(`  📥 Processing ${totalRows.toLocaleString()} snapshot rows in ${snapshotBatchCount} batch(es) of ${batchSize.toLocaleString()}...`);
      
      for (let offset = 0; offset < totalRows; offset += batchSize) {
        const batchQuery = `
          SELECT *
          FROM (
            ${rowNumberQuery}
          ) AS numbered
          WHERE rn > ${offset} AND rn <= ${offset + batchSize}
          ORDER BY rn
        `;

        const batchNum = Math.floor(offset / batchSize) + 1;
        console.log(`    Processing snapshot batch ${batchNum}/${snapshotBatchCount} (rows ${offset + 1} to ${Math.min(offset + batchSize, totalRows)})...`);
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
          if (row.Snapshot_Date) {
            const snapshotDate = new Date(row.Snapshot_Date);
            if (!maxSnapshotDate || snapshotDate > maxSnapshotDate) {
              maxSnapshotDate = snapshotDate;
            }
          }
        }

        // Insert changes in batches to avoid memory issues
        if (allChanges.length >= 10000) {
          console.log(`    💾 Flushing ${allChanges.length.toLocaleString()} changes to database...`);
          await insertChanges(supabaseClient, allChanges);
          allChanges.length = 0;
        }

        // Update current state in batches - CRITICAL: Update immediately after each batch
        // to ensure in-memory state matches database state for next batch comparison
        if (allUpdatedStates.length >= 10000) {
          console.log(`    💾 Flushing ${allUpdatedStates.length.toLocaleString()} state updates to database...`);
          await updateCurrentState(supabaseClient, allUpdatedStates);
          // Update in-memory state map with the states we just saved
          // This is more efficient than reloading from database
          for (const state of allUpdatedStates) {
            currentState.set(state.res_id, {
              snapshot_date: state.snapshot_date,
              sail_code: state.sail_code,
              agency_id: state.agency_id,
              group_id: state.group_id,
              guest_count: state.guest_count
            });
          }
          allUpdatedStates.length = 0;
          console.log(`    ✅ In-memory state map updated (${currentState.size} reservations)`);
        }
      }
      
      console.log(`  ✅ Completed reservation batch ${batchIdx + 1}/${resIdBatches.length} (${totalProcessed.toLocaleString()} total rows processed so far)`);
    }

    // Insert remaining changes
    if (allChanges.length > 0) {
      await insertChanges(supabaseClient, allChanges);
    }

    // Update remaining states
    if (allUpdatedStates.length > 0) {
      await updateCurrentState(supabaseClient, allUpdatedStates);
    }

    // Update sync metadata with the actual maximum Snapshot_Date processed
    // For initial load, use processTo; for incremental, use processTo (yesterday)
    // CRITICAL: last_processed_date should be set to the last date we actually processed
    let newLastProcessedDate;
    if (isInitialLoad) {
      newLastProcessedDate = processTo;
    } else {
      // For incremental syncs, use processTo (yesterday) as we always process up to yesterday
      // Use maxSnapshotDate if it's earlier than processTo (in case there's no data for yesterday)
      const maxDateStr = maxSnapshotDate ? maxSnapshotDate.toISOString().split('T')[0] : processTo;
      const maxDateObj = new Date(maxDateStr);
      const processToObj = new Date(processTo);
      // Use the earlier of maxSnapshotDate or processTo (but never before processFrom)
      newLastProcessedDate = maxDateObj <= processToObj ? maxDateStr : processTo;
    }
    
    const duration = Date.now() - startTime;
    await updateSyncMetadata(supabaseClient, newLastProcessedDate, totalProcessed, allChanges.length, duration);

    console.log(`✅ Sync complete: Processed ${totalProcessed} rows, detected ${allChanges.length} changes`);
    if (!isInitialLoad) {
      const maxDateStr = maxSnapshotDate ? maxSnapshotDate.toISOString().split('T')[0] : processFrom;
      console.log(`📅 Max Snapshot_Date processed: ${maxDateStr}`);
      console.log(`📅 New last processed date: ${newLastProcessedDate} (never before today: ${todayStr})`);
    }

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
