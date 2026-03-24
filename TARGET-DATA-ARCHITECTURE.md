# Target Data Architecture

Unified architecture for actual, supplied target, budget, and Talia target data with configurable mappings and visual editing.

## Implementation Status

- [x] Target data loading in Data Management (Import target CSV)
- [x] Central store: `booking_targets_supplied` table
- [x] Mapping config table: `target_mapping_config` (schema only; UI deferred)
- [x] Chart reads from central store via GraphQL
- [ ] Generic mapping config UI (visual, editable)
- [ ] Editable graph points for Talia targets (drag to adjust)
- [ ] Budget data integration (different grain; mapping TBD)

## Data Sources (4 streams)

| Stream | Source | Storage | Notes |
|--------|--------|---------|-------|
| **Actual** | GraphQL `bookingProfileWithCurves` | Runtime (no storage) | From reservations / booking profile |
| **Supplied target** | CSV import (BOOKINGTARGET_*.csv) | `booking_targets_supplied` | Company targets via Data Management |
| **Budget** | `budget` table (if synced) | Supabase | MASTER_VOYAGE, PASSENGERS, etc. — different grain |
| **Talia target** | User-edited on chart | `target_profiles` | Editable build curves; stored centrally |

## Central Data Store

### Tables

1. **`booking_targets_supplied`** — CSV-imported company targets  
   - Populated by Data Management "Import target CSV"  
   - Columns: `sail_code`, `ship_code`, `week_label`, `weeks_until_sailing`, `target_bookings`, `target_guests`, `import_batch_id`, `imported_at`  

2. **`target_mapping_config`** — Visual mapping rules  
   - Editable in UI; defines how CSV columns → internal fields  
   - Columns: `id`, `name`, `config` (JSONB), `is_active`, `created_at`, `updated_at`  
   - Config shape: `{ sailCodeColumn, weekColumn, targetBookingsColumn, targetGuestsColumn, ... }`  

3. **`target_profiles`** (existing) — Talia targets (user-edited curves)  
   - `build_curves` JSONB holds editable points  
   - Linked by `sail_code`, `ship_code`, `package_type`, etc.  

4. **Consolidated view** (computed at runtime)  
   - Per sail + week: `actual`, `supplied_target`, `budget_target`, `talia_target`  
   - Built by resolver from the above sources  

## Data Management Integration

- New section or table row: **"Booking targets"**  
- Actions: **Import target CSV** — opens file picker, parses CSV, applies mapping, upserts into `booking_targets_supplied`  
- Shows: last import time, row count, any parse errors  

## Mapping Configuration

- Generic, editable mappings stored in `target_mapping_config`  
- UI: dropdowns to map CSV column name → internal field (sail_code, week_label, target_bookings, target_guests)  
- One active mapping config; others kept as history/presets  

## Chart Component

- Displays: Actual, Supplied target, Budget target, Talia target (toggleable)  
- **Editable Talia target**: draggable points on the chart; changes persisted to `target_profiles`  
- Uses Chart.js with custom plugin for point dragging  

## Flow

1. **Import** (Data Management): CSV → parse → apply mapping → `booking_targets_supplied`  
2. **Map**: Configure/select mapping in Data Management or in chart settings  
3. **View** (Booking Target Chart): Load actual + supplied + budget + talia → align by sail/week → render  
4. **Edit** (Chart): Drag Talia target points → save to `target_profiles`  
