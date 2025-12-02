# UI Completion Handler Fix

## Issue
UI sync gets stuck when complete - progress updates work but UI doesn't clean up properly.

## Root Cause
The SSE completion event handler was closing the SSE connection but not:
1. Removing table from `syncingTables` state
2. Calling `updateTable()` to refresh table data
3. Clearing progress state

## Fix Applied

### Completion Event Handler
Added proper cleanup in the `complete` event handler:
- Remove table from `syncingTables` set
- Call `updateTable(tableName)` after 2 second delay (to allow metadata commit)
- Clear progress state after 5 seconds

### Error Event Handler
Added same cleanup for error events to ensure UI doesn't get stuck on errors.

## Code Changes

**File**: `talia-ui/src/components/DataManagementPage.jsx`

**Completion Handler** (lines ~496-550):
```javascript
} else if (data.type === 'complete') {
  // ... existing progress update ...
  
  // Close SSE connection
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  
  // NEW: Clean up UI state
  setSyncingTables(prev => {
    const newSet = new Set(prev);
    newSet.delete(tableName);
    return newSet;
  });
  
  // NEW: Update table data after delay
  setTimeout(async () => {
    try {
      await updateTable(tableName);
    } catch (err) {
      console.warn('Failed to update table data:', err);
      refetch();
    }
  }, 2000);
  
  // NEW: Clear progress after delay
  setTimeout(() => {
    setSyncProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[tableName];
      return newProgress;
    });
  }, 5000);
}
```

## Testing

1. Start server: `cd talia-server && npm start`
2. Start UI: `cd talia-ui && npm run dev`
3. Navigate to Data Management page
4. Click "Full Sync" on competitor table
5. **Expected**: 
   - Progress updates in real-time ✅
   - Sync completes ✅
   - UI cleans up properly ✅
   - Table data refreshes ✅
   - No stuck state ✅

## Status
✅ Fixed - UI should now properly clean up when sync completes

