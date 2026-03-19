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
const APPEARANCE_PROFILES_KEY = 'taliaAppearanceProfiles';
const ACTIVE_APPEARANCE_PROFILE_KEY = 'taliaActiveAppearanceProfileId';

const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return null;
  const value = hex.trim().replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((c) => `${c}${c}`).join('')
    : value;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

const mixRgb = (fromRgb, toRgb, t) => ([
  Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * t),
  Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * t),
  Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * t),
]);

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
  },
  'Pacifico (Script)': {
    name: 'Pacifico (Script)',
    value: '"Pacifico", "Brush Script MT", "Segoe Script", cursive',
    description: 'Flowing script style with playful personality'
  },
  'Bangers (Funny)': {
    name: 'Bangers (Funny)',
    value: '"Bangers", "Comic Sans MS", "Marker Felt", cursive',
    description: 'Bold comic-style lettering for fun presentations'
  },
  'Press Start 2P (Retro)': {
    name: 'Press Start 2P (Retro)',
    value: '"Press Start 2P", "Courier New", monospace',
    description: 'Classic pixel arcade look with retro vibes'
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

  // Global text intensity (0-100, default 45)
  const [textIntensity, setTextIntensity] = useState(() => {
    let initial = 45;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.textIntensity ?? 45;
      }
    } catch {
      // Use default
    }
    return initial;
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

  // Row hover color intensity (0-100, default 40)
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

  // Odd-row striping intensity (0-100, default 40)
  const [oddRowIntensity, setOddRowIntensity] = useState(() => {
    let initial = 40;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.oddRowIntensity ?? 40;
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Card/elevated surface intensity (0-100, default 40)
  const [cardColorIntensity, setCardColorIntensity] = useState(() => {
    let initial = 40;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.cardColorIntensity ?? 40;
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Even-row striping intensity (0-100, default 20)
  const [evenRowIntensity, setEvenRowIntensity] = useState(() => {
    let initial = 20;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.evenRowIntensity ?? 20;
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Global component/card padding scale (0-100, default 50)
  const [componentPadding, setComponentPadding] = useState(() => {
    let initial = 50;
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.componentPadding ?? 50;
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

  // Accent color preset for row shading
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

  // Accent color preset for card/elevated surfaces
  const [cardAccentColor, setCardAccentColor] = useState(() => {
    let initial = 'slate';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.cardAccentColor ?? 'slate';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  // Direct color overrides (hex values) to allow any user-selected color
  const [groupColorHex, setGroupColorHex] = useState(() => {
    let initial = '#385c94';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.groupColorHex ?? '#385c94';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const [rowHoverColorHex, setRowHoverColorHex] = useState(() => {
    let initial = '#7890a8';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.rowHoverColorHex ?? '#7890a8';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const [oddRowColorHex, setOddRowColorHex] = useState(() => {
    let initial = '#c8cdd7';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.oddRowColorHex ?? '#c8cdd7';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const [evenRowColorHex, setEvenRowColorHex] = useState(() => {
    let initial = '#ffffff';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.evenRowColorHex ?? '#ffffff';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const [cardColorHex, setCardColorHex] = useState(() => {
    let initial = '#252a37';
    try {
      const saved = localStorage.getItem("taliaLayout");
      if (saved) {
        const parsed = JSON.parse(saved);
        initial = parsed.fontSettings?.cardColorHex ?? '#252a37';
      }
    } catch {
      // Use default
    }
    return initial;
  });

  const [appearanceProfiles, setAppearanceProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem(APPEARANCE_PROFILES_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((entry) => entry?.id && entry?.name && entry?.settings) : [];
    } catch {
      return [];
    }
  });

  const [activeAppearanceProfileId, setActiveAppearanceProfileId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_APPEARANCE_PROFILE_KEY) || '';
    } catch {
      return '';
    }
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
        textIntensity,
        groupColorIntensity,
        rowColorIntensity,
        oddRowIntensity,
        cardColorIntensity,
        evenRowIntensity,
        componentPadding,
        accentColor,
        rowAccentColor,
        cardAccentColor,
        groupColorHex,
        rowHoverColorHex,
        oddRowColorHex,
        evenRowColorHex,
        cardColorHex,
        bgColor,
      };
      localStorage.setItem("taliaLayout", JSON.stringify(parsed));
    } catch {
      // Best-effort persistence
    }
  }, [fontSize, fontFamily, textIntensity, groupColorIntensity, rowColorIntensity, oddRowIntensity, cardColorIntensity, evenRowIntensity, componentPadding, accentColor, rowAccentColor, cardAccentColor, groupColorHex, rowHoverColorHex, oddRowColorHex, evenRowColorHex, cardColorHex, bgColor]);

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_PROFILES_KEY, JSON.stringify(appearanceProfiles));
      localStorage.setItem(ACTIVE_APPEARANCE_PROFILE_KEY, activeAppearanceProfileId || '');
    } catch {
      // Best-effort persistence
    }
  }, [appearanceProfiles, activeAppearanceProfileId]);

  const buildCurrentAppearanceSettings = () => ({
    fontFamily,
    fontSize,
    textIntensity,
    groupColorIntensity,
    rowColorIntensity,
    oddRowIntensity,
    evenRowIntensity,
    cardColorIntensity,
    componentPadding,
    bgColor,
    groupColorHex,
    rowHoverColorHex,
    oddRowColorHex,
    evenRowColorHex,
    cardColorHex,
  });

  const applyAppearanceSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return false;
    if (settings.fontFamily) setFontFamily(settings.fontFamily);
    if (Number.isFinite(settings.fontSize)) setFontSize(settings.fontSize);
    if (Number.isFinite(settings.textIntensity)) setTextIntensity(settings.textIntensity);
    if (Number.isFinite(settings.groupColorIntensity)) setGroupColorIntensity(settings.groupColorIntensity);
    if (Number.isFinite(settings.rowColorIntensity)) setRowColorIntensity(settings.rowColorIntensity);
    if (Number.isFinite(settings.oddRowIntensity)) setOddRowIntensity(settings.oddRowIntensity);
    if (Number.isFinite(settings.evenRowIntensity)) setEvenRowIntensity(settings.evenRowIntensity);
    if (Number.isFinite(settings.cardColorIntensity)) setCardColorIntensity(settings.cardColorIntensity);
    if (Number.isFinite(settings.componentPadding)) setComponentPadding(settings.componentPadding);
    if (settings.bgColor) setBgColor(settings.bgColor);
    if (settings.groupColorHex) setGroupColorHex(settings.groupColorHex);
    if (settings.rowHoverColorHex) setRowHoverColorHex(settings.rowHoverColorHex);
    if (settings.oddRowColorHex) setOddRowColorHex(settings.oddRowColorHex);
    if (settings.evenRowColorHex) setEvenRowColorHex(settings.evenRowColorHex);
    if (settings.cardColorHex) setCardColorHex(settings.cardColorHex);
    return true;
  };

  const applyAppearanceProfile = (profileId) => {
    const profile = appearanceProfiles.find((entry) => entry.id === profileId);
    if (!profile?.settings) return false;
    const applied = applyAppearanceSettings(profile.settings);
    if (!applied) return false;
    setActiveAppearanceProfileId(profile.id);
    return true;
  };

  const saveAppearanceProfile = (name, options = {}) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const targetId = options.profileId && appearanceProfiles.some((entry) => entry.id === options.profileId)
      ? options.profileId
      : null;
    const settings = buildCurrentAppearanceSettings();
    const now = new Date().toISOString();
    if (targetId) {
      setAppearanceProfiles((prev) =>
        prev.map((entry) =>
          entry.id === targetId
            ? { ...entry, name: trimmed, settings, updatedAt: now }
            : entry
        )
      );
      setActiveAppearanceProfileId(targetId);
      return targetId;
    }
    const profileId = `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAppearanceProfiles((prev) => [...prev, { id: profileId, name: trimmed, settings, updatedAt: now }]);
    setActiveAppearanceProfileId(profileId);
    return profileId;
  };

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

    // Shared interpolation helpers
    const lerp = (lo, hi, t) => (lo + (hi - lo) * t).toFixed(2);
    const lerpInt = (lo, hi, t) => Math.round(lo + (hi - lo) * t);

    // Global component/card padding density
    const tp = componentPadding / 100;
    const paddingScale = 0.6 + (tp * 1.0); // 0.6x .. 1.6x
    const scaledPx = (base, min = 1) => `${Math.max(min, Math.round(base * paddingScale))}px`;
    root.style.setProperty('--theme-padding-xs', scaledPx(3));
    root.style.setProperty('--theme-padding-sm', scaledPx(6));
    root.style.setProperty('--theme-padding-md', scaledPx(10));
    root.style.setProperty('--theme-padding-lg', scaledPx(14));
    root.style.setProperty('--theme-padding-xl', scaledPx(20));
    root.style.setProperty('--theme-component-padding-xs', scaledPx(4));
    root.style.setProperty('--theme-component-padding-sm', scaledPx(6));
    root.style.setProperty('--theme-component-padding-md', scaledPx(10));
    root.style.setProperty('--theme-component-padding-lg', scaledPx(12));
    root.style.setProperty('--theme-component-gap-xs', scaledPx(4));
    root.style.setProperty('--theme-component-gap-sm', scaledPx(6));
    root.style.setProperty('--theme-component-gap-md', scaledPx(10));
    root.style.setProperty('--theme-card-padding', scaledPx(10));
    root.style.setProperty('--theme-component-control-height', scaledPx(28, 20));

    // Global text intensity across app/panels/tables
    const tt = textIntensity / 100;
    const fgR = lerpInt(150, 236, tt);
    const fgG = lerpInt(160, 244, tt);
    const fgB = lerpInt(178, 252, tt);
    const fgA = lerp(0.72, 0.98, tt);
    root.style.setProperty('--theme-fg', `rgba(${fgR}, ${fgG}, ${fgB}, ${fgA})`);
    root.style.setProperty('--theme-text-secondary', `rgba(${fgR}, ${fgG}, ${fgB}, ${lerp(0.58, 0.90, tt)})`);
    root.style.setProperty('--theme-text-muted', `rgba(${fgR}, ${fgG}, ${fgB}, ${lerp(0.42, 0.76, tt)})`);
    root.style.setProperty('--theme-tabulator-header-text', `rgba(${lerpInt(164, 246, tt)}, ${lerpInt(174, 250, tt)}, ${lerpInt(194, 255, tt)}, ${lerp(0.70, 0.98, tt)})`);

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

    // Group row color can be any color selected via color input
    const fallbackAccent = [56, 92, 148];
    const accent = hexToRgb(groupColorHex) || fallbackAccent;
    const accentL1 = mixRgb(accent, [255, 255, 255], 0.28);
    const borderL0 = mixRgb(accent, [255, 255, 255], 0.52);
    const borderL1 = mixRgb(accent, [255, 255, 255], 0.66);

    // Group row colors - linear interpolation between min and max alpha
    const tg = groupColorIntensity / 100;

    root.style.setProperty('--theme-group-level-0-bg', `rgba(${accent.join(',')}, ${lerp(0.04, 0.82, tg)})`);
    root.style.setProperty('--theme-group-level-0-border', `rgba(${borderL0.join(',')}, ${lerp(0.02, 0.45, tg)})`);
    root.style.setProperty('--theme-group-level-1-bg', `rgba(${accentL1.join(',')}, ${lerp(0.03, 0.68, tg)})`);
    root.style.setProperty('--theme-group-level-1-border', `rgba(${borderL1.join(',')}, ${lerp(0.02, 0.38, tg)})`);

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

    // Row striping/hover and card/elevated surface intensity
    const tr = rowColorIntensity / 100;
    const to = oddRowIntensity / 100;
    const tc = cardColorIntensity / 100;
    const te = evenRowIntensity / 100;
    const rowHoverRgb = hexToRgb(rowHoverColorHex) || [120, 135, 160];
    const oddRowRgb = hexToRgb(oddRowColorHex) || [200, 205, 215];
    const evenRowRgb = hexToRgb(evenRowColorHex) || [255, 255, 255];
    const cardRgb = hexToRgb(cardColorHex) || [37, 42, 55];
    root.style.setProperty('--theme-table-row-even', `rgba(${evenRowRgb.join(',')}, ${lerp(0.00, 0.16, te)})`);
    root.style.setProperty('--theme-table-row-odd', `rgba(${oddRowRgb.join(',')}, ${lerp(0.00, 0.22, to)})`);
    root.style.setProperty('--theme-table-row-hover', `rgba(${rowHoverRgb.join(',')}, ${lerp(0.04, 0.35, tr)})`);
    root.style.setProperty('--theme-card-bg', `rgba(${cardRgb.join(',')}, ${lerp(0.40, 1.00, tc)})`);

    // Elevated surfaces blend background base with card accent tint
    const elR = lerpInt(g2[0], cardRgb[0], tc);
    const elG = lerpInt(g2[1], cardRgb[1], tc);
    const elB = lerpInt(g2[2], cardRgb[2], tc);
    root.style.setProperty('--theme-bg-elevated', `rgb(${elR}, ${elG}, ${elB})`);

    // Panel background derives from the global bg
    root.style.setProperty('--theme-panel-bg', `rgb(${lerpInt(s[0], 42, 0.3)}, ${lerpInt(s[1], 46, 0.3)}, ${lerpInt(s[2], 68, 0.3)})`);

    // Re-sync Chart.js globals with current CSS variables
    initChartDefaults();

  }, [fontSize, selectedFont, textIntensity, groupColorIntensity, rowColorIntensity, oddRowIntensity, cardColorIntensity, evenRowIntensity, componentPadding, accentColor, rowAccentColor, cardAccentColor, groupColorHex, rowHoverColorHex, oddRowColorHex, evenRowColorHex, cardColorHex, bgColor]);

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
    textIntensity,
    setTextIntensity,
    selectedFont,
    fontFamilies: FONT_FAMILIES,

    // Group color settings
    groupColorIntensity,
    setGroupColorIntensity,

    // Row/card color settings
    rowColorIntensity,
    setRowColorIntensity,
    oddRowIntensity,
    setOddRowIntensity,
    cardColorIntensity,
    setCardColorIntensity,
    evenRowIntensity,
    setEvenRowIntensity,
    componentPadding,
    setComponentPadding,

    // Accent color presets
    accentColor,
    setAccentColor,
    rowAccentColor,
    setRowAccentColor,
    cardAccentColor,
    setCardAccentColor,
    groupColorHex,
    setGroupColorHex,
    rowHoverColorHex,
    setRowHoverColorHex,
    oddRowColorHex,
    setOddRowColorHex,
    evenRowColorHex,
    setEvenRowColorHex,
    cardColorHex,
    setCardColorHex,

    // Appearance profiles
    appearanceProfiles,
    activeAppearanceProfileId,
    setActiveAppearanceProfileId,
    saveAppearanceProfile,
    applyAppearanceProfile,

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
