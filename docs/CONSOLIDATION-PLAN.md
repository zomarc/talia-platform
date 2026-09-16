# Consolidation Plan (Incremental)

Phased work to keep Talia on one consistent framework while continuing product development.
**CI is the definitive gate** (`npm run check:standards`). See `docs/FRAMEWORK-DIRECTIVES.md`.

## Status legend

- **Done** — shipped
- **Next** — ready to pick up
- **Later** — depends on earlier phases

---

## Sprint A — Governance (Done / keep enforcing)

| Item | Status | Notes |
|------|--------|-------|
| Framework directives doc | **Done** | `docs/FRAMEWORK-DIRECTIVES.md` |
| CI data-boundary + standards scripts | **Done** | Root `npm run check:standards` |
| MasterSailing removed; MSE sole explorer | **Done** | Layout alias `master-sailing` → explorer |
| Untracked GraphQL allowlist (4 panels) | Debt | Migrate off allowlist; do not grow it |

**Exit:** every PR touching UI runs `check:standards`.

---

## Sprint B — Product polish (current)

Small enhancements on the live path (MSE / RM Checklist / Target Profile). Do these without waiting for cleanup.

| Item | Status | Notes |
|------|--------|-------|
| MSE compact: show cabins (Bk C) | **Done** | Compact columns: Date, Bk B, Bk C, vs Tgt |
| RM Checklist: longer explanation tooltip | **Done** | Hover action / rationale for full explanation |
| Target Profile Editor library modes | Done recently | This sailing vs Library |
| MSE scroll restore on panel switch | Done recently | |

---

## Sprint C — Hide legacy from users

Registry-only / low risk. Users only see the modern path.

| Item | Status |
|------|--------|
| `showInReports: false` on mock legacy panels (KPICards, OccupancyChart, RevenueBreakdown, SimpleTable, …) | **Next** |
| Hide BookingProfile + Booking*Simple + BookingTargetProfileEditorSimple from sidebar | **Next** |
| Hide TargetProfileEditor (already mostly off) | Confirm |
| Delete orphaned hooks (`usePublishedRatesData`, `useReservationsData`) | **Next** |

---

## Sprint D — Shared hooks & events

| Item | Status |
|------|--------|
| `useSailSelectionContext` for sail listeners | Later |
| Remove `talia.sail.select` dot listeners | Later |
| `setInventoryItems` on all sail emitters | Later |
| EventBus helpers for publishedRates / cabin / voyageReport selects | Later |

---

## Sprint E — Shell & data boundary

| Item | Status |
|------|--------|
| Report shell on SailingTable, SailingSummary, MasterVoyagePerformanceSummary, InventoryMemo | Later |
| Migrate allowlisted raw fetches → `trackedFetchGraphql` | Later |
| `useReportShellOptions` wherever registry defines views | Later |

---

## Sprint F — Server consolidation

| Item | Status |
|------|--------|
| Split `resolvers.ts` into domain modules | Later |
| Deprecate `target_profiles` / legacy booking profile GraphQL | Later |
| Shared LF-vs-target math for review / compare / engine | Later |
| Server `npm test` in CI | Later |

---

## Working rules

1. Prefer enhancing **canonical** panels (MSE, Agency, InventoryTargetProfileEditor, ReservationBookingCurve, ProfileCompare, RmChecklist, EngineActivity).
2. Do not invent parallel panels for the same job.
3. New measurable rules go into CI scripts, not Cursor-only guidance.
4. Ship Sprint B items independently of Sprint C–F cleanup.

## Related

- `docs/FRAMEWORK-DIRECTIVES.md`
- `docs/FRAMEWORK-BACKLOG.md`
- `talia-ui/src/components/COMPONENT-STANDARDS.md`
