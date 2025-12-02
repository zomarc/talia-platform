# Sync Implementation Guide

**For developers adding new table syncs**

This guide walks you through implementing a new table sync following the established patterns.

## Quick Start Checklist

When adding a new table sync:

- [ ] Read `SYNC_PRINCIPLES.md` first
- [ ] Create `{table-name}-sync.js` file
- [ ] Implement sync function following the template below
- [ ] Add table definition to `sync.config.json`
- [ ] Register handler in `synapse-sync.js`
- [ ] Test in both UI and terminal contexts

## File Structure

```
talia-server/src/services/
├── SYNC_PRINCIPLES.md              ← Read this first!
├── SYNC_IMPLEMENTATION_GUIDE.md    ← This file
├── sync-metadata-service.js        ← Generic metadata operations
├── sync-operation.js               ← Generic sync wrapper (use this!)
├── sync-logger.js                  ← Logging infrastructure
├── synapse-sync.js                  ← Orchestration (add handler here)
└── {table-name}-sync.js            ← Your new sync file
```

## Implementation Template

### For Derived Tables (with change tracking)

```javascript
import sql from 'mssql';
import { SyncMetadataService } from './sync-metadata-service.js';

const SYNC_TYPE = 'your_table_name';
const CURRENT_STATE_TABLE = 'your_table_current_state';
const TARGET_TABLE = 'your_table';
const SNAPSHOT_COLUMN = 'Snapshot_Date'; // Adjust as needed
const DEPARTURE_DATE_COLUMN = 'Departure_Date'; // Adjust as needed

/**
 * Generate unique key for a record
 */
function getRecordKey(row) {
  // Return unique identifier for this record
  // Format: "key1|key2|key3"
  return `${row.Key1}|${row.Key2}|${row.Key3}`;
}

/**
 * Load current state from database
 */
async function loadCurrentState(supabaseClient) {
  const stateMap = new Map();
  // ... load logic ...
  return stateMap;
}

/**
 * Transform Synapse row to Supabase format
 */
function transformRow(row) {
  return {
    record_key: getRecordKey(row),
    // ... map all fields ...
    snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Process batch and detect changes
 */
function processChangesBatch(batch, currentState) {
  const changes = [];
  const updatedStates = [];
  // ... change detection logic ...
  return { changes, updatedStates };
}

/**
 * Update current state table
 */
async function updateCurrentState(supabaseClient, updatedStates) {
  // ... update logic ...
}

/**
 * Insert changes into target table
 */
async function insertChanges(supabaseClient, changes) {
  // ... insert logic ...
}

/**
 * Build WHERE clause
 */
function buildWhereClause(departureDateFrom, departureDateTo, lastProcessedSnapshotDate) {
  let whereClause = `${DEPARTURE_DATE_COLUMN} >= '${departureDateFrom}' AND ${DEPARTURE_DATE_COLUMN} <= '${departureDateTo}'`;
  if (lastProcessedSnapshotDate) {
    const datePart = lastProcessedSnapshotDate.split('T')[0];
    whereClause += ` AND ${SNAPSHOT_COLUMN} > '${datePart}'`;
  }
  return whereClause;
}

/**
 * Main sync function
 */
export async function syncYourTable({
  synapseConfig,
  supabaseClient,
  source,
  columns,
  dateColumn,
  dateRange,
  targetTable,
  rowNumberOrder,
  batchSize = 50000,
  forceFullSync = false,
  dataset = null,
  logger = null // Accept logger, but SyncOperation handles logging
}) {
  // Define local log functions at the START (per SYNC_PRINCIPLES.md)
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  const logError = (...args) => logger ? logger.error(...args) : console.error(...args);
  const logWarn = (...args) => logger ? logger.warn(...args) : console.warn(...args);
  
  const startTime = Date.now();
  
  // Validate inputs
  if (!dateRange?.from || !dateRange?.to) {
    throw new Error('Sync requires a dateRange with from/to values');
  }

  // STEP 1: Check source for latest snapshot date
  const latestAvailableSnapshotDate = await SyncMetadataService.getLatestSnapshotDate(
    synapseConfig,
    source,
    SNAPSHOT_COLUMN
  );

  // STEP 2: Get last processed snapshot date
  const lastProcessedSnapshotDate = forceFullSync 
    ? null 
    : await SyncMetadataService.getLastProcessedSnapshotDate(supabaseClient, SYNC_TYPE);

  // STEP 3: Determine if sync is needed
  const isInitialLoad = !lastProcessedSnapshotDate || forceFullSync;
  
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
  const whereClause = buildWhereClause(
    dateRange.from,
    dateRange.to,
    isInitialLoad ? null : lastProcessedSnapshotDate
  );

  // STEP 5: Load current state
  const currentState = await loadCurrentState(supabaseClient);

  // STEP 6: Process data in batches
  let pool = null;
  const allChanges = [];
  const allUpdatedStates = [];
  let totalProcessed = 0;
  let maxSnapshotDate = null;

  try {
    pool = await sql.connect(synapseConfig);
    const columnsSql = columns.join(', ');
    
    // Build pagination query
    const rowNumberQuery = `
      SELECT ${columnsSql}, ROW_NUMBER() OVER (ORDER BY ${rowNumberOrder.join(', ')}) as rn
      FROM ${source}
      WHERE ${whereClause}
    `;
    
    // Process in batches
    let offset = 0;
    while (true) {
      const batchQuery = `
        SELECT * FROM (${rowNumberQuery}) AS numbered
        WHERE rn > ${offset} AND rn <= ${offset + batchSize}
      `;
      
      const result = await pool.request().query(batchQuery);
      if (!result.recordset || result.recordset.length === 0) break;
      
      const { changes, updatedStates } = processChangesBatch(result.recordset, currentState);
      allChanges.push(...changes);
      allUpdatedStates.push(...updatedStates);
      
      // Track max snapshot date
      const batchSnapshotDates = result.recordset
        .map(r => r[SNAPSHOT_COLUMN])
        .filter(d => d);
      if (batchSnapshotDates.length > 0) {
        const batchMaxDate = Math.max(...batchSnapshotDates.map(d => new Date(d).getTime()));
        if (!maxSnapshotDate || batchMaxDate > maxSnapshotDate) {
          maxSnapshotDate = batchMaxDate;
        }
      }
      
      totalProcessed += result.recordset.length;
      offset += batchSize;
    }

    // STEP 7: Update current state
    if (allUpdatedStates.length > 0) {
      await updateCurrentState(supabaseClient, allUpdatedStates);
    }

    // STEP 8: Insert changes
    if (allChanges.length > 0) {
      await insertChanges(supabaseClient, allChanges);
    }

    // STEP 9: Update metadata
    const duration = Date.now() - startTime;
    const finalSnapshotDate = maxSnapshotDate 
      ? new Date(maxSnapshotDate).toISOString()
      : (lastProcessedSnapshotDate || latestAvailableSnapshotDate);
    
    await SyncMetadataService.updateSyncMetadata(
      supabaseClient,
      SYNC_TYPE,
      finalSnapshotDate,
      latestAvailableSnapshotDate || finalSnapshotDate,
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
    // Update metadata on error
    try {
      const duration = Date.now() - startTime;
      const fallbackDate = new Date(dateRange.from);
      fallbackDate.setHours(0, 0, 0, 0);
      await SyncMetadataService.updateSyncMetadataNoData(
        supabaseClient,
        SYNC_TYPE,
        latestAvailableSnapshotDate || fallbackDate.toISOString(),
        lastProcessedSnapshotDate || fallbackDate.toISOString(),
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
```

