# Inventory Item ↔ Source Data Linking

The contract for how external / warehouse source tables relate to
`inventory_item`, Talia's **source-independent canonical sailing layer**.

This document defines the **data linkage**. For panel-to-panel selection linking
(which consumes this layer), see [`CANONICAL-SELECTION-LINKING.md`](./CANONICAL-SELECTION-LINKING.md).

**Last updated:** 2026-07-08

---

## The principle

`inventory_item` is **not** a copy of Synapse or DWH tables. It is Talia's own
canonical identity for a sail on a ship.

| Layer | What it is | Examples |
|-------|------------|----------|
| **Source** | Upstream systems (Synapse / DWH / STG) — authoritative business facts | `dwh.Dim_Master_Sail`, `dwh.Dim_Sail_By_Cabin_Occupancy`, `fou.Fact_Reservation_daily` |
| **Local mirror** | Synced copies in Talia Postgres | `master_sail`, `sail_by_cabin_occupancy`, `reservation_current_state` |
| **Canonical** | Source-independent sailing identity + hierarchy | `inventory_item` (+ views `sailing_master`, `sailing_hierarchy`, `inventory_item_operational`) |

**Rule:** panels and events resolve *identity* (which voyage / which physical
scope) through `inventory_item`. Facts (berths, guests, rates) stay on their
source-mirrors and join **in via** `sail_code` / `ship_code` / `reference_sail_code`.

Never invert this: do not treat `master_sail` (or any other sync table) as the
canonical hierarchy for cross-panel linking.

---

## Primary feed: `master_sail` → `inventory_item`

### Upstream path

```
dwh.Dim_Master_Sail
        │  Synapse sync (syncType: master_sail)
        ▼
public.master_sail          ← local mirror (selling schedule)
        │  after successful sync:
        │  RPC refresh_inventory_item_sailing_hierarchy()
        ▼
public.inventory_item       ← canonical layer (identity + hierarchy)
```

Sync hook: `talia-server/src/services/synapse-sync.js` calls the RPC when the
`masterSail` sync finishes successfully.

Migration / function definition:
`talia-server/supabase/migrations/20260708100000_inventory_item_sailing_hierarchy.sql`.

### Unique key

`inventory_item` is unique on **`(sail_code, ship_code)`** (where both are
non-null). That is the stable join key from source-mirrored sailing rows.

### Field mapping (defined)

| `inventory_item` column | From `master_sail` | Definition |
|-------------------------|--------------------|------------|
| `sail_code` | `sail_code` | Physical / selling sail identifier for this row |
| `ship_code` | `ship_code` | Ship identity |
| `ship_name` | `ship_name` | Display name (refreshed on upsert) |
| `master_sail_id` | `sail_id` | Upstream sail id when present |
| `package_id` | `package_id` | Package id when present |
| `source_table` | constant `'master_sail'` | Provenance of the identity row |
| `source_row_id` | `COALESCE(sail_id::text, sail_code)` | Provenance pointer back to the mirror |
| `reference_sail_code` | see below | **Canonical management / master sail code** |
| `sailing_role` | see below | `'master'` or `'segment'` |
| `parent_inventory_item_id` | self-join via reference | FK to the master `inventory_item` (NULL for masters) |
| `is_operational` | see below | Exclude cancelled / fake / inactive from operational views |

### Hierarchy rules (authoritative)

`talia_reporting_sail_code(sail_code, master_voyage1, is_main)`:

- If `is_main = 1` → **master**: `reference_sail_code = sail_code`, `sailing_role = 'master'`.
- Else → **segment**: `reference_sail_code = COALESCE(NULLIF(TRIM(master_voyage1), ''), sail_code)`, `sailing_role = 'segment'`.

Parent link:

1. Prefer: segment's `reference_sail_code` + same `ship_code` matches a master row's `sail_code`.
2. Fallback: segment's `reference_sail_code` matches a master's `sail_code` (ship optional) when still unlinked.

