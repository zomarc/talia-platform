import sql from 'mssql';
import { SyncMetadataService } from './sync-metadata-service.js';

const SYNC_TYPE = 'reservation_changes';
const CURRENT_STATE_TABLE = 'reservation_current_state';
const CHANGES_TABLE = 'reservation_changes';
const SNAPSHOT_COLUMN = 'Snapshot_Date';

/**
 * Wrapper to load current state for reservation changes
 * First gets active reservation IDs from Synapse, then loads current state
 * Exported for use by sync service batching wrapper
 */
export async function loadReservationChangesCurrentState(supabaseClient, synapseConfig, dateRange, logger = null) {
  // Pure data loading - logging handled by sync service
  
  // Get reservation IDs for sailings within the date range from stg.RES_HEADER
  const pool = await sql.connect(synapseConfig);
  
  try {
    const activeResQuery = `
      SELECT DISTINCT RES_ID
      FROM stg.RES_HEADER
      WHERE SAIL_DATE_FROM >= '${dateRange.from}'
        AND SAIL_DATE_FROM <= '${dateRange.to}'
    `;
    
    const activeResResult = await pool.request().query(activeResQuery);
    const activeResIds = activeResResult.recordset.map(row => row.RES_ID).filter(Boolean);
    
    if (activeResIds.length === 0) {
      return new Map();
    }
    
    // Load current state filtered by active reservation IDs
    return await loadCurrentState(supabaseClient, dateRange, activeResIds, logger);
  } finally {
    await pool.close();
  }
}

/**
 * Load current state of reservations from database
 * Only loads reservations that are in the provided activeResIds list
 * Returns a Map<res_id, currentState>
 * Loads all states and filters in memory to avoid URI length limits
 */
async function loadCurrentState(supabaseClient, dateRange, activeResIds, logger = null) {
  // Logging removed - SyncOperation handles all logging
  const stateMap = new Map();
  
  if (!activeResIds || activeResIds.length === 0) {
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

  return stateMap;
}

/**
 * Clean up reservations from current_state where sailing dates have passed
 * Only keep reservations for active sailings (within date range)
 * Uses reservation table to identify which res_ids to remove
 */
async function cleanupOldReservations(supabaseClient, dateRange, logger = null) {
  // Logging removed - SyncOperation handles all logging
  
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
        return;
      }
      return;
    }

    if (!oldReservations || oldReservations.length === 0) {
      return;
    }

    const resIdsToRemove = oldReservations.map(r => r.res_id).filter(Boolean);
    if (resIdsToRemove.length === 0) {
      return;
    }
    
    // Delete in batches (Supabase has limits on IN clause size)
    const batchSize = 1000;
    for (let i = 0; i < resIdsToRemove.length; i += batchSize) {
      const batch = resIdsToRemove.slice(i, i + batchSize);
      const { error } = await supabaseClient
        .from(CURRENT_STATE_TABLE)
        .delete()
        .in('res_id', batch);

      if (error) {
        // Cleanup is non-critical - continue on error
        continue;
      }
    }
  } catch (error) {
    // Cleanup failures are non-fatal - continue
  }
}

/**
 * Update current state table with new reservation states
 * Deduplicates by res_id to keep only the latest snapshot_date
 * 
 * Exported for use by sync service batching wrapper
 */
export async function updateReservationChangesCurrentState(supabaseClient, updatedStates, logger = null) {
  // Pure data update - logging handled by sync service
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
  const batchSize = 1000;
  let updated = 0;

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
    
    updated += batch.length;
  }
}

/**
 * Process a batch of snapshots and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 * Exported for use by sync service batching wrapper
 */
