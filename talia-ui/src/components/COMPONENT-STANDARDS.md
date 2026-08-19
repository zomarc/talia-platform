# Component Development Standards

This document outlines the standards and patterns for building components in the Talia Platform UI. All components must follow these guidelines to ensure consistency, maintainability, and proper integration with the existing frameworks.

## Table of Contents

1. [Component Structure](#component-structure)
2. [Report Shell Vocabulary](#report-shell-vocabulary)
3. [Styling Guidelines](#styling-guidelines)
4. [Data Fetching](#data-fetching)
5. [State Management](#state-management)
6. [Framework Usage](#framework-usage)
7. [No Overrides Policy](#no-overrides-policy)
8. [Component Template](#component-template)
9. [Booked composition (FIT / Group)](#booked-composition-fit--group)
10. [Demand unit (Pax / Cabins)](#demand-unit-pax--cabins)
11. [Dense row hover previews](#dense-row-hover-previews)

## Component Structure

### React Functional Components

- Use React functional components with hooks
- Follow existing patterns in `components/focus-panels/`
- Use TypeScript-style prop documentation (JSDoc)

**Example:**
```jsx
/**
 * ComponentName - Brief description
 * 
 * @param {Object} props - Component props
 * @param {Array} props.data - Data array
 * @param {Object} props.theme - Theme object
 * @param {Function} props.onRefresh - Refresh callback
 */
const ComponentName = ({ data, theme, onRefresh }) => {
  // Component implementation
};
```

### File Organization

- Place components in appropriate directories:
  - `components/focus-panels/` - Dashboard panel components
  - `components/shared/` - Reusable shared components
  - `components/admin/` - Admin-only components
  - `components/dev/` - Development-only components

- Use index files for exports when appropriate

## Report Shell Vocabulary

Every focus-panel report uses the same **shell elements**. Use the standard CSS classes so global header visibility toggles work without per-panel logic.

**Do not call panel filter rows “Controls”.** In Talia vocabulary, `.talia-report-filters` are report/application filters. **Views** (Nested/Flat, Details, …) are non-restrictive per-component prefs via tab **Options**. **Operations** (filters, allocate, …) are role-gated; Admin configures them — end users do not see that Options section. In-panel `.talia-report__controls` / `.talia-report__actions-bar` follow those Options.

```
┌─ .talia-report ─────────────────────────────────────────────┐
│ header.talia-report__header          [Titles toggle]        │
│   h2.talia-report__title  +  p.talia-report__subtitle     │
│   (informational only — no action/control buttons)          │
├─────────────────────────────────────────────────────────────┤
│ .talia-report-filters                  [Filters toggle]     │
├─────────────────────────────────────────────────────────────┤
│ .talia-callout (0+)                    [Callouts toggle]    │
├─────────────────────────────────────────────────────────────┤
│ .talia-report__controls (0+)                                │
├─────────────────────────────────────────────────────────────┤
│ .talia-report__actions-bar             [Actions / Ops]      │
├─────────────────────────────────────────────────────────────┤
│ section.talia-report__snapshot (0|1)   [pinned KPIs]        │
│   (flex-shrink: 0 — does not scroll)                        │
├─────────────────────────────────────────────────────────────┤
│ main.talia-report__content                                  │
│   (+ --scroll when Snapshot present)                        │
│   primary table/chart/map (always mounted)                  │
│   ReportDataDetails (Details ≣) → secondary detail blocks   │
│   (.tabulator-header-filter = Column filters toggle)        │
└─────────────────────────────────────────────────────────────┘

StatusBar global criteria / focus / visibility strips are independent of per-component Options.
(each has its own header toggle). Only panel `.talia-report__controls` hides under
`talia-controls-hidden`.
```

### Element reference

| Shell element | What it is | Markup / class | Header toggle | Persisted |
|---------------|------------|----------------|---------------|-----------|
| **Title** | Panel name in report header | `header.talia-report__header` → `h2.talia-report__title` | **Titles** | Appearance profile `panelTitlesVisible` |
| **Subtitle** | Metadata line under title (counts, source) | `p.talia-report__subtitle` (inside header; hidden with Title) | *(with Titles)* | — |
| **Talia filters** | Application-level filter row in report shell (not panel controls) | `.talia-report-filters` (+ `__group`, `__label`, `__input`) | **Filters** | `localStorage` `taliaHeaderFiltersVisible` |
| **Column filters** | Native Tabulator column header filters | `headerFilter` columns → `.tabulator-header-filter` | Tab **Options** → Views → **Column filters** (global header remains an override) | User profile `componentOptions` |
| **Callout** | Extra informational note / guidance (usually hidden) | `.talia-callout` | **Callouts** | Appearance profile `calloutsVisible` |
| **Legends** | Chart.js overlay legends and HTML legend strips | `getOverlayLegendOptions` / `.talia-chart-legend` | Tab **Options** → Views → **Legends** (StatusBar **Legends** remains a global override) | User profile `componentOptions` + appearance `chartLegendsVisible` |
| **Controls** | In-panel view/ops chrome (Expand/Collapse, Nested/Flat buttons, …) | panel `.talia-report__controls` | Tab **Options** → Views → **Controls** | User profile `componentOptions` |
| **Actions** | Panel actions (Refresh, product Export, …) | `.talia-report__actions-bar` (preferred); legacy compact: `.talia-report__actions` in header | Tab **Options** (Ops) / role | Role ops allow-list + Admin Options |
| **Snapshot** | Pinned KPI strip above scrollable body (Booked, Velocity, …) | `ReportSnapshot` → `section.talia-report__snapshot` + `.talia-report__metrics` / `.talia-metric` | Tab **Options** → Views → **Snapshot** | User profile `componentOptions` |
| **Details** | User-facing *extra* data blocks (header ≣); never the primary table/chart | `ReportDataDetails` + `useReportShellOptions` / `usePanelDetailsVisibility` | Tab **Options** → Views → **Details** (+ header ≣) | User profile `componentOptions` + `localStorage` |
| **Totals** | Tabulator column-calc footer (`withColumnTotal`) | native ColumnCalcs via `setTabulatorColumnTotalsVisible` | Tab **Options** → Views → **Totals** | User profile `componentOptions` (opt-in `VIEW_TOTALS`; role `minRole` / ops allow-list) |
| **Technical meta** | Dev/diagnostic block (dock tab ⓘ) | `ReportEventMeta` via `usePanelTechnicalMetaVisibility` | Tab ⓘ only | In-memory `__taliaPanelTechnicalMetaVisibility` |
| **Panel Options** | Views + Operations menu on active dock tab | Tab **⚙** (`useComponentOptions` / `useReportShellOptions`) | Tab ⚙ | User profile + role criteria/ops |
| **Data export** | Export to CSV / PDF of the panel’s registered payload | `lib/panelDataExport.js` — Tabulator tables auto-register when `panelComponentId` is passed to `getTabulatorOptions`; non-table panels call `registerPanelDataExport` | Tab **⬇** (next to ⓘ) — **Export to CSV** / **Export to PDF** | `window.__taliaPanelDataExport` |
| **Tooltip** | Dense row/chip HoverPreview | `HoverPreview` + panel summary; Views → **Tooltip** (+ optional **Tooltip view** choice) | Tab **Options** → Views | User profile `componentOptions` |
| **Content** | Primary body (table, chart, map) | `main.talia-report__content`; with Snapshot use `talia-report__content--scroll` so only the body scrolls | — | — |

### Root `<html>` classes (visibility)

| Toggle | Class when hidden |
|--------|-------------------|
| Titles | `talia-panel-titles-hidden` |
| Filters | `talia-filters-hidden` |
| Column filters | `talia-tabulator-filters-hidden` |
| Callouts | `talia-callouts-hidden` |
| Legends | `talia-chart-legends-hidden` |
| Actions | `talia-actions-hidden` |
| Controls | `talia-controls-hidden` |

Details use `ReportDataDetails` / `visible={showDetails}` for **secondary** blocks only — not a root CSS class. Primary Tabulator/chart hosts stay mounted in `talia-report__content`.

**Views chrome (generic):** use `useReportShellOptions(panelComponentId, panelInstanceId)` for `showSnapshot`, `showDetails`, `showFilters`, `showTotals`, and `showLegends`. Persist via user profile `componentOptions`. Header **Filters** (`talia-filters-hidden`) remains a global override; per-panel Views → **Filters** uses `.talia-report-filters--hidden`. Header ≣ Details ANDs with Views → Details. StatusBar **Legends** (`talia-chart-legends-hidden`) remains a global override; per-panel Views → **Legends** uses `.talia-report--legends-hidden` and Chart.js `visible: chartLegendsVisible && showLegends`. Views → **Totals** (`VIEW_TOTALS`): pass `panelComponentId` into `getTabulatorOptions` so `tabulatorConfig` applies `setTabulatorColumnTotalsVisible` on Options change and `tableBuilt`; presenters may also call `useTabulatorColumnTotals(instanceRef, showTotals)`. Do **not** hide the footer with CSS (leaves a blank gap) or rewrite the Tabulator host `className` in React.

### Standard shell markup order

Follow **Agency** / **Published Rates** (filters → callout → controls → actions → content). Reference: `AgencyPresenter.jsx`, `MasterSailingExplorerPresenter.jsx`.

```jsx
<div className="focus-panel talia-report …" role="region" aria-label="…">
  <header className="talia-report__header">
    <div className="talia-report__header-left">
      <h2 className="talia-report__title">…</h2>
      <p className="talia-report__subtitle">…</p>
    </div>
  </header>

  <div className="…-panel__filters talia-report-filters">…</div>

  {showCallout ? <div className="…-panel__callout talia-callout" role="note">…</div> : null}

  <div className="talia-report__controls" aria-label="… controls">…</div>

  <div className="talia-report__actions-bar" aria-label="… actions">…</div>

  {/* Optional pinned KPIs — sibling above content, never inside the scroll region */}
  <ReportSnapshot items={[…]} />

  <main className="talia-report__content talia-report__content--scroll">
    <div ref={tableRef} className="talia-table" role="grid" />
    {/* Optional secondary details only — never wrap the primary table/chart */}
    <ReportDataDetails visible={showDetails} as="section">
      …
    </ReportDataDetails>
  </main>
</div>
```

- **Title header is informational only** — `h2.talia-report__title` + `p.talia-report__subtitle`; never put action or control buttons in `talia-report__header`.
- Put **Talia filters** in their own row — never mix into the title block (except legacy panels not yet migrated).
- Put **Controls** (Expand/Collapse, group toggles) in `.talia-report__controls` — toggled with global **Operations**.
- Put **Actions** (Refresh, Export) in `.talia-report__actions-bar` — toggled with global **Operations**.
- Put **Snapshot** KPIs in `ReportSnapshot` / `.talia-report__snapshot` as a sibling **above** `main` — do not place them inside scrollable content. Pair with `talia-report__content--scroll`. Gate with `useReportShellOptions` → `showSnapshot` (`visible={showSnapshot}`).
- **Column filters** need no panel markup; set `headerFilter` on Tabulator columns.
- Gate **secondary detail blocks** with `ReportDataDetails` when the panel has header **Details** (≣) content (history, editors, extra tables). Do **not** wrap the primary table/chart — that destroys one-shot Tabulator/chart instances when Details is toggled off.
- Do **not** use header ≣ for technical meta; do **not** use tab ⓘ for user data tables.

### Shell audit checklist

When reviewing active report panels (`showInReports: true` in `registry.js`):

1. Root uses `focus-panel talia-report` (or `talia-report` for admin embeds).
2. `talia-report__header` contains **title + subtitle only** — no `talia-report__header-right`, `talia-report__actions`, or buttons.
3. Panel criteria inputs live in `.talia-report-filters` — not mixed with controls or actions.
4. View-mode / expand toggles live in `.talia-report__controls` with `talia-btn talia-btn--secondary`.
5. Refresh / export live in `.talia-report__actions-bar`.
6. KPI strips use `ReportSnapshot` / `.talia-report__snapshot` as a sibling **above** `main` (not inside scrollable content), with `talia-report__content--scroll` on the body.
7. Primary body in `main.talia-report__content` (always mounted). Use `ReportDataDetails` only for secondary Details (≣) blocks.

Events: `components/dockview/eventConstants.js` (`DASHBOARD_FILTER_VISIBILITY_EVENT`, `DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT`, `DASHBOARD_DETAILS_VISIBILITY_EVENT`, `REPORT_PANEL_TECHNICAL_META_EVENT`).

## Styling Guidelines

### CSS Variables (Theme System)

- **Always use CSS variables from the theme system** (`config/themes.js`)
- Access theme via `useTheme()` hook from `contexts/ThemeContext`
- Use theme colors via CSS variables/classes (not inline style blocks)

**Example:**
```jsx
return <div className="my-component">Content</div>;
```

### Inline Styles

- **Do not use inline React styles (`style={{...}}`).**
- Use CSS classes and CSS variables instead.
- If runtime styling is unavoidable (for example, Tabulator cell formatters), keep it localized to formatter logic and avoid JSX inline style props.

### CSS Files

- Use existing theme CSS variables from `styles/theme.css`
- Follow patterns in `styles/theme.css`
- Do not create new CSS files unless absolutely necessary
- Prefer shared style files (`theme.css`, `components.css`, `focus-panels.css`, `tabulator-theme.css`)

## Data Fetching

### Focus Panels (Preferred Pattern)

- For focus panel reports, prefer `useTableDataWithContext` and container/presenter separation.
- Standardize loading/error/empty handling via shared wrappers (for example `PanelDataState`) where possible.
- Pass `panelInstanceId` and `panelComponentId` through containers/hooks so panel-scoped refresh/diagnostics remain generic.
- **Keep content while refreshing:** do not swap the panel for a spinner when prior data exists (`if (loading && !data)` / `PanelDataState` with `empty`). ReportShell greys the panel via `useReportPanelLoading` + `talia-report-shell--loading`. Spinner only on initial empty load.

### Apollo Client (GraphQL, When Needed)

- Use Apollo Client for GraphQL-specific endpoints that are not served by standard table/context hooks.
- Import from `lib/apolloClient.js`
- Use hooks from `hooks/data/` for data fetching when available
- Keep query/mutation usage localized and documented in the owning feature module
- Route GraphQL calls through shared tracked helpers in `services/data/trackedGraphql.js`:
  - `trackedFetchGraphql(...)`
  - `trackedApolloQuery(...)`
  - `trackedApolloMutate(...)`
- Do not add new raw `fetch('/api/graphql')` or direct `apolloClient.query/mutate` calls in feature code.

**Example:**
```jsx
import { useQuery } from '@apollo/client';
import { apolloClient, FOCUS_QUERIES } from '../lib/apolloClient';

const MyComponent = () => {
  const { data, loading, error } = useQuery(FOCUS_QUERIES.GET_FOCUSES);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{/* Render data */}</div>;
};
```

### Data Hooks

- Use existing hooks from `hooks/data/` when available
- Create new hooks in `hooks/data/` for reusable data fetching patterns
- Hooks should handle loading, error, and data states

## State Management

### React Hooks

- Use React hooks for component state:
  - `useState` - Local component state
  - `useEffect` - Side effects and lifecycle
  - `useCallback` - Memoized callbacks
  - `useRef` - Refs for DOM access or stable values
  - `usePanelDetailsVisibility` - Shared panel details visibility behavior
  - `useSubpanelExpansion` - Shared sub-panel expand/collapse behavior

### Context for Shared State

- Use context for shared state:
  - `ThemeContext` - Theme management
  - `SupabaseAuthContext` - Authentication state
- Do not create new context providers unless necessary
- Prefer props over context when possible

### No External State Management

- **Do not use external state management libraries** (Redux, MobX, etc.)
- Use React's built-in state management only
- Use context sparingly for truly global state

## Framework Usage

### Tables: Tabulator

- **Always use Tabulator** for table components
- Use `lib/tabulatorConfig.js` (`initTabulator` + `getTabulatorOptions`) for initialization
- Follow patterns in `components/focus-panels/_TEMPLATE/TemplatePresenter.jsx`

**Key Patterns:**
- Initialize table once when data is ready
- Update table data using `replaceData()` when data changes
- Always create instances with `new Tabulator(..., getTabulatorOptions({ ... }))`
- Use `selectableRows: 1` for single row selection
- Use `headerFilter: "list"` with `autocomplete: true` for dropdown filters
- Standardize column labels with short+long naming:
  - `titleShort`: compact column header shown in-table
  - `titleLong`: full label used by Tabulator `headerTooltip`
  - `tabulatorConfig` auto-applies this, and also defaults `headerTooltip` to `title` when no long name is provided
  - Global field-level defaults live in `lib/tabulatorColumnLabelDictionary.js` and are applied automatically across components
- Global compact text policy: package columns (`package_name` / `package`) are rendered as first word + `...` with full value on hover title (applied centrally in `tabulatorConfig`)
- **Number display kinds (presentation only):** map fields to `money` | `pct` | `count` | `quantity` | `rate` in `tabulatorColumnLabelDictionary` (`display: 'money'`). Applied centrally by `getTabulatorOptions` via `lib/numberDisplay.js`:
  - **money** → whole numbers in the grid; exact cents on hover
  - **pct** → ≥1 decimal
  - **count** → integers
  - **quantity** → up to 1 decimal, trailing zeros trimmed (guests)
  - **rate** → 2 decimals
  - Opt out a column with `displayKind: false`; force a kind with `displayKind: 'money'`
  - Footer calcs still sum full precision; footer **display** follows the same kind
  - CSV/PDF export keeps raw values
- Enforcement rule: when adding a new table component, prefer dictionary-backed fields in `tabulatorColumnLabelDictionary`; if a field is new, add it to the dictionary in the same change (include `display` when numeric)
- Shared definitions rule: maintain two per-field notes in the Column Terminology admin panel:
  - **User definition** (business/user-facing meaning)
  - **Admin/Dev definition** (technical/internal meaning)
- Emit events on row selection: `talia:componentname.select`
- **Persistent selection indicator:** use `createReferenceRowFormatter` / `refreshReferenceRowClasses` from `lib/tabulatorReferenceSelection.js` so the active row keeps class `tabulator-row--reference` across data refresh. Shared **full-row** selected fill plus left accent bar live in `tabulator-theme.css` (`--theme-table-row-selected`, `--theme-table-row-selected-accent`). Panels with `selectableRows: 1` get the same treatment via `.tabulator-selected`.
- For grouped tables that need tab-header controls, set `supportsGroupActions: true` in `registry.js` and register presenter actions in `window.__taliaPanelGroupActions`
- For **table data export** (CSV / print-PDF for verification), set `supportsDataExport: true` in `registry.js` and register via `registerPanelDataExport` from `lib/panelDataExport.js` (dock tab **⬇** next to ⓘ). Prefer `payloadFromTabulator(table, title)` so export uses **visible/filtered** rows. This is distinct from product Export in `.talia-report__actions-bar` (e.g. Project Summary PDF).
- Do not hardcode table `layout` in panel code unless you intentionally opt out with `enforceGlobalLayout: false`
- **Column totals (footer):** define per-column with `withColumnTotal` from `lib/tabulatorConfig` (native Tabulator `bottomCalc`). Totals recalculate from **active/filtered rows** (panel filters that `replaceData`, plus header filters). Do not invent custom footer markup or per-panel sum loops. Opt out of calcs on a table with `columnCalcs: false` if needed. Gate visibility with Views → **Totals** (`VIEW_TOTALS` in catalog + `showTotals` from `useReportShellOptions`); apply with `setTabulatorColumnTotalsVisible` / `useTabulatorColumnTotals` (Tabulator `removeCalcs` / `reinitializeCalcs` + `recalc` — never CSS-hide the footer).
  - Kinds: `count` | `sum` | `avg` | `min` | `max` | `unique`
  - Example: `withColumnTotal({ field: 'guest_count', ... }, 'sum')` — footer display follows the field’s dictionary `display` kind
- **Single-row record form:** when the presenter’s data array has exactly one row, render `ReportTableOrRecord` / `ReportRecordForm` (`components/shared/ReportRecordForm.jsx`) instead of the visible table. Keep the Tabulator host mounted but hidden so the instance is not destroyed. Reuses column `titleLong`/`title` and formatters via `lib/reportRecordForm.js`. Opt out a column with `excludeFromRecordForm: true`. Skip matrix/heatmap panels.

**Grouped Tab Header Controls (optional):**
- Use only when the panel has Tabulator grouping and users need global expand/collapse
- Keep actions in presenter (`cycleGroupState`, optional compatibility `openAllGroups`/`collapseAllGroups`)
- Register actions by both keys:
  - `panelComponentId` (stable panel type key, e.g. `master-sailing`)
  - `panelInstanceId` (instance key, when available)
- Expose `getCycleState()` returning `{ depth, maxDepth }` so tab icon/tooltip reflects current state
- Cleanup registrations on unmount to avoid stale handlers

**Panel data export (optional, dock tab ⬇):**
- Opt in with `supportsDataExport: true` in `registry.js`
- Register in the presenter:

```jsx
import { payloadFromTabulator, registerPanelDataExport } from '../../../lib/panelDataExport';

useEffect(() => {
  return registerPanelDataExport({
    panelInstanceId,
    panelComponentId,
    getPayload: () => payloadFromTabulator(instanceRef.current, 'My Panel'),
  });
}, [panelInstanceId, panelComponentId]);
```

- Tab chrome shows **⬇** → CSV | PDF (print dialog). Do not put export inside `ReportEventMeta` (tab ⓘ remains technical meta only).
- PDF may include an optional `chartImage` data URL (e.g. Chart.js `toBase64Image()`) rendered above the table. CSV ignores the chart.

**Example:**
```jsx
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';

const MyTable = ({ data }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  
  useEffect(() => {
    const initTable = async () => {
      const Tabulator = await initTabulator();
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: data,
        columns: columns,
        selectableRows: 1,
        // ... other config
      }));
    };
    initTable();
  }, []);
  
  return <div ref={tableRef} />;
};
```

### Charts: Chart.js

- **Always use Chart.js** for chart components
- Follow patterns in existing chart components
- Use theme colors for chart styling

**Example:**
```jsx
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const MyChart = ({ data }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    const ctx = chartRef.current.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: data,
      options: {
        // Use theme colors
        backgroundColor: theme.colors.accent,
      }
    });
  }, [data]);
  
  return <canvas ref={chartRef} />;
};
```

### Layout: Dockview

- **Always use Dockview** for layout management
- Follow patterns in `App.jsx` and `Dashboard.jsx`
- Do not manipulate Dockview's layout system directly
- Use `api.addPanel()` with proper position references

**Important:**
- Do not add resize event listeners
- Do not call `api.layout()` manually
- Do not manipulate panel positioning after creation
- Let Dockview handle all layout and resizing naturally
- Do not dispatch manual `window.resize` events from Dockview handlers
- Do not call component-level resize methods (`chart.resize()`, Tabulator redraw) from Dockview events
- Never add debounce/throttle/timer logic to "fix" Dockview resize behavior

### GraphQL: Apollo Client

- **Always use Apollo Client** for GraphQL
- Import from `lib/apolloClient.js`
- Use existing queries/mutations when available
- Add new queries to `lib/apolloClient.js` if needed

### Maps: React Leaflet

- Use React Leaflet directly for map rendering (`MapContainer`, `TileLayer`, overlays).
- Use shared map defaults from `components/shared/maps/LeafletMapDefaults.jsx` for:
  - English-friendly basemap tile URL/attribution
  - Container resize synchronization (`LeafletResizeObserver`)
- Use shared port coordinate lookup from `components/shared/maps/portCoordinates.js` (do not define per-component coordinate maps).
- Keep map tile configuration consistent across panels; do not define ad hoc tile providers per component unless required by product requirements.
- Do not dispatch manual `window.resize` events or timer-based map resize hacks from Dockview/layout handlers.

### Reusable Panel Behaviors

See [Report Shell Vocabulary](#report-shell-vocabulary) for Title / Filter / Action / Callout / Details definitions and markup order.

- **Details hook:** `hooks/usePanelDetailsVisibility.js` + `services/panelDetailsState.js` + `ReportDataDetails.jsx` — optional per-panel `commitVisible(next)`; `respectGlobal: false` only for isolated pages (e.g. Data Management).
- **Technical meta:** `hooks/usePanelTechnicalMetaVisibility.js` + `services/panelTechnicalMetaState.js` — tab ⓘ only, not header ≣.
- **Sub-panels:** expand/collapse inside a report (e.g. cabin group) → `hooks/useSubpanelExpansion.js`.
- Do not duplicate visibility/toggle logic per component; use standard shell classes.

## No Overrides Policy

### Framework Usage

- **Use frameworks as-is** through project-shared adapters already established in this repo
- **No additional complexity layers** - use frameworks directly
- **Follow framework documentation** - use official patterns

### What NOT to Do

- ❌ Do not create new custom wrappers around Tabulator, Chart.js, or Dockview
- ❌ Do not override framework methods or properties
- ❌ Do not add abstraction layers between components and frameworks
- ❌ Do not create "helper" functions that duplicate framework functionality

### What TO Do

- ✅ Use `tabulatorConfig` as the single shared Tabulator entry point
- ✅ Follow framework documentation patterns
- ✅ Use framework features as intended
- ✅ Create utility functions only for data transformation, not framework wrapping
- ✅ Keep components minimal: containers fetch/map state, presenters render UI, shared behavior lives in hooks/utilities

## Component Template

See `components/focus-panels/_TEMPLATE/TemplatePresenter.jsx` for a complete example following all standards.

### Key Template Features

1. **Tabulator Integration** - Proper initialization and data updates
2. **Theme Usage** - CSS variables from theme system
3. **Event Emission** - Custom events for inter-component communication
4. **Error Handling** - Proper error states and loading states
5. **Cleanup** - Proper cleanup in useEffect return functions

### Using the Template

1. Copy `_TEMPLATE/` directory
2. Rename files to match your component
3. Update:
   - Column definitions
   - Event names (`talia:yourcomponent.select`)
   - Data field names
   - Initial sort column
4. Follow all patterns in the template

## Testing Checklist

Before committing a new component, ensure:

- [ ] Uses React functional components with hooks
- [ ] Uses CSS variables from theme system (no hardcoded colors)
- [ ] `npm run check:standards` reports no new inline-style violations
- [ ] Uses project data hooks (or Apollo Client when hooks are not applicable)
- [ ] GraphQL fetch/query/mutate paths use `trackedGraphql` shared helpers
- [ ] Uses Tabulator for tables (if applicable)
- [ ] Uses Chart.js for charts (if applicable)
- [ ] Uses Dockview for layout (if applicable)
- [ ] No custom framework wrappers
- [ ] Follows existing component patterns
- [ ] Proper error and loading states
- [ ] Cleanup in useEffect return functions
- [ ] JSDoc comments for props

## Examples

### Good Component

```jsx
import { useTheme } from '../contexts/ThemeContext';
import { useQuery } from '@apollo/client';
import { FOCUS_QUERIES } from '../lib/apolloClient';

const GoodComponent = ({ onRefresh }) => {
  const { theme } = useTheme();
  const { data, loading, error } = useQuery(FOCUS_QUERIES.GET_FOCUSES);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div className="talia-card">
      {data.focuses.map(focus => (
        <div key={focus.id}>{focus.name}</div>
      ))}
    </div>
  );
};
```

### Bad Component

```jsx
// ❌ Hardcoded colors
// ❌ No theme usage
// ❌ Custom wrapper around Tabulator
// ❌ No error handling

const BadComponent = () => {
  return (
    <div style={{ background: '#ffffff', color: '#000000' }}>
      <MyCustomTableWrapper data={data} />
    </div>
  );
};
```

## Booked composition (FIT / Group)

Global StatusBar criterion `bookedComposition` (`window.__taliaGlobalCriteria.bookedComposition`) defines how FIT vs Group is reported. Subscribe with `useGlobalBookedComposition`. Helpers live in `lib/bookedComposition.js`.

| Mode | Meaning |
|------|---------|
| `booked_only` | FIT = `pax_type` F · Group = `pax_type` G |
| `three_way` | FIT · Group booked · Group held (GTY × source probability) |
| `group_fit_expected` (**default**) | FIT booked · Group = G booked + GTY held expected |

Do not invent Talia group probabilities yet — use `resolveDeliveryProbability` / `resolveGroupHoldProbability` from `lib/deliveryProbability.js` (source: `group_probability` / `res_probability` / alloc `probability`). Fact group-OF explode rows (`source_origin=fact_group_alloc`) feed Agency expected value; FIT+Held composition still uses alloc holds for berth occupancy — do not double-count both. Cabin Deck ownership highlighting is a separate concept.

## Demand unit (Pax / Cabins)

**Calculate once at guests; unit is presentation only.**

- Canonical demand math stays at **pax** = guests / berths from `guest_count` (RES_HEADER + Fact). Densify, sync, GraphQL, and transforms keep guest series/fields as source of truth.
- StatusBar **Unit** (`demandUnit`: `pax` | `cabins`, default **`cabins`**) only changes display. Subscribe with `useGlobalDemandUnit` (`hooks/useGlobalDemandUnit.js`). Convert with `toDemandVolume(guests, unit)` from `lib/demandUnit.js` (`guests / 2` for cabins).
- Never branch densify/sync/GraphQL on presentation unit. Never show dual primary demand grains in one tile/column.
- Inventory facts stay cabins: Capacity, Bk C, Cabin Deck, LF. Cap reference lines show in cabins mode; hide or clearly relabel in pax mode.
- Revenue (EUR) stays on pax economics; volume tiles/series follow the presentation unit.

First-wave consumers: Master Sailing Explorer (Booked / Est / Contr), Reservation Profile (snapshot + Monday chart), Sailing Demand Composition.

## Dense row hover previews

Use shared `HoverPreview` (portal chrome) + a panel-specific dense summary component (e.g. `DistributionSummary`, `ReservationHoverSummary`, `CabinDeckHoverSummary`).

- **Precompute** indexes in the container (`useMemo`) when sail/table data loads — never aggregate inside `rowMouseEnter`.
- Presenter keeps the index in a **ref** for hot Tabulator handlers; hover state stores only `{ id, rect }` (or `{ item, rect }` for click-to-open chips).
- Clip row/chip rects with `clipAnchorRectToViewport` so wide Tabulator rows do not park the preview off-screen.
- Prefer Appearance **Hover Preview Delay / Opacity** (ThemeContext) for timing and transparency; drop native `title` tooltips on the same rows to avoid doubles.
- Gate with Views → **Tooltip** (`VIEW_TOOLTIP` / `showTooltip` from `useReportShellOptions`). Optional **Tooltip view** (`tooltipView` choice) switches among a small set of summaries (e.g. MSE Distribution vs Performance).
- Click selects/links via the message bus; hover only shows the preview and clears when the pointer leaves (same as MSE).

## Summary

- **Use frameworks directly** - Tabulator, Chart.js, Dockview, Apollo Client
- **Use theme system** - CSS variables from `config/themes.js`
- **Follow existing patterns** - Look at `_TEMPLATE/` and existing components
- **No overrides** - Use frameworks as-is, no custom wrappers
- **Keep it simple** - No unnecessary abstraction layers
