/**
 * ThemeProvider / useTheme — presentation (CSS tokens) only: fonts, colours, palette, named appearance profiles.
 * A USER has a ROLE (auth / sidebar admin UI); an ADMIN may define appearance profiles. FOCUS is layout of
 * components only — unrelated to this module. Persistence: GraphQL `appearanceSettings` → Supabase
 * `config_setting`. Global criteria: `talia:dashboard.globalCriteria`.
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import theme from '../config/themes';
import { initChartDefaults } from '../lib/chartConfig';
import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import {
  APPEARANCE_SETTINGS_QUERY,
  SAVE_APPEARANCE_PROFILES_MUTATION,
  SAVE_APPEARANCE_SETTINGS_MUTATION,
  TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT,
} from '../graphql/taliaAppearanceOperations';
import {
  TALIA_UI_THEME_REGISTRY_QUERY,
  TALIA_UI_THEME_REGISTRY_UPDATED_EVENT,
} from '../graphql/taliaUiThemeRegistryOperations';
import { resolveTaliaAppearanceUserId } from '../lib/resolveTaliaAppearanceUserId';
import { useSupabaseAuth } from './SupabaseAuthContext.jsx';
import {
  TALIA_UI_THEME_KEYS,
  TALIA_UI_THEMES,
  mergeTaliaUiThemesFromDb,
  resolveThemeDefaultHeaderLogoUrl,
} from '../themes/taliaUiThemes';

const ThemeContext = createContext();
const LEGACY_APPEARANCE_MIGRATE_PREFIX = 'taliaAppearanceMigrated:';

/** Old App.jsx sidebar used `fontSettings.theme` with default/dark/light — not Talia bg ids. */
const LEGACY_APP_THEME_TO_BG = Object.freeze({
  default: 'midnight',
  dark: 'midnight',
  light: 'porcelain',
});

const inferLocaleDefaultCurrency = () => {
  try {
    const region = Intl.DateTimeFormat().resolvedOptions().region;
    if (!region || typeof region !== 'string') return 'USD';
    const map = {
      AU: 'AUD',
      GB: 'GBP',
      NZ: 'NZD',
      CA: 'CAD',
      JP: 'JPY',
      CH: 'CHF',
      US: 'USD',
    };
    if (map[region]) return map[region];
    const euro = new Set([
      'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PT', 'SK', 'SI', 'ES',
    ]);
    if (euro.has(region)) return 'EUR';
  } catch {
    // ignore
  }
  return 'USD';
};

const normalizeDefaultDisplayCurrency = (raw, fallback = 'USD') => {
  const fb = typeof fallback === 'string' && /^[A-Z]{3}$/i.test(fallback)
    ? fallback.toUpperCase()
    : 'USD';
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(s)) return fb;
  try {
    Intl.NumberFormat('en-US', { style: 'currency', currency: s, maximumFractionDigits: 0 }).format(1);
    return s;
  } catch {
    return fb;
  }
};

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

