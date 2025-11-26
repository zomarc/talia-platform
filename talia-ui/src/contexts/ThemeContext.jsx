/**
 * Theme Context Provider
 * 
 * Centralized theme management using CSS variables.
 * Themes are separated from application code and applied via CSS variables.
 */

import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import { themes, DEFAULT_THEME, getTheme, applyTheme, getThemeColors } from '../config/themes';

const ThemeContext = createContext();

// Font families for data visualization - defined outside component for use in useState initializers
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

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme Provider Component
 * Manages theme state and applies themes via CSS variables
 */
export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or use default (data theme)
  const [currentTheme, setCurrentTheme] = useState(() => {
    let themeToApply = DEFAULT_THEME;
    try {
      const saved = localStorage.getItem('talia-theme');
      if (saved && themes[saved]) {
        themeToApply = saved;
      } else {
        // Also check legacy localStorage key for backward compatibility
        const legacySaved = localStorage.getItem("taliaLayout");
        if (legacySaved) {
          const parsed = JSON.parse(legacySaved);
          const legacyTheme = parsed.fontSettings?.theme;
          if (legacyTheme && themes[legacyTheme]) {
            themeToApply = legacyTheme;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load theme from localStorage:', e);
    }
    // Apply theme IMMEDIATELY during initialization (before first render)
    console.log('[ThemeContext] Applying theme synchronously:', themeToApply);
    applyTheme(themeToApply);
    // Verify CSS variables were set
    const root = document.documentElement;
    const bgValue = getComputedStyle(root).getPropertyValue('--theme-bg');
    console.log('[ThemeContext] CSS variable --theme-bg after applyTheme:', bgValue ? 'SET' : 'NOT SET');
    return themeToApply;
  });

  // Apply theme when it changes (for runtime theme switching)
  useEffect(() => {
    applyTheme(currentTheme);
    try {
      localStorage.setItem('talia-theme', currentTheme);
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
  }, [currentTheme]);

  // Get current theme object
  const theme = getTheme(currentTheme);
  const themeColors = getThemeColors(currentTheme);

  // Font settings (kept here for backward compatibility with existing code)
  const [fontSize, setFontSize] = useState(() => {
    let initialFontSize = 12;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontSize = parsed.fontSettings?.fontSize || 12;
      }
    } catch (e) {
      console.warn('Failed to load fontSize from localStorage:', e);
    }
    // Set font CSS variable IMMEDIATELY during initialization (before first render)
    const root = document.documentElement;
    root.style.setProperty('--theme-font-size', `${initialFontSize}px`);
    // Scale table font size proportionally (Data Mode baseline: fontSize 12 = table 10px)
    const tableFontSize = Math.max(8, Math.round((initialFontSize / 12) * 10));
    root.style.setProperty('--theme-table-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-header-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-header-font-weight', '600');
    console.log('[ThemeContext] Set font CSS variables synchronously:', {
      fontSize: initialFontSize,
      tableFontSize: tableFontSize
    });
    return initialFontSize;
  });

  const [fontFamily, setFontFamily] = useState(() => {
    let initialFontFamily = 'Inter';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontFamily = parsed.fontSettings?.fontFamily || 'Inter';
      }
    } catch (e) {
      console.warn('Failed to load fontFamily from localStorage:', e);
    }
    // Set font family CSS variable IMMEDIATELY during initialization
    const root = document.documentElement;
    const selectedFont = FONT_FAMILIES[initialFontFamily] || FONT_FAMILIES['Inter'];
    root.style.setProperty('--theme-font-family', selectedFont.value);
    root.style.setProperty('--theme-font-family-monospace', 'monospace');
    root.style.setProperty('--theme-table-font-family', 'monospace');
    console.log('[ThemeContext] Set font family CSS variables synchronously:', {
      fontFamily: initialFontFamily,
      fontFamilyValue: selectedFont.value,
      tableFontFamily: 'monospace'
    });
    return initialFontFamily;
  });

  const [spacingMode, setSpacingMode] = useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.spacingMode || 'default';
      }
    } catch (e) {
      console.warn('Failed to load spacingMode from localStorage:', e);
    }
    return 'default';
  });

  // FONT_FAMILIES is now defined outside component (above) for use in useState initializers

  const selectedFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES['Inter'];

  // Update font CSS variables when fontSize or fontFamily changes (for runtime updates)
  // Note: Initial values are set synchronously in useState initializers above
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-font-size', `${fontSize}px`);
    root.style.setProperty('--theme-font-family', selectedFont.value);
    root.style.setProperty('--theme-font-family-monospace', 'monospace');
    
    // Table-specific font settings
    // Scale table font size proportionally with theme fontSize (Data Mode baseline: fontSize 12 = table 10px)
    // Formula: tableFontSize = (fontSize / 12) * 10, minimum 8px
    const tableFontSize = Math.max(8, Math.round((fontSize / 12) * 10));
    root.style.setProperty('--theme-table-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-font-family', 'monospace');
    root.style.setProperty('--theme-table-header-font-size', `${tableFontSize}px`);
    root.style.setProperty('--theme-table-header-font-weight', '600');
    
    console.log('[ThemeContext] Updated font CSS variables:', {
      fontSize: `${fontSize}px`,
      tableFontSize: `${tableFontSize}px`,
      fontFamily: selectedFont.value
    });
  }, [fontSize, selectedFont]);

  const value = {
    // Theme
    theme,
    themeColors, // Legacy colors object for backward compatibility
    currentTheme,
    setCurrentTheme,
    availableThemes: Object.keys(themes).map(key => ({
      key,
      name: themes[key].name,
      description: themes[key].description
    })),
    
    // Font settings
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    selectedFont,
    spacingMode,
    setSpacingMode,
    fontFamilies: FONT_FAMILIES,
    scaledFontSize: fontSize
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;

