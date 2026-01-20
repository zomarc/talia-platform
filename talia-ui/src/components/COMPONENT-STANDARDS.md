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
- Use theme colors for all styling

**Example:**
```jsx
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();
  
  return (
    <div style={{
      background: theme.colors.background,
      color: theme.colors.foreground,
      border: `1px solid ${theme.colors.border}`
    }}>
      Content
    </div>
  );
};
```

### Inline Styles

- **Avoid inline styles** except for:
  - Dynamic values (calculated widths, positions)
  - Component-specific overrides that can't be achieved via CSS variables
  - Temporary development styles (must be removed before commit)

### CSS Files

- Use existing theme CSS variables from `styles/theme.css`
- Follow patterns in `styles/theme.css`
- Do not create new CSS files unless absolutely necessary
- Prefer CSS-in-JS via theme system

## Data Fetching

### Apollo Client (GraphQL)

- Use Apollo Client for all GraphQL queries
- Import from `lib/apolloClient.js`
- Use hooks from `hooks/data/` for data fetching when available
- Follow patterns in `services/GraphQLFocusService.js`

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
- Use `lib/tabulatorConfig.js` for initialization
- Follow patterns in `components/focus-panels/_TEMPLATE/TemplatePresenter.jsx`

**Key Patterns:**
- Initialize table once when data is ready
- Update table data using `replaceData()` when data changes
- Use `selectableRows: 1` for single row selection
- Use `headerFilter: "list"` with `autocomplete: true` for dropdown filters
- Emit events on row selection: `talia:componentname.select`

**Example:**
```jsx
import { initTabulator } from '../../../lib/tabulatorConfig';

const MyTable = ({ data }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  
  useEffect(() => {
    const initTable = async () => {
      const Tabulator = await initTabulator();
      instanceRef.current = new Tabulator(tableRef.current, {
        data: data,
        columns: columns,
        selectableRows: 1,
        // ... other config
      });
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

### GraphQL: Apollo Client

- **Always use Apollo Client** for GraphQL
- Import from `lib/apolloClient.js`
- Use existing queries/mutations when available
- Add new queries to `lib/apolloClient.js` if needed

## No Overrides Policy

### Framework Usage

- **Use frameworks as-is** - no custom wrappers
- **No additional complexity layers** - use frameworks directly
- **Follow framework documentation** - use official patterns

### What NOT to Do

- ❌ Do not create custom wrappers around Tabulator, Chart.js, or Dockview
- ❌ Do not override framework methods or properties
- ❌ Do not add abstraction layers between components and frameworks
- ❌ Do not create "helper" functions that duplicate framework functionality

### What TO Do

- ✅ Use frameworks directly in components
- ✅ Follow framework documentation patterns
- ✅ Use framework features as intended
- ✅ Create utility functions only for data transformation, not framework wrapping

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
- [ ] Uses Apollo Client for GraphQL queries
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
    <div style={{
      background: theme.colors.background,
      color: theme.colors.foreground
    }}>
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
