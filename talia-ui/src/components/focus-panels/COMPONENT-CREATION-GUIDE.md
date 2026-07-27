# Component Creation Guide

Standard guide for creating lightweight, accessible report components.

## Architecture

```
src/
├── styles/
│   ├── theme.css           # CSS variables (single source of truth)
│   ├── tabulator-theme.css # Tabulator styling via CSS vars
│   └── components.css      # Shared component classes
├── lib/
│   ├── tabulatorConfig.js  # Shared Tabulator wrapper + global fit mode wiring
│   ├── chartConfig.js      # Chart.js defaults
│   └── dataTypes/          # Shared formatters
└── components/focus-panels/
    └── YourReport/
        ├── index.jsx       # Container (data fetching)
        └── YourReportPresenter.jsx  # Presenter (UI only)
```

## Event Bus (Report Linking)

Use the shared event bus for cross-panel linking. Standard sail selection events are:

- `talia:sail.select` - payload `{ sail_code, row_data, timestamp }`
- `talia:sail.clear` - payload `{ timestamp }`

Use the shared helpers from `src/lib/eventBus.js` to emit events:

```jsx
import { emitSailSelect, emitSailClear, SAIL_SELECT_EVENT } from '../../lib/eventBus';

// Emit selection
emitSailSelect({ sail_code: rec.sail_code, row_data: rec, timestamp: new Date().toISOString() });

// Emit clear
emitSailClear({ timestamp: new Date().toISOString() });

// Listen for selection
window.addEventListener(SAIL_SELECT_EVENT, handler);
```

## Creating a New Report

### 1. Container Component (`index.jsx`)

Handles data fetching, transformation, and state management.

Prefer the shared panel state wrapper pattern for loading/error/empty handling (`PanelDataState`) instead of duplicating bespoke state markup in each container.

```jsx
import React, { useMemo } from 'react';
import YourReportPresenter from './YourReportPresenter';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';

const YourReportContainer = ({ panelInstanceId, panelComponentId }) => {
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'your_table',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 1000
  });

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading data..."
      error={error}
      errorTitle="Error Loading Data"
      empty={!data?.length}
      emptyMessage="No data found."
      onRetry={refetch}
    >
      <YourReportPresenter data={data} onRefresh={refetch} />
    </PanelDataState>
  );
};

export default YourReportContainer;
```

### 2. Presenter Component (`YourReportPresenter.jsx`)

Pure UI component with no data fetching logic.

```jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { createDeltaFormatter, createRowFormatter, isEmpty, parseNumber } from '../../../lib/dataTypes';

// Value formatters
const formatCurrency = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return new Intl.NumberFormat('en-US').format(num);
};

// Column definitions
const columns = [
  { field: "id", titleShort: "ID", titleLong: "Record identifier", width: 100 },
  { field: "name", titleShort: "Name", titleLong: "Customer name", headerFilter: "input" },
  {
    field: "amount",
    titleShort: "Amt",
    titleLong: "Amount (EUR)",
    hozAlign: "right",
    formatter: (cell) => formatCurrency(cell.getValue())
  }
];

const YourReportPresenter = ({ data, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [recordCount, setRecordCount] = useState(0);

  // Initialize Tabulator
  useEffect(() => {
    if (!data?.length || initialized) return;
    
    const init = async () => {
      const Tabulator = await initTabulator();
      
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: data,
        columns: columns,
        pagination: true,
        paginationSize: 50,
        dataLoaded: (data) => setRecordCount(data.length)
      }));
      
      setInitialized(true);
      setRecordCount(data.length);
    };
    
    init();
    
    return () => {
      if (instanceRef.current) instanceRef.current.destroy();
    };
  }, [data?.length]);

  return (
    <div className="talia-report" role="region" aria-label="Your Report">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Report Title</h2>
          <p className="talia-report__subtitle">Description</p>
        </div>
      </header>

      <div className="your-report__filters talia-report-filters" aria-label="Your report filters">
        {/* Application/report filters row — governed by header Filters toggle */}
      </div>

      {/* Optional: panel operation controls (Expand/Collapse, view modes) — governed by Operations toggle */}
      <div className="talia-report__controls" aria-label="Your report controls">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onExpandAll}>
          Expand all
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onCollapseAll}>
          Collapse
        </button>
      </div>

      <div className="talia-report__actions-bar" aria-label="Your report actions">
        {onRefresh && (
          <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} aria-label="Refresh data">
            ↻ Refresh
          </button>
        )}
      </div>

      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>
    </div>
  );
};

export default YourReportPresenter;
```

