# Booking profiles: REAL, TARGET, MODEL, finance budget

Maps **product intent** to **panels** after the inventory-scoped dimensional profile work.

## System ownership (`talia`)

Canonical **REAL / TARGET / BUDGET / MODEL** profile data stored in Supabase is owned by the **Talia system**:

- **Scope:** `system` (GraphQL `ProfileSeriesScope.SYSTEM`)
- **Owner key:** `talia` (`TALIA_SYSTEM_OWNER_KEY`)
- **Humans:** viewers by default; **Manager+** may mutate curves, nested LF targets, and `target_profiles`.

## ① REAL — actual booking behaviour (primary)

- **What:** Inventory-scoped voyage profile (master + segment `sail_codes`), week build curves, dimensional distribution.
- **Primary panel:** **Real booking profile (+ YoY)** (`booking-profile`).
- **Controls:** Breakdown = Total | Market group | Market | Currency; Metric = Guests | Bookings | Load factor %.
- **API:** `bookingProfileDimensional` / `bookingProfileDimensionalYoY`.
- **Capacity:** counted once (berth status or `ship.ship_pax_capacity`) — never sum master + segment berths.
- **History:** If `reservation_changes` snapshot density is thin, the panel shows a data-quality callout and current distribution still works from `reservation`. Re-sync `reservationChanges` with a wide `Snapshot_Date` range (see `sync.config.json`).

## YoY (secondary / illustrative)

- Weeks-to-sail aligned overlay; peer resolved via ship + sail-date window when not passed explicitly.
- UI callout: recent years are weak futures proxies — not a planning baseline.

## Finance budget (end-state)

- Synapse `lkp.BUDGET` → `budget` table (`sync.config.json` key `budget`).
- **API / UI:** `budgetEndStateComparison` — passengers by market / market group / currency vs actual guests; not a week curve.
- Labelled **Finance budget** (distinct from commercial TARGET/MODEL perspectives).

## ② TARGET — supplied external targets

- CSV → `booking_targets_supplied` via Data Management.
- Panel: **TARGET only (imported)**.

## ③ MODEL + nested LF perspectives

- **MODEL graph editor** (`booking-target-profile-editor-simple`): absolute bookings/guests points on `inventory_item_profile_curve_point`.
- **Nested LF target profiles** (`inventory-target-profile-editor`): many named perspectives per inventory item; tree voyage → market_group → market → currency; metric = load factor %. Tables: `inventory_target_profile`, `inventory_target_profile_node`.

## Legacy

- **Target Profile Editor** / `target_profiles`: hidden from Reports; keep read-compat only.
- Diagnostic Simple REAL / Overlay panels: hidden from Reports; prefer primary Booking Profile.

## Forecast

Deferred until REAL + targets + budget are in regular use.
