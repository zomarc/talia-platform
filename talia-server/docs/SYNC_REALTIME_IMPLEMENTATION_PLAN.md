# Real-Time Sync Updates - Implementation Plan

## Current Issues

1. **Bad Request Errors**: Console shows bad request but servers are operational
2. **Polling Instead of Push**: Currently using polling (inefficient, not real-time)
3. **Terminal Scripts Failing**: CLI sync commands not working properly
4. **Concurrency Issues**: Multiple syncs of same table can conflict
5. **Code Complexity**: Too much code, needs simplification

## Solution: GraphQL Subscriptions for Push-Based Updates

### Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   UI Client     │◄─Sub───│  Apollo Server   │◄────────│  Sync Service   │
│  (Browser)      │         │  (GraphQL)       │         │  (synapse-sync) │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                      │
                                      │ Event Emitter
                                      ▼
                            ┌──────────────────┐
                            │  PubSub System   │
                            │  (In-Memory)     │
                            └──────────────────┘
```

### Key Principles

1. **Push-Based (GraphQL Subscriptions)**: Use Apollo Server subscriptions for real-time updates
2. **Concurrency Control**: Lock mechanism to prevent duplicate syncs
3. **Separation of Concerns**: Sync logic separate from table definitions ✅
4. **Minimal Code**: Remove polling code, use event-driven architecture
5. **Terminal Compatibility**: Terminal scripts work independently (no subscriptions needed)

## Implementation Steps

### Phase 1: Fix Immediate Issues (Priority 1)

#### 1.1 Fix Bad Request Errors
- **Issue**: GraphQL mutation parameters may be incorrect
- **Fix**: 
  - Validate `tableName` parameter
  - Check `tableNameMap` mapping
  - Add better error messages
  - Ensure `dataset` parameter is optional and handled correctly

#### 1.2 Fix Terminal Scripts
- **Issue**: CLI sync commands failing
- **Fix**:
  - Ensure `sync-cli.js` works independently
  - Terminal doesn't need subscriptions/SSE
  - Fix any import/export issues
  - Ensure logger works in terminal (console output)

#### 1.3 Add Concurrency Control
- **Issue**: Multiple syncs of same table can conflict
- **Fix**:
  ```javascript
  // In SynapseSyncService.syncTable()
  const existingSync = this.activeSyncs.get(tableName);
  if (existingSync && existingSync.status === 'running') {
    throw new Error(`Sync already in progress for ${tableName}. Please wait for it to complete.`);
  }
  ```

### Phase 2: Implement GraphQL Subscriptions (Priority 2)

#### 2.1 Add PubSub System
- Install `graphql-subscriptions` package (if not already)
- Create `SyncEventEmitter` using PubSub
- Emit events: `syncLog`, `syncProgress`, `syncComplete`, `syncError`

#### 2.2 Add Subscription to GraphQL Schema
```graphql
type Subscription {
  syncUpdates(tableName: String!): SyncUpdate!
}

type SyncUpdate {
  type: String! # 'log' | 'progress' | 'complete' | 'error'
  tableName: String!
  timestamp: String!
  data: JSON!
}
```

#### 2.3 Update Sync Service to Emit Events
- Replace polling with event emission
- Emit events during sync operations:
  - `syncLog`: Every log message
  - `syncProgress`: Progress updates (batch, records, etc.)
  - `syncComplete`: When sync finishes
  - `syncError`: On errors

#### 2.4 Update UI to Use Subscriptions
- Remove polling code
- Connect to GraphQL subscription
- Update logs/progress in real-time from subscription events

### Phase 3: Cleanup & Testing (Priority 3)

#### 3.1 Remove Polling Code
- Remove `syncStatus` GraphQL query (no longer needed)
- Remove polling interval logic from UI
- Remove `activeSyncs` Map (or keep only for concurrency control)
- Simplify codebase

#### 3.2 Add Robust Error Handling
- Better error messages
- Retry logic for subscription connections
- Fallback to final result if subscription fails
- Handle disconnections gracefully

#### 3.3 Test Both Paths
- UI sync via GraphQL mutation + subscription
- Terminal sync via CLI (no subscription needed)
- Concurrent sync prevention
- Multiple UI sessions watching same sync

## Technical Details

### Event Types

```typescript
interface SyncUpdate {
  type: 'log' | 'progress' | 'complete' | 'error';
  tableName: string;
  timestamp: string;
  data: {
    // For 'log': { level: 'info'|'error'|'warn', message: string }
    // For 'progress': { current: number, total: number, percentage: number, type: string }
    // For 'complete': { success: boolean, recordsProcessed: number, duration: number }
    // For 'error': { message: string, error: string }
  };
}
```

### Concurrency Control

```javascript
// In SynapseSyncService
async syncTable(tableName, datasetName, overrides) {
  // Check if already running
  const existingSync = this.activeSyncs.get(tableName);
  if (existingSync && existingSync.status === 'running') {
    throw new Error(`Sync already in progress for ${tableName}`);
  }
  
  // Set lock
  this.activeSyncs.set(tableName, { 
    status: 'running', 
    logger,
    startTime: Date.now()
  });
  
  try {
    // Run sync...
    // Emit events during sync
    this.emitSyncEvent('log', tableName, { level: 'info', message: '...' });
    this.emitSyncEvent('progress', tableName, { current: 100, total: 1000, ... });
  } finally {
    // Clear lock
    this.activeSyncs.delete(tableName);
  }
}
```

### GraphQL Subscription Resolver

```typescript
Subscription: {
  syncUpdates: {
    subscribe: (parent, args, context) => {
      const { tableName } = args;
      return syncEventEmitter.asyncIterator(`sync-${tableName}`);
    },
    resolve: (payload) => payload
  }
}
```

## Benefits

1. **Real-Time**: True push-based updates, no polling delay
2. **Efficient**: Server pushes only when events occur
3. **Robust**: Handles disconnections, retries automatically
4. **Simple**: Less code, event-driven architecture
5. **Concurrent-Safe**: Prevents duplicate syncs
6. **Terminal Compatible**: CLI scripts work independently
7. **GraphQL Native**: Uses standard GraphQL subscriptions

## Next Steps (In Order)

### Immediate (Fix Now)
1. ✅ Fix bad request errors - validate parameters
2. ✅ Fix terminal scripts - ensure they work
3. ✅ Add concurrency control - prevent duplicate syncs

### Short Term (This Week)
4. ✅ Add PubSub system to sync service
5. ✅ Add GraphQL subscription schema
6. ✅ Update sync service to emit events
7. ✅ Update UI to use subscriptions
8. ✅ Remove polling code

### Testing
9. ✅ Test UI sync with subscriptions
10. ✅ Test terminal scripts independently
11. ✅ Test concurrent sync prevention
12. ✅ Test multiple UI sessions

## Code Changes Summary

### Files to Modify
1. `talia-server/src/services/synapse-sync.js` - Add event emission, concurrency control
2. `talia-server/src/api/schema.ts` - Add subscription type
3. `talia-server/src/api/resolvers.ts` - Add subscription resolver, fix bad request
4. `talia-ui/src/components/DataManagementPage.jsx` - Replace polling with subscription
5. `talia-server/sync-cli.js` - Ensure it works independently

### Files to Remove/Simplify
1. Remove `syncStatus` query (no longer needed)
2. Remove polling interval logic from UI
3. Simplify `activeSyncs` Map (keep only for concurrency)

### New Files
1. `talia-server/src/services/sync-event-emitter.js` - Event emitter for sync events

