# Talia UI Component Architecture Review

## Current Architecture Analysis

### 📊 Overview
- **Framework**: React 19.1.1 with Vite
- **State Management**: Context API (AuthContext)
- **Data Fetching**: Multiple patterns (InstantDB, Supabase REST, Apollo Client configured but unused)
- **Layout System**: Dockview for panel management
- **Table Library**: Tabulator (loaded via CDN)

### 🔍 Current Structure

```
talia-ui/src/
├── components/
│   ├── admin/          # Admin-specific components
│   ├── focus-management/  # Focus management UI
│   ├── focus-panels/   # Data visualization panels
│   └── (root-level)    # Entry components
├── services/           # Business logic layer
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
└── lib/                # External lib configs
```

### ⚠️ Key Issues Identified

#### 1. **Inconsistent Data Fetching Patterns**
- **InstantDB** used for auth and focus management
- **Supabase REST API** used for business data (SimpleTable.jsx)
- **Apollo Client + GraphQL** configured but not utilized
- **Hardcoded API URLs** in components

#### 2. **Component Concerns Not Separated**
- Components handle data fetching directly
- Business logic mixed with UI logic
- No consistent error handling patterns
- Loading states managed inconsistently

#### 3. **Lack of Reusability**
- Duplicate data fetching code
- No shared components library
- Theme styling duplicated across components

#### 4. **Testing Difficulties**
- Components tightly coupled to external dependencies
- No abstraction layer for data fetching
- Difficult to mock or test

### 💡 Recommended Architecture Improvements

## Phase 1: Standardize Data Layer

### 1.1 Create Unified Data Service Layer

```typescript
// Proposed structure
src/
├── services/
│   ├── data/
│   │   ├── api.ts           # Base API configuration
│   │   ├── sailings.ts      # Sailing data service
│   │   ├── cabins.ts        # Cabin data service
│   │   └── kpis.ts          # KPI data service
│   ├── auth/                # Auth services (existing)
│   └── focus/               # Focus services (existing)
```

**Benefits:**
- Single source of truth for API endpoints
- Consistent error handling
- Easier to switch between REST/GraphQL
- Better testability

### 1.2 Implement Query Layer with Hooks

```typescript
// src/hooks/data/useSailingData.js
export const useSailingData = (filters) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    sailingService.fetch(filters)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [filters]);
  
  return { data, loading, error };
};
```

## Phase 2: Component Architecture

### 2.1 Component Separation Pattern

Adopt **Container/Presentational Component** pattern:

```
components/
├── focus-panels/
│   ├── SailingTable/
│   │   ├── index.jsx          # Container (handles data)
│   │   ├── SailingTable.jsx   # Presentational (UI only)
│   │   ├── SailingTableRow.jsx
│   │   └── SailingTable.module.css
│   └── ...
```

### 2.2 Shared Components Library

```
components/
├── shared/
│   ├── LoadingSpinner.jsx
│   ├── ErrorBoundary.jsx
│   ├── DataTable.jsx           # Wrapper for Tabulator
│   ├── Card.jsx
│   ├── Button.jsx
│   └── Modal.jsx
```

### 2.3 Theme System Enhancement

```typescript
// src/contexts/ThemeContext.jsx
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('default');
  
  const themeValues = {
    colors: THEMES[theme].colors,
    typography: { fontSize, fontFamily },
    spacing: { mode: spacingMode }
  };
  
  return (
    <ThemeContext.Provider value={{ themeValues, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

## Phase 3: Data Flow Patterns

### 3.1 Implement React Query (Recommended)

Replace current data fetching with **React Query** or **TanStack Query**:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// In components
const { data, isLoading, error } = useQuery({
  queryKey: ['sailings', filters],
  queryFn: () => sailingsService.fetch(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Benefits:**
- Built-in caching
- Automatic refetching
- Error handling
- Loading states
- Optimistic updates

### 3.2 GraphQL Integration

If continuing with GraphQL:

```typescript
// Use Apollo Client hooks consistently
import { useQuery } from '@apollo/client';
import { GET_SAILINGS } from '../lib/apolloClient';

