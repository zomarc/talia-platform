import sql from 'mssql';
import { SyncMetadataService } from './sync-metadata-service.js';

const SYNC_TYPE = 'competitor';
const CURRENT_STATE_TABLE = 'competitor_current_state';
const TARGET_TABLE = 'competitor';
const SNAPSHOT_COLUMN = 'Snapshot_Date';
const DEPARTURE_DATE_COLUMN = 'Departure_Date';

/**
 * Extract first port from ports string
 * Handles various separators: comma, semicolon, pipe, newline, arrows
 * Extracts just the port name (removes country, parentheses, etc.)
 */
function extractDeparturePort(ports) {
  if (!ports) return null;
  
  const portString = String(ports).trim();
  if (!portString) return null;
  
  // Try different separators in order of preference
  const separators = [';', ',', '|', '\n', ' -> ', ' - ', ' → ', ' →→ '];
  
  let firstPort = null;
  
  for (const sep of separators) {
    if (portString.includes(sep)) {
      const parts = portString.split(sep);
      // Get first non-empty part
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && trimmed.length > 0 && trimmed.length < 100) {
          firstPort = trimmed;
          break;
        }
      }
      if (firstPort) break;
    }
  }
  
  // If no separator found, use the whole string if reasonable
  if (!firstPort && portString.length < 50 && !portString.includes(';') && !portString.includes(',')) {
    firstPort = portString;
  }
  
  if (!firstPort) return null;
  
  // Clean up the port name
  return firstPort
    // Remove "Port of" prefix
    .replace(/^Port\s+of\s+/i, '')
    .replace(/^Port\s+/i, '')
    // Remove country in parentheses: "Athens (Piraeus), Greece" -> "Athens"
    .replace(/\s*\([^)]+\)[^,]*/g, '')
    // Remove country after comma: "Venice, Italy" -> "Venice"
    .replace(/,\s*[^,]+$/, '')
    // Remove "Port" suffix
    .replace(/\s+Port$/i, '')
    .trim();
}

/**
 * Generate a unique key for a competitor record
 * Key format: date|duration|cruiseline|destination|ship|market
 * Works with both raw Synapse rows and transformed state objects
 */
function getCompetitorKey(row) {
  // Handle both raw rows (with Departure_Date as Date object) and transformed rows (with departure_date as string)
  const departureDate = row.Departure_Date 
    ? (row.Departure_Date instanceof Date 
        ? row.Departure_Date.toISOString().split('T')[0] 
        : new Date(row.Departure_Date).toISOString().split('T')[0])
    : (row.departure_date || 'NULL');
  
  const duration = row.Duration || row.duration || 'NULL';
  const cruiseLine = row.Cruise_Line || row.cruise_line || 'NULL';
  const destination = row.Destination || row.destination || 'NULL';
  const shipName = row.Ship_Name || row.ship_name || 'NULL';
  const market = row.Market || row.market || 'NULL';
  
  return `${departureDate}|${duration}|${cruiseLine}|${destination}|${shipName}|${market}`;
}

/**
 * Load current state of all competitors from database
 * Returns a Map<competitor_key, currentState>
 */
