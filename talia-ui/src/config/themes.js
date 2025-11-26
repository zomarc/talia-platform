/**
 * Centralized Theme Configuration
 * 
 * All theme definitions are separated from application code.
 * Themes are applied via CSS variables for better separation and easier customization.
 * 
 * To add a new theme:
 * 1. Add theme definition below
 * 2. Add theme name to THEME_NAMES export
 * 3. CSS variables will be automatically applied via ThemeProvider
 */

/**
 * Default Theme - Modern Dark (Data Mode style)
 * This is now the default theme for the entire application
 */
export const DEFAULT_THEME = 'data';

/**
 * Theme Definitions
 * Each theme defines CSS variable values that will be applied to :root
 */
export const themes = {
  // Modern Dark Theme (Data Mode style) - DEFAULT
  data: {
    name: 'Modern Dark',
    description: 'Professional dark theme optimized for data visualization',
    cssVariables: {
      // Background colors
      '--theme-bg': 'linear-gradient(135deg, #0a0a1a 0%, #151528 50%, #1a1a2e 100%)',
      '--theme-bg-solid': '#151528',
      
      // Foreground/text colors
      '--theme-fg': '#e8e8f0',
      '--theme-text-secondary': 'rgba(232, 232, 240, 0.75)',
      '--theme-text-muted': 'rgba(232, 232, 240, 0.55)',
      
      // Sidebar colors
      '--theme-sidebar': 'rgba(255, 255, 255, 0.05)',
      '--theme-sidebar-border': 'rgba(255, 255, 255, 0.12)',
      '--theme-sidebar-header': 'rgba(255, 255, 255, 0.08)',
      
      // Accent colors (blue)
      '--theme-accent': '#5b9bd5',
      '--theme-accent-hover': '#4a8bc2',
      '--theme-accent-light': 'rgba(91, 155, 213, 0.15)',
      
      // Glass morphism effects
      '--theme-glass': 'rgba(255, 255, 255, 0.08)',
      '--theme-glass-border': 'rgba(255, 255, 255, 0.15)',
      '--theme-glass-hover': 'rgba(255, 255, 255, 0.12)',
      
      // Border colors
      '--theme-border': 'rgba(255, 255, 255, 0.15)',
      
      // Interactive states
      '--theme-hover': 'rgba(91, 155, 213, 0.25)',
      '--theme-selected': 'rgba(91, 155, 213, 0.15)',
      
      // Table row colors
      '--theme-table-row-even': 'transparent',
      '--theme-table-row-odd': 'rgba(0, 0, 0, 0.2)',
      '--theme-table-row-hover': 'rgba(66, 133, 244, 0.5)',
      '--theme-table-row-selected': 'rgba(66, 133, 244, 0.25)',
      '--theme-table-row-selected-hover': 'rgba(66, 133, 244, 0.6)',
    },
    // Legacy color object for backward compatibility (will be deprecated)
    colors: {
      background: 'linear-gradient(135deg, #0a0a1a 0%, #151528 50%, #1a1a2e 100%)',
      foreground: '#e8e8f0',
      sidebar: 'rgba(255, 255, 255, 0.05)',
      sidebarBorder: 'rgba(255, 255, 255, 0.12)',
      sidebarHeader: 'rgba(255, 255, 255, 0.08)',
      accent: '#5b9bd5',
      accentHover: '#4a8bc2',
      accentLight: 'rgba(91, 155, 213, 0.15)',
      glass: 'rgba(255, 255, 255, 0.08)',
      glassBorder: 'rgba(255, 255, 255, 0.15)',
      glassHover: 'rgba(255, 255, 255, 0.12)',
      textSecondary: 'rgba(232, 232, 240, 0.75)',
      textMuted: 'rgba(232, 232, 240, 0.55)',
      border: 'rgba(255, 255, 255, 0.15)',
      tableRowEven: 'transparent',
      tableRowOdd: 'rgba(0, 0, 0, 0.2)',
      tableRowHover: 'rgba(66, 133, 244, 0.5)',
      tableRowSelected: 'rgba(66, 133, 244, 0.25)',
      tableRowSelectedHover: 'rgba(66, 133, 244, 0.6)',
      hover: 'rgba(91, 155, 213, 0.25)',
      selected: 'rgba(91, 155, 213, 0.15)'
    }
  },

  // Light Theme (Original Default)
  default: {
    name: 'Light',
    description: 'Clean light theme with warm accents',
    cssVariables: {
      '--theme-bg': '#ffffff',
      '--theme-bg-solid': '#ffffff',
      '--theme-fg': '#2b2b2b',
      '--theme-text-secondary': '#6b6b6b',
      '--theme-text-muted': '#999',
      '--theme-sidebar': '#f7f3ee',
      '--theme-sidebar-border': '#e8dfd0',
      '--theme-sidebar-header': '#f5efe6',
      '--theme-accent': '#b08d57',
      '--theme-accent-hover': 'rgba(176, 141, 87, 0.6)',
      '--theme-accent-light': 'rgba(176, 141, 87, 0.3)',
      '--theme-glass': 'rgba(255, 255, 255, 0.8)',
      '--theme-glass-border': '#e8dfd0',
      '--theme-glass-hover': '#fff7ea',
      '--theme-border': '#e8dfd0',
      '--theme-hover': '#fff7ea',
      '--theme-selected': '#fdeacc',
      '--theme-table-row-even': 'transparent',
      '--theme-table-row-odd': 'rgba(0, 0, 0, 0.02)',
      '--theme-table-row-hover': 'rgba(176, 141, 87, 0.1)',
      '--theme-table-row-selected': '#fdeacc',
      '--theme-table-row-selected-hover': 'rgba(176, 141, 87, 0.2)',
    },
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
      accentHover: 'rgba(176, 141, 87, 0.6)',
      accentLight: 'rgba(176, 141, 87, 0.3)',
      textSecondary: '#6b6b6b',
      textMuted: '#999',
      border: '#e8dfd0',
      hover: '#fff7ea',
      selected: '#fdeacc'
    }
  },

  // Dark Theme (VS Code style)
  dark: {
    name: 'Dark',
    description: 'Classic dark theme similar to VS Code',
    cssVariables: {
      '--theme-bg': '#1e1e1e',
      '--theme-bg-solid': '#1e1e1e',
      '--theme-fg': '#d4d4d4',
      '--theme-text-secondary': '#cccccc',
      '--theme-text-muted': '#808080',
      '--theme-sidebar': '#252526',
      '--theme-sidebar-border': '#3e3e42',
      '--theme-sidebar-header': '#2d2d30',
      '--theme-accent': '#007acc',
      '--theme-accent-hover': 'rgba(0, 122, 204, 0.6)',
      '--theme-accent-light': 'rgba(0, 122, 204, 0.3)',
      '--theme-glass': 'rgba(42, 45, 46, 0.8)',
      '--theme-glass-border': '#3e3e42',
      '--theme-glass-hover': '#2a2d2e',
      '--theme-border': '#3e3e42',
      '--theme-hover': '#2a2d2e',
      '--theme-selected': '#094771',
      '--theme-table-row-even': 'transparent',
      '--theme-table-row-odd': 'rgba(255, 255, 255, 0.05)',
      '--theme-table-row-hover': 'rgba(0, 122, 204, 0.2)',
      '--theme-table-row-selected': '#094771',
      '--theme-table-row-selected-hover': 'rgba(0, 122, 204, 0.4)',
    },
    colors: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      sidebar: '#252526',
      sidebarBorder: '#3e3e42',
      sidebarHeader: '#2d2d30',
      accent: '#007acc',
      accentHover: 'rgba(0, 122, 204, 0.6)',
      accentLight: 'rgba(0, 122, 204, 0.3)',
      textSecondary: '#cccccc',
      textMuted: '#808080',
      border: '#3e3e42',
      hover: '#2a2d2e',
      selected: '#094771'
    }
  }
};

/**
 * Get theme by name
 */
export const getTheme = (themeName) => {
  return themes[themeName] || themes[DEFAULT_THEME];
};

/**
 * Get all available theme names
 */
export const getThemeNames = () => {
  return Object.keys(themes);
};

/**
 * Apply theme CSS variables to document root
 */
export const applyTheme = (themeName) => {
  const theme = getTheme(themeName);
  const root = document.documentElement;
  
  // Apply all CSS variables
  Object.entries(theme.cssVariables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  // Add theme class to body for CSS selectors
  document.body.className = document.body.className
    .replace(/theme-\w+/g, '')
    .trim() + ` theme-${themeName}`;
};

/**
 * Get theme colors object (for backward compatibility)
 */
export const getThemeColors = (themeName) => {
  const theme = getTheme(themeName);
  return theme.colors || {};
};

export default themes;

