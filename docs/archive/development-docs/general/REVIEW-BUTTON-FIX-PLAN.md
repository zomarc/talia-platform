# Review Button Fix Plan

## Problem

The "Review" button in Data Mode makes a direct Supabase call:
```javascript
const { data, error } = await supabase
  .from(table.tableName)
  .select('*')
  .limit(100);
```

This fails from external URLs because the browser can't access `127.0.0.1:54321`.

## Solution

Create a generic GraphQL query to fetch table data through the backend.

## Implementation Steps

1. **Add GraphQL Query**: `tableData(tableName: String!, limit: Int): [JSON!]!`
   - Generic query that can fetch any table
   - Returns JSON array (since table schemas vary)

2. **Create Resolver**: 
   - Use `supabaseDataService.client.from(tableName).select('*').limit(limit)`
   - Return raw data as JSON

3. **Update Review Button**:
   - Replace direct Supabase call with GraphQL query
   - Use `/api/graphql` endpoint

## Files to Modify

1. `talia-server/src/api/schema.ts` - Add `tableData` query
2. `talia-server/src/api/resolvers.ts` - Add resolver
3. `talia-ui/src/components/DataManagementPage.jsx` - Update review button

