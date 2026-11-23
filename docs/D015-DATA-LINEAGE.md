# D015 — Data Lineage Admin Panel

| Field | Value |
|-------|--------|
| **Reference** | D015 |
| **Status** | Spec for v1 build |
| **Date** | 18 November 2026 |
| **Author** | Talia delivery (Russell) |
| **Audience** | Admin · Product / delivery · Data |
| **Panel** | **Data Lineage** (`data-lineage`) |
| **Documents** | Also stored as `project_document` **D015** |

---

## 1. Purpose

Admins need a single place to answer:

1. What is the **original source table**?
2. What is the **Talia mirror / target table**?
3. Which **components** use which tables?
4. For a selected entity, which **columns** are in play and what is the **provenance** of that data?
5. Can we **see** Synapse → Talia → component lineage graphically (to improve upstream source quality)?

The panel supports **grid**, **table**, and **diagram** displays, with orientation **tables** / **components** / **fields**. Components and tables are ordered / highlighted by **usage count** (data refreshes), with filters for **Source**, **Component**, **Role**, **User**, and **Recency**.

---

## 2. UX

### Views (Tab Options)

| Option | Choices | Purpose |
|--------|---------|--------|
| **Orientation** | `tables` / `components` / `fields` | Table-, component-, or field-first primary grain |
| **Display** | `grid` / `table` / `diagram` | Summary cards, Tabulator, or source-lineage Mermaid graph |

### Summary grains

**Table-first row:** original source | Talia table | consumer count | top consumers | usage score (sum of filtered data refreshes for consumers).

**Component-first row:** component | tables used | usage count | last used | roles that used it.

**Field-first row:** field | label | Synapse/Talia source | components using it | component count | refreshes (sum of panel refresh counts) | last refresh. Sorted by component overlap then refreshes. Details lists refreshes **per component**.

**Grid:** compact summary cards sorted/highlighted by usage intensity.

**Table:** Tabulator with header filters; row click selects entity and opens Details.

**Diagram:** Mermaid flowchart of **Synapse source → Talia table → Component** (pipeline lineage for source remapping). This is **not** a classical FK ERD — Talia intentionally has few/no database foreign keys. Node click opens Details.

- **Component** / **Source** filters scope the graph like grid/table. With Component set, only that panel appears; **Co-consumers** (filter checkbox or Views) restores shared-field fan-out without clearing the filter.
- **Usage-weighted edges:** thick/teal = high refreshes; solid = some usage; dashed/muted = zero in the current Role/User/Recency window. Diagram **Legends** (Views → Legends / StatusBar Legends) explains edge styles via `.talia-chart-legend`.
- **Logical links (Views, off by default):** advisory Talia↔Talia relationships from `dataLineageLogicalLinks.js` (inventory hierarchy, proposed agency joins, etc.). Drawn only when both endpoints are already on the canvas. Statuses are `proposed` / `provisional` / `confirmed`. **Never** Synapse FKs, **never** runtime join drivers — purpose is to surface remapping discussion areas while upstream models stay messy/changing.
- Role colours: Sources (slate-blue), Talia (teal), Components (warm accent). PDF export embeds a light-theme render of the same graph.

**Details (`ReportDataDetails`):** selected entity’s columns (field-usage catalog when component-scoped; ETL upsert key when table-scoped; per-component refreshes when field-scoped) plus provenance (source schema/table → target → panels). Does not replace Column Terminology.

### Filters (`.talia-report-filters`)

- **Data** scope (used / opened / all)
- **Source** — Synapse source label
- **Component** — consuming panel
- **Shared only** — fields orientation (2+ components)
- **Category** (All / Application / Admin / specific) — components orientation
- **Key** (All / Key only / Suggested) — components orientation
- **Coverage** (All / Issues only) — components / tables
- **Role**
- **User** (email)
- **Recency** (`7d` / `30d` / `90d` / `all`)

Filters narrow usage aggregates and re-rank. Lineage edges with zero usage in-window sort last and appear muted — they are not hidden.

### Key panels + soft coverage

While the client remaps backend source tables, Talia must **show** what tables and Synapse sources each panel uses.

- **Key** is an Admin flag (`panel_lineage_flag.is_key`), toggled in Data Lineage Details and in **Admin Dashboard → Data Lineage**.
- **Suggested** keys are a guide from data refreshes (`ui_activity_events.kind=query`) in the **last 28 days** (not authoritative). Panel *opens* alone understate use for panels that stay mounted in a focus.
- Coverage statuses: `ok`, `missing_tables`, `missing_source`, `missing_columns`.
- **Key + gap → Issue** (highlighted callout / badge). Non-key gaps stay informational.
- Coverage **never fails** the app or CI — highlight only.

---

## 3. Data model

Client join catalog + APIs:

1. **Source → Talia edges** — `tableSources` / sync.config (primary); `etl_table_parameters` as Seaware/original reference only.
2. **Component → tables** — registry `tables`, overrides, scrape (`npm run build:lineage-tables`), then `dataRequirements` extract.
3. **Column provenance** — scraped `columns:` on fetches, sync.config columns, Tabulator field-usage, and `dataLineagePanelOverrides`.
4. **Usage** — `uiActivityPanelUsage` aggregates **data refreshes** (`kind=query`), not panel opens. Labels: Refreshes / Last refresh.
5. **Key flags** — `panel_lineage_flag` via `panelLineageFlags` / `setPanelLineageKey`.

### Framework contract (populate field mappings)

1. Prefer `useTableDataWithContext({ tableName, columns })` so scrape can attribute fields.
2. GraphQL / custom hooks: add `DATA_LINEAGE_PANEL_OVERRIDES` or registry `tables` / `columns`.
3. Regenerate catalogs with `npm run build:lineage-tables` (and field-usage build when Tabulator fields change).

---

## 4. Access and shell

- Focus panel: `DataLineagePanel`, `panelId: data-lineage`, `allowedRoles: ['ADMIN','SUPER_USER']`.
- Admin Dashboard section **Data Lineage** for inline key toggles + coverage table.
- Container / presenter split; tracked GraphQL / `useTableDataWithContext`.
- Standard report shell: header, filters, content, Details, Provenance.
- No sail/ship selection linking (admin meta only).

---

## 5. Out of scope

- Hard CI/build failure on coverage gaps.
- Auto-editing sync mappings or presenter provenance prose.
- Replacing Column Terminology or ETL Table Parameters.

---

## 6. Acceptance

- [x] Panel appears under Admin reports for ADMIN / SUPER_USER
- [x] Orientation toggles tables ↔ components
- [x] Display toggles grid ↔ table
- [x] Role / User / Recency filters re-rank by usage
- [x] Details show columns + provenance for selection
- [x] Zero-usage items remain visible but muted / last
- [x] Admin can flag key panels; suggested from 28d refreshes
- [x] Key coverage gaps highlighted (not failed)
- [x] Admin Dashboard Data Lineage section inline