`talia_master_sail_is_operational(sail_code, is_fake, is_active)` is **true** only when:

- `is_fake <> 'Y'`, and
- `is_active <> 'N'`, and
- `sail_code` does **not** contain `-CX` (cancelled).

### Refresh behaviour (idempotent)

`refresh_inventory_item_sailing_hierarchy()` always:

1. **Upserts** identity rows from distinct `(sail_code, ship_code)` in `master_sail`
   (`source_table = 'master_sail'`).
2. **Updates** hierarchy fields (`reference_sail_code`, `sailing_role`, `is_operational`, …).
3. **Clears** `parent_inventory_item_id` on masters, then **re-links** segments.

Call this after any material change to `master_sail` content if sync did not
already run (e.g. local restores, one-off loads).

---

## What `inventory_item` is responsible for vs not

### Owns (identity)

- Stable `(sail_code, ship_code)` identity
- Master ↔ segment hierarchy (`reference_sail_code`, `sailing_role`, `parent_inventory_item_id`)
- Operational flag (`is_operational`)
- Provenance (`source_table`, `source_row_id`)
- Extensions that hang off the identity (memos, profile curve points)

### Does **not** own (facts stay on source mirrors)

| Concern | Source of truth (local) | Upstream (typical) | Join into `inventory_item` |
|---------|-------------------------|--------------------|----------------------------|
| Schedule / package / ports | `master_sail` | `dwh.Dim_Master_Sail` | `(sail_code, ship_code)` |
| Physical berths / occupancy by day | `ship_day_berth_status` ← `sail_by_cabin_occupancy` | `dwh.Dim_Sail_By_Cabin_Occupancy` | `sail_code` (+ `ship_code`); expand voyage via `reference_sail_code` |
| Guest / booking counts | `reservation_current_state` | `fou.Fact_Reservation_daily` | `sail_code` (selling); voyage scope via `reference_sail_code` / `sail_codes[]` |
| Published rates | `published_rates_current_state` | published rates pipeline | `sail_code` |
| Ship dimensions / AIS context | `ship` (+ optional MMSI/IMO on `inventory_item`) | ship tables / config | `ship_code` |

**Physical vs selling reminder:** berth capacity for a voyage is the **physical**
berth pool on the ship × day — never sum master + segment capacity. Use
`inventory_item` to know which `sail_code`s belong to the same voyage, then take
physical facts from `ship_day_berth_status` (typically max / same-day berth pool),
not a naïve SUM across hierarchy members.

---

## Helper views (Talia reporting surfaces)

| View | Definition |
|------|------------|
| `inventory_item_operational` | `inventory_item` where `is_operational = true` |
| `sailing_master` | Operational rows with `sailing_role = 'master'` |
| `sailing_hierarchy` | Segments with parent master link + `master_sail` schedule enrichment |
| `sailing_physical_day_map` | Master ↔ segment date windows for selling structure mapping |
| `ship_day_berth_status` | Physical berth capacity/occupied/available by `ship_code`, `sail_code`, date |

Prefer these views for reporting grains; prefer raw `inventory_item` when building
the selection index or mutating extensions.

---

## How other components should join

### Resolve identity first

```
input sail_code or ship_code
        │
        ▼
inventory_item  →  reference_sail_code, ship_code, sail_codes[], sailing_role
        │
        ├── physical facts:  filter ship_day_capacity by ship_code
        │                    (nameplate / offsale / sellable / occupied / available)
        │                    highlight sail_codes ∈ voyage; never sum master + segments
        └── selling facts:   filter reservations / rates / master_sail
                             by reference_sail_code or sail_codes
```

### Do

- Join facts on `sail_code` and/or `ship_code` **after** resolving through
  `inventory_item` when the question is “which voyage?” or “which ship days?”.
- Treat `reference_sail_code` as the **management / master** key for a voyage.
- Keep `source_table` / `source_row_id` when inserting manual / alternate identity
  rows so provenance stays auditable.

### Don't