export function processReservationChangesBatch(batch, currentState, logger = null) {
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
 * Exported for use by sync service batching wrapper
 */
export async function insertReservationChanges(supabaseClient, changes, logger = null) {
  // Pure data insertion - logging handled by sync service
  if (changes.length === 0) return;

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const { error } = await supabaseClient.from(CHANGES_TABLE).insert(batch);
    if (error) {
      throw new Error(`Failed to insert reservation change batch: ${error.message}`);
    }
    inserted += batch.length;
  }
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
  forceFullSync = false,
  dataset = null, // Dataset name for metadata tracking
  logger = null
}) {
  // Define local log functions at the START (per SYNC_PRINCIPLES.md)
  // These are defined but not used - SyncOperation handles all logging
  // They exist for consistency and in case error handlers need them
  // Use console fallback per SYNC_PRINCIPLES.md (even though SyncOperation handles logging)
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  const logError = (...args) => logger ? logger.error(...args) : console.error(...args);
  const logWarn = (...args) => logger ? logger.warn(...args) : console.warn(...args);
  
  const startTime = Date.now();
  
  // Validate inputs early
  if (!dateRange?.from || !dateRange?.to) {
    throw new Error('Reservation changes sync requires a dateRange with from/to values');
  }

  // STEP 1: Check source for latest snapshot date FIRST
  // Logging handled by sync service
  const latestAvailableSnapshotDate = await SyncMetadataService.getLatestSnapshotDate(
    synapseConfig,
    source,
    SNAPSHOT_COLUMN
  );

  // STEP 2: Get last processed snapshot date from metadata
  const lastProcessedSnapshotDate = forceFullSync 
    ? null 
    : await SyncMetadataService.getLastProcessedSnapshotDate(supabaseClient, SYNC_TYPE);

  // STEP 3: Determine if sync is needed
  const isInitialLoad = !lastProcessedSnapshotDate || forceFullSync;
  
  // Check if we're up to date (incremental sync with no new snapshots)
  if (!isInitialLoad && latestAvailableSnapshotDate && lastProcessedSnapshotDate) {
    if (new Date(latestAvailableSnapshotDate) <= new Date(lastProcessedSnapshotDate)) {
      const duration = Date.now() - startTime;
      await SyncMetadataService.updateSyncMetadataNoData(
        supabaseClient,
        SYNC_TYPE,
        latestAvailableSnapshotDate,
        lastProcessedSnapshotDate,
        duration,
        dataset
      );
      return {
        success: true,
        recordsProcessed: 0,
        changesDetected: 0,
        duration: duration,
        message: 'No new snapshots available'
      };
    }
  }

  // STEP 4: Build WHERE clause
  // CRITICAL: Always filter by Departure_Date range (dataset requirement)
  // Use Snapshot_Date only for incremental filtering
  let processFrom, processTo;
  
  if (isInitialLoad) {
    // Initial load: use the configured date range
    processFrom = dateRange.from;
    processTo = dateRange.to;
  } else {
    // Incremental sync: process snapshots from lastProcessedSnapshotDate up to yesterday
    // Extract date part for SQL comparison (Snapshot_Date is a DATE column)
    const datePart = lastProcessedSnapshotDate.split('T')[0];
    processFrom = datePart;
    // CRITICAL: Always set an upper bound to yesterday to prevent processing infinite data
    // This ensures we only process historical snapshots, not future dates
    const yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    processTo = yesterday.toISOString().split('T')[0];
  }

  // Clean up old reservations from current_state (sailings that have passed)
  // Logging handled by sync service
  await cleanupOldReservations(supabaseClient, dateRange, logger);

  // STEP 5: Get reservation IDs for sailings within the date range from stg.RES_HEADER
  // Logging handled by sync service
  let pool = await sql.connect(synapseConfig);
  
  const activeResQuery = `
    SELECT DISTINCT RES_ID
    FROM stg.RES_HEADER
    WHERE SAIL_DATE_FROM >= '${dateRange.from}'
      AND SAIL_DATE_FROM <= '${dateRange.to}'
  `;
  
  const activeResResult = await pool.request().query(activeResQuery);
  const activeResIds = activeResResult.recordset.map(row => row.RES_ID).filter(Boolean);
  
  // Close initial connection - we'll recreate it after loading current state
  await pool.close();
  
  if (activeResIds.length === 0) {
    const duration = Date.now() - startTime;
    await SyncMetadataService.updateSyncMetadataNoData(
      supabaseClient,
      SYNC_TYPE,
      latestAvailableSnapshotDate,
      lastProcessedSnapshotDate || latestAvailableSnapshotDate,
      duration,
      dataset
    );
    return {
      success: true,
      recordsProcessed: 0,
      changesDetected: 0,
      duration: duration,
      message: 'No reservations in sailing date range'
    };
  }

  // STEP 6: Load current state from database (only for active reservations)
  // Use the exported wrapper function that handles getting activeResIds
  // Logging handled by sync service
  // This may take time, so we close the previous connection and create a new one after
  const currentState = await loadReservationChangesCurrentState(supabaseClient, synapseConfig, dateRange, logger);

  // STEP 7: Recreate connection for processing snapshots
  // Connection may have timed out while loading current state, so create fresh connection
  // Generic pattern - no table-specific code
  pool = await sql.connect(synapseConfig);
  
  // Process snapshots only for these reservations
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  let maxSnapshotDate = null; // Track actual max snapshot date processed
  const columnsSql = columns.join(', ');
  
  // Process in batches if we have too many reservation IDs
  // SQL Server can handle large IN clauses, but we use 5000 as a safe batch size for performance
  const maxInClauseSize = 5000; // Reduced from 10000 for better performance and reliability
  const resIdBatches = [];
  for (let i = 0; i < activeResIds.length; i += maxInClauseSize) {
    resIdBatches.push(activeResIds.slice(i, i + maxInClauseSize));
  }
  
  try {
    
    // Process each batch of reservation IDs
    for (let batchIdx = 0; batchIdx < resIdBatches.length; batchIdx++) {
      const resIdBatch = resIdBatches[batchIdx];
      const resIdsList = resIdBatch.map(id => id.toString()).join(', ');
      
      // Build WHERE clause - Filter by snapshot date AND reservation IDs
      // Use alias 'rhs' for RES_HEADER_SNAPSHOT
      // CRITICAL: Only process snapshots for reservations within sailing date range
      // For incremental syncs, use > lastProcessedSnapshotDate (not processFrom) to ensure we get new snapshots on the same day
      const dateCol = dateColumn.replace(/\[/g, '').replace(/\]/g, '');
      const snapshotDatePart = lastProcessedSnapshotDate ? lastProcessedSnapshotDate.split('T')[0] : null;
      const whereClause = isInitialLoad
        ? `rhs.[${dateCol}] >= '${processFrom}' AND rhs.[${dateCol}] <= '${processTo}' AND rhs.RES_ID IN (${resIdsList})`
        : `rhs.[${dateCol}] > '${snapshotDatePart}' AND rhs.[${dateCol}] <= '${processTo}' AND rhs.RES_ID IN (${resIdsList})`;
      

      // Count query needs to use the same alias and WHERE clause
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${source} rhs
        WHERE ${whereClause}
      `;

      // Validate connection before each batch query - generic pattern
      try {
        await pool.request().query('SELECT 1 as connection_test');
      } catch (connError) {
        throw new Error(`Database connection lost during sync. Please check VPN connection and ensure Azure Synapse is accessible. Original error: ${connError.message}`);
      }

      const countResult = await pool.request().query(countQuery);
      const totalRows = countResult.recordset[0].total;
      
      if (totalRows === 0) {
        continue; // Skip to next batch
      }
      
      const rowNumberQuery = buildRowNumberQuery({
        source,
        columnsSql,
        whereClause,
        rowNumberOrder
      });

      // Process snapshot rows in batches (within each reservation batch)
      const snapshotBatchCount = Math.ceil(totalRows / batchSize);
      logger?.info(`📊 Processing ${totalRows.toLocaleString()} snapshot rows in ${snapshotBatchCount} batch(es) for reservation batch ${batchIdx + 1}/${resIdBatches.length}...`);
      
      for (let offset = 0; offset < totalRows; offset += batchSize) {
        // Validate connection before each batch query - generic pattern
        try {
          await pool.request().query('SELECT 1 as connection_test');
        } catch (connError) {
          throw new Error(`Database connection lost during sync. Please check VPN connection and ensure Azure Synapse is accessible. Original error: ${connError.message}`);
        }
        
        const batchQuery = `
          SELECT *
          FROM (
            ${rowNumberQuery}
          ) AS numbered
          WHERE rn > ${offset} AND rn <= ${offset + batchSize}
          ORDER BY rn
        `;

        const batchResult = await pool.request().query(batchQuery);
        const batch = batchResult.recordset;
        if (!batch.length) {
          break;
        }

        const { changes, updatedStates } = processReservationChangesBatch(batch, currentState, logger);
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

        // Log progress periodically
        if (totalProcessed % 50000 === 0 || totalProcessed === totalRows) {
          logger?.info(`✅ Processed ${totalProcessed.toLocaleString()} snapshot rows (${allChanges.length.toLocaleString()} changes detected so far)`);
        }

        // Insert changes in batches to avoid memory issues
        if (allChanges.length >= 10000) {
          logger?.info(`💾 Flushing ${allChanges.length.toLocaleString()} changes to database...`);
          await insertReservationChanges(supabaseClient, allChanges, logger);
          allChanges.length = 0;
        }

        // Update current state in batches - CRITICAL: Update immediately after each batch
        // to ensure in-memory state matches database state for next batch comparison
        if (allUpdatedStates.length >= 10000) {
          logger?.info(`💾 Flushing ${allUpdatedStates.length.toLocaleString()} state updates to database...`);
          await updateReservationChangesCurrentState(supabaseClient, allUpdatedStates, logger);
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
        }
      }
    }

    // Insert remaining changes
    if (allChanges.length > 0) {
      logger?.info(`💾 Inserting final ${allChanges.length.toLocaleString()} changes...`);
      await insertReservationChanges(supabaseClient, allChanges, logger);
    }

    // Update remaining states
    if (allUpdatedStates.length > 0) {
      logger?.info(`💾 Updating final ${allUpdatedStates.length.toLocaleString()} state records...`);
      await updateReservationChangesCurrentState(supabaseClient, allUpdatedStates, logger);
    }
    
    logger?.info(`✅ Completed processing: ${totalProcessed.toLocaleString()} snapshot rows, ${allChanges.length.toLocaleString()} changes detected`);

    // STEP 8: Update metadata
    // Use the actual max snapshot date processed, or fallback to lastProcessedSnapshotDate if no data
    // Convert to datetime at midnight
    let finalProcessedSnapshotDate;
    if (maxSnapshotDate) {
      const date = new Date(maxSnapshotDate);
      date.setHours(0, 0, 0, 0); // Set to midnight
      finalProcessedSnapshotDate = date.toISOString();
    } else if (lastProcessedSnapshotDate) {
      // Ensure it's at midnight
      const date = new Date(lastProcessedSnapshotDate);
      date.setHours(0, 0, 0, 0);
      finalProcessedSnapshotDate = date.toISOString();
    } else if (latestAvailableSnapshotDate) {
      finalProcessedSnapshotDate = latestAvailableSnapshotDate;
    } else {
      // Fallback to today at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      finalProcessedSnapshotDate = today.toISOString();
    }
    
    const duration = Date.now() - startTime;
    
    await SyncMetadataService.updateSyncMetadata(
      supabaseClient,
      SYNC_TYPE,
      finalProcessedSnapshotDate,
      latestAvailableSnapshotDate || finalProcessedSnapshotDate,
      totalProcessed,
      allChanges.length,
      duration,
      dataset
    );

    return {
      success: true,
      recordsProcessed: totalProcessed,
      changesDetected: allChanges.length,
      duration: duration,
      message: `Processed ${totalProcessed.toLocaleString()} snapshot rows, detected ${allChanges.length} changes`
    };
  } catch (error) {
    // Even on error, try to update metadata
    try {
      const duration = Date.now() - startTime;
      // Create fallback snapshot date at midnight
      const fallbackDate = new Date(dateRange.from);
      fallbackDate.setHours(0, 0, 0, 0);
      const fallbackSnapshotDate = fallbackDate.toISOString();
      
      await SyncMetadataService.updateSyncMetadataNoData(
        supabaseClient,
        SYNC_TYPE,
        latestAvailableSnapshotDate || fallbackSnapshotDate,
        lastProcessedSnapshotDate || fallbackSnapshotDate,
        duration,
        dataset
      );
    } catch (metadataError) {
      // Ignore metadata update errors on sync failure
    }
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}
