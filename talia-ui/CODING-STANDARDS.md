# Talia UI Coding Standards

## Core Principle: USE THE LIBRARY

### ⚠️ ALWAYS USE LIBRARY FEATURES OVER CUSTOM CODE

**Rule of Thumb**: Before writing any custom code, check if the library already provides a feature for it.

### Examples of Right vs Wrong

#### ❌ WRONG: Writing Custom Filter Logic
```javascript
// BAD: Manually extracting unique values
const getFilterValues = (field, data) => {
  const uniqueValues = [...new Set(data.map(row => row[field]))];
  const values = { "": "All" };
  uniqueValues.forEach(value => { values[value] = value; });
  return values;
};

column.headerFilterParams = {
  values: getFilterValues(col.field, data)
};
```

#### ✅ RIGHT: Using Library Feature
```javascript
// GOOD: Let Tabulator handle it
column.headerFilterParams = {
  valuesLookup: true  // Tabulator does it automatically!
};
```

---

## Library Usage Guidelines

### 1. Tabulator (Table Library)

#### ✅ Use These Native Features
- **Filtering**: Use `valuesLookup` for dynamic dropdowns
- **Sorting**: Use `initialSort` instead of pre-sorting data
- **Resizing**: Enable `resizableColumns: true`
- **Reordering**: Enable `movableColumns: true`
- **Themes**: Use built-in themes, don't write custom CSS
- **Formatters**: Use Tabulator formatters, not custom cell renderers

#### ❌ Don't Create These Custom Solutions
- ~~Manual filter value extraction~~ → Use `valuesLookup`
- ~~Custom CSS for table styling~~ → Use Tabulator themes
- ~~Manual data sorting~~ → Use Tabulator sorting
- ~~Custom pagination logic~~ → Use `pagination: true`

### 2. React Patterns

#### ✅ Use These
- **Hooks**: Extract reusable logic to custom hooks
- **Context**: Use Context API for state sharing
- **Props**: Pass data down, events up
- **useEffect**: For side effects and data fetching

#### ❌ Don't Do These
- ~~Prop drilling~~ → Use Context
- ~~Inline complex logic~~ → Extract to hooks
- ~~Direct DOM manipulation~~ → Use React refs
- ~~Global state in components~~ → Use Context or state management

### 3. Data Fetching

#### ✅ Use These Patterns
- **Custom Hooks**: `useSailingData()`, `useKPIData()`
- **Service Layer**: Centralized API calls
- **Error Handling**: Consistent with shared components

#### ❌ Don't Do These
- ~~Fetch in components~~ → Use hooks
- ~~Duplicate fetch logic~~ → Use service layer
- ~~Inline API calls~~ → Use service functions

---

## Decision Tree: Custom Code vs Library Feature

```
Do I need to implement a feature?
    │
    ├─> Check library documentation
    │       │
    │       ├─> Library provides it?
    │       │   │
    │       │   └─> ✅ USE THE LIBRARY
    │       │
    │       └─> Library doesn't provide it?
    │           │
    │           └─> Is it a core feature?
    │               │
    │               ├─> Yes → Write custom solution
    │               │
    │               └─> No → Can you use a different library?
    │                           │
    │                           ├─> Yes → Switch library or add library
    │                           │
    │                           └─> No → Minimal custom code only
```

---

## Code Review Checklist

Before submitting code, ensure:

### ✅ Library Usage
- [ ] Used library features instead of custom implementations
- [ ] No reinventing the wheel
- [ ] Leveraged built-in options/configuration
- [ ] Used official APIs and patterns

### ✅ Architecture
- [ ] Separated concerns (Container/Presenter)
- [ ] Extracted reusable logic to hooks
- [ ] Used service layer for API calls
- [ ] Shared components for common UI