### 3. Register the Component

Register in `src/components/focus-panels/registry.js`:

```jsx
YourReport: {
  component: YourReportContainer,
  panelId: 'your-report',
  title: 'Your Report',
  category: 'Tables',
  legacy: false, // optional: set true for legacy-but-supported panels
  showInReports: true,
  events: { emits: [], respondsTo: [] },
}
```

### 4. Optional Group Actions in Tab Header

Use this only for grouped Tabulator panels that need tab-level `open all` / `collapse all` icons.

1. In `registry.js`, opt in:

```jsx
supportsGroupActions: true,
```

2. In your container, accept and pass Dockview ids:

```jsx
const YourReportContainer = ({ panelInstanceId, panelComponentId }) => (
  <YourReportPresenter
    panelInstanceId={panelInstanceId}
    panelComponentId={panelComponentId}
    // ...
  />
);
```

3. In your presenter, register actions:

```jsx
useEffect(() => {
  window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
  const key = panelComponentId || 'your-report';
  const actions = {
    cycle: cycleGroupState, // closed -> level1 -> level2 ... -> closed
    getCycleState: () => ({ depth: currentDepth, maxDepth: 2 }),
    // optional compatibility:
    openAll: openAllGroups,
    collapseAll: collapseAllGroups,
  };
  window.__taliaPanelGroupActions[key] = actions;
  if (panelInstanceId) window.__taliaPanelGroupActions[panelInstanceId] = actions;
  return () => {
    delete window.__taliaPanelGroupActions[key];
    if (panelInstanceId) delete window.__taliaPanelGroupActions[panelInstanceId];
  };
}, [collapseAllGroups, cycleGroupState, openAllGroups, panelComponentId, panelInstanceId]);
```

## CSS Classes Reference