const normalizeCustomBackgroundHex = (value) => {
  if (value == null) return '';
  const rgb = hexToRgb(String(value));
  if (!rgb) return '';
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`.toLowerCase();
};

const mixRgb = (fromRgb, toRgb, t) => ([
  Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * t),
  Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * t),
  Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * t),
]);

const normalizeMenuDisappearMs = (value, fallback = 5000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(30000, Math.max(1000, Math.round(parsed)));
};

const normalizeSidebarAutoCloseMs = (value, fallback = 8000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(60000, Math.max(1000, Math.round(parsed)));
};

const normalizeSidebarDisplayMode = (value, fallback = 'panel') => (
  value === 'overlay' ? 'overlay' : fallback
);

/** @deprecated Import from `../themes/taliaUiThemes` */
export { TALIA_BG_PRESETS, TALIA_UI_THEME_KEYS as TALIA_BG_COLOR_KEYS } from '../themes/taliaUiThemes';

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
  const { user, loading: authLoading } = useSupabaseAuth();
  const appearanceUserId = resolveTaliaAppearanceUserId(user);

  const [fontSize, setFontSize] = useState(10);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [textIntensity, setTextIntensity] = useState(45);
  const [groupColorIntensity, setGroupColorIntensity] = useState(60);
  const [rowColorIntensity, setRowColorIntensity] = useState(40);
  const [oddRowIntensity, setOddRowIntensity] = useState(40);
  const [cardColorIntensity, setCardColorIntensity] = useState(40);
  const [evenRowIntensity, setEvenRowIntensity] = useState(20);
  const [componentPadding, setComponentPadding] = useState(50);
  const [accentColor, setAccentColor] = useState('blue');
  const [rowAccentColor, setRowAccentColor] = useState('slate');
  const [cardAccentColor, setCardAccentColor] = useState('slate');
  const [groupColorHex, setGroupColorHex] = useState('#385c94');
  const [rowHoverColorHex, setRowHoverColorHex] = useState('#7890a8');
  const [oddRowColorHex, setOddRowColorHex] = useState('#c8cdd7');
  const [evenRowColorHex, setEvenRowColorHex] = useState('#ffffff');
  const [tableHeaderColorHex, setTableHeaderColorHex] = useState('#3f5784');
  const [cardColorHex, setCardColorHex] = useState('#252a37');
  const [tableHeaderIntensity, setTableHeaderIntensity] = useState(60);
  const [panelTitlesVisible, setPanelTitlesVisible] = useState(true);
  const [actionsVisible, setActionsVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [menuDisappearMs, setMenuDisappearMs] = useState(
    normalizeMenuDisappearMs(undefined, 5000)
  );
  const [sidebarAutoCloseEnabled, setSidebarAutoCloseEnabled] = useState(false);
  const [sidebarAutoCloseMs, setSidebarAutoCloseMs] = useState(
    normalizeSidebarAutoCloseMs(undefined, 8000)
  );
  const [sidebarDisplayMode, setSidebarDisplayMode] = useState(
    normalizeSidebarDisplayMode(undefined, 'panel')
  );
  const [calloutsVisible, setCalloutsVisible] = useState(true);
  const [gameSoundEnabled, setGameSoundEnabled] = useState(true);
  const [defaultDisplayCurrency, setDefaultDisplayCurrencyState] = useState(() =>
    normalizeDefaultDisplayCurrency(undefined, inferLocaleDefaultCurrency())
  );

  const setDefaultDisplayCurrency = useCallback((next) => {
    setDefaultDisplayCurrencyState(
      normalizeDefaultDisplayCurrency(
        typeof next === 'string' ? next : String(next ?? ''),
        inferLocaleDefaultCurrency()
      )
    );
  }, []);

  const [appearanceProfiles, setAppearanceProfiles] = useState([]);
  const [activeAppearanceProfileId, setActiveAppearanceProfileId] = useState('');
  const [appearanceDbLoaded, setAppearanceDbLoaded] = useState(false);
  const [themeRegistryFromDb, setThemeRegistryFromDb] = useState({ themes: {}, assets: {} });
  const saveSettingsTimerRef = useRef(null);
  const saveProfilesTimerRef = useRef(null);

  const mergedTaliaUiThemes = useMemo(
    () => mergeTaliaUiThemesFromDb(TALIA_UI_THEMES, themeRegistryFromDb.themes),
    [themeRegistryFromDb.themes]
  );

  const taliaUiThemeKeysOrdered = useMemo(() => {
    const keys = Object.keys(mergedTaliaUiThemes);
    const ordered = [...TALIA_UI_THEME_KEYS];
    for (const k of keys) {
      if (!ordered.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [mergedTaliaUiThemes]);

  const normalizeBgColorKey = useCallback((value, fallback = 'midnight') => {
    if (typeof value !== 'string') return fallback;
    const k = value.trim();
    if (!k) return fallback;
    if (Object.prototype.hasOwnProperty.call(mergedTaliaUiThemes, k)) return k;
    const lower = k.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(mergedTaliaUiThemes, lower)) return lower;
    if (Object.prototype.hasOwnProperty.call(LEGACY_APP_THEME_TO_BG, lower)) {
      return LEGACY_APP_THEME_TO_BG[lower];
    }
    return fallback;
  }, [mergedTaliaUiThemes]);

  const [bgColor, setBgColorState] = useState('midnight');
  const setBgColor = useCallback((next) => {
    setBgColorState(normalizeBgColorKey(typeof next === 'string' ? next : String(next), 'midnight'));
  }, [normalizeBgColorKey]);

  const resolveThemeDefaultHeaderLogoForTheme = useCallback(
    (themeKey) => {
      const meta = mergedTaliaUiThemes[themeKey];
      if (!meta) return '';
      return resolveThemeDefaultHeaderLogoUrl(meta, themeRegistryFromDb.assets) || '';
    },
    [mergedTaliaUiThemes, themeRegistryFromDb.assets]
  );

  const [headerLogoUrl, setHeaderLogoUrl] = useState('');
  const [headerLogoVisible, setHeaderLogoVisible] = useState(true);

  const [customBackgroundHex, setCustomBackgroundHexState] = useState('');
  const setCustomBackgroundHex = useCallback((next) => {
    if (next == null || next === '') {
      setCustomBackgroundHexState('');
      return;
    }
    const n = normalizeCustomBackgroundHex(next);
    setCustomBackgroundHexState(n || '');
  }, []);

  const selectedFont = FONT_FAMILIES[fontFamily] || FONT_FAMILIES['Inter'];

  const buildCurrentAppearanceSettings = useCallback(() => ({
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
    tableHeaderColorHex,
    cardColorHex,
    tableHeaderIntensity,
    panelTitlesVisible,
    actionsVisible,
    controlsVisible,
    menuDisappearMs,
    sidebarAutoCloseEnabled,
    sidebarAutoCloseMs,
    sidebarDisplayMode,
    calloutsVisible,
    gameSoundEnabled,
    defaultDisplayCurrency,
    headerLogoUrl,
    headerLogoVisible,
    customBackgroundHex,
  }), [fontFamily, fontSize, textIntensity, groupColorIntensity, rowColorIntensity, oddRowIntensity, evenRowIntensity, cardColorIntensity, componentPadding, bgColor, groupColorHex, rowHoverColorHex, oddRowColorHex, evenRowColorHex, tableHeaderColorHex, cardColorHex, tableHeaderIntensity, panelTitlesVisible, actionsVisible, controlsVisible, menuDisappearMs, sidebarAutoCloseEnabled, sidebarAutoCloseMs, sidebarDisplayMode, calloutsVisible, gameSoundEnabled, defaultDisplayCurrency, headerLogoUrl, headerLogoVisible, customBackgroundHex]);

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
    const rawBg =
      (Object.prototype.hasOwnProperty.call(settings, 'bgColor') && settings.bgColor != null && String(settings.bgColor).trim() !== '')
        ? String(settings.bgColor).trim()
        : (Object.prototype.hasOwnProperty.call(settings, 'currentTheme') && settings.currentTheme != null && String(settings.currentTheme).trim() !== '')
          ? String(settings.currentTheme).trim()
          : (Object.prototype.hasOwnProperty.call(settings, 'theme') && settings.theme != null && String(settings.theme).trim() !== '')
            ? String(settings.theme).trim()
            : null;
    if (rawBg) {
      setBgColor(rawBg);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'customBackgroundHex')) {
      const raw = settings.customBackgroundHex;
      if (raw == null || raw === '') {
        setCustomBackgroundHex('');
      } else {
        setCustomBackgroundHex(String(raw));
      }
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'headerLogoUrl')) {
      setHeaderLogoUrl(typeof settings.headerLogoUrl === 'string' ? settings.headerLogoUrl : '');
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'headerLogoVisible')) {
      setHeaderLogoVisible(settings.headerLogoVisible !== false);
    }
    if (settings.groupColorHex) setGroupColorHex(settings.groupColorHex);
    if (settings.rowHoverColorHex) setRowHoverColorHex(settings.rowHoverColorHex);
    if (settings.oddRowColorHex) setOddRowColorHex(settings.oddRowColorHex);
    if (settings.evenRowColorHex) setEvenRowColorHex(settings.evenRowColorHex);
    if (settings.tableHeaderColorHex) setTableHeaderColorHex(settings.tableHeaderColorHex);
    if (settings.cardColorHex) setCardColorHex(settings.cardColorHex);
    if (Number.isFinite(settings.tableHeaderIntensity)) setTableHeaderIntensity(settings.tableHeaderIntensity);
    if (Object.prototype.hasOwnProperty.call(settings, 'panelTitlesVisible')) {
      setPanelTitlesVisible(settings.panelTitlesVisible !== false);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'actionsVisible')) {
      setActionsVisible(settings.actionsVisible !== false);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'controlsVisible')) {
      setControlsVisible(settings.controlsVisible === true);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'menuDisappearMs')) {
      setMenuDisappearMs(normalizeMenuDisappearMs(settings.menuDisappearMs, 5000));
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'sidebarAutoCloseEnabled')) {
      setSidebarAutoCloseEnabled(settings.sidebarAutoCloseEnabled === true);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'sidebarAutoCloseMs')) {
      setSidebarAutoCloseMs(normalizeSidebarAutoCloseMs(settings.sidebarAutoCloseMs, 8000));
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'sidebarDisplayMode')) {
      setSidebarDisplayMode(normalizeSidebarDisplayMode(settings.sidebarDisplayMode, 'panel'));
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'calloutsVisible')) {
      setCalloutsVisible(settings.calloutsVisible !== false);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'gameSoundEnabled')) {
      setGameSoundEnabled(settings.gameSoundEnabled !== false);
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'defaultDisplayCurrency')) {
      setDefaultDisplayCurrencyState(
        normalizeDefaultDisplayCurrency(settings.defaultDisplayCurrency, inferLocaleDefaultCurrency())
      );
    }
    return true;
  };

  const applyAppearanceProfile = (profileId) => {
    const profile = appearanceProfiles.find((entry) => entry.id === profileId);
    if (!profile) return false;
    const s = profile.settings && typeof profile.settings === 'object' ? profile.settings : {};
    applyAppearanceSettings(s);
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

  /** Same ordered list as the header Style menu: saved profiles first, then palette theme keys. */
  const appearanceStyleSelectOptions = useMemo(() => {
    const paletteOpts = taliaUiThemeKeysOrdered.map((key) => ({
      key,
      label: mergedTaliaUiThemes[key]?.label || key,
    }));
    if (appearanceProfiles.length === 0) return paletteOpts;
    return [...appearanceProfiles.map((p) => ({ key: p.id, label: p.name })), ...paletteOpts];
  }, [appearanceProfiles, mergedTaliaUiThemes, taliaUiThemeKeysOrdered]);

  const appearanceStyleSelectValue = useMemo(() => {
    if (activeAppearanceProfileId && appearanceProfiles.some((p) => p.id === activeAppearanceProfileId)) {
      return activeAppearanceProfileId;
    }
    if (
      bgColor
      && (Object.prototype.hasOwnProperty.call(mergedTaliaUiThemes, bgColor)
        || taliaUiThemeKeysOrdered.includes(bgColor))
    ) {
      return bgColor;
    }
    return appearanceStyleSelectOptions[0]?.key || '';
  }, [activeAppearanceProfileId, appearanceProfiles, bgColor, mergedTaliaUiThemes, taliaUiThemeKeysOrdered, appearanceStyleSelectOptions]);

  useEffect(() => {
    if (authLoading) return undefined;
    setFontSize(10);
    setFontFamily('Inter');
    setTextIntensity(45);
    setGroupColorIntensity(60);
    setRowColorIntensity(40);
    setOddRowIntensity(40);
    setCardColorIntensity(40);
    setEvenRowIntensity(20);
    setComponentPadding(50);
    setAccentColor('blue');
    setRowAccentColor('slate');
    setCardAccentColor('slate');
    setGroupColorHex('#385c94');
    setRowHoverColorHex('#7890a8');
    setOddRowColorHex('#c8cdd7');
    setEvenRowColorHex('#ffffff');
    setTableHeaderColorHex('#3f5784');
    setCardColorHex('#252a37');
    setTableHeaderIntensity(60);
    setPanelTitlesVisible(true);
    setActionsVisible(true);
    setControlsVisible(false);
    setMenuDisappearMs(normalizeMenuDisappearMs(undefined, 5000));
    setSidebarAutoCloseEnabled(false);
    setSidebarAutoCloseMs(normalizeSidebarAutoCloseMs(undefined, 8000));
    setSidebarDisplayMode(normalizeSidebarDisplayMode(undefined, 'panel'));
    setCalloutsVisible(true);
    setGameSoundEnabled(true);
    setDefaultDisplayCurrencyState(normalizeDefaultDisplayCurrency(undefined, inferLocaleDefaultCurrency()));
    setAppearanceProfiles([]);
    setActiveAppearanceProfileId('');
    setBgColorState('midnight');
    setHeaderLogoUrl('');
    setHeaderLogoVisible(true);
    setCustomBackgroundHexState('');
    setAppearanceDbLoaded(false);
    return undefined;
  }, [authLoading, appearanceUserId]);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return undefined;

    const loadAppearanceSettings = async () => {
      const userId = appearanceUserId;
      const appearanceVariables =
        userId != null && String(userId).trim() !== '' ? { userId: String(userId) } : {};
      const loadPurpose =
        userId != null && String(userId).trim() !== ''
          ? `Load appearance settings for Talia user ${userId}`
          : 'Load global appearance settings (no Talia user id on session yet)';
      try {
        const [appearanceData, registryData] = await Promise.all([
          trackedFetchGraphql({
            query: APPEARANCE_SETTINGS_QUERY,
            variables: appearanceVariables,
            component: 'ThemeContext',
            purpose: loadPurpose,
            tableName: 'config_setting'
          }),
          trackedFetchGraphql({
            query: TALIA_UI_THEME_REGISTRY_QUERY,
            component: 'ThemeContext',
            purpose: 'Load UI theme registry from database',
            tableName: 'config_setting'
          })
        ]);
        if (cancelled) return;
        const reg = registryData?.taliaUiThemeRegistry;
        setThemeRegistryFromDb({
          themes: reg?.themes && typeof reg.themes === 'object' ? reg.themes : {},
          assets: reg?.assets && typeof reg.assets === 'object' ? reg.assets : {}
        });
        const payload = appearanceData?.appearanceSettings;
        const dbHasSettings = payload?.settings && typeof payload.settings === 'object'
          && Object.keys(payload.settings).length > 0;

        if (dbHasSettings) {
          applyAppearanceSettings(payload.settings);
        }
        if (Array.isArray(payload?.profiles)) {
          if (payload.profiles.length > 0) {
            setAppearanceProfiles(
              payload.profiles
                .filter((entry) => entry?.id)
                .map((entry) => ({
                  id: entry.id,
                  name: String(entry.name || '').trim() || `Profile ${String(entry.id).slice(-6)}`,
                  settings: entry.settings && typeof entry.settings === 'object' ? entry.settings : {},
                  updatedAt: entry.updatedAt || new Date().toISOString()
                }))
            );
          } else {
            setAppearanceProfiles([]);
          }
        }
        if (typeof payload?.activeProfileId === 'string' && payload.activeProfileId) {
          setActiveAppearanceProfileId(payload.activeProfileId);
        }

        const migrateKey =
          userId != null && String(userId).trim() !== ''
            ? `${LEGACY_APPEARANCE_MIGRATE_PREFIX}${userId}`
            : null;
        const dbHasProfiles = Array.isArray(payload?.profiles) && payload.profiles.length > 0;
        if (migrateKey && !sessionStorage.getItem(migrateKey)) {
          try {
            const layoutRaw = localStorage.getItem('taliaLayout');
            const parsedLayout = layoutRaw ? JSON.parse(layoutRaw) : {};
            const legacyFs = parsedLayout?.fontSettings && typeof parsedLayout.fontSettings === 'object'
              ? parsedLayout.fontSettings
              : null;
            const profilesRaw = localStorage.getItem('taliaAppearanceProfiles');
            let legacyProfiles = [];
            if (profilesRaw) {
              const pr = JSON.parse(profilesRaw);
              legacyProfiles = Array.isArray(pr) ? pr.filter((e) => e?.id && e?.name && e?.settings) : [];
            }
            const legacyActive = localStorage.getItem('taliaActiveAppearanceProfileId') || '';
            const hasLegacyFs = legacyFs && Object.keys(legacyFs).length > 0;
            const migrateSettings = !dbHasSettings && hasLegacyFs;
            const migrateProfiles = !dbHasProfiles && legacyProfiles.length > 0;
            const migrateActiveOnly = legacyActive && !migrateSettings && !migrateProfiles;
            const hasLegacy = hasLegacyFs || legacyProfiles.length > 0 || legacyActive;
            const shouldMigrate = hasLegacy && (migrateSettings || migrateProfiles || migrateActiveOnly);

            if (shouldMigrate) {
              if (migrateSettings) {
                await trackedFetchGraphql({
                  query: SAVE_APPEARANCE_SETTINGS_MUTATION,
                  variables: {
                    settings: legacyFs,
                    activeProfileId: legacyActive || null,
                    userId
                  },
                  component: 'ThemeContext',
                  purpose: `One-time legacy appearance migration for Talia user ${userId}`,
                  tableName: 'config_setting'
                });
                applyAppearanceSettings(legacyFs);
              } else if (migrateActiveOnly) {
                await trackedFetchGraphql({
                  query: SAVE_APPEARANCE_SETTINGS_MUTATION,
                  variables: {
                    settings: {},
                    activeProfileId: legacyActive,
                    userId
                  },
                  component: 'ThemeContext',
                  purpose: `One-time legacy active profile id for Talia user ${userId}`,
                  tableName: 'config_setting'
                });
              }
              if (migrateProfiles) {
                await trackedFetchGraphql({
                  query: SAVE_APPEARANCE_PROFILES_MUTATION,
                  variables: { profiles: legacyProfiles, userId },
                  component: 'ThemeContext',
                  purpose: `One-time legacy profiles migration for Talia user ${userId}`,
                  tableName: 'config_setting'
                });
                setAppearanceProfiles(legacyProfiles);
              }
              if (legacyActive && (migrateSettings || migrateProfiles || migrateActiveOnly)) {
                setActiveAppearanceProfileId(legacyActive);
              }
              localStorage.removeItem('taliaAppearanceProfiles');
              localStorage.removeItem('taliaActiveAppearanceProfileId');
              if (layoutRaw) {
                const next = { ...parsedLayout };
                delete next.fontSettings;
                localStorage.setItem('taliaLayout', JSON.stringify(next));
              }
              sessionStorage.setItem(migrateKey, '1');
              console.log(`[ThemeContext] Migrated legacy browser appearance to DB for Talia user ${userId}`);
            }
          } catch (migrateErr) {
            console.warn('[ThemeContext] Legacy appearance migration skipped:', migrateErr);
          }
        }
      } catch (error) {
        console.warn('[ThemeContext] Failed to load appearance settings from DB:', error);
      } finally {
        if (!cancelled) {
          setAppearanceDbLoaded(true);
        }
      }
    };
    loadAppearanceSettings();
    return () => {
      cancelled = true;
    };
  }, [authLoading, appearanceUserId]);

  useEffect(() => {
    const refreshRegistry = async () => {
      try {
        const registryData = await trackedFetchGraphql({
          query: TALIA_UI_THEME_REGISTRY_QUERY,
          component: 'ThemeContext',
          purpose: 'Refresh UI theme registry after admin update',
          tableName: 'config_setting',
        });
        const reg = registryData?.taliaUiThemeRegistry;
        setThemeRegistryFromDb({
          themes: reg?.themes && typeof reg.themes === 'object' ? reg.themes : {},
          assets: reg?.assets && typeof reg.assets === 'object' ? reg.assets : {},
        });
      } catch (err) {
        console.warn('[ThemeContext] Theme registry refresh failed:', err);
      }
    };
    window.addEventListener(TALIA_UI_THEME_REGISTRY_UPDATED_EVENT, refreshRegistry);
    return () => {
      window.removeEventListener(TALIA_UI_THEME_REGISTRY_UPDATED_EVENT, refreshRegistry);
    };
  }, []);

  useEffect(() => {
    const normalizeProfilesFromPayload = (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return [];
      return raw
        .filter((entry) => entry?.id)
        .map((entry) => ({
          id: entry.id,
          name: String(entry.name || '').trim() || `Profile ${String(entry.id).slice(-6)}`,
          settings: entry.settings && typeof entry.settings === 'object' ? entry.settings : {},
          updatedAt: entry.updatedAt || new Date().toISOString(),
        }));
    };

    const refreshAppearanceProfiles = async () => {
      try {
        const userId = appearanceUserId;
        const appearanceVariables =
          userId != null && String(userId).trim() !== '' ? { userId: String(userId) } : {};
        const appearanceData = await trackedFetchGraphql({
          query: APPEARANCE_SETTINGS_QUERY,
          variables: appearanceVariables,
          component: 'ThemeContext',
          purpose: 'Refresh appearance profiles after admin update',
          tableName: 'config_setting',
        });
        const payload = appearanceData?.appearanceSettings;
        setAppearanceProfiles(normalizeProfilesFromPayload(payload?.profiles || []));
        const aid = payload?.activeProfileId;
        if (typeof aid === 'string' && aid) {
          setActiveAppearanceProfileId(aid);
        } else if (aid === null || aid === '') {
          setActiveAppearanceProfileId('');
        }
      } catch (err) {
        console.warn('[ThemeContext] Appearance profiles refresh failed:', err);
      }
    };

    window.addEventListener(TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT, refreshAppearanceProfiles);
    return () => {
      window.removeEventListener(TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT, refreshAppearanceProfiles);
    };
  }, [appearanceUserId]);

  useEffect(() => {
    if (!appearanceDbLoaded) return undefined;
    if (!Object.prototype.hasOwnProperty.call(mergedTaliaUiThemes, bgColor)) {
      setBgColorState('midnight');
    }
    return undefined;
  }, [appearanceDbLoaded, mergedTaliaUiThemes, bgColor]);

  useEffect(() => {
    if (!appearanceDbLoaded) return undefined;
    if (saveSettingsTimerRef.current) {
      clearTimeout(saveSettingsTimerRef.current);
    }
    saveSettingsTimerRef.current = setTimeout(async () => {
      try {
        await trackedFetchGraphql({
          query: SAVE_APPEARANCE_SETTINGS_MUTATION,
          variables: {
            settings: buildCurrentAppearanceSettings(),
            activeProfileId: activeAppearanceProfileId || null,
            userId: appearanceUserId ?? null,
          },
          component: 'ThemeContext',
          purpose: appearanceUserId
            ? `Persist appearance settings for Talia user ${appearanceUserId}`
            : 'Persist global appearance settings (no Talia user id)',
          tableName: 'config_setting'
        });
      } catch (error) {
        console.warn('[ThemeContext] Failed to save appearance settings:', error);
      }
    }, 450);
    return () => {
      if (saveSettingsTimerRef.current) {
        clearTimeout(saveSettingsTimerRef.current);
      }
    };
  }, [appearanceDbLoaded, appearanceUserId, fontFamily, fontSize, textIntensity, groupColorIntensity, rowColorIntensity, oddRowIntensity, evenRowIntensity, cardColorIntensity, componentPadding, bgColor, customBackgroundHex, headerLogoUrl, headerLogoVisible, groupColorHex, rowHoverColorHex, oddRowColorHex, evenRowColorHex, tableHeaderColorHex, cardColorHex, tableHeaderIntensity, panelTitlesVisible, actionsVisible, controlsVisible, menuDisappearMs, sidebarAutoCloseEnabled, sidebarAutoCloseMs, sidebarDisplayMode, calloutsVisible, gameSoundEnabled, defaultDisplayCurrency, activeAppearanceProfileId]);

  useEffect(() => {
    if (!appearanceDbLoaded) return undefined;
    if (saveProfilesTimerRef.current) {
      clearTimeout(saveProfilesTimerRef.current);
    }
    saveProfilesTimerRef.current = setTimeout(async () => {
      try {
        await trackedFetchGraphql({
          query: SAVE_APPEARANCE_PROFILES_MUTATION,
          variables: {
            profiles: appearanceProfiles,
            userId: appearanceUserId ?? null,
          },
          component: 'ThemeContext',
          purpose: appearanceUserId
            ? `Persist appearance profiles for Talia user ${appearanceUserId}`
            : 'Persist global appearance profiles (no Talia user id)',
          tableName: 'config_setting'
        });
      } catch (error) {
        console.warn('[ThemeContext] Failed to save appearance profiles:', error);
      }
    }, 450);
    return () => {
      if (saveProfilesTimerRef.current) {
        clearTimeout(saveProfilesTimerRef.current);
      }
    };
  }, [appearanceDbLoaded, appearanceUserId, appearanceProfiles]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('talia-panel-titles-hidden', panelTitlesVisible === false);
    window.__taliaPanelTitlesVisible = panelTitlesVisible !== false;
  }, [panelTitlesVisible]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('talia-actions-hidden', actionsVisible === false);
    window.__taliaActionsVisible = actionsVisible !== false;
  }, [actionsVisible]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('talia-controls-hidden', controlsVisible !== true);
    window.__taliaControlsVisible = controlsVisible === true;
  }, [controlsVisible]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('talia-callouts-hidden', calloutsVisible === false);
    window.__taliaCalloutsVisible = calloutsVisible !== false;
  }, [calloutsVisible]);

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
    // Shared panel-fit sizing tokens used by card/chart/map/table surfaces.
    root.style.setProperty('--theme-card-min-height', scaledPx(160, 110));
    root.style.setProperty('--theme-table-min-height', scaledPx(220, 140));
    root.style.setProperty('--theme-chart-min-height', scaledPx(180, 130));
    root.style.setProperty('--theme-chart-height', scaledPx(280, 180));
    root.style.setProperty('--theme-map-min-height', scaledPx(200, 150));
    root.style.setProperty('--theme-map-height', scaledPx(260, 180));
    root.style.setProperty('--theme-side-panel-width', scaledPx(300, 220));
    root.style.setProperty('--theme-report-card-min-track', scaledPx(240, 160));
    root.style.setProperty('--theme-auto-disappear-ms', `${normalizeMenuDisappearMs(menuDisappearMs, 5000)}ms`);

    const uiTheme = mergedTaliaUiThemes[bgColor] || mergedTaliaUiThemes.midnight;
    const customBgRgb = (() => {
      const h = typeof customBackgroundHex === 'string' ? customBackgroundHex.trim() : '';
      return h ? hexToRgb(h) : null;
    })();

    let warmMed;
    let lightPalette;
    let s;
    let g1;
    let g2;
    if (customBgRgb) {
      s = customBgRgb;
      g1 = mixRgb(customBgRgb, [0, 0, 0], 0.18);
      g2 = mixRgb(customBgRgb, [255, 255, 255], 0.14);
      const luma = ((0.2126 * s[0]) + (0.7152 * s[1]) + (0.0722 * s[2])) / 255;
      lightPalette = luma > 0.55;
      warmMed = false;
    } else {
      warmMed = uiTheme.palette === 'warmMediterranean';
      lightPalette = uiTheme.palette === 'light';
      const bg = uiTheme.bg;
      s = bg.solid;
      g1 = bg.g1;
      g2 = bg.g2;
    }

    // Global text intensity — dark text on light themes, light text on dark
    const tt = textIntensity / 100;
    if (lightPalette) {
      const dr = lerpInt(42, 24, tt);
      const dg = lerpInt(48, 28, tt);
      const db = lerpInt(58, 32, tt);
      const fgA = lerp(0.88, 0.98, tt);
      root.style.setProperty('--theme-fg', `rgba(${dr}, ${dg}, ${db}, ${fgA})`);
      root.style.setProperty('--theme-text-secondary', `rgba(${dr}, ${dg}, ${db}, ${lerp(0.62, 0.82, tt)})`);
      root.style.setProperty('--theme-text-muted', `rgba(${dr}, ${dg}, ${db}, ${lerp(0.45, 0.68, tt)})`);
    } else {
      const fgR = lerpInt(150, 236, tt);
      const fgG = lerpInt(160, 244, tt);
      const fgB = lerpInt(178, 252, tt);
      const fgA = lerp(0.72, 0.98, tt);
      root.style.setProperty('--theme-fg', `rgba(${fgR}, ${fgG}, ${fgB}, ${fgA})`);
      root.style.setProperty('--theme-text-secondary', `rgba(${fgR}, ${fgG}, ${fgB}, ${lerp(0.58, 0.90, tt)})`);
      root.style.setProperty('--theme-text-muted', `rgba(${fgR}, ${fgG}, ${fgB}, ${lerp(0.42, 0.76, tt)})`);
    }

    root.style.setProperty('--theme-bg-solid', `rgb(${s.join(',')})`);
    root.style.setProperty('--theme-bg', `linear-gradient(135deg, rgb(${g1.join(',')}) 0%, rgb(${s.join(',')}) 50%, rgb(${g2.join(',')}) 100%)`);

    root.dataset.taliaBgColor = customBgRgb ? 'custom' : bgColor;
    root.dataset.taliaUiTheme = customBgRgb ? 'custom' : bgColor;

    root.classList.toggle('talia-theme-palette-warmMediterranean', warmMed);
    root.classList.toggle('talia-theme-palette-light', lightPalette);

    if (warmMed) {
      root.style.setProperty('--theme-accent', '#0d9488');
      root.style.setProperty('--theme-accent-hover', '#0f766e');
      root.style.setProperty('--theme-accent-light', 'rgba(13, 148, 136, 0.18)');
      root.style.setProperty('--theme-hover', 'rgba(13, 148, 136, 0.24)');
      root.style.setProperty('--theme-selected', 'rgba(13, 148, 136, 0.14)');
      root.style.setProperty('--theme-selected-hover', 'rgba(13, 148, 136, 0.22)');
      root.style.setProperty('--theme-focus', 'rgba(45, 212, 191, 0.35)');
      root.style.setProperty('--theme-border', 'rgba(232, 213, 184, 0.14)');
      root.style.setProperty('--theme-border-light', 'rgba(232, 213, 184, 0.07)');
      root.style.setProperty('--theme-glass', 'rgba(255, 250, 240, 0.06)');
      root.style.setProperty('--theme-glass-border', 'rgba(232, 213, 184, 0.12)');
      root.style.setProperty('--theme-sidebar-border', 'rgba(232, 213, 184, 0.1)');
      root.style.setProperty('--theme-tabulator-sort-active', '#5eead4');
    } else if (lightPalette) {
      root.style.setProperty('--theme-accent', '#2563eb');
      root.style.setProperty('--theme-accent-hover', '#1d4ed8');
      root.style.setProperty('--theme-accent-light', 'rgba(37, 99, 235, 0.12)');
      root.style.setProperty('--theme-hover', 'rgba(37, 99, 235, 0.08)');
      root.style.setProperty('--theme-selected', 'rgba(37, 99, 235, 0.1)');
      root.style.setProperty('--theme-selected-hover', 'rgba(37, 99, 235, 0.16)');
      root.style.setProperty('--theme-focus', 'rgba(37, 99, 235, 0.35)');
      root.style.setProperty('--theme-border', 'rgba(15, 23, 42, 0.12)');
      root.style.setProperty('--theme-border-light', 'rgba(15, 23, 42, 0.06)');
      root.style.setProperty('--theme-glass', 'rgba(255, 255, 255, 0.72)');
      root.style.setProperty('--theme-glass-border', 'rgba(15, 23, 42, 0.1)');
      root.style.setProperty('--theme-sidebar-border', 'rgba(15, 23, 42, 0.08)');
      root.style.setProperty('--theme-tabulator-sort-active', '#2563eb');
    } else {
      root.style.setProperty('--theme-accent', '#5b9bd5');
      root.style.setProperty('--theme-accent-hover', '#4a8bc2');
      root.style.setProperty('--theme-accent-light', 'rgba(91, 155, 213, 0.15)');
      root.style.setProperty('--theme-hover', 'rgba(91, 155, 213, 0.25)');
      root.style.setProperty('--theme-selected', 'rgba(91, 155, 213, 0.15)');
      root.style.setProperty('--theme-selected-hover', 'rgba(91, 155, 213, 0.25)');
      root.style.setProperty('--theme-focus', 'rgba(91, 155, 213, 0.4)');
      root.style.setProperty('--theme-border', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--theme-border-light', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--theme-glass', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--theme-glass-border', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--theme-sidebar-border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--theme-tabulator-sort-active', '#7db3ea');
    }

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
    const headerRgb = hexToRgb(tableHeaderColorHex) || [63, 87, 132];
    const cardRgb = hexToRgb(cardColorHex) || [37, 42, 55];
    const th = tableHeaderIntensity / 100;
    const headerLuma = ((headerRgb[0] * 0.2126) + (headerRgb[1] * 0.7152) + (headerRgb[2] * 0.0722)) / 255;
    const headerIsLight = headerLuma > 0.56;
    const headerTextLo = headerIsLight ? 18 : 176;
    const headerTextHi = headerIsLight ? 72 : 252;
    const headerTextR = lerpInt(headerTextLo, headerTextHi, tt);
    const headerTextG = lerpInt(headerIsLight ? 22 : 184, headerIsLight ? 78 : 255, tt);
    const headerTextB = lerpInt(headerIsLight ? 28 : 200, headerIsLight ? 84 : 255, tt);
    const headerTextAlpha = headerIsLight ? lerp(0.84, 0.98, tt) : lerp(0.72, 0.98, tt);
    root.style.setProperty('--theme-table-row-even', `rgba(${evenRowRgb.join(',')}, ${lerp(0.00, 0.16, te)})`);
    root.style.setProperty('--theme-table-row-odd', `rgba(${oddRowRgb.join(',')}, ${lerp(0.00, 0.22, to)})`);
    root.style.setProperty('--theme-table-row-hover', `rgba(${rowHoverRgb.join(',')}, ${lerp(0.04, 0.35, tr)})`);
    if (warmMed) {
      root.style.setProperty('--theme-table-row-hover', 'rgba(13, 148, 136, 0.16)');
      root.style.setProperty('--theme-table-row-selected', 'rgba(13, 148, 136, 0.28)');
      root.style.setProperty('--theme-table-row-selected-hover', 'rgba(13, 148, 136, 0.38)');
    } else if (lightPalette) {
      root.style.setProperty('--theme-table-row-hover', 'rgba(37, 99, 235, 0.07)');
      root.style.setProperty('--theme-table-row-selected', 'rgba(37, 99, 235, 0.12)');
      root.style.setProperty('--theme-table-row-selected-hover', 'rgba(37, 99, 235, 0.18)');
    } else {
      root.style.removeProperty('--theme-table-row-selected');
      root.style.removeProperty('--theme-table-row-selected-hover');
    }
    root.style.setProperty('--theme-tabulator-header-bg', `rgba(${headerRgb.join(',')}, ${lerp(0.20, 0.74, th)})`);
    root.style.setProperty('--theme-tabulator-header-border', `rgba(${headerRgb.join(',')}, ${lerp(0.30, 0.88, th)})`);
    root.style.setProperty('--theme-tabulator-header-text', `rgba(${headerTextR}, ${headerTextG}, ${headerTextB}, ${headerTextAlpha})`);
    root.style.setProperty('--theme-card-bg', `rgba(${cardRgb.join(',')}, ${lerp(0.40, 1.00, tc)})`);

    // Elevated surfaces blend background base with card accent tint
    if (lightPalette) {
      const elR = lerpInt(g2[0], 255, 0.25);
      const elG = lerpInt(g2[1], 255, 0.25);
      const elB = lerpInt(g2[2], 255, 0.28);
      root.style.setProperty('--theme-bg-elevated', `rgb(${elR}, ${elG}, ${elB})`);
      root.style.setProperty('--theme-panel-bg', `rgb(${lerpInt(s[0], 252, 0.55)}, ${lerpInt(s[1], 252, 0.55)}, ${lerpInt(s[2], 254, 0.55)})`);
    } else {
      const elR = lerpInt(g2[0], cardRgb[0], tc);
      const elG = lerpInt(g2[1], cardRgb[1], tc);
      const elB = lerpInt(g2[2], cardRgb[2], tc);
      root.style.setProperty('--theme-bg-elevated', `rgb(${elR}, ${elG}, ${elB})`);
      root.style.setProperty('--theme-panel-bg', `rgb(${lerpInt(s[0], 42, 0.3)}, ${lerpInt(s[1], 46, 0.3)}, ${lerpInt(s[2], 68, 0.3)})`);
    }

    // Re-sync Chart.js globals with current CSS variables
    initChartDefaults();

  }, [fontSize, selectedFont, textIntensity, groupColorIntensity, rowColorIntensity, oddRowIntensity, cardColorIntensity, evenRowIntensity, componentPadding, accentColor, rowAccentColor, cardAccentColor, groupColorHex, rowHoverColorHex, oddRowColorHex, evenRowColorHex, tableHeaderColorHex, cardColorHex, tableHeaderIntensity, bgColor, customBackgroundHex, menuDisappearMs, mergedTaliaUiThemes]);

  const applyAppearanceStyleSelectKey = (rawNext) => {
    const key =
      typeof rawNext === 'string'
        ? rawNext
        : String(rawNext?.target?.value ?? rawNext ?? '').trim();
    if (!key || !appearanceStyleSelectOptions.some((o) => o.key === key)) return;
    const profile = appearanceProfiles.find((p) => p.id === key);
    if (profile) {
      const s = profile.settings && typeof profile.settings === 'object' ? profile.settings : {};
      applyAppearanceSettings(s);
      setActiveAppearanceProfileId(profile.id);
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(mergedTaliaUiThemes, key)
      || taliaUiThemeKeysOrdered.includes(key)
    ) {
      setActiveAppearanceProfileId('');
      setCustomBackgroundHex('');
      setBgColor(key);
    }
  };

  // Context value - provide theme and font settings
  const value = {
    // Theme object (for components that need JS access to colors)
    theme,
    
    // Legacy aliases for backward compatibility
    currentTheme: bgColor,
    setCurrentTheme: setBgColor,
    availableThemes: taliaUiThemeKeysOrdered.map((key) => ({
      key,
      name: mergedTaliaUiThemes[key]?.label || key,
    })),
    taliaUiThemeKeys: taliaUiThemeKeysOrdered,
    mergedTaliaUiThemes,
    resolveThemeDefaultHeaderLogoForTheme,
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
    tableHeaderColorHex,
    setTableHeaderColorHex,
    cardColorHex,
    setCardColorHex,
    tableHeaderIntensity,
    setTableHeaderIntensity,
    panelTitlesVisible,
    setPanelTitlesVisible,
    actionsVisible,
    setActionsVisible,
    controlsVisible,
    setControlsVisible,
    menuDisappearMs,
    setMenuDisappearMs,
    sidebarAutoCloseEnabled,
    setSidebarAutoCloseEnabled,
    sidebarAutoCloseMs,
    setSidebarAutoCloseMs,
    sidebarDisplayMode,
    setSidebarDisplayMode,
    calloutsVisible,
    setCalloutsVisible,
    gameSoundEnabled,
    setGameSoundEnabled,
    defaultDisplayCurrency,
    setDefaultDisplayCurrency,

    // Appearance profiles
    appearanceDbLoaded,
    appearanceProfiles,
    activeAppearanceProfileId,
    setActiveAppearanceProfileId,
    saveAppearanceProfile,
    applyAppearanceProfile,
    appearanceStyleSelectOptions,
    appearanceStyleSelectValue,
    applyAppearanceStyleSelectKey,

    // UI theme (persisted as bgColor) + optional header logo (any theme)
    bgColor,
    setBgColor,
    customBackgroundHex,
    setCustomBackgroundHex,
    headerLogoUrl,
    setHeaderLogoUrl,
    headerLogoVisible,
    setHeaderLogoVisible,

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
