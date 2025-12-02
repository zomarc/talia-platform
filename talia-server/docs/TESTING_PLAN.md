# Testing Plan for Real-Time Sync Updates

## Issues Fixed

1. ✅ **Fixed `dataset` error in UI** - Removed undefined variable reference
2. ✅ **Fixed server compilation** - Using standalone Apollo Server + separate Express for SSE
3. ✅ **Added event emission system** - SyncEventEmitter created
4. ✅ **Updated SyncLogger** - Automatically emits events
5. ✅ **Added concurrency control** - Prevents duplicate syncs

## Current Architecture

- **GraphQL Server**: Apollo Server standalone on port 4000
- **SSE Server**: Express server on port 4001 for real-time sync events
- **Event System**: SyncEventEmitter emits events during sync operations

## Testing Steps

### 1. Test Server Startup

```bash
cd talia-server
npm run compile
npm start
```

**Expected Output:**
- GraphQL server running on port 4000
- SSE server running on port 4001
- No compilation errors

### 2. Test Terminal Sync (Should Still Work)

```bash
cd talia-server
node sync-cli.js sync-table competitor sept-dec-2025
```

**Expected:**
- Sync runs successfully
- Logs appear in terminal
- No errors

### 3. Test UI Sync (Current State - Still Using Polling)

1. Start UI: `cd talia-ui && npm run dev`
2. Navigate to Data Management page
3. Click "Sync" on competitor table
4. **Expected**: Sync should work, but still using polling (not SSE yet)

### 4. Test Concurrency Control

1. Start a sync from UI
2. Immediately try to start another sync of the same table
3. **Expected**: Second sync should fail with "Sync already in progress" error

## Known Issues / Next Steps

### Phase 2 Remaining Work

1. **Update UI to Use SSE** (Not Done Yet)
   - Replace polling with SSE connection
   - Connect to `http://localhost:4001/api/sync/stream/:tableName`
   - Handle SSE events (log, progress, complete, error)

2. **Remove Polling Code** (Not Done Yet)
   - Remove `syncStatus` GraphQL query
   - Remove polling intervals from UI
   - Clean up `activeSyncs` Map (or keep only for concurrency)

3. **Add Progress Event Emissions** (Partially Done)
   - Progress events added in `syncLargeTable`
   - Need to add to `syncDerivedTable` and `syncSmallTable`

### Testing Checklist

- [ ] Server compiles without errors
- [ ] Server starts successfully
- [ ] GraphQL endpoint works (port 4000)
- [ ] SSE endpoint accessible (port 4001)
- [ ] Terminal sync works
- [ ] UI sync works (with polling)
- [ ] Concurrency control works
- [ ] Events are emitted during sync
- [ ] SSE connection receives events (when UI updated)

## Next Implementation Steps

1. **Update UI to Connect to SSE**
   - Create EventSource connection in `handleSync`
   - Replace polling logic with SSE event handlers
   - Update progress bar from SSE events

2. **Remove Polling Code**
   - Remove `syncStatus` query from schema
   - Remove polling interval logic
   - Clean up unused code

3. **Test End-to-End**
   - Test UI sync with SSE
   - Verify real-time updates
   - Test multiple concurrent UI sessions