- Don't invent a second hierarchy from `master_sail.is_main` / `master_voyage1` in
  UI code — the refresh function already materialised that into `inventory_item`.
- Don't use `master_sail` alone as the cross-panel canonical key.
- Don't duplicate hierarchy rules in panel transforms (use `inventoryReference`
  / `inventoryReferenceService` for selections; use DB views for SQL reports).

### Canonical capacity (`ship_day_capacity`)

Current and historic capacity share one voyage-day formula. Occupancy is already
historic by itinerary date; `ship_cabin_reserve` windows overlay the same dates.

| Field | Meaning |
|-------|---------|
| nameplate | Physical occupancy totals (Tot C / Cap B) |
| offsale | Distinct cabins whose reserve window overlaps the date and type is offsale (`RESERVED`, `BROKEN`, `OUT OF ORDER`, `EMERGENCY`, `WAREHOUSE`, `CREW`, `OVER`) |
| sellable | nameplate minus offsale — load-factor denominator |
| occupied | Occupancy |
| available | sellable minus occupied |

Segment / port-pair holds and `HANDICAP` / `VIP*` stay visible on Cabin Deck but
do **not** reduce sellable. Attach physical numbers to `reference_sail_code` only
— never sum master + segments. MSE `Res C` (`guaranteed_cabins`) is a selling hold,
not Seaware offsale.

---

## Provenance contract

Every automated identity row from the hierarchy refresh carries:

- `source_table = 'master_sail'`
- `source_row_id = COALESCE(sail_id::text, sail_code)`

Manual / GraphQL upserts may set other `source_table` values (e.g. `'manual'`).
That does **not** change the uniqueness rule: still `(sail_code, ship_code)`.

---

## Table catalogue metadata

Configured in `talia-ui/src/config/tableSources.js`:

| Table | `type` | Upstream `source` | Load / refresh |
|-------|--------|-------------------|----------------|
| `master_sail` | `direct` | `dwh.Dim_Master_Sail` | Synapse sync |
| `inventory_item` | `application` | — | Hierarchy refresh (from `master_sail`) |
| `inventory_item_operational` | `application` | — | View |
| `sailing_master` / `sailing_hierarchy` | `application` | — | View |
| `ship_day_berth_status` | `application` | — | View over `sail_by_cabin_occupancy` |
| `ship_day_capacity` | `application` | — | View: nameplate + offsale + sellable by ship x sail x itinerary date |
| `ship_cabin_reserve` | `direct` | `stg.SHIP_CABIN_RESERVE` | Synapse sync (offsale / segment / constrained holds) |

---

## Key files

| Concern | Location |
|---------|----------|
| Schema + refresh RPC + views | `talia-server/supabase/migrations/20260708100000_inventory_item_sailing_hierarchy.sql` |
| Physical berth view + selling day map | `talia-server/supabase/migrations/20260708120000_ship_day_berth_status.sql` |
| Canonical capacity (nameplate + offsale + sellable) | `talia-server/supabase/migrations/20260818180000_ship_day_capacity.sql` |
| Original identity table | `talia-server/supabase/migrations/20260302000000_create_inventoy_item_and_memos.sql` |
| `reference_sail_code` column | `talia-server/supabase/migrations/20260311000000_add_reference_sail_code_to_inventory_item.sql` |
| Sync → refresh hook | `talia-server/src/services/synapse-sync.js` |
| UI table metadata | `talia-ui/src/config/tableSources.js` |
| Selection consumers of this layer | `docs/CANONICAL-SELECTION-LINKING.md` |

---

## Do / Don't (data)

**Do**

- Treat `inventory_item` as the only canonical sailing hierarchy.
- Refresh hierarchy after `master_sail` sync (or run the RPC manually after
  bulk loads).
- Join fact tables *to* the resolved voyage / ship scope.

**Don't**

- Don't re-derive master/segment from source mirrors in application code.
- Don't store berth totals or guest counts on `inventory_item` (facts stay upstream).
- Don't sum physical capacity across a master and its segments.
