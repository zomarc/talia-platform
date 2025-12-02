# Sync Architecture Analysis - Why We Can't Make Everything Fully Generic

## The Core Problem

You're absolutely right - we have inconsistent patterns and table-specific code scattered across multiple files. Let me explain why we **CAN'T** make everything 100% generic, but also what we **SHOULD** standardize.

## What We CAN Standardize (Infrastructure)

### ✅ Already Standardized:
1. **Logging**: All syncs use `SyncLogger` with `eventEmitter`
2. **Metadata**: All syncs use `SyncMetadataService.updateSyncMetadata()`
3. **Event Emission**: All syncs emit via `syncEventEmitter`
4. **Batching Wrapper**: Derived tables use `syncDerivedTableWithBatching()`

### ❌ NOT Standardized (The Problem):
1. **syncType Naming**: Inconsistent between camelCase (`publishedRates`) and snake_case (`published_rates`)
2. **Table-Specific Files**: Each derived table has its own file with custom logic
3. **Key Generation**: Each table has different key generation logic
4. **Change Detection**: Each table has different change detection logic

## Why We CAN'T Make Business Logic Generic

### Domain-Specific Requirements

Each derived table has **fundamentally different business logic**:

#### 1. **Key Generation** (What makes a record unique?)

**Competitor** (`competitor-sync.js`):
```javascript
// Key: date|duration|cruiseline|destination|ship|market
function getCompetitorKey(row) {
  return `${departureDate}|${duration}|${cruiseLine}|${destination}|${shipName}|${market}`;
}
```

**Published Rates** (`published-rates-sync.js`):
```javascript
// Key: sail_code|cabin_category|rate_type|promo_name
function getPublishedRateKey(row) {
  return `${sailCode}|${cabinCategory}|${rateType}|${promoName}`;
}
```

**Reservation Changes** (`reservation-changes-sync.js`):
```javascript
// Key: res_id|snapshot_date (tracks changes over time for same reservation)
// Different - tracks same reservation across multiple snapshots
```

**Why Different?**
- Competitor: Unique by departure date, duration, cruise line, destination, ship, market
- Published Rates: Unique by sail code, cabin category, rate type, promo name
- Reservation Changes: Tracks the same reservation (res_id) across time (snapshot_date)

#### 2. **Change Detection** (What fields matter for detecting changes?)

**Competitor**:
```javascript
const hasChange = 
  previous.lowest_price !== transformed.lowest_price ||
  previous.lowest_inside !== transformed.lowest_inside ||
  previous.lowest_outside !== transformed.lowest_outside ||
  previous.lowest_balcony !== transformed.lowest_balcony ||
  previous.lowest_suite !== transformed.lowest_suite ||
  previous.taxes !== transformed.taxes ||
  // ... 8 more fields
```

**Published Rates**:
```javascript
const hasChange = 
  previous.fare_per_person !== transformed.fare_per_person ||
  previous.port_taxes_services !== transformed.port_taxes_services ||
  previous.extra_adult !== transformed.extra_adult ||
  previous.extra_child !== transformed.extra_child ||
  previous.discount !== transformed.discount ||
  previous.promo_type !== transformed.promo_type ||
  previous.region !== transformed.region;
```

**Why Different?**
- Competitor: Tracks price changes across cabin categories and taxes
- Published Rates: Tracks fare, taxes, extras, discounts, promo type, region
- Different business domains = different change criteria

#### 3. **State Management** (How to deduplicate and keep latest?)

**Competitor**:
```javascript
// For initial load: all records are unique by competitor_key
// For incremental: keep only latest snapshot_date per competitor_key
const isInitialLoad = uniqueSnapshotDates.size === 1;
if (isInitialLoad) {
  // Just deduplicate by key
} else {
  // Keep latest snapshot_date for each competitor_key
}
```

**Published Rates**:
```javascript
// Always deduplicate: keep only the latest snapshot_date for each rate_key
const stateMap = new Map();
for (const state of updatedStates) {
  const key = state.rate_key;
  const existing = stateMap.get(key);
  if (!existing || new Date(state.snapshot_date) > new Date(existing.snapshot_date)) {
    stateMap.set(key, state);
  }
}
```

**Why Different?**
- Competitor: Has special handling for initial load vs incremental
- Published Rates: Always keeps latest snapshot regardless of load type
- Different business requirements

## The Real Issue: Inconsistent Infrastructure

### Problem 1: syncType Naming Mismatch

**Current State:**
- `synapse-sync.js`: Uses `syncType: 'publishedRates'` (camelCase from sync.config.json)
- `published-rates-sync.js`: Defines `SYNC_TYPE = 'published_rates'` (snake_case, but NOT USED)
- `tableSources.js`: Uses `syncType: 'published_rates'` (snake_case)
- **Result**: Metadata stored as `sync_type = 'publishedRates'`, but UI looks for `sync_type = 'published_rates'` → Last sync time doesn't update!

**Solution**: Always use snake_case to match `tableSources.js`:
- `syncType: 'published_rates'` ✅
- `syncType: 'competitor'` ✅
- `syncType: 'reservation_changes'` ✅

### Problem 2: Table-Specific Files Are Necessary

**Why we need separate files:**
- Each table has domain-specific business logic
- Key generation is table-specific
- Change detection is table-specific
- State management is table-specific

**What we SHOULD standardize:**
- All use `syncDerivedTableWithBatching()` wrapper ✅
- All use `SyncMetadataService` for metadata ✅
- All use `SyncLogger` with `eventEmitter` ✅
- All export same function signatures:
  - `loadXxxCurrentState(supabaseClient, logger)`
  - `processXxxBatch(batch, currentState, logger)`
  - `insertXxxChanges(supabaseClient, changes, logger)`
  - `updateXxxCurrentState(supabaseClient, updatedStates, logger)`

## What We SHOULD Do

### 1. Standardize syncType Naming
- Always use snake_case to match `tableSources.js`
- Fix `publishedRates` → `published_rates`

### 2. Standardize Function Signatures
- All table-specific sync files should export the same 4 functions
- All use the same parameters
- All use `syncDerivedTableWithBatching()` wrapper

### 3. Standardize Infrastructure
- ✅ All use `SyncMetadataService` (FIXED)
- ✅ All use `SyncLogger` with `eventEmitter` (ALREADY DONE)
- ✅ All use `syncEventEmitter` for real-time updates (ALREADY DONE)

### 4. Keep Business Logic Separate
- ✅ Each table has its own file for domain-specific logic
- ✅ Key generation, change detection, state management stay table-specific
- ✅ This is CORRECT - business logic can't be generic

## Conclusion

**We CAN'T make everything generic because:**
- Business logic is domain-specific (key generation, change detection, state management)
- Each table has different requirements

**We CAN and SHOULD standardize:**
- Infrastructure (logging, metadata, events, batching wrapper)
- Function signatures (same 4 functions per table)
- syncType naming (always snake_case)

**The current architecture is CORRECT** - we just need to:
1. Fix syncType naming inconsistencies
2. Ensure all tables follow the same function signature pattern
3. Document that business logic stays table-specific (this is intentional and correct)

