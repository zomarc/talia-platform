# Before & After: Code Examples

This document shows concrete before/after examples of the architecture improvements.

## Example 1: Data Fetching

### ❌ Before
```javascript
// SimpleTable.jsx (lines 103-127)
const loadSailingCabinData = async () => {
  try {
    const response = await fetch('http://127.0.0.1:54321/rest/v1/master_sail?select=*&limit=100', {
      headers: {
        'apikey': 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
        'Authorization': 'Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[SailingByCabinCategory] Loaded data from Supabase:', data.length, 'records');
    setAllData(data);
    return data;
  } catch (error) {
    console.error('[SailingByCabinCategory] Error loading data:', error);
    return [];
  }
};

// Used throughout the component
useEffect(() => {
  // ... 50+ lines of initialization
  const sailingCabinData = await loadSailingCabinData();
  // ... more code
}, []);
```

**Problems:**
- API URL hardcoded in component
- Headers hardcoded in component
- Error handling inconsistent
- Loading state managed manually
- Not reusable

### ✅ After

```javascript
// services/data/sailingsService.js
class SailingsService {
  async fetch(filters = {}) {
    const { sail_code, ship_name, limit = 100 } = filters;
    const response = await fetch(`${this.baseUrl}/master_sail?${queryParams}`, {
      headers: this.headers,
    });
    return await response.json();
  }
}

// hooks/data/useSailingData.js
export const useSailingData = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    sailingsService.fetch(filters)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  return { data, loading, error, refetch };
};

// In component
const MyComponent = () => {
  const { data, loading, error } = useSailingData({ sail_code: 'S001' });
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <MyUI data={data} />;
};
```

**Benefits:**
- ✅ Centralized API configuration
- ✅ Reusable hook
- ✅ Automatic loading/error states
- ✅ Clean component code
- ✅ Easy to test

---

## Example 2: Loading States

### ❌ Before
```javascript
// Spread across components with different implementations
const SailingByCabinCategory = () => {
  const [loading, setLoading] = useState(false);
  
  // Manual loading management
  setLoading(true);
  try {
    await loadData();
  } finally {
    setLoading(false);
  }
  
  if (loading) {
    return <div>Loading...</div>; // Different in each component
  }
};

const KPICards = () => {
  const [loading, setLoading] = useState(false);
  // Same pattern repeated...
  
  if (loading) {
    return <p>Please wait...</p>; // Different implementation
  }
};
```

**Problems:**
- Duplicate code in every component
- Inconsistent UI
- No loading spinner
- No error states

### ✅ After

```javascript
// components/shared/LoadingSpinner.jsx - Created once
export const LoadingSpinner = ({ message, size }) => {
  return (
    <div style={spinnerStyles}>
      {/* Animated spinner */}
      <p>{message}</p>
    </div>
  );
};

// Usage in ANY component
import { LoadingSpinner } from '../shared';

const MyComponent = () => {
  const { data, loading } = useSailingData();
  
  if (loading) return <LoadingSpinner message="Loading sailing data..." />;
  
  return <div>{/* content */}</div>;
};
```

**Benefits:**
- ✅ Write once, use everywhere
- ✅ Consistent UX
- ✅ Configurable (size, message, fullScreen)
- ✅ Easy to update

---

## Example 3: Error Handling

### ❌ Before
```javascript
// Inconsistent error handling across components
const MyComponent = () => {
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchData()
      .catch(err => {
        console.error(err);
        setError(err);
      });
  }, []);
  
  if (error) {
    // Different error UI in each component
    return <div>Error: {error.message}</div>;
  }
};
```

**Problems:**
- No retry mechanism
- Inconsistent error display
- Poor user experience

### ✅ After

```javascript
// components/shared/ErrorMessage.jsx
export const ErrorMessage = ({ error, onRetry, onDismiss }) => {
  return (
    <div>
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
      {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
    </div>
  );
};

// Usage
import { ErrorMessage } from '../shared';

const MyComponent = () => {
  const { data, loading, error, refetch } = useSailingData();
  
  if (error) {
    return <ErrorMessage error={error} onRetry={refetch} />;
  }
  
  return <div>{/* content */}</div>;
};
```

