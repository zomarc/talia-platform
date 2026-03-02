/**
 * Theme Context Provider
 * 
 * Provides theme values to components. The actual styling is done via
 * CSS variables in /src/styles/theme.css. This context provides:
 * - JavaScript access to theme values (for charts/config logic when needed)
 * - Font size/family settings (user-adjustable)
 * 
 * Components should apply styling via CSS classes and CSS variables.
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import theme from '../config/themes';

const ThemeContext = createContext();

/**
 * Font families available in the application
 */
const FONT_FAMILIES = {
  'IBM Plex Sans': {
    name: 'IBM Plex Sans',
    value: '"IBM Plex Sans", "Source Sans 3", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    description: 'Dense UI font with excellent legibility'
  },
  'Source Sans 3': {
    name: 'Source Sans 3',
    value: '"Source Sans 3", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: 'Clean, modern, and compact'
  },
  'Inter': {
    name: 'Inter',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    description: 'Modern, clean, highly readable'
  },
  'Roboto': {
    name: 'Roboto',
    value: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: 'Google\'s data-friendly font'
  },
  'Source Sans Pro': {
    name: 'Source Sans Pro',
    value: '"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    description: 'Adobe\'s professional font'
  },
  'Arial': {
    name: 'Arial',
    value: 'Arial, Helvetica, sans-serif',
    description: 'Classic, widely supported'
  },
  'Verdana': {
    name: 'Verdana',
    value: 'Verdana, Geneva, sans-serif',
    description: 'High readability, screen-optimized'
  },
  'Georgia': {
    name: 'Georgia',
    value: 'Georgia, "Times New Roman", serif',
    description: 'Elegant serif, print-friendly'
  }
};

/**
 * Hook to access theme values
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme Provider Component
 * Provides theme values and font settings to the application
 */
export const ThemeProvider = ({ children }) => {
  // Font size setting (user-adjustable)
  const [fontSize, setFontSize] = useState(() => {
    let initialFontSize = 11;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontSize = parsed.fontSettings?.fontSize || 12;
      }
    } catch {
      // Use default
    }
    return initialFontSize;
  });

  // Font family setting (user-adjustable)
  const [fontFamily, setFontFamily] = useState(() => {
    let initialFontFamily = 'IBM Plex Sans';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontFamily = parsed.fontSettings?.fontFamily || 'IBM Plex Sans';
      }
    } catch {
      // Use default
    }
    return initialFontFamily;
  });

  const selectedFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES['Inter'];

  // Update CSS variables when font settings change
  useEffect(() => {
    const root = document.documentElement;
    
    // Base font settings
    root.style.setProperty('--theme-font-size', `${fontSize}px`);
    root.style.setProperty('--theme-font-family', selectedFont.value);
    root.style.setProperty('--theme-font-size-sm', `${Math.max(8, fontSize - 1)}px`);
    root.style.setProperty('--theme-font-size-xs', `${Math.max(7, fontSize - 2)}px`);
    root.style.setProperty('--theme-font-size-lg', `${Math.max(9, fontSize + 1)}px`);
    root.style.setProperty('--theme-font-size-xl', `${Math.max(10, fontSize + 2)}px`);
    
    // Table font settings (scaled proportionally)
    const tableFontSize = Math.max(8, fontSize);
    root.style.setProperty('--theme-table-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-font-family', selectedFont.value);
    root.style.setProperty('--theme-table-header-font-size', `${tableFontSize}px`);

    // Table sizing - keep rows/headers proportional to font size
    const tableRowHeight = Math.max(18, Math.round(fontSize * 2));
    const tableHeaderHeight = Math.max(20, Math.round(fontSize * 2.2));
    const cellPadY = Math.max(2, Math.round(fontSize * 0.25));
    const cellPadX = Math.max(4, Math.round(fontSize * 0.55));
    const filterHeight = Math.max(18, Math.round(fontSize * 1.6));
    root.style.setProperty('--theme-table-row-height', `${tableRowHeight}px`);
    root.style.setProperty('--theme-table-header-height', `${tableHeaderHeight}px`);
    root.style.setProperty('--theme-table-cell-padding-y', `${cellPadY}px`);
    root.style.setProperty('--theme-table-cell-padding-x', `${cellPadX}px`);
    root.style.setProperty('--theme-table-filter-height', `${filterHeight}px`);

    // Trigger layout recalculation for tables/charts using native resize handling
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
  }, [fontSize, selectedFont]);

  // Context value - provide theme and font settings
  const value = {
    // Theme object (for components that need JS access to colors)
    theme,
    
    // Legacy aliases for backward compatibility
    currentTheme: 'talia',
    setCurrentTheme: () => {}, // No-op - single theme
    availableThemes: [{ key: 'talia', name: 'Talia Professional' }],
    themeColors: theme.colors,
    
    // Font settings (user-adjustable)
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    selectedFont,
    fontFamilies: FONT_FAMILIES,
    
    // Legacy - kept for compatibility
    spacingMode: 'compact',
    setSpacingMode: () => {},
    scaledFontSize: fontSize,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
