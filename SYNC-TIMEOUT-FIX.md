# Azure Synapse Sync Timeout Fix

## Problem

Both **local** and **staging** environments were experiencing sync failures with Azure Synapse. The symptoms were:

- ✅ Connection tests pass (simple `SELECT 1` queries work)
- ✅ Network connectivity is good (DNS, TCP 1433, VPN IP correct)
- ❌ Actual sync queries timeout after 5 minutes
- ❌ Server-side query cancellation: "Query QID76187873 has been cancelled"

## Root Cause

**The issue was with the Azure Synapse source system** - likely due to:
- Temporary performance degradation
- Server-side maintenance or configuration changes
- Resource constraints on the Azure Synapse side

The timeout errors were resolved once the source system issues were addressed.

## Solution

**Note**: The issue was resolved on the Azure Synapse source system side. However, the following query optimizations were added as a preventive measure and may help with performance:

1. **`OPTION (MAXDOP 1)`** - Forces single-threaded execution for more predictable performance
2. **`OPTION (FAST 1000)`** - Optimizes query execution for the first 1000 rows, which helps with batching

These optimizations are generally beneficial for batch processing and can help prevent future timeout issues.

### Files Modified

- `talia-server/src/services/synapse-sync.js`
  - Added hints to `rowNumberQuery` (line ~1472)
  - Added hints to `batchQuery` (line ~1534)
  
- `talia-server/src/services/reservation-changes-sync.js`
  - Added hints to `buildRowNumberQuery()` (line ~350)
  - Added hints to `batchQuery` (line ~618)

## Testing

After deploying these changes:

1. **Test on local**: Try syncing a small table (e.g., `ships`)
2. **Test on staging**: Try syncing a larger table (e.g., `publishedRates` or `competitor`)
3. **Monitor logs**: Check for timeout errors in GraphQL server logs

## Additional Notes

- The client-side timeout remains at 300 seconds (5 minutes)
- If timeouts persist, consider:
  - Reducing batch size from 50,000 to 25,000 or 10,000
  - Adding more specific WHERE clause filters to reduce query scope
  - Checking Azure Synapse server-side query timeout settings

## Deployment

To deploy this fix:

```bash
# Local: Restart GraphQL server
cd talia-server && npm run dev

# Staging: Deploy code changes
./scripts/deploy-to-staging.sh --code-only
```
