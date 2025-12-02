# Sync Naming Standard - REQUIRED FOR ALL FUTURE DEVELOPMENT

## CRITICAL RULE: syncType MUST Always Be snake_case

**ALL syncType values MUST use snake_case format to match database table naming conventions.**

## Standard Mapping

| sync.config.json Key (camelCase) | syncType (snake_case) | UI Table Name | Notes |
|-----------------------------------|----------------------|---------------|-------|
| ships | ships | ship | Plural OK - matches source |
| cabinAvailability | cabin_availability | cabin_availability | |
| reservations | reservation | reservation | Singular for syncType |
| masterSail | master_sail | master_sail | |
| sailByCabinOccupancy | sail_by_cabin_occupancy | sail_by_cabin_occupancy | |
| publishedRates | published_rates | published_rates | |
| competitor | competitor | competitor | |
| reservationChanges | reservation_changes | reservation_changes | |
| reservationPromotion | reservation_promotion | reservation_promotion | |

## Rules

1. **syncType ALWAYS snake_case** - No exceptions
2. **syncType MUST match tableSources.js** - This is the source of truth
3. **sync.config.json keys** - Can be camelCase (internal use only)
4. **UI table names** - Use snake_case (Supabase table names)
5. **Metadata sync_type** - Always snake_case (stored in sync_metadata table)

## Implementation

### ✅ CORRECT Pattern

```javascript
// In syncDerivedTable or syncTable
{
  syncType: 'published_rates', // snake_case - matches tableSources.js
  // ...
}

// In SyncMetadataService.updateSyncMetadata
await SyncMetadataService.updateSyncMetadata(
  supabaseClient,
  'published_rates', // snake_case - matches tableSources.js
  // ...
);
```

### ❌ WRONG Pattern

```javascript
// DON'T use camelCase from sync.config.json
{
  syncType: 'publishedRates', // WRONG - camelCase
  // ...
}
```

## Files to Update

1. ✅ `tableSources.js` - Standardize all syncType to snake_case
2. ✅ `synapse-sync.js` - Use snake_case syncType values
3. ✅ All sync-specific files - Use snake_case syncType constants
4. ✅ Database cleanup - Remove duplicate sync_metadata entries

## Validation

- syncType must match between:
  - `tableSources.js` syncType
  - `synapse-sync.js` metadataConfig.syncType
  - `sync_metadata` table sync_type column
  - UI metadata lookup

If any of these don't match, the UI will not show sync status correctly.