Full shell vocabulary (Title, Filters, Actions, Callouts, Details, Controls vs Column filters): see [`COMPONENT-STANDARDS.md` § Report Shell Vocabulary](../COMPONENT-STANDARDS.md#report-shell-vocabulary).

### Report Structure
- `.talia-report` - Main container
- `.talia-report__header` - Title block (toggle: **Titles**)
- `.talia-report__title` - Report title (h2)
- `.talia-report__subtitle` - Subtitle/metadata (hidden with title)
- `.talia-report-filters` - Panel filter row (toggle: **Filters**); not the app **Controls** strip
- `.talia-callout` - Informational note (toggle: **Callouts**, usually hidden by default)
- `.talia-report__controls` - Panel operations row (Expand/Collapse, view modes; toggle: **Operations**)
- `.talia-report__actions-bar` - Panel actions row (Refresh, Export; toggle: **Operations**)
- `.talia-report__actions` - Legacy compact actions in header (prefer `__actions-bar`; do not add new uses)
- `.talia-report__content` - Main content (table/chart/map)
- `.talia-report__footer` - Footer (usually hidden via CSS)

### Tables
- `.talia-table` - Table wrapper

### Buttons
- `.talia-btn` - Standard outlined button (default for actions)
- `.talia-btn--secondary` - Outlined button for controls and secondary actions (preferred in `.talia-report__controls` and `.talia-report__actions-bar`)
- `.talia-btn--primary` - Primary action button (one per row, or active toggle state)
- `.talia-btn--ghost` - Borderless text-style button (avoid in controls/actions rows)
- `.talia-btn--small` - Smaller button

### States
- `.talia-loading` - Loading spinner container
- `.talia-empty` - Empty state message
- `.talia-error` - Error state message

### Layout
- `.talia-card` - Card container
- `.talia-grid` - Grid container
- `.talia-grid--2/3/4` - Column variants

## Using Formatters

Import from the shared dataTypes library:

```jsx
import {
  createPerformanceFormatter,
  createDeltaFormatter,
  createRowFormatter,
  isEmpty,
  parseNumber
} from '../../../lib/dataTypes';

// Performance indicator (green/yellow/red based on threshold)
const performanceFormatter = createPerformanceFormatter(100);

// Delta/change indicator (positive green, negative red)
const deltaFormatter = createDeltaFormatter();

// Row formatter for summary rows
const rowFormatter = createRowFormatter();
```

## Chart.js Integration

Chart.js is pre-configured with theme defaults. Just import and use:

```jsx
import { Chart, registerables } from 'chart.js';
import { getChartColors, createDataset } from '../../../lib/chartConfig';

Chart.register(...registerables);

// In your component
const colors = getChartColors();
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [...],
    datasets: [createDataset(data, 'Series Name', 0)]
  }
});
```

## Accessibility Requirements

1. **ARIA labels**: Add `aria-label` to containers and interactive elements
2. **Roles**: Use `role="region"`, `role="grid"`, `role="status"`, `role="alert"`
3. **Keyboard**: Support keyboard navigation (Tabulator handles this with `a11y: true`)
4. **Screen readers**: Use `.talia-sr-only` for screen-reader-only text

## Do's and Don'ts

### DO
- Use CSS classes from `components.css`
- Use CSS variables from `theme.css`
- Use shared formatters from `dataTypes`
- Keep presenters pure (no data fetching)
- Include ARIA labels and roles
- Handle loading/error/empty states using shared panel patterns (`PanelDataState`, `LoadingSpinner`, `ErrorMessage`)
- Use `initTabulator()` + `getTabulatorOptions(...)` for every Tabulator table
- Let global fit mode control table layout (`Best Fit`/`Fit Width`/`Fit Data` from header controls)
- Prefer `titleShort` + `titleLong` for every column so headers stay compact while Tabulator `headerTooltip` shows full names
- Reuse global defaults from `src/lib/tabulatorColumnLabelDictionary.js` for common field names (for example `guest_count`, `sail_days`, `cabin_category`)
- If you introduce a new column field, add its short/long terminology entry to `tabulatorColumnLabelDictionary.js` in the same PR
- Wrap the Tabulator host with `ReportTableOrRecord` so a single-row result renders as a vertical record form (table stays mounted/hidden). Pass `onRecordActive` when the panel emits select on row click.

### DON'T
- Use inline styles
- Hardcode colors
- Duplicate formatter logic
- Mix data fetching with UI rendering
- Skip accessibility attributes
- Add new raw `fetch('/api/graphql')` or direct `apolloClient.query/mutate` calls in feature components/services without `trackedGraphql` wrappers
- Hardcode `layout` in presenters unless you intentionally opt out with `enforceGlobalLayout: false`
- Add manual resize/layout workaround logic in component code (`window.resize`, custom redraw loops)

## GraphQL Tracking Standard

For any new GraphQL data access path that cannot use `useTableDataWithContext`, use:

- `services/data/trackedGraphql.js`
  - `trackedFetchGraphql(...)` for HTTP GraphQL
  - `trackedApolloQuery(...)` / `trackedApolloMutate(...)` for Apollo

This keeps observability and performance metadata consistent across all reports.

## Example Components

Reference implementations:
- `VoyageReport` - Lightweight table report template
- `MasterVoyagePerformanceSummary` - Complex report with grouping
