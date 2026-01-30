/**
 * Theme Context Provider
 * 
 * Provides theme values to components. The actual styling is done via
 * CSS variables in /src/styles/theme.css. This context provides:
 * - JavaScript access to theme values (for inline styles when needed)
 * - Font size/family settings (user-adjustable)
 * 
 * Components should prefer CSS variables over context values:
 *   PREFERRED: style={{ background: 'var(--theme-bg-solid)' }}
 *   FALLBACK:  style={{ background: theme.colors.background }}
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import theme from '../config/themes';

const ThemeContext = createContext();

/**
 * Font families available in the application
 */
const FONT_FAMILIES = {
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
    let initialFontSize = 12;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontSize = parsed.fontSettings?.fontSize || 12;
      }
    } catch (e) {
      // Use default
    }
    return initialFontSize;
  });

  // Font family setting (user-adjustable)
  const [fontFamily, setFontFamily] = useState(() => {
    let initialFontFamily = 'Inter';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontFamily = parsed.fontSettings?.fontFamily || 'Inter';
      }
    } catch (e) {
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
    
    // Table font settings (scaled proportionally)
    const tableFontSize = Math.max(8, Math.round((fontSize / 12) * 10));
    root.style.setProperty('--theme-table-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-font-family', selectedFont.value);
    root.style.setProperty('--theme-table-header-font-size', `${tableFontSize}px`);
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
