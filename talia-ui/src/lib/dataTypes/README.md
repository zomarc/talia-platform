# Shared Data Types Library

## Overview

The Shared Data Types Library provides standardized, reusable data type definitions and column builders for Tabulator tables. This library eliminates code duplication and ensures consistent formatting, sorting, and filtering across all components.

**Achievements:**
- Reduced MasterVoyagePerformanceSummary from ~860 lines to ~280 lines
- Centralized formatters, column definitions, and conditional styling
- Consistent behavior across all components

## Key Principles

1. **Leverage Tabulator:** All types use Tabulator's native formatters, sorters, and filters
2. **Composability:** Column builders can be combined with column groups
3. **Conditional Styling:** Built-in support for performance indicators (green/yellow/red)
4. **Locale Support:** All formatting respects browser locale with fallbacks

## Quick Start

```javascript
import { 
  TextColumn, CurrencyColumn, PercentageColumn, 
  PerformanceColumn, DeltaColumn, createColumnGroup 
} from '@/lib/dataTypes';

const columns = [
  TextColumn('ship', 'Ship', { filter: 'lookup' }),
  createColumnGroup('Pricing', [
    CurrencyColumn('minFare', 'Min Fare'),
    CurrencyColumn('maxFare', 'Max Fare')
  ]),
  createColumnGroup('Performance', [
    PerformanceColumn('vsTarget', 'vs Target %', 100),
    DeltaColumn('delta', 'Delta')
  ])
];
```

## Column Builders

High-level functions that create complete Tabulator column configurations.

### TextColumn

Basic text column with optional lookup filter.

```javascript
TextColumn('ship', 'Ship', { filter: 'lookup' })
TextColumn('description', 'Description', { width: 200 })
```

**Options:**
- `filter`: 'lookup', 'input', or false (default: false)
- `width`: Column width (default: 150)
- `boldSummaryRows`: Bold summary rows (default: false)

### CurrencyColumn

Currency column with comparison filter support.

```javascript
CurrencyColumn('revenue', 'Revenue')
CurrencyColumn('price', 'Price', { currency: 'USD', width: 140 })
```

**Options:**
- `currency`: Currency code (default: 'EUR')
- `width`: Column width (default: 120)
- `minDecimals`, `maxDecimals`: Decimal places (default: 0)

**Filter Support:** Users can type `>1000`, `<5000`, `>=2000`, etc.

### PercentageColumn

Percentage column with standard formatting.

```javascript
PercentageColumn('occupancy', 'Occupancy %')
PercentageColumn('growth', 'Growth', { decimals: 1 })
```

**Options:**
- `decimals`: Decimal places (default: 2)
- `width`: Column width (default: 100)

### NumberColumn

Number column with comparison filter support.

```javascript
NumberColumn('quantity', 'Quantity')
NumberColumn('average', 'Average', { minDecimals: 2, maxDecimals: 2 })
```

**Filter Support:** Users can type `>100`, `<500`, etc.

### PerformanceColumn

Percentage column with conditional styling (green/yellow/red).

```javascript
PerformanceColumn('vsTarget', 'vs Target %', 100)
PerformanceColumn('availability', '% Available', 20, { warningPercent: 0.9 })
```

**Styling:**
- Green: value >= threshold
- Yellow: threshold * warningPercent <= value < threshold
- Red: value < threshold * warningPercent

**Options:**
- `threshold`: Performance threshold (default: 100)
- `warningPercent`: Warning threshold (default: 0.8)
- `decimals`: Decimal places (default: 2)
- `boldSummaryRows`: Bold summary rows (default: true)

### DeltaColumn

Delta indicator column with positive/negative styling.

```javascript
DeltaColumn('vsBudget', 'vs Budget %')
DeltaColumn('change', 'Change', { showSign: true })
```

**Styling:**
- Green: value > 0
- Red: value < 0
- Neutral: value === 0

**Options:**
- `decimals`: Decimal places (default: 2)
- `showSign`: Show +/- sign (default: false)

### Additional Column Builders

```javascript
// Date column
DateColumn('sailDate', 'Sail Date', { format: 'short' })

// Simple number (display only, no filter)
SimpleNumberColumn('count', 'Count')

// Rate of Sale (1 decimal place)
ROSColumn('ros', 'ROS')

// Currency with delta styling
CurrencyDeltaColumn('revenueDelta', 'Revenue Delta')
```