### For Direct Tables (simple pull, no change tracking)

```javascript
import sql from 'mssql';
import { SyncMetadataService } from './sync-metadata-service.js';

const SYNC_TYPE = 'your_table_name';
const TARGET_TABLE = 'your_table';

/**
 * Transform Synapse row to Supabase format
 */
function transformRow(row) {
  return {
    // ... map all fields ...
    updated_at: new Date().toISOString()
  };
}

export async function syncYourTable({
  synapseConfig,
  supabaseClient,
  source,
  columns,
  dateRange,
  targetTable,
  batchSize = 1000,
  forceFullSync = false,
  dataset = null,
  logger = null
}) {
  // Define local log functions
  const log = (...args) => logger ? logger.info(...args) : console.log(...args);
  const logError = (...args) => logger ? logger.error(...args) : console.error(...args);
  
  const startTime = Date.now();
  
  // Build WHERE clause (if date range needed)
  let whereClause = '';
  if (dateRange?.from && dateRange?.to) {
    whereClause = `WHERE DateColumn >= '${dateRange.from}' AND DateColumn <= '${dateRange.to}'`;
  }
  
  let pool = null;
  let totalProcessed = 0;
  
  try {
    pool = await sql.connect(synapseConfig);
    const columnsSql = columns.join(', ');
    const query = `SELECT ${columnsSql} FROM ${source} ${whereClause}`;
    
    const result = await pool.request().query(query);
    const transformed = result.recordset.map(transformRow);
    
    // Insert in batches
    for (let i = 0; i < transformed.length; i += batchSize) {
      const batch = transformed.slice(i, i + batchSize);
      const { error } = await supabaseClient.from(targetTable).upsert(batch, {
        onConflict: 'primary_key_column'
      });
      if (error) throw error;
      totalProcessed += batch.length;
    }
    
    // Update metadata
    const duration = Date.now() - startTime;
    await SyncMetadataService.updateSyncMetadata(
      supabaseClient,
      SYNC_TYPE,
      null, // No snapshot date for direct tables
      null,
      totalProcessed,
      0,
      duration,
      dataset
    );
    
    return {
      success: true,
      recordsProcessed: totalProcessed,
      recordsUpdated: 0,
      duration: duration,
      message: `Processed ${totalProcessed.toLocaleString()} records`
    };
  } catch (error) {
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}
```

