# Shared Tabulator Configuration

## Overview

Tabulator configuration has been centralized into a single shared module for consistency across all components.

## Files Changed

### ✅ Created New File
- **`src/lib/tabulatorConfig.js`** - Shared Tabulator configuration

### ✅ Updated Files
- **`src/components/focus-panels/SailingTable/SailingTablePresenter.jsx`** - Uses shared config
- **`src/components/focus-panels/SimpleTable.jsx`** - Uses shared config
- **`src/lib/index.js`** - Central export point

## What's in the Shared Config

### 1. Configuration Constants
```javascript
export const TABULATOR_CONFIG = {
  css: 'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css',
  js: 'https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js'
};
```

### 2. Loading Functions
- **`loadTabulatorCss()`** - Loads CSS from CDN
- **`loadTabulatorJs()`** - Loads JS from CDN
- **`initTabulator()`** - Loads both (recommended)

### 3. Default Options
```javascript
export const DEFAULT_TABULATOR_OPTIONS = {
  layout: 'fitColumns',
  reactiveData: false,
  height: '100%',
  selectable: 1,
  headerFilterLiveFilter: true,
  headerFilterLiveFilterDelay: 300,
  // ... more defaults
};
```

### 4. Common Column Types
- `input` - Text input filter
- `dropdown` - Dropdown filter
- `number` - Number filter
- `date` - Date formatter
- `boolean` - Yes/No formatter

## How to Use

### Basic Usage
```javascript
import { initTabulator } from '../../lib/tabulatorConfig';

const MyTable = () => {
  useEffect(() => {
    const initTable = async () => {
      const Tabulator = await initTabulator();
      
      new Tabulator(tableRef.current, {
        data: myData,
        columns: myColumns
      });
    };
    
    initTable();
  }, []);
};
```

### With Shared Options
```javascript
import { initTabulator, DEFAULT_TABULATOR_OPTIONS } from '../../lib/tabulatorConfig';

const Tabulator = await initTabulator();

new Tabulator(tableRef.current, {
  ...DEFAULT_TABULATOR_OPTIONS,
  data: myData,
  columns: myColumns
});
```

### Using Common Column Types
```javascript
import { COMMON_COLUMN_TYPES } from '../../lib/tabulatorConfig';

const columns = [
  COMMON_COLUMN_TYPES.input({
    field: 'name',
    title: 'Name'
  }),
  COMMON_COLUMN_TYPES.number({
    field: 'price',
    title: 'Price'
  })
];
```

## Benefits

### ✅ Consistency
- Same config across all tables
- Consistent loading behavior
- Standard options everywhere

### ✅ Maintainability
- Update config in one place
- Easy to change CDN version
- Centralized error handling

### ✅ Reusability
- Common column types
- Default options
- Shared loading logic

### ✅ Testability
- Mock config easily
- Test loading functions
- Validate options

## Migration Examples

### Before
```javascript
// Each component had its own loading logic
const CDN = { ... };
const loadCss = (url) => { ... };
const loadScript = (url) => { ... };

// In component
await loadCss(CDN.css);
const Tabulator = await loadScript(CDN.js);
```

### After
```javascript
// Import shared config
import { initTabulator } from '../../lib/tabulatorConfig';

// In component (one line!)
const Tabulator = await initTabulator();
```

## Next Steps

1. ✅ Use `initTabulator()` in existing components
2. ⏳ Update any remaining components
3. ⏳ Add more common column types as needed
4. ⏳ Create table wrapper component

## Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| `SailingTablePresenter.jsx` | ✅ Updated | Uses shared config |
| `SimpleTable.jsx` | ✅ Updated | Uses shared config |
| Future components | ⏳ Pending | Use shared config |

## Quick Reference

```javascript
// Import what you need
import { 
  initTabulator,                      // Load Tabulator
  DEFAULT_TABULATOR_OPTIONS,         // Default options
  COMMON_COLUMN_TYPES,                // Column helpers
  TABULATOR_CONFIG,                   // CDN URLs
  loadTabulatorCss,                   // Load CSS only
  loadTabulatorJs                     // Load JS only
} from '../../lib/tabulatorConfig';
```

---

**See:** `src/lib/tabulatorConfig.js` for full implementation

