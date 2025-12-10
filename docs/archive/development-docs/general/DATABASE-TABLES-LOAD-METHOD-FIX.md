# Database Tables Load Method Fix - Plan

## Problem

After migrating to GraphQL, all tables show `loadMethod: 'Direct'` incorrectly.

## Root Cause

1. **Original Logic**: Frontend calculated `loadMethod` from `tableSources.js`:
   - `type === 'derived'` → `'Batch'`
   - `isLargeDataset === true` → `'Batch'`  
   - Otherwise → `'Direct'`

2. **What Happened**: 
   - GraphQL resolver hardcodes `loadMethod: 'Direct'` and `type: 'direct'` for ALL tables
   - Backend doesn't have access to `tableSources.js` config
   - Frontend tries to recalculate but uses wrong `type` from GraphQL

3. **The Issue**:
   - Backend returns `type: 'direct'` for everything
   - Frontend uses GraphQL's `type` instead of `tableConfig.type` from `tableSources.js`
   - So derived tables (like `reservation_changes`) show as 'Direct' instead of 'Batch'

## Solution

**Frontend should calculate loadMethod from `tableSources.js`, not from GraphQL**

### Changes Needed:

1. **GraphQL Resolver**: 
   - Remove `loadMethod` calculation (backend doesn't know the config)
   - Remove hardcoded `type: 'direct'` (or make it optional/nullable)
   - Backend should only return raw metadata (rowCount, dateRange, etc.)

2. **Frontend Hook**:
   - After receiving GraphQL response, get `tableConfig` from `getTableSource()`
   - Calculate `loadMethod` using original logic:
     ```javascript
     const tableConfig = getTableSource(table.tableName);
     const loadMethod = tableConfig.type === 'derived' ? 'Batch' : 
                       (tableConfig.isLargeDataset ? 'Batch' : 'Direct');
     ```
   - Use `tableConfig.type` and `tableConfig.source`, not from GraphQL

## Implementation Steps

1. Update GraphQL schema - make `loadMethod` optional or remove it
2. Update resolver - don't calculate `loadMethod` or `type`
3. Update frontend hook - calculate `loadMethod` from `tableConfig` after GraphQL response
