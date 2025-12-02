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
 * 
 * Exported for use by sync service batching wrapper
 */
export async function loadCompetitorCurrentState(supabaseClient, logger = null) {
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
 * 
 * Exported for use by sync service batching wrapper
 */
export async function updateCompetitorCurrentState(supabaseClient, updatedStates, logger = null) {
  if (updatedStates.length === 0) return;
  
  // Logging handled by sync service

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
  let updated = 0;

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
    
    updated += batch.length;
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
 * 
 * This function is used by the sync service's batching wrapper.
 * The sync service handles all querying, batching, and data insertion.
 */
export function processCompetitorBatch(batch, currentState, logger = null) {
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  
  log(`🔄 Transforming ${batch.length.toLocaleString()} records for competitor...`);
  const result = processChangesBatch(batch, currentState);
  log(`✅ Processed ${batch.length.toLocaleString()} records (${result.changes.length} changes detected)`);
  
  return result;
}

/**
 * Process a batch of competitor records and detect changes compared to current state
 * Returns { changes: [], updatedStates: [] }
 * Internal function - use processCompetitorBatch instead
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
 * Exported for use by sync service batching wrapper
 */
export async function insertCompetitorChanges(supabaseClient, changes, logger = null) {
  if (changes.length === 0) return;

  // Pure data insertion - logging handled by sync service
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

