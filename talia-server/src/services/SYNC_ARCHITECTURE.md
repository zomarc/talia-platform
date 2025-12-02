# Sync Architecture: Separation of Concerns

## Overview

The sync system is designed with clear separation between:
1. **Sync Logic** (table-specific transformation)
2. **Sync Orchestration** (generic coordination)
3. **Sync Management** (UI/CLI interfaces)

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  Management Layer (UI/CLI)                              │
│  - DataManagementPage.jsx                               │
│  - sync-cli.js                                          │
│  - GraphQL resolvers                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Orchestration Layer (synapse-sync.js)                  │
│  - Builds runtime config                                │
│  - Routes to appropriate sync handler                   │
│  - Creates SyncLogger instances                         │
│  - Wraps syncs with SyncOperation                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Operation Layer (sync-operation.js)                    │
│  - Wraps sync functions                                 │
│  - Handles logging (pre/post execution)                 │
│  - Handles error catching                               │
│  - Returns structured results                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Sync Logic Layer ({table}-sync.js)                     │
│  - Source column mapping                                │
│  - Data transformation                                  │
│  - Change detection                                     │
│  - Database operations                                  │
│  - NO logging (uses logger parameter)                   │
│  - NO control flow (orchestration handles it)          │
│  - NO metadata management (uses SyncMetadataService)   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Infrastructure Layer                                   │
│  - SyncMetadataService (metadata operations)            │
│  - SyncLogger (structured logging)                      │
│  - Database connections                                 │
└─────────────────────────────────────────────────────────┘
```

## Current State

### ✅ Fully Compliant
- **competitor-sync.js** - Uses SyncOperation wrapper, follows all principles

### ⚠️ Needs Refactoring
- **published-rates-sync.js** - Has logging, not using SyncOperation
- **reservation-changes-sync.js** - Has logging, not using SyncOperation

### ✅ Infrastructure Ready
- **SyncOperation** - Generic wrapper for all syncs
- **SyncMetadataService** - Generic metadata operations
- **SyncLogger** - Structured logging
- **SYNC_PRINCIPLES.md** - Documentation
- **SYNC_IMPLEMENTATION_GUIDE.md** - Implementation guide

## Next Steps

### Phase 1: Complete Current Refactoring (Priority 1)

1. **Refactor published-rates-sync.js**
   - Remove all logging calls
   - Wrap with SyncOperation in synapse-sync.js
   - Ensure log functions are defined (even if unused)
   - Test in both UI and terminal

2. **Refactor reservation-changes-sync.js**
   - Remove all logging calls
   - Wrap with SyncOperation in synapse-sync.js
   - Ensure log functions are defined (even if unused)
   - Test in both UI and terminal

3. **Update synapse-sync.js**
   - Ensure all derived table syncs use SyncOperation consistently
   - Remove any direct logging from orchestration layer
   - Ensure detailedLogs are returned for all syncs

### Phase 2: Establish Patterns (Priority 2)

1. **Create Sync Function Template**
   - Extract common patterns into reusable template
   - Document in SYNC_IMPLEMENTATION_GUIDE.md
   - Create example implementations

2. **Standardize Error Handling**
   - Ensure all syncs handle errors consistently
   - Update metadata on error (via SyncMetadataService)
   - Return structured error responses

3. **Standardize Result Format**
   - All syncs return same structure:
     ```javascript
     {
       success: boolean,
       recordsProcessed: number,
       recordsUpdated: number,
       duration: number,
       message: string,
       detailedLogs?: string[]
     }
     ```

### Phase 3: Future-Proofing (Priority 3)

1. **Create Sync Function Generator/Scaffold**
   - Script or template to generate new sync files
   - Pre-filled with standard structure
   - Includes all required patterns

2. **Add Validation**
   - Validate sync function signatures
   - Ensure all syncs follow patterns
   - Runtime checks for compliance

3. **Documentation**
   - Complete SYNC_IMPLEMENTATION_GUIDE.md
   - Add examples for common scenarios
   - Document troubleshooting guide

## Separation of Concerns

### Sync Logic ({table}-sync.js)
**Responsibility**: Data transformation and database operations
- ✅ Source column mapping
- ✅ Transform data format
- ✅ Generate unique keys
- ✅ Detect changes
- ✅ Insert/update data
- ❌ NO logging (use logger parameter)
- ❌ NO control flow decisions
- ❌ NO metadata management
- ❌ NO UI/CLI specific code

### Sync Orchestration (synapse-sync.js)
**Responsibility**: Coordinate sync execution
- ✅ Build runtime configuration
- ✅ Route to appropriate handler
- ✅ Create logger instances
- ✅ Wrap syncs with SyncOperation
- ✅ Handle table type routing
- ❌ NO data transformation
- ❌ NO business logic

### Sync Operation (sync-operation.js)
**Responsibility**: Wrap sync functions with common behavior
- ✅ Pre-execution logging
- ✅ Post-execution logging
- ✅ Error catching and logging
- ✅ Result formatting
- ✅ Attach detailed logs
- ❌ NO sync logic
- ❌ NO orchestration

### Sync Management (UI/CLI)
**Responsibility**: User interface and command-line interface
- ✅ Display sync status
- ✅ Trigger syncs
- ✅ Show logs
- ✅ Handle user input
- ❌ NO sync logic
- ❌ NO orchestration logic

## Benefits of This Architecture

1. **Testability**: Each layer can be tested independently
2. **Maintainability**: Changes to one layer don't affect others
3. **Reusability**: Sync logic works in any context (UI/CLI/API)
4. **Consistency**: All syncs follow the same patterns
5. **Scalability**: Easy to add new table syncs
6. **Debugging**: Clear separation makes issues easier to trace

## Migration Checklist for New Syncs

When adding a new table sync:

- [ ] Read SYNC_PRINCIPLES.md
- [ ] Read SYNC_IMPLEMENTATION_GUIDE.md
- [ ] Create {table}-sync.js following template
- [ ] Define log functions at start (even if unused)
- [ ] Use SyncMetadataService for all metadata operations
- [ ] Wrap with SyncOperation in synapse-sync.js
- [ ] Add table definition to sync.config.json
- [ ] Test in terminal context
- [ ] Test in UI context
- [ ] Verify logs appear in both contexts
- [ ] Verify metadata updates correctly
- [ ] Document any table-specific quirks

## Code Review Checklist

When reviewing sync code:

- [ ] No console.log/error/warn (use logger parameter)
- [ ] Log functions defined at function start
- [ ] SyncMetadataService used for metadata
- [ ] SyncOperation wrapper used (for derived tables)
- [ ] No table-specific control flow
- [ ] No UI/CLI specific code
- [ ] Generic and reusable patterns
- [ ] Error handling consistent with other syncs
- [ ] Result format matches standard structure