async function loadCurrentState(supabaseClient) {
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
        const key = getCompetitorKey(row);
        stateMap.set(key, {
          snapshot_date: row.snapshot_date,
          departure_date: row.departure_date,
          cruise_line: row.cruise_line,
          ship_name: row.ship_name,
          market: row.market,
          source: row.source,
          duration: row.duration,
          lowest_price: row.lowest_price,
          lowest_inside: row.lowest_inside,
          lowest_outside: row.lowest_outside,
          lowest_balcony: row.lowest_balcony,
          lowest_suite: row.lowest_suite,
          taxes: row.taxes
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
 * Update current state table with new competitor states
 * For initial load: stores all unique competitor records
 * For incremental: updates existing records and adds new ones
 */
async function updateCurrentState(supabaseClient, updatedStates) {
  if (updatedStates.length === 0) return;

  // For initial load (all same snapshot_date), just store all unique records
  // For incremental, deduplicate by keeping latest snapshot_date per competitor_key
  const uniqueSnapshotDates = new Set(updatedStates.map(s => s.snapshot_date));
  const isInitialLoad = uniqueSnapshotDates.size === 1;

  let statesToUpdate;
  if (isInitialLoad) {
    // Initial load: all records are unique by competitor_key, just deduplicate by key
    const stateMap = new Map();
    for (const state of updatedStates) {
      const key = state.competitor_key;
      // Keep the first occurrence (they're all from same snapshot anyway)
      if (!stateMap.has(key)) {
        stateMap.set(key, state);
      }
    }
    statesToUpdate = Array.from(stateMap.values());
  } else {
    // Incremental: keep only latest snapshot_date for each competitor_key
    const stateMap = new Map();
    for (const state of updatedStates) {
      const key = state.competitor_key;
      const existing = stateMap.get(key);
      if (!existing || new Date(state.snapshot_date) > new Date(existing.snapshot_date)) {
        stateMap.set(key, state);
      }
    }
    statesToUpdate = Array.from(stateMap.values());
  }

  const batchSize = 1000;

  for (let i = 0; i < statesToUpdate.length; i += batchSize) {
    const batch = statesToUpdate.slice(i, i + batchSize);
    const { error } = await supabaseClient
      .from(CURRENT_STATE_TABLE)
      .upsert(batch, {
        onConflict: 'competitor_key'
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
  const ports = row.Ports || null;
  const departurePort = extractDeparturePort(ports);
  
  return {
    competitor_key: getCompetitorKey(row),
    currency: row.Currency || null,
    departure_date: row.Departure_Date ? new Date(row.Departure_Date).toISOString().split('T')[0] : null,
    departure_port: departurePort,
    duration: row.Duration ? parseFloat(row.Duration) : null,
    week_number: row.Week_Number ? parseFloat(row.Week_Number) : null,
    year: row.Year ? parseFloat(row.Year) : null,
    lowest_price: row.Lowest_Price ? parseFloat(row.Lowest_Price) : null,
    lowest_inside: row.Lowest_Inside ? parseFloat(row.Lowest_Inside) : null,
    lowest_outside: row.Lowest_Outside ? parseFloat(row.Lowest_Outside) : null,
    lowest_balcony: row.Lowest_Balcony ? parseFloat(row.Lowest_Balcony) : null,
    lowest_suite: row.Lowest_Suite ? parseFloat(row.Lowest_Suite) : null,
    taxes: row.Taxes ? parseFloat(row.Taxes) : null,
    cruise_line: row.Cruise_Line || null,
    destination: row.Destination || null,
    cruise_name: row.Cruise_Name || null,
    ship_name: row.Ship_Name || null,
    ports: ports,
    market: row.Market || null,
    source: row.Source || null,
    snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Process a batch of competitor records and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 */
function processChangesBatch(batch, currentState) {
  const changes = [];
  const updatedStates = [];

  // Sort batch by competitor_key, then by snapshot_date
  const sorted = batch.sort((a, b) => {
    const keyA = getCompetitorKey(a);
    const keyB = getCompetitorKey(b);
    if (keyA !== keyB) {
      return keyA.localeCompare(keyB);
    }
    return new Date(a.Snapshot_Date) - new Date(b.Snapshot_Date);
  });

  for (const row of sorted) {
    const transformed = transformRow(row);
    const key = transformed.competitor_key;
    const previous = currentState.get(key);

    // Always update current state with latest snapshot
    updatedStates.push(transformed);

    // Only store a change if there's a previous state AND something changed
    if (previous) {
      const hasChange = 
        previous.lowest_price !== transformed.lowest_price ||
        previous.lowest_inside !== transformed.lowest_inside ||
        previous.lowest_outside !== transformed.lowest_outside ||
        previous.lowest_balcony !== transformed.lowest_balcony ||
        previous.lowest_suite !== transformed.lowest_suite ||
        previous.taxes !== transformed.taxes ||
        previous.currency !== transformed.currency ||
        previous.cruise_line !== transformed.cruise_line ||
        previous.destination !== transformed.destination ||
        previous.ship_name !== transformed.ship_name ||
        previous.market !== transformed.market ||
        previous.departure_port !== transformed.departure_port ||
        previous.source !== transformed.source;

      if (hasChange) {
        // Remove updated_at from changes (it's only for current_state table)
        const { updated_at, ...changeData } = transformed;
        changes.push({
          ...changeData,
          lowest_price_delta: (transformed.lowest_price || 0) - (previous.lowest_price || 0),
          lowest_inside_delta: (transformed.lowest_inside || 0) - (previous.lowest_inside || 0),
          lowest_outside_delta: (transformed.lowest_outside || 0) - (previous.lowest_outside || 0),
          lowest_balcony_delta: (transformed.lowest_balcony || 0) - (previous.lowest_balcony || 0),
          lowest_suite_delta: (transformed.lowest_suite || 0) - (previous.lowest_suite || 0),
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
 * Insert changes into competitor table
 */
async function insertChanges(supabaseClient, changes) {
  if (changes.length === 0) return;

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const { error } = await supabaseClient.from(TARGET_TABLE).insert(batch);
    if (error) {
      throw new Error(`Failed to insert competitor change batch: ${error.message}`);
    }
    inserted += batch.length;
  }
}

/**
 * Build WHERE clause for competitor sync
 * 
 * CRITICAL: Always filter by Departure_Date range (dataset requirement)
 * Use Snapshot_Date only for incremental filtering
 * 
 * @param {string} departureDateFrom - Start of departure date range
 * @param {string} departureDateTo - End of departure date range
 * @param {string|null} lastProcessedSnapshotDate - Last processed snapshot date (for incremental)
 * @returns {string} WHERE clause
 */
function buildWhereClause(departureDateFrom, departureDateTo, lastProcessedSnapshotDate) {
  // Always filter by departure date range (dataset requirement)
  let whereClause = `${DEPARTURE_DATE_COLUMN} >= '${departureDateFrom}' AND ${DEPARTURE_DATE_COLUMN} <= '${departureDateTo}'`;
  
  // For incremental syncs, also filter by snapshot date
  // Convert datetime to date string for SQL comparison (Snapshot_Date is a DATE column)
  if (lastProcessedSnapshotDate) {
    const datePart = lastProcessedSnapshotDate.split('T')[0]; // Extract date part from ISO datetime
    whereClause += ` AND ${SNAPSHOT_COLUMN} > '${datePart}'`;
  }
  
  return whereClause;
}

/**
 * Build row number query for pagination
 */
function buildRowNumberQuery({ source, columnsSql, whereClause, rowNumberOrder }) {
  const order = (rowNumberOrder && rowNumberOrder.length > 0)
    ? rowNumberOrder.join(', ')
    : `[${SNAPSHOT_COLUMN}]`;

  return `
    SELECT ${columnsSql}, ROW_NUMBER() OVER (ORDER BY ${order}) as rn
    FROM ${source}
    ${whereClause ? `WHERE ${whereClause}` : ''}
  `;
}

/**
 * Sync competitor data incrementally
 * 
 * Key Principles:
 * - Always filter by Departure_Date range (dataset requirement)
 * - Use Snapshot_Date for incremental filtering only
 * - Check source for latest snapshot date first
 * - Update metadata even when no data processed
 * 
 * Initial Load:
 *   - Processes all snapshots where Departure_Date is in dateRange
 *   - Builds current state, stores only actual changes
 * 
 * Incremental Update:
 *   - Processes snapshots where Departure_Date is in dateRange AND Snapshot_Date > lastProcessedSnapshotDate
 *   - Compares to current state from database
 *   - Stores only new changes
 *   - Updates current state
 */
export async function syncCompetitors({
  synapseConfig,
  supabaseClient,
  source,
  columns,
  dateColumn, // This is Snapshot_Date (for reference, but we build WHERE clause ourselves)
  dateRange,
  targetTable,
  rowNumberOrder,
  batchSize = 50000,
  forceFullSync = false,
  dataset = null, // Dataset name for metadata tracking
  logger = null // Accept logger for consistency, but SyncOperation handles all logging
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
    throw new Error('Competitor sync requires a dateRange with from/to values');
  }

  // STEP 1: Check source for latest snapshot date FIRST
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
        recordsUpdated: 0,
        duration: duration,
        message: 'No new snapshots available'
      };
    }
  }

  // STEP 4: Build WHERE clause
  // CRITICAL: Always filter by Departure_Date range, use Snapshot_Date for incremental only
  const whereClause = buildWhereClause(
    dateRange.from,
    dateRange.to,
    isInitialLoad ? null : lastProcessedSnapshotDate
  );

  // STEP 5: Load current state from database
  const currentState = await loadCurrentState(supabaseClient);

  // STEP 6: Process data in batches
  let pool = null;
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  let maxSnapshotDate = null; // Track actual max snapshot date processed
  const columnsSql = columns.join(', ');

  try {
    pool = await sql.connect(synapseConfig);
    
    const rowNumberQuery = buildRowNumberQuery({
      source,
      columnsSql,
      whereClause,
      rowNumberOrder
    });

    // Process in batches
    let offset = 0;
    let batchNumber = 1;
    let hasMoreData = true;
    
    while (hasMoreData) {
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
        hasMoreData = false;
        break;
      }

      const { changes, updatedStates } = processChangesBatch(batch, currentState);
      allChanges.push(...changes);
      allUpdatedStates.push(...updatedStates);
      totalProcessed += batch.length;

      // Track the maximum snapshot date from this batch
      if (batch.length > 0) {
        const batchSnapshotDates = batch
          .map(r => r.Snapshot_Date ? new Date(r.Snapshot_Date).getTime() : null)
          .filter(d => d !== null);
        if (batchSnapshotDates.length > 0) {
          const batchMaxDate = Math.max(...batchSnapshotDates);
          if (maxSnapshotDate === null || batchMaxDate > maxSnapshotDate) {
            maxSnapshotDate = batchMaxDate;
          }
        }
      }

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
      
      offset += batchSize;
      batchNumber++;
    }

    // Insert remaining changes
    if (allChanges.length > 0) {
      await insertChanges(supabaseClient, allChanges);
    }

    // Update remaining states
    if (allUpdatedStates.length > 0) {
      await updateCurrentState(supabaseClient, allUpdatedStates);
    }

    // STEP 7: Update metadata
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
      recordsUpdated: allChanges.length,
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
