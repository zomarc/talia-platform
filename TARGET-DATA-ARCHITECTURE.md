# Target Data Architecture

Unified architecture for actual, supplied target, finance budget, and Talia nested LF targets.

## Profile vocabulary (canonical)

| Term | Meaning |
|------|---------|
| **Profile** | Curve from 0 → endpoint (weeks-to-sail or book-date axis) |
| **Physical profile** | Profile for an `inventory_item` that could/was/may be sold |
| **History profile** | Physical profile that happened (past sail) |
| **Model profile** | Adjustable, assignable history profile used as prior for future |
| **Target profile** | Editable goal curve for future events (`inventory_target_profile`, active flag) |
| **Budget profile** | Financial end-state / performance measure (`budget` table; week curve deferred) |

Sail ↔ model binding: `profile_model_map` (`lazy` default via prior-year peer, or `manual` override).
Compare UI: **Sailing Profile** (`ProfileCompare`) — REAL vs model (+ optional active target overlay, budget gap).

Aggregation views (read-only): ship × month and DOW × duration via `profileAggregations`.

## Implementation Status

- [x] Target data loading in Data Management (Import target CSV)
- [x] Central store: `booking_targets_supplied` table
- [x] Mapping config table: `target_mapping_config` (schema only; UI deferred)
- [x] Inventory-scoped dimensional REAL profile (`bookingProfileDimensional`)
- [x] Absolute vs load-factor % display
- [x] Market / market group / currency breakdown
- [x] YoY weeks-to-sail overlay (illustrative; peer resolution)
- [x] Finance budget table + sync config (`lkp.BUDGET` → `budget`) end-state comparison
- [x] Nested LF target profiles (`inventory_target_profile` + nodes), multi-perspective + **is_active**
- [x] Model map (`profile_model_map`) + ProfileCompare GraphQL
- [x] MSE review highlight vs active target (`profileTargetReviewStatuses`)
- [x] Multi-level aggregations (`profileAggregations`) — counts / coverage, not full curves
- [ ] Generic mapping config UI (visual, editable)
- [ ] Budget shaped onto week curve (future)
- [ ] Forecast (deferred)

## Data Sources

| Stream | Source | Storage | Notes |
|--------|--------|---------|-------|
| **REAL** | `reservation` (+ cabin occupancy for LF end) | Runtime | Reservation Booking Curve / ProfileCompare |
| **Model prior** | History peer sail | `profile_model_map` + lazy finder | ±21d same ship year-1 |
| **Supplied TARGET** | CSV import | `booking_targets_supplied` | Company targets |
| **Finance BUDGET** | `lkp.BUDGET` sync | `budget` | End-state pax by voyage × market × roll-up × currency |
| **Target profile** | UI editor | `inventory_target_profile` (+ nodes) | Named goals; one `is_active` per item |
| **Legacy MODEL** | Graph editor | `inventory_item_profile_curve_point` | Absolute bookings/guests |
| **Legacy** | — | `target_profiles` | Read-compat only |

Do **not** overload `target_mapping_config` (CSV column map only).

See also: [talia-ui/docs/BOOKING_PROFILE_GOALS.md](talia-ui/docs/BOOKING_PROFILE_GOALS.md).
