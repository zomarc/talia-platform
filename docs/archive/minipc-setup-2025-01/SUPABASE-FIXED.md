# Supabase Connection Fixed ✅

## Issue Resolved

**Problem**: Supabase connection was showing as offline with "Invalid path specified in request URL"

**Root Cause**: The Supabase JS client automatically adds `/rest/v1` to API paths. When using PostgREST directly (`http://supabase-rest:3000`), it created a double path issue.

**Solution**: Changed `SUPABASE_URL` to use Kong gateway (`http://supabase-kong:8000`) which properly routes `/rest/v1` requests to PostgREST.

## Configuration Change

**Before**:
```yaml
SUPABASE_URL: http://supabase-rest:3000
```

**After**:
```yaml
SUPABASE_URL: http://supabase-kong:8000
```

## Verification

✅ **Connection Status**: `online: true`  
✅ **Direct Query Test**: Successfully connected  
✅ **Data Query**: Can query Supabase tables  

## Test Commands

```bash
# Check connection status
curl -s http://localhost:4000/graphql -X POST -H 'Content-Type: application/json' -d '{"query":"{ supabaseConnectionStatus { online server database error } }"}'

# Test data query
curl -s http://localhost:4000/graphql -X POST -H 'Content-Type: application/json' -d '{"query":"{ ships { id name } }"}'
```

## Files Modified (MiniPC Only)

- `~/talia-docker/docker-compose.talia.yml` - Updated SUPABASE_URL

**Note**: Local configuration was NOT modified - this fix only applies to MiniPC.

---

**Status**: ✅ Supabase connection working on MiniPC
