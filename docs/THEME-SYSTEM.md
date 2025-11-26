# Theme System Architecture

## Overview

The Talia UI theme system has been refactored to use a centralized, CSS variable-based approach. This separates theme configuration from application code, making it easier to maintain and customize.

## Architecture

### 1. Centralized Theme Configuration (`src/config/themes.js`)

All theme definitions are stored in a single configuration file:
- **Default Theme**: `data` (Modern Dark - Data Mode style)
- **Available Themes**: `data`, `default`, `dark`
- Each theme defines CSS variables that are applied to `:root`

### 2. Theme Context Provider (`src/contexts/ThemeContext.jsx`)

- Manages theme state
- Applies themes via CSS variables
- Persists theme selection to localStorage
- Provides `useTheme()` hook for components

### 3. CSS Variables (`src/styles/theme.css`)

- Defines default CSS variable values
- Variables are dynamically updated by ThemeProvider
- Components use CSS variables instead of hardcoded colors

## Usage

### In Components

```jsx
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const { theme, themeColors, currentTheme, setCurrentTheme } = useTheme();
  
  // Use CSS variables (recommended)
  return (
    <div style={{ 
      backgroundColor: 'var(--theme-bg)',
      color: 'var(--theme-fg)',
      borderColor: 'var(--theme-border)'
    }}>
      Content
    </div>
  );
  
  // Or use themeColors object (backward compatibility)
  return (
    <div style={{ 
      backgroundColor: themeColors.background,
      color: themeColors.foreground
    }}>
      Content
    </div>
  );
}
```

### Changing Themes

```jsx
const { setCurrentTheme, availableThemes } = useTheme();

// Change theme
setCurrentTheme('data'); // or 'default', 'dark'

// List available themes
availableThemes.forEach(theme => {
  console.log(theme.key, theme.name, theme.description);
});
```

## CSS Variables Reference

All theme colors are available as CSS variables:

- `--theme-bg` - Background color/gradient
- `--theme-bg-solid` - Solid background color (for overlays)
- `--theme-fg` - Foreground/text color
- `--theme-text-secondary` - Secondary text color
- `--theme-text-muted` - Muted text color
- `--theme-sidebar` - Sidebar background
- `--theme-sidebar-border` - Sidebar border color
- `--theme-sidebar-header` - Sidebar header background
- `--theme-accent` - Accent color
- `--theme-accent-hover` - Accent hover color
- `--theme-accent-light` - Light accent color
- `--theme-glass` - Glass morphism background
- `--theme-glass-border` - Glass morphism border
- `--theme-glass-hover` - Glass morphism hover
- `--theme-border` - Border color
- `--theme-hover` - Hover state background
- `--theme-selected` - Selected state background
- `--theme-table-row-even` - Table even row background
- `--theme-table-row-odd` - Table odd row background
- `--theme-table-row-hover` - Table row hover background
- `--theme-table-row-selected` - Table selected row background
- `--theme-table-row-selected-hover` - Table selected row hover

## Adding a New Theme

1. Add theme definition to `src/config/themes.js`:

```javascript
export const themes = {
  // ... existing themes ...
  
  myNewTheme: {
    name: 'My New Theme',
    description: 'Description of my theme',
    cssVariables: {
      '--theme-bg': '#ffffff',
      '--theme-fg': '#000000',
      // ... all other variables
    },
    colors: {
      // Legacy color object for backward compatibility
      background: '#ffffff',
      foreground: '#000000',
      // ... all other colors
    }
  }
};
```

2. The theme will automatically be available via `availableThemes` in `useTheme()` hook.

## Benefits

1. **Separation of Concerns**: Theme configuration is separate from application code
2. **Easy Customization**: Change themes by modifying a single config file
3. **CSS Variables**: Better performance and easier to override
4. **Backward Compatibility**: Legacy `colors` object still available
5. **Type Safety**: Theme structure is consistent and documented
6. **Default Theme**: Data Mode style is now the default for all pages

## Migration Notes

- Old inline theme systems in `App.jsx` and `Dashboard.jsx` have been removed
- Components should migrate to CSS variables over time
- `themeColors` object is available for backward compatibility during migration