**Benefits:**
- ✅ Consistent error UI
- ✅ Built-in retry functionality
- ✅ Better UX
- ✅ Reusable

---

## Example 4: Component Structure

### ❌ Before
```javascript
// SimpleTable.jsx - 486 lines, everything in one file
const SailingByCabinCategory = () => {
  // 1. Theme definition
  const theme = { /* ... */ };
  
  // 2. State management
  const [selectedSailCode, setSelectedSailCode] = useState(null);
  const [allData, setAllData] = useState([]);
  
  // 3. Data fetching function
  const loadSailingCabinData = async () => { /* ... */ };
  
  // 4. Event listeners
  useEffect(() => { /* ... */ }, []);
  
  // 5. Filter logic
  const getFilteredData = () => { /* ... */ };
  
  // 6. Tabulator initialization
  useEffect(() => { /* ... 200 lines ... */ }, []);
  
  // 7. Manual refresh function
  const refreshData = useCallback(() => { /* ... */ }, []);
  
  // 8. Update effect
  useEffect(() => { /* ... */ }, [selectedSailCode, allData]);
  
  // 9. Global window exposure
  useEffect(() => { /* ... */ }, [refreshData]);
  
  // 10. Render
  return <div>...</div>;
};
```

**Problems:**
- Too many responsibilities
- Hard to test
- Hard to maintain
- Difficult to understand

### ✅ After

```javascript
// Container Component - handles data (SailingTable/index.jsx)
import { useSailingData } from '../../../hooks/data/useSailingData';
import SailingTablePresenter from './SailingTablePresenter';
import { LoadingSpinner, ErrorMessage } from '../../shared';

export const SailingTableContainer = ({ filters, theme }) => {
  const { data, loading, error, refetch } = useSailingData(filters);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  
  return <SailingTablePresenter data={data} theme={theme} />;
};

// Presentational Component - handles UI only (SailingTablePresenter.jsx)
export const SailingTablePresenter = ({ data, theme, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  
  // Pure UI logic with Tabulator
  useEffect(() => {
    // Initialize Tabulator
  }, [data]);
  
  return (
    <div>
      {onRefresh && <button onClick={onRefresh}>↻ Refresh</button>}
      <div ref={tableRef} />
    </div>
  );
};
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Testable independently
- ✅ Reusable presenter
- ✅ Container handles all data logic

---

## Example 5: Service Layer

### ❌ Before
```javascript
// Hardcoded API calls scattered across components
const Component1 = () => {
  const response = await fetch('http://127.0.0.1:54321/rest/v1/master_sail', {
    headers: {
      'apikey': 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      'Authorization': 'Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    }
  });
};

const Component2 = () => {
  const response = await fetch('http://127.0.0.1:54321/rest/v1/master_sail', {
    headers: {
      'apikey': 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      'Authorization': 'Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
    }
  });
};
// Duplicated in every component...
```

**Problems:**
- API URL and keys hardcoded everywhere
- Change URLs = update 10+ files
- No centralization
- No easy way to switch providers

### ✅ After

```javascript
// services/data/sailingsService.js - Single source of truth
class SailingsService {
  constructor() {
    this.baseUrl = SUPABASE_URL;
    this.headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };
  }
  
  async fetch(filters = {}) {
    // Centralized API logic
  }
}

// Usage everywhere
import sailingsService from './services/data/sailingsService';

const data = await sailingsService.fetch({ sail_code: 'S001' });
```

**Benefits:**
- ✅ Single place to update URLs/keys
- ✅ Easy to switch providers
- ✅ Consistent API calls
- ✅ Testable service layer

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Lines of Code** | 486 per component | ~150 per component |
| **Reusability** | Low | High |
| **Testability** | Difficult | Easy |
| **Maintainability** | Poor | Excellent |
| **Consistency** | Low | High |
| **Developer Experience** | Frustrating | Pleasant |

## Migration Path

1. Start using new hooks and shared components
2. Refactor one component at a time
3. Gradually replace old patterns
4. Test continuously
5. Enjoy improved code quality!

