/**
 * Theme Configuration
 * 
 * Single theme definition for the application.
 * CSS variables are defined in /src/styles/theme.css
 * This file provides JavaScript access to theme values for components
 * that need to reference colors in inline styles.
 * 
 * PREFERRED: Use CSS variables directly in styles:
 *   style={{ background: 'var(--theme-bg-solid)' }}
 * 
 * FALLBACK: Use this theme object when CSS variables won't work:
 *   style={{ background: theme.colors.background }}
 */

/**
 * Application Theme - Modern Professional Dark
 * Single source of truth for theme values in JavaScript
 */
export const theme = {
  name: 'Talia Professional',
  
  colors: {
    // Backgrounds
    background: '#151528',
    backgroundGradient: 'linear-gradient(135deg, #0a0a1a 0%, #151528 50%, #1a1a2e 100%)',
    elevated: '#1a1a2e',
    
    // Text
    foreground: '#e8e8f0',
    textSecondary: 'rgba(232, 232, 240, 0.75)',
    textMuted: 'rgba(232, 232, 240, 0.55)',
    
    // Accent
    accent: '#5b9bd5',
    accentHover: '#4a8bc2',
    accentLight: 'rgba(91, 155, 213, 0.15)',
    
    // Borders
    border: 'rgba(255, 255, 255, 0.15)',
    borderLight: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.25)',
    
    // Glass/panels
    glass: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
    glassHover: 'rgba(255, 255, 255, 0.12)',
    
    // Sidebar
    sidebar: 'rgba(255, 255, 255, 0.05)',
    sidebarBorder: 'rgba(255, 255, 255, 0.12)',
    sidebarHeader: 'rgba(255, 255, 255, 0.08)',
    
    // Interactive states
    hover: 'rgba(91, 155, 213, 0.25)',
    selected: 'rgba(91, 155, 213, 0.15)',
    
    // Table rows
    tableRowEven: 'transparent',
    tableRowOdd: 'rgba(0, 0, 0, 0.2)',
    tableRowHover: 'rgba(66, 133, 244, 0.35)',
    tableRowSelected: 'rgba(66, 133, 244, 0.25)',
    tableRowSelectedHover: 'rgba(66, 133, 244, 0.45)',
    
    // Status colors
    success: '#4caf50',
    successLight: 'rgba(76, 175, 80, 0.15)',
    warning: '#ff9800',
    warningLight: 'rgba(255, 152, 0, 0.15)',
    error: '#f44336',
    errorLight: 'rgba(244, 67, 54, 0.15)',
  },
  
  // Font settings
  fonts: {
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    familyMono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace',
    size: 12,
    sizeSm: 11,
    sizeXs: 10,
    sizeLg: 14,
    sizeXl: 16,
  },
  
  // Table settings
  table: {
    fontSize: 10,
    fontFamily: 'monospace',
    headerHeight: 28,
    rowHeight: 24,
    headerFontWeight: 600,
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  
  // Border radius
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
};

/**
 * Get the application theme
 * @returns {Object} Theme object
 */
export const getTheme = () => theme;

/**
 * Get theme colors (shorthand)
 * @returns {Object} Theme colors
 */
export const getThemeColors = () => theme.colors;

// Default export
export default theme;

// Legacy exports for backward compatibility
export const DEFAULT_THEME = 'talia';
export const themes = { talia: theme, data: theme, default: theme, dark: theme };
export const getThemeNames = () => ['talia'];
export const applyTheme = () => {}; // No-op - CSS variables are static