## Registration Steps

### 1. Add to `sync.config.json`

```json
{
  "tables": {
    "your_table": {
      "type": "derived",  // or "direct"
      "source": "schema.TableName",
      "target": "your_table",
      "handler": "yourTable",  // Must match case in synapse-sync.js
      "columns": ["Column1", "Column2", "..."],
      "dateColumn": "Snapshot_Date",
      "rowNumberOrder": ["[Snapshot_Date]", "[SomeOtherColumn]"]
    }
  }
}
```

### 2. Register in `synapse-sync.js`

For **derived tables**, add to `syncDerivedTable()`:

```javascript
case 'yourTable': {
  if (!runtime.dateRange) {
    throw new Error('yourTable requires a date range in the configuration');
  }

  const forceFullSync = runtime.overrides?.forceFullSync || false;

  // Use SyncOperation wrapper for consistent logging
  const syncOp = new SyncOperation(syncYourTable, logger, {
    tableName: runtime.tableName,
    syncType: 'yourTable'
  });

  const result = await syncOp.execute({
    synapseConfig: this.synapseConfig,
    supabaseClient: supabaseDataService.client,
    source: runtime.definition.source,
    columns: runtime.definition.columns,
    dateColumn: runtime.definition.dateColumn,
    dateRange: runtime.dateRange,
    targetTable: runtime.definition.target,
    rowNumberOrder: runtime.definition.rowNumberOrder,
    forceFullSync,
    dataset: runtime.datasetName
  });

  return {
    tableName: runtime.tableName,
    success: result.success,
    recordsProcessed: result.recordsProcessed || 0,
    recordsUpdated: result.recordsUpdated || 0,
    duration: result.duration || null,
    message: result.message,
    detailedLogs: result.detailedLogs || []
  };
}
```

For **direct tables**, they're handled automatically by `syncSmallTable()` or `syncLargeTable()`.

### 3. Import the sync function

Add to imports at top of `synapse-sync.js`:

```javascript
import { syncYourTable } from './your-table-sync.js';
```

## Testing

### Terminal Test
```bash
cd talia-server
node sync-cli.js sync-table your_table dataset-name --force-full-sync
```

### UI Test
1. Navigate to Data Management page
2. Find your table in the list
3. Click "Full Sync" button
4. Check logs in "Server Logs" panel

## Key Principles Reminder

1. **Sync functions = Source/Transform only**
   - No logging (use logger parameter)
   - No control flow (SyncOperation handles it)
   - No metadata management (use SyncMetadataService)

2. **Use SyncOperation wrapper**
   - Wraps sync function with logging and error handling
   - Ensures consistent behavior across all syncs

3. **Always define log functions**
   - Even if not used, define at function start
   - Use console fallbacks when logger is null

4. **Metadata via SyncMetadataService**
   - Never write custom metadata code
   - Always use the service methods

5. **Generic and reusable**
   - If you add functionality, ensure it can apply to all tables
   - Never add table-specific code that can't be reused

## Common Patterns

### Change Detection
```javascript
function processChangesBatch(batch, currentState) {
  const changes = [];
  const updatedStates = [];
  
  for (const row of batch) {
    const transformed = transformRow(row);
    const key = transformed.record_key;
    const previous = currentState.get(key);
    
    // Always update current state
    updatedStates.push(transformed);
    
    // Detect changes
    if (previous) {
      const hasChange = /* compare fields */;
      if (hasChange) {
        changes.push({
          ...transformed,
          /* add delta fields */,
          created_at: new Date().toISOString()
        });
      }
    }
    
    // Update in-memory state
    currentState.set(key, transformed);
  }
  
  return { changes, updatedStates };
}
```

### Batch Processing
```javascript
const batchSize = 1000;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await supabaseClient.from(table).upsert(batch);
}
```

## Troubleshooting

### "log is not defined" error
- Ensure log functions are defined at the START of the function
- Check that SyncOperation is being used

### Metadata not updating
- Ensure SyncMetadataService methods are called
- Check that SYNC_TYPE constant matches sync_type in database

### Changes not detected
- Verify getRecordKey() returns consistent keys
- Check that currentState is loaded correctly
- Ensure change detection logic compares all relevant fields

## Next Steps After Implementation

1. Test in terminal context
2. Test in UI context
3. Verify metadata updates correctly
4. Check that logs appear in both contexts
5. Document any table-specific quirks in code comments

