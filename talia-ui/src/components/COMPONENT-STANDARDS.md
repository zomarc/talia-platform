# Component Development Standards

This document outlines the standards and patterns for building components in the Talia Platform UI. All components must follow these guidelines to ensure consistency, maintainability, and proper integration with the existing frameworks.

## Table of Contents

1. [Component Structure](#component-structure)
2. [Styling Guidelines](#styling-guidelines)
3. [Data Fetching](#data-fetching)
4. [State Management](#state-management)
5. [Framework Usage](#framework-usage)
6. [No Overrides Policy](#no-overrides-policy)
7. [Component Template](#component-template)

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
- Emit events on row selection: `talia:componentname.select`
- For grouped tables that need tab-header controls, set `supportsGroupActions: true` in `registry.js` and register presenter actions in `window.__taliaPanelGroupActions`
- Do not hardcode table `layout` in panel code unless you intentionally opt out with `enforceGlobalLayout: false`

**Grouped Tab Header Controls (optional):**
- Use only when the panel has Tabulator grouping and users need global expand/collapse
- Keep actions in presenter (`cycleGroupState`, optional compatibility `openAllGroups`/`collapseAllGroups`)
- Register actions by both keys:
  - `panelComponentId` (stable panel type key, e.g. `master-sailing`)
  - `panelInstanceId` (instance key, when available)
- Expose `getCycleState()` returning `{ depth, maxDepth }` so tab icon/tooltip reflects current state
- Cleanup registrations on unmount to avoid stale handlers

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

- **Header structure:** use `header.talia-report__header` for title/subtitle only (plus compact actions when required).
- **Action section:** place panel actions in a dedicated `talia-report__actions-bar` row (separate from title and from filter rows).
- **Panel filters:** place filter controls in a dedicated `talia-report-filters` row (or `talia-report__filters`) instead of mixing them into the title block.
- **Informational callouts:** use `talia-callout` for optional guidance text so global Callouts visibility controls can show/hide it consistently.
- **User data details (header ≣):** `hooks/usePanelDetailsVisibility.js` + `services/panelDetailsState.js` + **`components/shared/ReportDataDetails.jsx`**. Gate **entire** data-table regions with `<ReportDataDetails visible={showTable}>…</ReportDataDetails>` so Tabulator unmounts and no orphan headers remain (same pattern as Competitor Pricing). Header broadcasts `scope: 'all'` (persisted: `taliaGlobalReportDetailsVisible`). Optional in-panel overrides: `commitVisible(next)`. Use `respectGlobal: false` only where isolated (e.g. Data Management).
- **Technical meta (tab ⓘ):** `hooks/usePanelTechnicalMetaVisibility.js` + `services/panelTechnicalMetaState.js` + `REPORT_PANEL_TECHNICAL_META_EVENT`. `ReportShell` shows `ReportEventMeta` only when this is on — **not** tied to header ≣.
- **Do not** use the ⓘ event for end-user data tables; do not use header ≣ for technical meta.
- **Within-report filter rows (Talia filters):** wrap controls in `talia-report-filters` (see `focus-panels.css`) so the header **Filters** toggle (`talia-filters-hidden` on `<html>`) shows/hides this panel filter bar consistently.
- **Tabulator column header filters:** independent of Talia filter rows. The header **Column filters** toggle (`talia-tabulator-filters-hidden` on `<html>`) hides `.tabulator-header-filter` globally via `tabulator-theme.css`. No per-panel opt-in — any Tabulator table with `headerFilter` columns is covered automatically.
- **Visibility controls:** platform visibility toggles govern section-level blocks (`Title` / `Actions` / `Filters` / `Column filters` / `Details` / `Callouts`) via shared root classes; do not create panel-specific toggle logic.
- For sub-panel expand/collapse *inside* a report (e.g. cabin group), use `hooks/useSubpanelExpansion.js`.
- Do not duplicate these patterns per component.

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

## Summary

- **Use frameworks directly** - Tabulator, Chart.js, Dockview, Apollo Client
- **Use theme system** - CSS variables from `config/themes.js`
- **Follow existing patterns** - Look at `_TEMPLATE/` and existing components
- **No overrides** - Use frameworks as-is, no custom wrappers
- **Keep it simple** - No unnecessary abstraction layers
