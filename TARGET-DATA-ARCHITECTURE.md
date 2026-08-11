# Target Data Architecture

Unified architecture for actual, supplied target, finance budget, and Talia nested LF targets.

## Implementation Status

- [x] Target data loading in Data Management (Import target CSV)
- [x] Central store: `booking_targets_supplied` table
- [x] Mapping config table: `target_mapping_config` (schema only; UI deferred)
- [x] Inventory-scoped dimensional REAL profile (`bookingProfileDimensional`)
- [x] Absolute vs load-factor % display
- [x] Market / market group / currency breakdown
- [x] YoY weeks-to-sail overlay (illustrative; peer resolution)
- [x] Finance budget table + sync config (`lkp.BUDGET` → `budget`) end-state comparison
- [x] Nested LF target profiles (`inventory_target_profile` + nodes), multi-perspective
- [ ] Generic mapping config UI (visual, editable)
- [ ] Budget shaped onto week curve (future)
- [ ] Forecast (deferred)

## Data Sources

| Stream | Source | Storage | Notes |
|--------|--------|---------|-------|
| **REAL** | `reservation` + `reservation_changes` via inventory scope | Runtime | Master + segment `sail_codes` |
| **Supplied TARGET** | CSV import | `booking_targets_supplied` | Company targets |
| **Finance BUDGET** | `lkp.BUDGET` sync | `budget` | End-state pax by voyage × market × roll-up × currency |
| **Nested LF MODEL** | UI editor | `inventory_target_profile` (+ nodes) | Many perspectives per inventory item |
| **Legacy MODEL** | Graph editor | `inventory_item_profile_curve_point` | Absolute bookings/guests |
| **Legacy** | — | `target_profiles` | Read-compat only |

See also: [talia-ui/docs/BOOKING_PROFILE_GOALS.md](talia-ui/docs/BOOKING_PROFILE_GOALS.md).
