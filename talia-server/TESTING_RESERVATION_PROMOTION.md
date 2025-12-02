# Testing Reservation Promotion Sync

## Server Status ✅

**Server is running:**
- PID: Check with `ps aux | grep "node.*dist/index.js"`
- Port: 4000
- Endpoint: http://localhost:4000/graphql
- Status: ✅ Responding to requests

## Test Commands

### 1. Test Server Connection
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

### 2. Test Sync via GraphQL
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { syncTable(tableName: \"reservation_promotion\") { success message error recordsProcessed } }"}'
```

### 3. Test with Dataset
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { syncTable(tableName: \"reservation_promotion\", dataset: \"sept-dec-2025\") { success message error recordsProcessed } }"}'
```

## UI Testing

1. **Open Browser**: http://localhost:5173 (or your dev server URL)
2. **Navigate to**: Data Management page
3. **Find Table**: `reservation_promotion` should appear in the table list
4. **Click Sync**: Click the sync button for `reservation_promotion`
5. **Check Logs**: Watch the activity log for progress

## Expected Results

- ✅ Table appears in UI (dynamically discovered)
- ✅ Sync button is enabled
- ✅ Sync completes successfully
- ✅ Shows: "Successfully synced 176,715 records in batches"
- ✅ Records appear in `reservation_promotion` table

## Troubleshooting

### If UI shows "ERR_CONNECTION_REFUSED":
1. Check server is running: `ps aux | grep "node.*dist/index.js"`
2. Check port 4000: `lsof -i:4000`
3. Restart server: `cd talia-server && npm start`

### If sync fails:
1. Check server logs: `tail -f /tmp/talia-server.log`
2. Check browser console for errors
3. Verify table mapping in `resolvers.ts` includes `'reservation_promotion': 'reservationPromotion'`

### If table doesn't appear in UI:
1. Check `tableSources.js` includes `reservation_promotion`
2. Refresh the page
3. Check browser console for errors

## Current Status

- ✅ Server running
- ✅ GraphQL endpoint responding
- ✅ Sync mutation working
- ✅ Table mapping correct
- ✅ UI should work (test in browser)

