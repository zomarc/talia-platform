# Framework Directives

Authoritative rules for consolidating Talia onto one consistent application framework.
This document is the human-readable contract. **CI is the definitive enforcement gate.**

## Authority order

1. **Canonical docs** — what the framework is (`docs/DOCS-CANONICAL.md`, this file, UI standards).
2. **CI / `check:standards`** — the merge gate. If code violates a measurable rule, CI fails.
3. **Cursor / IDE rules** — optional agent hints only. They must not invent a second standard.
   If a Cursor rule and CI disagree, **CI wins**.

Do not treat Cursor rules as the access point for “is this allowed?”. Run:

```bash
cd talia-ui && npm run check:standards
cd talia-ui && npm run check:standards:strict   # fail on warnings
```

Root convenience (when wired): `npm run check:standards` from the monorepo root.

## UI directives (measurable)

| Directive | Enforcement |
|-----------|-------------|
| Focus panels use GraphQL only via `useTableDataWithContext`, `trackedFetchGraphql`, or `trackedApolloQuery` / `trackedApolloMutate` | `scripts/check-data-boundary.mjs` |
| No inline style objects in `src/components` | `scripts/check-component-standards.mjs` |
| Container = data; Presenter = UI; report shell vocabulary | Docs + review; shell automation can grow over time |
| Selection only via `emitSailSelect` / `emitShipSelect` (and other `eventBus` helpers) | Docs + review; extend CI when patterns are stable |
| Tabulator via `tabulatorConfig.js` (`initTabulator` / `getTabulatorOptions`) | Docs + review |
| One production registry: `focus-panels/registry.js` | Docs; banned panels removed from registry |

## Canonical product paths

| Concern | Canonical | Removed / not for new work |
|---------|-----------|----------------------------|
| Master sailing explorer | `MasterSailingExplorer` (`master-sailing-explorer`) | `MasterSailing` removed; saved layouts alias `master-sailing` → explorer |
| Target profile edit | `InventoryTargetProfileEditor` | `TargetProfileEditor`, `BookingTargetProfileEditorSimple` |
| Booking curves | `ReservationBookingCurve` + `ProfileCompare` | Legacy `BookingProfile` and `Booking*Simple` diagnostics |

## Server directives (direction)

- New GraphQL logic goes in `resolver-modules/*` + domain services — not new bulk code in `resolvers.ts`.
- Sailing identity: `inventory_item`. Targets: `inventory_target_profile`.
- Deprecate legacy GraphQL fields before deleting UI callers.
- `npm test` in `talia-server` / `talia-engine` is the verification path for service math.

## Known CI debt (tracked)

Temporary allowlists in `check-data-boundary.mjs` list focus-panels that still call `fetch(GRAPHQL_URL)` / `fetch('/api/graphql')` directly. Those must migrate to `trackedFetchGraphql`. **Do not add new allowlist entries**; fix the caller instead.

## Related docs

- `talia-ui/src/components/COMPONENT-STANDARDS.md`
- `talia-ui/src/components/focus-panels/COMPONENT-CREATION-GUIDE.md`
- `docs/CANONICAL-SELECTION-LINKING.md`
- `docs/INVENTORY-ITEM-SOURCE-LINKING.md`
- `docs/FRAMEWORK-BACKLOG.md`
