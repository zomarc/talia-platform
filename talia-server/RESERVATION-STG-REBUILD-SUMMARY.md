# Reservation Integration Rebuild - Summary

## Overview

This document summarizes the plan to completely rebuild the reservation integration to use `stg.*` tables instead of the current `dwh.*` and `fou.*` tables.

## Current Problems

1. **Reservation table is empty** - Currently syncing from `dwh.Fact_Reservation_History` but table has 0 rows
2. **Complex filtering** - Requires EXISTS subqueries and complex date filtering
3. **Performance issues** - Processing 2.9M+ rows unnecessarily
4. **Wrong source** - Using fact/history tables instead of current staging tables

## Solution: Use stg.* Tables

### Expected Tables
- `stg.RES_HEADER` - Main reservation header/current state (primary source)
- `stg.RES_*` - Other related reservation tables as needed

### Benefits
- ✅ Current state data (not historical snapshots)
- ✅ Simpler queries (no complex EXISTS needed)
- ✅ Better performance (only current reservations)
- ✅ Cleaner data model

## Implementation Plan

See `PLAN-RESERVATION-STG-REBUILD.md` for detailed plan.

### Quick Start

1. **Explore stg.RES_* tables:**
   ```bash
   npm run explore-stg-res
   ```

2. **Review the plan:**
   - Read `PLAN-RESERVATION-STG-REBUILD.md`
   - Follow Phase 1 (Discovery) first

3. **Implementation phases:**
   - Phase 1: Discovery & Analysis
   - Phase 2: Rebuild Reservation Table Sync
   - Phase 3: Rebuild Reservation Changes Sync
   - Phase 4: Data Migration & Validation
   - Phase 5: Cleanup & Documentation

## Key Files

- `PLAN-RESERVATION-STG-REBUILD.md` - Detailed implementation plan
- `scripts/explore-stg-res-tables.js` - Script to explore stg.RES_* tables
- `sync.config.json` - Sync configuration (needs update)
- `src/services/synapse-sync.js` - Transform logic (needs update)
- `src/services/reservation-changes-sync.js` - Change tracking (needs update)

## Next Steps

1. Run `npm run explore-stg-res` to discover available tables
2. Document the schema and column mappings
3. Update `sync.config.json` to use `stg.RES_HEADER`
4. Update transform logic in `synapse-sync.js`
5. Test and validate

## Questions to Answer

1. Which stg.RES_* table contains current reservation state?
2. How are changes tracked in stg.* schema?
3. What date column should be used for filtering?
4. Are there relationships between stg.RES_* tables?


