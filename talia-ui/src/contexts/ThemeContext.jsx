/**
 * Theme Context Provider
 * 
 * Centralized theme management using CSS variables.
 * Themes are separated from application code and applied via CSS variables.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes, DEFAULT_THEME, getTheme, applyTheme, getThemeColors } from '../config/themes';

const ThemeContext = createContext();

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
    try {
      const saved = localStorage.getItem('talia-theme');
      if (saved && themes[saved]) {
        return saved;
      }
      // Also check legacy localStorage key for backward compatibility
      const legacySaved = localStorage.getItem("taliaLayout");
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        const legacyTheme = parsed.fontSettings?.theme;
        if (legacyTheme && themes[legacyTheme]) {
          return legacyTheme;
        }
      }
    } catch (e) {
      console.warn('Failed to load theme from localStorage:', e);
    }
    // Default to 'data' theme (Modern Dark - Data Mode style)
    return DEFAULT_THEME;
  });

  // Apply theme when it changes
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
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.fontSize || 12;
      }
    } catch (e) {
      console.warn('Failed to load fontSize from localStorage:', e);
    }
    return 12;
  });

  const [fontFamily, setFontFamily] = useState(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.fontSettings?.fontFamily || 'Inter';
      }
    } catch (e) {
      console.warn('Failed to load fontFamily from localStorage:', e);
    }
    return 'Inter';
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

  // Font families for data visualization
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

  const selectedFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES['Inter'];

  // Apply font size and font family as CSS variables
  // This must be AFTER fontSize, fontFamily, and selectedFont are defined
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-font-size', `${fontSize}px`);
    root.style.setProperty('--theme-font-family', selectedFont.value);
    root.style.setProperty('--theme-font-family-monospace', 'monospace');
    
    // Table-specific font settings (Data Mode uses 10px monospace)
    // These are fixed to match Data Management screen styling
    root.style.setProperty('--theme-table-font-size', '10px');
    root.style.setProperty('--theme-table-font-family', 'monospace');
    root.style.setProperty('--theme-table-header-font-size', '10px');
    root.style.setProperty('--theme-table-header-font-weight', '600');
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