### ✅ Code Quality
- [ ] DRY (Don't Repeat Yourself)
- [ ] Readable and maintainable
- [ ] Documented complex logic
- [ ] Follows existing patterns

---

## Specific Library Guidelines

### Tabulator
```javascript
// ✅ GOOD: Using native features
const config = {
  headerFilter: "autocomplete",
  headerFilterParams: { valuesLookup: true },
  resizableColumns: true,
  movableColumns: true,
  initialSort: [{ column: "date", dir: "desc" }]
};

// ❌ BAD: Custom implementations
const config = {
  headerFilter: "select",
  headerFilterParams: { 
    values: manuallyExtractUniqueValues() 
  },
  customResizeHandler: () => {},
  customMoveHandler: () => {},
  manualSort: preSortData()
};
```

### React Query / Apollo
```javascript
// ✅ GOOD: Using library hooks
const { data, loading, error } = useSailingData(filters);

// ❌ BAD: Manual fetch management
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
useEffect(() => {
  fetch('/api').then(res => res.json()).then(setData).finally(() => setLoading(false));
}, []);
```

### Lodash / Utils
```javascript
// ✅ GOOD: Using utility library
import { debounce } from 'lodash';
const debouncedSearch = debounce(handleSearch, 300);

// ❌ BAD: Writing custom debounce
const customDebounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};
```

---

## Red Flags: When Code Should Be Refactored

Watch for these patterns that indicate we're not using libraries properly:

### 🚩 Manual Data Processing
```javascript
// If you're manually extracting unique values
const uniqueValues = [...new Set(data.map(x => x.field))];
```
**Should be**: Using library's automatic lookup

### 🚩 Custom UI Components
```javascript
// If you're building dropdowns, modals, etc from scratch
<div style={{...}} onClick={...}>Custom Dropdown</div>
```
**Should be**: Using component library (Material-UI, Ant Design, etc.)

### 🚩 Inline Data Fetching
```javascript
// If you're writing fetch calls in components
useEffect(() => {
  fetch('/api').then(setData);
}, []);
```
**Should be**: Using custom hooks or React Query

### 🚩 Manual State Management
```javascript
// If you're managing complex state in components
const [state1, setState1] = useState();
const [state2, setState2] = useState();
// ... many states
```
**Should be**: Using Context or state management library

---

## Examples: Before → After

### Example 1: Filter Generation

**Before** (Custom solution - 50 lines):
```javascript
const generateColumns = (data) => {
  const sampleData = data.slice(0, 100);
  
  return columnDefs.map(col => {
    const sampleValues = [...new Set(
      sampleData.map(row => row[col.field]).filter(Boolean)
    )];
    
    const values = { "": "All" };
    sampleValues.forEach(value => { values[value] = value; });
    
    return {
      ...col,
      headerFilterParams: { values, clearable: true }
    };
  });
};
```

**After** (Library feature - 2 lines):
```javascript
const columns = [
  {
    field: "ship_name",
    headerFilter: "autocomplete",
    headerFilterParams: { valuesLookup: true }
  }
];
```

**Lines saved**: 48 lines (96% reduction!)

### Example 2: Data Fetching

**Before** (Custom solution - 30 lines):
```javascript
const Component = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetch('/api')
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;
  return <Table data={data} />;
};
```

**After** (Library feature - 5 lines):
```javascript
const Component = () => {
  const { data, loading, error } = useSailingData();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  return <Table data={data} />;
};
```

**Lines saved**: 25 lines (83% reduction!)

---

## Resources

### Documentation to Reference
- **Tabulator 5.6**: https://tabulator.info/docs/5.6
- **React Hooks**: https://react.dev/reference/react
- **React Query**: https://tanstack.com/query/latest
- **Material-UI**: https://mui.com/
- **Lodash**: https://lodash.com/docs/

### When to Choose a Library
1. **Popularity**: Used by many developers
2. **Maintenance**: Actively maintained
3. **Documentation**: Well documented
4. **Features**: Has what you need
5. **Size**: Lightweight if possible

---

## Quick Reference

| Task | Use Library | Custom Code |
|------|-------------|-------------|
| Filter dropdowns | `valuesLookup: true` | ❌ Manual extraction |
| Column sorting | `initialSort` | ❌ Pre-sort data |
| Loading states | Shared components | ❌ Inline styles |
| Error handling | Shared components | ❌ Custom UI |
| Data fetching | Custom hooks | ❌ Inline fetches |
| Styling | Library themes | ❌ Custom CSS |
| State management | Context/Redux | ❌ Prop drilling |

---

**Remember**: Every line of custom code is a line to maintain. Use the library! 🚀

