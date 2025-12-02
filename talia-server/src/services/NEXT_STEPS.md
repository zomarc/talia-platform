# Next Steps: Sync Architecture Completion

## Current Status

✅ **Completed:**
- Generic sync infrastructure (SyncOperation, SyncMetadataService, SyncLogger)
- competitor-sync.js refactored to use SyncOperation
- Documentation (SYNC_PRINCIPLES.md, SYNC_IMPLEMENTATION_GUIDE.md, SYNC_ARCHITECTURE.md)
- Fix for "log is not defined" error

⚠️ **Remaining Work:**
- published-rates-sync.js needs refactoring
- reservation-changes-sync.js needs refactoring
- synapse-sync.js needs consistency updates

## Immediate Next Steps (Priority Order)

### Step 1: Refactor published-rates-sync.js

**Goal**: Remove all logging, wrap with SyncOperation

**Changes needed:**
1. Remove all `log()`, `logError()`, `logWarn()` calls from the function body
2. Keep log function definitions at the start (for consistency)
3. Update `synapse-sync.js` to wrap `syncPublishedRates` with SyncOperation
4. Ensure `detailedLogs` are returned

**Files to modify:**
- `talia-server/src/services/published-rates-sync.js`
- `talia-server/src/services/synapse-sync.js` (case 'publishedRates')

**Testing:**
- Terminal: `node sync-cli.js sync-table published_rates_changes dataset-name --force-full-sync`
- UI: Click "Full Sync" button in Data Management page

### Step 2: Refactor reservation-changes-sync.js

**Goal**: Remove all logging, wrap with SyncOperation

**Changes needed:**
1. Remove all `log()`, `logError()`, `logWarn()` calls from the function body
2. Keep log function definitions at the start (for consistency)
3. Update `synapse-sync.js` to wrap `syncReservationChanges` with SyncOperation
4. Ensure `detailedLogs` are returned

**Files to modify:**
- `talia-server/src/services/reservation-changes-sync.js`
- `talia-server/src/services/synapse-sync.js` (case 'reservationChanges')

**Testing:**
- Terminal: `node sync-cli.js sync-table reservation_changes dataset-name --force-full-sync`
- UI: Click "Full Sync" button in Data Management page

### Step 3: Standardize synapse-sync.js

**Goal**: Ensure all derived table syncs use SyncOperation consistently

**Changes needed:**
1. Wrap `publishedRates` case with SyncOperation (like `competitor`)
2. Wrap `reservationChanges` case with SyncOperation (like `competitor`)
3. Ensure all cases return `detailedLogs`
4. Remove any direct logging from orchestration layer

**Files to modify:**
- `talia-server/src/services/synapse-sync.js`

## Future Table Syncs: Quick Start

When adding a new table sync in the future:

1. **Read the guides:**
   - `SYNC_PRINCIPLES.md` - Core principles
   - `SYNC_IMPLEMENTATION_GUIDE.md` - Step-by-step guide
   - `SYNC_ARCHITECTURE.md` - Architecture overview

2. **Create sync file:**
   - Copy template from `SYNC_IMPLEMENTATION_GUIDE.md`
   - Implement table-specific transformation logic
   - Define log functions at start (even if unused)

3. **Register in synapse-sync.js:**
   - Add case to `syncDerivedTable()` switch
   - Wrap with SyncOperation
   - Return detailedLogs

4. **Add to sync.config.json:**
   - Define table configuration
   - Set handler name (must match case in synapse-sync.js)

5. **Test:**
   - Terminal context
   - UI context
   - Verify logs appear in both

## Architecture Benefits

### Separation of Concerns
- **Sync Logic**: Pure data transformation (table-specific)
- **Orchestration**: Coordinates execution (generic)
- **Operation**: Wraps with logging/error handling (generic)
- **Management**: UI/CLI interfaces (generic)

### Consistency
- All syncs follow same patterns
- Same code path for UI and terminal
- Same logging format everywhere
- Same error handling everywhere

### Scalability
- Easy to add new table syncs
- Template guides implementation
- Generic infrastructure supports all tables
- No table-specific code in orchestration

### Maintainability
- Clear separation makes debugging easier
- Changes to one layer don't affect others
- Patterns are documented and enforced
- Code reviews can check against principles

## Verification Checklist

After completing refactoring, verify:

- [ ] All sync functions define log functions at start
- [ ] No console.log/error/warn in sync functions
- [ ] All derived table syncs use SyncOperation wrapper
- [ ] All syncs return detailedLogs
- [ ] All syncs use SyncMetadataService for metadata
- [ ] All syncs work in terminal context
- [ ] All syncs work in UI context
- [ ] Logs appear correctly in both contexts
- [ ] Error handling is consistent
- [ ] Result format is consistent

## Questions to Consider

1. **Should we create a sync function generator script?**
   - Could scaffold new sync files from template
   - Ensures consistency automatically

2. **Should we add runtime validation?**
   - Check sync function signatures
   - Verify compliance with principles
   - Warn about violations

3. **Should we create unit tests for sync functions?**
   - Test transformation logic
   - Test change detection
   - Test error handling

4. **Should we add performance monitoring?**
   - Track sync durations
   - Monitor batch sizes
   - Alert on slow syncs

## Success Criteria

The refactoring is complete when:

1. ✅ All sync functions follow SYNC_PRINCIPLES.md
2. ✅ All derived table syncs use SyncOperation
3. ✅ All syncs work in both UI and terminal contexts
4. ✅ Logs appear consistently in both contexts
5. ✅ New syncs can be added following the guide
6. ✅ Code reviews can verify compliance easily