const SailingTable = () => {
  const { data, loading, error } = useQuery(GET_SAILINGS, {
    variables: { filters },
  });
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <Table data={data.sailings} />;
};
```

## Phase 4: State Management

### 4.1 Consider State Management Library

For complex state, consider **Zustand** or **Jotai**:

```typescript
// src/stores/useAppStore.js
import { create } from 'zustand';

export const useAppStore = create((set) => ({
  selectedSailCode: null,
  setSelectedSailCode: (code) => set({ selectedSailCode: code }),
  
  // ... other state
}));
```

### 4.2 Event System Replacement

Current: Custom window events
Recommendation: React Context + useState/useReducer

```typescript
// src/contexts/SelectionContext.jsx
const SelectionContext = createContext();

export const SelectionProvider = ({ children }) => {
  const [selectedSailCode, setSelectedSailCode] = useState(null);
  
  return (
    <SelectionContext.Provider value={{ selectedSailCode, setSelectedSailCode }}>
      {children}
    </SelectionContext.Provider>
  );
};
```

## Phase 5: Type Safety

### 5.1 Add TypeScript (Gradual Migration)

```typescript
// Start with data models
interface Sailing {
  sailId: string;
  sailCode: string;
  shipName: string;
  sailDateFrom: Date;
  // ...
}
```

## Priority Implementation Roadmap

### 🎯 Quick Wins (Week 1)
1. ✅ Extract Tabulator wrapper to shared component
2. ✅ Create unified API service layer
3. ✅ Add loading/error components
4. ✅ Implement Theme Context properly

### 🚀 Medium Priority (Week 2-3)
1. ✅ Separate container/presentational components
2. ✅ Implement React Query for data fetching
3. ✅ Add PropTypes or TypeScript definitions
4. ✅ Create shared component library

### 🔮 Long-term (Month 2+)
1. ✅ Full TypeScript migration
2. ✅ Component Storybook
3. ✅ Comprehensive testing
4. ✅ Performance optimization

## Specific Code Improvements

### 1. SimpleTable.jsx Refactoring

**Current Issues:**
- 486 lines of mixed concerns
- Direct Supabase REST calls
- Manual CDN loading
- Global window events

**Proposed Structure:**

```typescript
// src/components/focus-panels/SailingTable/index.jsx (Container)
export const SailingTableContainer = () => {
  const { data, loading, error } = useSailingData();
  const theme = useTheme();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <SailingTable data={data} theme={theme} />;
};

// src/components/focus-panels/SailingTable/SailingTable.jsx (Presentational)
export const SailingTable = ({ data, theme }) => {
  // Pure UI logic
};

// src/hooks/data/useSailingData.js
export const useSailingData = () => {
  // Data fetching logic
};
```

### 2. Add Testing Support

```javascript
// src/components/shared/DataTable.jsx
export const DataTable = ({ 
  data, 
  columns, 
  loading, 
  error,
  onRowSelect 
}) => {
  // Wrapper for Tabulator with proper loading/error states
};

// Make it testable
export const useTable = (data) => {
  // Extract table logic
};
```

## Code Quality Metrics to Improve

1. **Component Size**: Average 200+ lines → Target: <150 lines
2. **Cyclomatic Complexity**: Reduce nested conditionals
3. **Code Duplication**: Currently high → Target: <5%
4. **Test Coverage**: Currently 0% → Target: >70%
5. **Type Safety**: 0% → Target: 100% with TypeScript

## Next Steps

1. **Review this document** with the team
2. **Choose GraphQL vs REST** for data layer
3. **Decide on TypeScript** adoption timeline
4. **Prioritize quick wins** for immediate impact
5. **Set up development tooling** (ESLint, Prettier, Husky)

## References

- [React Component Patterns](https://react.dev/learn)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Apollo Client Best Practices](https://www.apollographql.com/docs/react/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

