# Canonical Selection Linking (inventory_item reference)

How Talia panels link to each other. This is the **single, canonical mechanism**
for component-to-component selection. Read this before adding a new panel that
emits or responds to a selection.

**Last updated:** 2026-07-07

---

## The principle

Talia separates the **physical** world (ships, berths, days) from the **selling**
structure (master sailings, segments, sail codes). `inventory_item` is the
source-independent **canonical layer** that ties them together.

> Every selection event is translated through `inventory_item.reference_sail_code`
> **at emit time**, so the dispatched event already carries a consistent canonical
> payload. Listening panels simply refresh and/or filter on the fields they care
> about — they do not each re-implement the translation.

A master voyage and all of its segments share:

- one `reference_sail_code` (the canonical / management sail code)
- one `ship_code`
- the full set of physical `sail_code`s (master + segments)

So resolving a selection through the reference gives every consumer the complete
physical + selling scope of that selection.

---

## The two events

| Event | Clear event | Meaning |
|-------|-------------|---------|
| `talia:sail.select` | `talia:sail.clear` | A sailing (master or segment) was selected |
| `talia:ship.select` | `talia:ship.clear` | A ship was selected |

Constants and emit helpers live in `talia-ui/src/lib/eventBus.js`:

- `SAIL_SELECT_EVENT`, `SAIL_CLEAR_EVENT`, `SHIP_SELECT_EVENT`, `SHIP_CLEAR_EVENT`
- `emitSailSelect(detail)`, `emitSailClear()`, `emitShipSelect(detail)`, `emitShipClear()`

**Always emit through these helpers.** They perform the canonical translation.
Do not hand-roll `window.dispatchEvent(new CustomEvent('talia:sail.select', ...))`.

---

## Data flow

```
Emitter component
  emitSailSelect({ sail_code, reference_sail_code?, row_data? })
        │
        ▼
eventBus.dispatchCanonicalSelection()
        │  enrichSelectionDetail(raw)
        ▼
inventoryReferenceService  ◄── inventory_item index
  (primed by panels; GraphQL fallback if not)
        │
        ▼
Enriched event detail:
  { ...raw,
    reference_sail_code,
    ship_code,
    ship_name,
    sail_codes: [...],
    canonical_scope: { reference_sail_code, ship_code, ship_name, sail_codes[], roles[], source } }
        │
        ▼
Listening panels → read canonical_scope → refresh / filter
```

---

## Key modules

| Concern | File |
|---------|------|
| Pure resolver (no I/O, unit-tested) | `talia-ui/src/lib/inventoryReference.js` |
| Shared service: cache + translate at emit | `talia-ui/src/services/data/inventoryReferenceService.js` |
| Event constants + canonical emit helpers | `talia-ui/src/lib/eventBus.js` |
| Reference example (emitter) | `talia-ui/src/components/focus-panels/MasterSailingExplorer/` |
| Reference example (listener) | `talia-ui/src/components/focus-panels/ShipDayBerth/` |

### `inventoryReference.js` (pure)

- `buildInventoryReferenceIndex(inventoryItems)` → `{ byReference, referenceBySailCode }`
- `resolveSelectionScope(detail, index)` → canonical scope, with graceful fallbacks:
  - master selected → full physical scope
  - **segment selected → hops to its master reference** and returns the whole voyage
  - ship-only selection → ship scope
  - unmapped reference → reference-only scope (still usable)
- `resolveReferenceSailCode`, `resolveSailCode`, `resolveShipCode` helpers

### `inventoryReferenceService.js` (stateful, shared)

- `setInventoryItems(rows)` — panels that already load `inventory_item` prime the
  shared index (no duplicate fetch).
- `ensureInventoryIndex()` — GraphQL fallback load if nothing primed it yet.
- `enrichSelectionDetail(raw)` — merges canonical scope into a raw detail.
- `resolveScopeSync(detail)` / `resolveScope(detail)` — resolve against the cache.
- `isInventoryIndexReady()`, `onInventoryIndexChange(fn)`, `__resetInventoryReferenceService()` (tests).

---

## The canonical payload contract

Every `sail.select` / `ship.select` event `detail` includes:

```js
{
  // original fields the emitter provided are preserved (row_data, sailing_role, ...)
  reference_sail_code: 'CJ07260718',   // canonical management code
  ship_code:           'CJ',
  ship_name:           'Celestyal Journey',
  sail_codes:          ['CJ07260718', 'CJ07260719'], // master + segments
  canonical_scope: {
    reference_sail_code: 'CJ07260718',
    ship_code:  'CJ',
    ship_name:  'Celestyal Journey',
    sail_codes: ['CJ07260718', 'CJ07260719'],
    roles:      ['master', 'segment'],
    source:     'inventory_reference' // | 'ship_code' | 'reference_only'
  }
}
```

