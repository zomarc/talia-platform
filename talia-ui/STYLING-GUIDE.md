# Talia UI Styling Guide

## Overview

Talia UI uses a **single, unified CSS system** with no inline styles or CSS injection. All styling is externalized using:

1. **CSS Variables** (`theme.css`) - Single source of truth for all colors, fonts, spacing
2. **Component Classes** (`components.css`) - Reusable classes for common UI patterns
3. **Dashboard Classes** (`dashboard.css`) - Dashboard-specific styling
4. **Library Themes** - Standard themes from npm packages (Tabulator midnight, Chart.js via config)

## Core Principles

### 1. No Inline Styles
❌ **DON'T:**
```jsx
<div style={{ padding: '12px', background: '#151528' }}>
```

✅ **DO:**
```jsx
<div className="talia-card">
```

### 2. Use CSS Variables
❌ **DON'T:**
```css
.my-component {
  background: #151528;
  color: #e8e8f0;
}
```

✅ **DO:**
```css
.my-component {
  background: var(--theme-bg-solid);
  color: var(--theme-fg);
}
```

### 3. Use Component Classes
❌ **DON'T:**
```jsx
<button style={{ padding: '8px', background: 'transparent' }}>
```

✅ **DO:**
```jsx
<button className="talia-btn talia-btn--ghost">
```

### 4. No CSS Injection
- Never use `createElement('style')`
- Never use `insertRule` or `addRule`
- Never dynamically inject CSS
- All CSS must be in `.css` files imported at build time

### 5. Library Theming
- **Tabulator**: Uses `tabulator_midnight` theme from npm package. No overrides.
- **Chart.js**: Uses `chartConfig.js` to set global defaults based on CSS variables.

## File Structure

```
src/
├── styles/
│   ├── theme.css          # CSS variables (single source of truth)
│   ├── components.css     # Shared component classes
│   ├── dashboard.css      # Dashboard-specific styles
│   └── tabulator-theme.css # Empty (Tabulator uses npm theme)
├── lib/
│   ├── chartConfig.js     # Chart.js global configuration
│   └── tabulatorConfig.js # Tabulator configuration (imports theme)
└── main.jsx               # Imports all CSS files in order
```

## CSS Import Order

The order matters! Import in `main.jsx`:

```javascript
import './index.css'              // Base styles
import './styles/theme.css'       // CSS variables (must be first)
import './styles/tabulator-theme.css' // Tabulator (after theme)
import './styles/components.css'  // Component classes
import './styles/dashboard.css'    // Dashboard styles
```

## Available CSS Variables

See `theme.css` for complete list. Common ones:

- Colors: `--theme-bg-solid`, `--theme-fg`, `--theme-accent`, `--theme-border`
- Typography: `--theme-font-family`, `--theme-font-size`, `--theme-font-size-sm`
- Spacing: `--theme-padding-xs`, `--theme-padding-sm`, `--theme-padding-md`
- Borders: `--theme-radius-sm`, `--theme-radius-md`

## Component Classes

### Report Container
```jsx
<div className="talia-report">
  <header className="talia-report__header">
    <h2 className="talia-report__title">Title</h2>
  </header>
  <main className="talia-report__content">...</main>
  <footer className="talia-report__footer">...</footer>
</div>
```

### Buttons
```jsx
<button className="talia-btn">Default</button>
<button className="talia-btn talia-btn--primary">Primary</button>
<button className="talia-btn talia-btn--ghost">Ghost</button>
<button className="talia-btn talia-btn--small">Small</button>
```

### States
```jsx
<div className="talia-loading">...</div>
<div className="talia-empty">...</div>
<div className="talia-error">...</div>
```

### Cards
```jsx
<div className="talia-card">...</div>
<div className="talia-card talia-card--elevated">...</div>
```

## Dashboard Classes

See `dashboard.css` for Dashboard-specific classes:

- `.dashboard-sidebar` - Sidebar container
- `.dashboard-section` - Collapsible section
- `.dashboard-btn` - Sidebar buttons
- `.dashboard-form-group` - Form inputs
- `.dashboard-mode-btn` - Mode selector buttons

## Conditional Formatting

For conditional formatting in Tabulator cells, inline styles are acceptable ONLY for dynamic values:

```javascript
// OK: Dynamic conditional formatting
formatter: (cell) => {
  const value = cell.getValue();
  const element = cell.getElement();
  if (value > 100) {
    element.style.backgroundColor = 'var(--theme-perf-good-bg)';
    element.style.color = 'var(--theme-perf-good)';
  }
  return value;
}
```

## Migration Checklist

When updating a component:

1. [ ] Remove all `style={{}}` props
2. [ ] Replace with CSS classes from `components.css` or `dashboard.css`
3. [ ] Use CSS variables for any custom values
4. [ ] Ensure no CSS injection methods are used
5. [ ] Test that styles match the unified theme

## Common Patterns

### Centered Content
```jsx
<div className="talia-loading">
  <div className="talia-loading__spinner"></div>
  <div className="talia-loading__text">Loading...</div>
</div>
```

### Grid Layout
```jsx
<div className="talia-grid talia-grid--3">
  <div className="talia-card">...</div>
  <div className="talia-card">...</div>
  <div className="talia-card">...</div>
</div>
```

### Metrics Display
```jsx
<div className="talia-metric">
  <span className="talia-metric__label">Revenue</span>
  <span className="talia-metric__value">$1,234,567</span>
</div>
```

## Testing

After making styling changes:

1. Build the app: `npm run build`
2. Check browser console for CSS errors
3. Verify all tables use midnight theme
4. Verify all charts use theme colors
5. Verify no inline styles in DOM inspector
