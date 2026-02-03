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
│   ├── tabulatorConfig.js  # Tabulator initialization
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

```jsx
import React, { useMemo } from 'react';
import YourReportPresenter from './YourReportPresenter';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';

const YourReportContainer = () => {
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'your_table',
    eventName: null,
    contextMapper: () => null,
    limit: 1000
  });

  // Loading state - use CSS classes
  if (loading) {
    return (
      <div className="talia-loading" role="status" aria-live="polite">
        <div className="talia-loading__spinner" aria-hidden="true" />
        <span className="talia-loading__text">Loading data...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="talia-error" role="alert">
        <span className="talia-error__icon" aria-hidden="true">⚠️</span>
        <h3 className="talia-error__title">Error Loading Data</h3>
        <p className="talia-error__message">{error.message}</p>
        <button className="talia-btn" onClick={refetch}>Try Again</button>
      </div>
    );
  }

  // Empty state
  if (!data?.length) {
    return (
      <div className="talia-empty" role="status">
        <span className="talia-empty__icon" aria-hidden="true">📊</span>
        <h3 className="talia-empty__title">No Data Available</h3>
        <p className="talia-empty__message">No data found.</p>
      </div>
    );
  }

  return <YourReportPresenter data={data} onRefresh={refetch} />;
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
  { field: "id", title: "ID", width: 100 },
  { field: "name", title: "Name", headerFilter: "input" },
  { field: "amount", title: "Amount", hozAlign: "right", formatter: (cell) => formatCurrency(cell.getValue()) }
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
      
      instanceRef.current = new Tabulator(tableRef.current, {
        ...getTabulatorOptions(),
        data: data,
        columns: columns,
        pagination: true,
        paginationSize: 50,
        a11y: true, // Enable accessibility
        dataLoaded: (data) => setRecordCount(data.length)
      });
      
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
        <div>
          <h2 className="talia-report__title">Report Title</h2>
          <p className="talia-report__subtitle">Description</p>
        </div>
        <div className="talia-report__actions">
          {onRefresh && (
            <button className="talia-btn" onClick={onRefresh} aria-label="Refresh data">
              ↻ Refresh
            </button>
          )}
        </div>
      </header>

      <main className="talia-report__content">
        <div ref={tableRef} className="talia-table" role="grid" aria-rowcount={recordCount} />
      </main>

      <footer className="talia-report__footer">
        <span>{recordCount.toLocaleString()} records</span>
        <span>Last updated: {new Date().toLocaleDateString()}</span>
      </footer>
    </div>
  );
};

export default YourReportPresenter;
```

### 3. Register the Component

Add to `Dashboard.jsx`:

```jsx
// Import
import YourReport from "./components/focus-panels/YourReport";

// Add to DockviewReact components
"your-report": (props) => <YourReport {...props} />,

// Add sidebar button
<button className="talia-btn" onClick={() => onAddPanel('your-report', 'Your Report')}>
  📊 Your Report
</button>
```

## CSS Classes Reference

### Report Structure
- `.talia-report` - Main container
- `.talia-report__header` - Header with title and actions
- `.talia-report__title` - Report title (h2)
- `.talia-report__subtitle` - Subtitle/description
- `.talia-report__actions` - Action buttons container
- `.talia-report__content` - Main content area
- `.talia-report__footer` - Footer with metadata

### Tables
- `.talia-table` - Table wrapper

### Buttons
- `.talia-btn` - Standard button
- `.talia-btn--primary` - Primary action button
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
- Handle loading/error/empty states

### DON'T
- Use inline styles
- Hardcode colors
- Duplicate formatter logic
- Mix data fetching with UI rendering
- Skip accessibility attributes

## Example Components

Reference implementations:
- `VoyageReport` - Lightweight table report template
- `MasterVoyagePerformanceSummary` - Complex report with grouping