`source` tells a listener how the scope was resolved:

- `inventory_reference` — fully translated via `inventory_item` (trusted)
- `ship_code` — direct ship selection, not (yet) mapped to a voyage
- `reference_only` — a reference/sail we couldn't map; scoped by its own codes

---

## How to ADD A PANEL THAT EMITS a selection

1. Load `inventory_item` (operational) in your container and prime the cache:

```jsx
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';

useEffect(() => {
  if (inventoryRows?.length) setInventoryItems(inventoryRows);
}, [inventoryRows]);
```

2. Emit via the helper — pass whatever you have; translation fills the rest:

```jsx
import { emitSailSelect } from '../../../lib/eventBus';

emitSailSelect({
  sail_code: row.reference_sail_code || row.sail_code,
  reference_sail_code: row.reference_sail_code || row.sail_code,
  row_data: row,
});
```

That's it — do **not** resolve ship/segment relationships yourself before emitting.

---

## How to ADD A PANEL THAT LISTENS to a selection

Prefer the canonical scope carried on the event; fall back to a local resolve
only for robustness (e.g. events from not-yet-updated emitters):

```jsx
import { SAIL_SELECT_EVENT, SAIL_CLEAR_EVENT, SHIP_SELECT_EVENT, SHIP_CLEAR_EVENT }
  from '../../../lib/eventBus';
import { buildInventoryReferenceIndex, resolveSelectionScope }
  from '../../../lib/inventoryReference';

useEffect(() => {
  const handleSelect = (event) => {
    const scope = event?.detail?.canonical_scope
      || resolveSelectionScope(event?.detail, localInventoryIndex);
    setSelectedScope(scope);        // then filter / refresh your data
  };
  const handleClear = () => setSelectedScope(null);

  [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT].forEach((n) => window.addEventListener(n, handleSelect));
  [SAIL_CLEAR_EVENT, SHIP_CLEAR_EVENT].forEach((n) => window.addEventListener(n, handleClear));
  return () => {
    [SAIL_SELECT_EVENT, SHIP_SELECT_EVENT].forEach((n) => window.removeEventListener(n, handleSelect));
    [SAIL_CLEAR_EVENT, SHIP_CLEAR_EVENT].forEach((n) => window.removeEventListener(n, handleClear));
  };
}, [localInventoryIndex]);
```

Then respond by:

- **Physical panels** (e.g. Ship × Day Berths): filter by `scope.ship_code`,
  highlight rows whose `sail_code ∈ scope.sail_codes`.
- **Selling panels** (e.g. reservations, rates): filter by `scope.reference_sail_code`
  or the specific `scope.sail_codes`.

Panels using `useTableDataWithContext` on `sail.select` keep working unchanged, and
now additionally receive `ship_code` + `canonical_scope` for richer filtering.

---

## Database backing

`inventory_item` (canonical) carries:

- `sail_code`, `reference_sail_code`, `ship_code`, `ship_name`
- `sailing_role` (`master` | `segment`), `parent_inventory_item_id`, `is_operational`

Refreshed by `refresh_inventory_item_sailing_hierarchy()` after master-sail sync
(see `talia-server/supabase/migrations/20260708100000_inventory_item_sailing_hierarchy.sql`).
Physical berths come from `ship_day_berth_status`
(`talia-server/supabase/migrations/20260708120000_ship_day_berth_status.sql`).

**How source tables feed this layer** (field mapping, hierarchy rules, join
contracts): [`docs/INVENTORY-ITEM-SOURCE-LINKING.md`](./INVENTORY-ITEM-SOURCE-LINKING.md).

---

## Tests

- `talia-ui/src/lib/inventoryReference.test.mjs`
- `talia-ui/src/services/data/inventoryReferenceService.test.mjs`

Run:

```bash
cd talia-ui && node --test src/lib/inventoryReference.test.mjs src/services/data/inventoryReferenceService.test.mjs
```

---

## Do / Don't

**Do**

- Emit selections only via `emitSailSelect` / `emitShipSelect`.
- Prime the index with `setInventoryItems` whenever you load `inventory_item`.
- Read `canonical_scope` on the receiving side.
- Treat physical (`ship_code`, berths) and selling (`reference_sail_code`, guests) as
  separate concerns that meet through `inventory_item`.

**Don't**

- Don't dispatch raw `sail.select` / `ship.select` CustomEvents directly.
- Don't re-derive master↔segment or sail↔ship relationships inside a listener.
- Don't sum physical capacity across a master and its segments (same berths).
