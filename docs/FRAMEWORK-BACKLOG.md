# Framework backlog (consolidated)

Single view of outstanding work for a **stable, consistent, message-based** UI.
Generated from live code audit + docs scan (Jul 2026). Prefer this over stale `NEXT-STEPS*` roadmaps.

## Principles (non-negotiable)

- Selection: `emitSailSelect` / `emitShipSelect` / `emitReservationSelect` only — never raw `CustomEvent` for canonical selects.
- Translation at emit: `inventory_item` → `canonical_scope` on every sail/ship event.
- Chrome/layout: `publishDashboardGlobalConfig` with `changedKeys`; Filters/Details must not force full Tabulator redraw.
- Tabulator: mount once + `replaceData`; preserve scroll on layout refresh; do not `emitSailClear` on deselect side-effects.
- Shell: `talia-report__*` vocabulary; `ReportDataDetails` = secondary only (never wrap primary table/chart).
- Data: `useTableDataWithContext` / `trackedGraphql` — no raw `fetch('/api/graphql')` in feature code.
- Physical capacity: never sum master + segment berths.

---

## P0 — Framework stability

| Item | Status | Notes |
|------|--------|-------|
| Tabulator scroll + active-panel flush | **Done** | `tabulatorConfig` preserves scroll; active panel only flushes `pendingLayoutRefresh` |
| globalConfig alias scoping | **Done** | Legacy aliases only for changed fields |
| Emit helpers on emitters (SailingSummary, DataMatch, SailingTable, SimpleTable) | **Done** | Clear-on-deselect removed; SailingTable mount-once |
| MasterSailing removed; MSE is sole explorer | **Done** | `master-sailing` layout alias → `master-sailing-explorer` |
| CI is definitive standards gate | **Done** | `docs/FRAMEWORK-DIRECTIVES.md`; `npm run check:standards` |
| Groups Explorer (GRM) v1 | **Done** | Source MR display-only; Talia MR independent; registry `groups-explorer` |
| Promo Explorer v1 | **Done** | Active/related/flagged heuristics; registry `promo-explorer` |
| Selection guide + `_TEMPLATE` match canonical docs | Open | Merge `COMPONENT-CREATION-GUIDE` / template with `CANONICAL-SELECTION-LINKING.md` |
| Report-shell sweep (outliers) | Open | e.g. DemandHeatmap, MasterVoyagePerformanceSummary |
| Sidebar toggles → `publishDashboardGlobalConfig` | Open | DashboardSidebar still fires legacy-only events |

## P1 — Component debt

| Item | Status | Notes |
|------|--------|-------|
| Distribution panel | **Done (v1+)** | Channel + Market Group (`market_roll_up`) + Group/FIT; volumes need Reservation Validation |
| Capacity Validation panel | **Done (v1 ledger)** | Vertical source-attributed list; MSE-aligned physical berths called out |
| Cabin Deck Inventory | **Done (v1)** | `ship_inventory_alloc` + `ship_cabin` by deck/category; FIT/Group/GTY ONLY highlights |
| Reservation Validation ledger | Open | Same style as Capacity Validation — before trusting Distribution |
| ShipDayBerth re-focus only on scope change | Open | Avoid scroll jump on every `replaceData` |
| Group cycle without full `setData` | Open | MSE / DataMatch / ShipDayBerth |
| Booking*Simple / ColumnTerminology split | Defer | Split when next touched |
| MasterVoyagePerformanceSummary mock metrics | Open | Replace or mark demo-only |

## P2 — Data / integration

| Item | Status | Notes |
|------|--------|-------|
| Group/FIT from FACT_RESERVATION | Open | Need reliable `pax_type` / group holds without confirmed `res_id` |
| Sync `market_roll_up` + `ship_inventory_alloc` + `ship_cabin` | Open | `ship_inventory_alloc` source is `stg.RES_CABIN_ALLOCATION_DETAIL` (replaces stale `stg.SHIP_INVENTORY_ALLOC`) |
| Backfill `agency_channel` / `agency_market` on reservation | Defer | v1 joins Dim_Agency |
| Focus-group mutation admin checks | Open | `resolvers.ts` TODOs |
| Tracked wrappers for remaining Apollo services | Open | Focus/user/profile services |
| Capacity zeros / inventory sync edge cases | Open | Investigate when validation shows gaps |

## Docs / process

| Item | Action |
|------|--------|
| Root + `talia-ui/NEXT-STEPS.md`, `STYLING-STATUS.md` | Archive or fold into this file |
| `docs/FUTURE-ARCHITECTURE.md` changelog roadmaps | Rewrite or archive |
| `docs/DOCS-CANONICAL.md` | Add selection-linking + inventory-item docs |
| Booking intel roadmap | Keep as product plan (`TALIA_BOOKING_INTEL_ROADMAP.md`) |

---

## Review checklist (tomorrow)

### Architecture — Vite / discuss portal (always flaky)

- Review why Vite-dev (`:5173`) keeps dying / conflicting with Start Demo preview (`:4173`) and agent shells.
- Confirm durable presenter (launchd KeepAlive) + preview-only public path remains the rule; document restart SOP.
- Decide: single entry (`validate start-core` / `start-demo`) vs ad-hoc `npm run dev` so Cursor agents cannot strand half the stack.

### Product / UI verify

1. Open focus with MSE + Distribution + Capacity Validation + Cabin Deck Inventory + RCS.
2. Select sailing → Distribution market **groups** fill; Cabin Deck shows decks + GTY holds; Capacity Validation row fills; no MSE scroll jump.
3. Select booking → MSE stays put; Agency filters; Distribution unchanged until sail changes.
4. Toggle Filters/Details → tables do not full-refresh.
5. Click sailing once after activating another panel → single-click select.
6. On Cabin Deck chips: FIT shows `Res {id}`, GROUP shows `Group {id}`, GTY ONLY listed under unassigned.
7. Reservation Profile chart: Today line + axis to Sail (0); numeric Week −N ticks; Target overlay when active.
8. Metric reconcile one sail: Booked / Estimated / Contracted across MSE, Demand, Reservation filters, Profile Mondays.

### After 2026-08-15 UI commit (`5c203f0`) — continue

Published to **https://dev.taliahub.com** via Start Demo (rebuild `:4173` + ngrok) on 2026-08-17.

1. **Smoke:** Reservation Views → Totals instant on/off (no blank footer); Net Rev EUR whole numbers + exact on hover.
2. **Number display sweep:** drop redundant per-panel numeric formatters; fill missing dictionary `display:` kinds (MSE / Agency / …).
3. **PDF (optional):** Snapshot KPIs in Reservation Profile PDF; chart export on Target Profile if useful.
4. **Column Terminology (later):** only if ops need display-kind overrides without a deploy.
5. **Push** `main` when ready (local was ahead of origin at demo time).
