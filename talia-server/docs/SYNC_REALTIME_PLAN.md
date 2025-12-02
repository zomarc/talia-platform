# Real-Time Sync Updates - Implementation Plan

## Current Issues

1. **Bad Request Errors**: Console shows bad request but servers are operational
2. **Polling Instead of Push**: Currently using polling (inefficient, not real-time)
3. **Terminal Scripts Failing**: CLI sync commands not working properly
4. **Concurrency Issues**: Multiple syncs of same table can conflict
5. **Code Complexity**: Too much code, needs simplification

## Solution: Push-Based Real-Time Updates

### Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   UI Client     │◄──SSE───│  GraphQL Server  │◄────────│  Sync Service   │
│  (Browser)      │         │   (Express)      │         │  (synapse-sync) │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                      │
                                      │ Log Events
                                      ▼
                            ┌──────────────────┐
                            │  Event Emitter   │
                            │  (In-Memory)     │
                            └──────────────────┘
```

### Key Principles

1. **Push-Based (SSE)**: Server-Sent Events for real-time log streaming
2. **Concurrency Control**: Lock mechanism to prevent duplicate syncs
3. **Separation of Concerns**: Sync logic separate from table definitions ✅
4. **Minimal Code**: Remove polling code, use event-driven architecture
5. **Terminal Compatibility**: Terminal scripts work independently (no SSE needed)

## Implementation Steps

### Phase 1: Fix Immediate Issues

1. **Fix Bad Request Errors**
   - Check GraphQL mutation parameters
   - Validate table name mapping
   - Add better error messages

2. **Fix Terminal Scripts**
   - Ensure `sync-cli.js` works independently
   - Terminal doesn't need SSE/WebSocket
   - Fix any import/export issues

3. **Add Concurrency Control**
   - Check if sync is already running before starting
   - Return clear error if sync already in progress
   - Store sync locks in `activeSyncs` Map

### Phase 2: Implement Push-Based Updates (SSE)

1. **Add Event Emitter to Sync Service**
   - Create `SyncEventEmitter` class
   - Emit events: `log`, `progress`, `complete`, `error`
   - Store events per table name

2. **Add SSE Endpoint**
   - Express route: `GET /api/sync/stream/:tableName`
   - Stream events as Server-Sent Events
   - Handle client disconnections gracefully

3. **Update Sync Service**
   - Emit events during sync operations
   - Replace polling with event emission
   - Keep `activeSyncs` Map for status tracking

4. **Update UI**
   - Remove polling code
   - Connect to SSE endpoint
   - Update logs/progress in real-time from events

### Phase 3: Cleanup & Testing

1. **Remove Polling Code**
   - Remove `syncStatus` GraphQL query (no longer needed)
   - Remove polling interval logic from UI
   - Simplify codebase

2. **Add Robust Error Handling**
   - Better error messages
   - Retry logic for SSE connections
   - Fallback to final result if SSE fails

3. **Test Both Paths**
   - UI sync via GraphQL + SSE
   - Terminal sync via CLI (no SSE needed)
   - Concurrent sync prevention

## Technical Details

### Event Types

```typescript
interface SyncEvent {
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
  this.activeSyncs.set(tableName, { status: 'running', ... });
  
  try {
    // Run sync...
  } finally {
    // Clear lock
    this.activeSyncs.delete(tableName);
  }
}
```

### SSE Endpoint

```javascript
// In Express server
app.get('/api/sync/stream/:tableName', (req, res) => {
  const { tableName } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const eventHandler = (event) => {
    if (event.tableName === tableName) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };
  
  syncEventEmitter.on('sync-event', eventHandler);
  
  req.on('close', () => {
    syncEventEmitter.off('sync-event', eventHandler);
  });
});
```

## Benefits

1. **Real-Time**: True push-based updates, no polling delay
2. **Efficient**: Server pushes only when events occur
3. **Robust**: Handles disconnections, retries automatically
4. **Simple**: Less code, event-driven architecture
5. **Concurrent-Safe**: Prevents duplicate syncs
6. **Terminal Compatible**: CLI scripts work independently

## Next Steps

1. Fix bad request errors (immediate)
2. Fix terminal scripts (immediate)
3. Add concurrency control (immediate)
4. Implement SSE endpoint (Phase 2)
5. Update sync service to emit events (Phase 2)
6. Update UI to use SSE (Phase 2)
7. Remove polling code (Phase 3)
8. Test everything (Phase 3)

