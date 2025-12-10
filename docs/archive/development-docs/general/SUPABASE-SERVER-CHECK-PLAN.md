# Plan: Route Supabase Status Check Through Backend

## Problem
The Data Mode panel shows Supabase as offline when accessing from external URL (`talia.ngrok.dev`) because:
- The browser tries to connect directly to `http://127.0.0.1:54321` (local Supabase)
- External browsers cannot access `localhost` addresses
- Supabase checks need to go through the backend server, not directly from the browser

## Solution
Route Supabase connection checks through the GraphQL backend, similar to how Azure Synapse status is checked.

## Implementation Steps

### ✅ Step 1: Add GraphQL Query to Schema
**File**: `talia-server/src/api/schema.ts`
- Added `supabaseConnectionStatus: ConnectionStatus!` query
- Uses the same `ConnectionStatus` type as `synapseConnectionStatus`

### ✅ Step 2: Create Backend Resolver
**File**: `talia-server/src/api/resolvers.ts`
- Added `supabaseConnectionStatus` resolver
- Tests Supabase connection from backend using `supabaseDataService.client`
- Returns connection status with server URL, database name, and error details
- Handles errors gracefully

### ✅ Step 3: Update Server Services Config
**File**: `talia-ui/src/config/serverServices.js`
- Changed Supabase service from `method: 'supabase'` to `method: 'graphql'`
- Updated to use GraphQL query instead of direct Supabase client call
- Query uses `/api/graphql` endpoint (proxied through Vite)
- Updated display address to show server/database from status
- Updated offline message to show error details

### ✅ Step 4: DataManagementPage Already Supports This
**File**: `talia-ui/src/components/DataManagementPage.jsx`
- Already handles GraphQL-based status checks (lines 117-171)
- No changes needed - it will automatically use the new GraphQL query

## How It Works Now

### Before (Direct Browser Check)
```
Browser → http://127.0.0.1:54321 (❌ Fails from external URL)
```

### After (Backend Check)
```
Browser → /api/graphql → Backend (localhost:4000) → Supabase (localhost:54321) ✅
```

## Benefits
1. ✅ Works from external URLs (ngrok, etc.)
2. ✅ Consistent with other service checks (Synapse uses same pattern)
3. ✅ Better error handling and reporting
4. ✅ Shows actual server/database information in UI
5. ✅ No changes needed to DataManagementPage component

## Testing
1. Access UI from external URL: `https://talia.ngrok.dev/celestyal`
2. Navigate to Data Mode panel
3. Check Server Status section
4. Supabase should show as online if running locally
5. If offline, error message will show details

## Files Modified
- ✅ `talia-server/src/api/schema.ts` - Added query
- ✅ `talia-server/src/api/resolvers.ts` - Added resolver
- ✅ `talia-ui/src/config/serverServices.js` - Updated config

## Next Steps
1. Restart backend server to pick up schema/resolver changes
2. Test from external URL
3. Verify Supabase status shows correctly