## Column Groups

Create grouped column headers.

```javascript
import { createColumnGroup, CurrencyColumn, PerformanceColumn } from '@/lib/dataTypes';

createColumnGroup('Pricing', [
  CurrencyColumn('minFare', 'Min Fare'),
  CurrencyColumn('maxFare', 'Max Fare')
])

// Nested groups
createColumnGroup('Performance', [
  createColumnGroup('Revenue', [
    CurrencyColumn('ytdRev', 'YTD Revenue'),
    DeltaColumn('vsTarget', 'vs Target')
  ])
])
```

## Conditional Formatters

Low-level formatters for custom usage.

```javascript
import { 
  createPerformanceFormatter, 
  createDeltaFormatter, 
  createRowFormatter,
  STYLES 
} from '@/lib/dataTypes';

// Performance formatter
const formatter = createPerformanceFormatter(100, { warningPercent: 0.8 });

// Delta formatter
const deltaFormatter = createDeltaFormatter({ showSign: true });

// Row formatter for summary rows
const rowFormatter = createRowFormatter();

// Style constants
console.log(STYLES.positive);  // { backgroundColor: '#d4edda', color: '#155724' }
console.log(STYLES.negative);  // { backgroundColor: '#f8d7da', color: '#721c24' }
console.log(STYLES.warning);   // { backgroundColor: '#fff3cd', color: '#856404' }
```

## Low-Level Data Types

For direct Tabulator integration.

```javascript
import { Currency, Percentage, DateType, Number } from '@/lib/dataTypes';

// Direct column builder
const column = Currency.toTabulatorColumn('price', 'Price', { currency: 'EUR' });

// Direct formatter usage
const customColumn = {
  field: 'price',
  title: 'Price',
  formatter: Currency.formatter,
  formatterParams: { currency: 'EUR' },
  sorter: Currency.sorter,
  hozAlign: Currency.hozAlign
};
```

## Migration Example

### Before (860 lines)

```javascript
const formatCurrency = (value) => {
  if (value == null || value === '') return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const performanceFormatter = (cell, threshold = 100) => {
  const value = cell.getValue();
  if (value == null || value === '') return '';
  const element = cell.getElement();
  const numValue = parseFloat(value);
  // ... 20 more lines of styling code
};

const columns = [
  { 
    field: "ytdBookedRevEUR", 
    title: "YTD Booked Rev EUR",
    width: 140,
    hozAlign: "right",
    formatter: (cell) => formatCurrency(cell.getValue())
  },
  // ... 700+ more lines
];
```

### After (280 lines)

```javascript
import { CurrencyColumn, PerformanceColumn, createColumnGroup } from '@/lib/dataTypes';

const columns = [
  createColumnGroup('Performance vs Budget', [
    CurrencyColumn('ytdBookedRevEUR', 'YTD Booked Rev EUR', { width: 140 }),
    DeltaColumn('vsTargetPercent', 'vs Target %'),
  ]),
  // ...
];
```

## File Structure

```
src/lib/dataTypes/
├── index.js                    # Main exports
├── README.md                   # This file
├── types/
│   ├── Currency.js             # Currency data type
│   ├── Percentage.js           # Percentage data type
│   ├── Date.js                 # DateType data type
│   └── Number.js               # Number data type
├── formatters/
│   ├── baseFormatter.js        # Utility functions
│   └── conditionalFormatters.js # Performance/delta formatters
└── columns/
    ├── columnBuilders.js       # High-level column builders
    └── columnGroups.js         # Column group helpers
```

## Best Practices

1. **Use Column Builders:** Prefer `CurrencyColumn()` over `Currency.toTabulatorColumn()`
2. **Group Related Columns:** Use `createColumnGroup()` for logical groupings
3. **Consistent Thresholds:** Use the same performance thresholds across reports
4. **Document Custom Usage:** If you need custom formatting, document why

## Contributing

When adding new column types:

1. Add type to `columns/columnBuilders.js`
2. Export from `index.js`
3. Update this README with examples
4. Test in DataTypesValidation component
