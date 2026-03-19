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
import { initChartDefaults } from '../lib/chartConfig';

const ThemeContext = createContext();

/**
 * Font families available in the application
 */
const FONT_FAMILIES = {
  Inter: {
    name: 'Inter',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    description: 'Modern, clean, highly readable'
  },
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
    let initialFontSize = 10;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initialFontSize = parsed.fontSettings?.fontSize ?? 10;
      }
    } catch {
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
    } catch {
      // Use default
    }
    return initialFontFamily;
  });

  // Group color intensity (0-100, default 60)
  const [groupColorIntensity, setGroupColorIntensity] = useState(() => {
    let initial = 60;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.groupColorIntensity ?? 60;
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Row/card color intensity (0-100, default 40)
  const [rowColorIntensity, setRowColorIntensity] = useState(() => {
    let initial = 40;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.rowColorIntensity ?? 40;
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Accent color preset for group rows
  const [accentColor, setAccentColor] = useState(() => {
    let initial = 'blue';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.accentColor ?? 'blue';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Accent color preset for row/card shading
  const [rowAccentColor, setRowAccentColor] = useState(() => {
    let initial = 'slate';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.rowAccentColor ?? 'slate';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Global background color preset
  const [bgColor, setBgColor] = useState(() => {
    let initial = 'midnight';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.bgColor ?? 'midnight';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const selectedFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES['Inter'];

  // Auto-persist appearance settings to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("taliaLayout");
      const parsed = saved ? JSON.parse(saved) : {};
      parsed.fontSettings = {
        ...(parsed.fontSettings || {}),
        fontSize,
        fontFamily,
        groupColorIntensity,
        rowColorIntensity,
        accentColor,
        rowAccentColor,
        bgColor,
      };
      localStorage.setItem("taliaLayout", JSON.stringify(parsed));
    } catch {
      // Best-effort persistence
    }
  }, [fontSize, fontFamily, groupColorIntensity, rowColorIntensity, accentColor, rowAccentColor, bgColor]);

  // Update CSS variables when font/appearance settings change
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

    // Global background presets: solid + gradient endpoints
    const BG_PRESETS = {
      midnight:  { solid: [26, 29, 51],  g1: [17, 19, 37],  g2: [32, 36, 59]  },
      charcoal:  { solid: [30, 30, 34],  g1: [20, 20, 24],  g2: [38, 38, 44]  },
      navy:      { solid: [18, 24, 42],  g1: [12, 16, 30],  g2: [26, 34, 56]  },
      graphite:  { solid: [34, 36, 40],  g1: [24, 26, 30],  g2: [42, 44, 50]  },
      ocean:     { solid: [18, 30, 38],  g1: [12, 20, 28],  g2: [26, 40, 52]  },
      obsidian:  { solid: [16, 16, 20],  g1: [10, 10, 14],  g2: [22, 22, 28]  },
    };
    const bg = BG_PRESETS[bgColor] || BG_PRESETS.midnight;
    const [s, g1, g2] = [bg.solid, bg.g1, bg.g2];
    root.style.setProperty('--theme-bg-solid', `rgb(${s.join(',')})`);
    root.style.setProperty('--theme-bg', `linear-gradient(135deg, rgb(${g1.join(',')}) 0%, rgb(${s.join(',')}) 50%, rgb(${g2.join(',')}) 100%)`);

    // Accent color presets: [level0 R,G,B], [level1 R,G,B], [border R,G,B]
    const ACCENT_PRESETS = {
      blue:   { l0: [56, 92, 148],  l1: [118, 140, 176], br0: [138, 176, 230], br1: [178, 198, 230] },
      teal:   { l0: [36, 120, 120], l1: [80, 150, 150],  br0: [110, 200, 200], br1: [150, 210, 210] },
      purple: { l0: [88, 56, 148],  l1: [140, 118, 176], br0: [176, 138, 230], br1: [198, 178, 230] },
      slate:  { l0: [62, 72, 92],   l1: [90, 100, 118],  br0: [130, 142, 160], br1: [158, 168, 182] },
      amber:  { l0: [148, 112, 36], l1: [176, 152, 90],  br0: [220, 190, 120], br1: [230, 210, 160] },
      rose:   { l0: [148, 56, 72],  l1: [176, 100, 118], br0: [230, 150, 170], br1: [230, 180, 198] },
    };
    const accent = ACCENT_PRESETS[accentColor] || ACCENT_PRESETS.blue;

    // Group row colors - linear interpolation between min and max alpha
    const tg = groupColorIntensity / 100;
    const lerp = (lo, hi, t) => (lo + (hi - lo) * t).toFixed(2);
    const lerpInt = (lo, hi, t) => Math.round(lo + (hi - lo) * t);

    root.style.setProperty('--theme-group-level-0-bg', `rgba(${accent.l0.join(',')}, ${lerp(0.04, 0.82, tg)})`);
    root.style.setProperty('--theme-group-level-0-border', `rgba(${accent.br0.join(',')}, ${lerp(0.02, 0.45, tg)})`);
    root.style.setProperty('--theme-group-level-1-bg', `rgba(${accent.l1.join(',')}, ${lerp(0.03, 0.68, tg)})`);
    root.style.setProperty('--theme-group-level-1-border', `rgba(${accent.br1.join(',')}, ${lerp(0.02, 0.38, tg)})`);

    // Text: inversely proportional -- brighter when background is darker
    const textR0 = lerpInt(180, 255, tg);
    const textG0 = lerpInt(190, 255, tg);
    const textB0 = lerpInt(205, 255, tg);
    const textA0 = lerp(0.55, 1.00, tg);
    root.style.setProperty('--theme-group-level-0-text', `rgba(${textR0}, ${textG0}, ${textB0}, ${textA0})`);

    const textR1 = lerpInt(185, 255, tg);
    const textG1 = lerpInt(192, 255, tg);
    const textB1 = lerpInt(208, 255, tg);
    const textA1 = lerp(0.55, 1.00, tg);
    root.style.setProperty('--theme-group-level-1-text', `rgba(${textR1}, ${textG1}, ${textB1}, ${textA1})`);

    // Row/card accent color presets
    const ROW_ACCENT_PRESETS = {
      blue:   { odd: [180, 200, 230], hover: [91, 155, 213],  card: [37, 50, 78]  },
      teal:   { odd: [170, 220, 215], hover: [60, 175, 165],  card: [30, 55, 55]  },
      purple: { odd: [200, 185, 230], hover: [140, 95, 210],  card: [48, 38, 72]  },
      slate:  { odd: [200, 205, 215], hover: [120, 135, 160], card: [37, 42, 55]  },
      amber:  { odd: [230, 215, 180], hover: [200, 165, 80],  card: [58, 48, 32]  },
      rose:   { odd: [230, 190, 200], hover: [210, 100, 130], card: [58, 35, 42]  },
    };
    const rowAcc = ROW_ACCENT_PRESETS[rowAccentColor] || ROW_ACCENT_PRESETS.slate;

    // Row striping, card, and elevated surface intensity
    const tr = rowColorIntensity / 100;
    root.style.setProperty('--theme-table-row-odd', `rgba(${rowAcc.odd.join(',')}, ${lerp(0.00, 0.12, tr)})`);
    root.style.setProperty('--theme-table-row-hover', `rgba(${rowAcc.hover.join(',')}, ${lerp(0.04, 0.35, tr)})`);
    root.style.setProperty('--theme-card-bg', `rgba(${rowAcc.card.join(',')}, ${lerp(0.40, 1.00, tr)})`);

    // Elevated surfaces blend background base with row accent tint
    const elR = lerpInt(g2[0], rowAcc.card[0], tr);
    const elG = lerpInt(g2[1], rowAcc.card[1], tr);
    const elB = lerpInt(g2[2], rowAcc.card[2], tr);
    root.style.setProperty('--theme-bg-elevated', `rgb(${elR}, ${elG}, ${elB})`);

    // Panel background derives from the global bg
    root.style.setProperty('--theme-panel-bg', `rgb(${lerpInt(s[0], 42, 0.3)}, ${lerpInt(s[1], 46, 0.3)}, ${lerpInt(s[2], 68, 0.3)})`);

    // Re-sync Chart.js globals with current CSS variables
    initChartDefaults();

  }, [fontSize, selectedFont, groupColorIntensity, rowColorIntensity, accentColor, rowAccentColor, bgColor]);

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

    // Group color settings
    groupColorIntensity,
    setGroupColorIntensity,

    // Row/card color settings
    rowColorIntensity,
    setRowColorIntensity,

    // Accent color presets
    accentColor,
    setAccentColor,
    rowAccentColor,
    setRowAccentColor,

    // Background color
    bgColor,
    setBgColor,
    
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
