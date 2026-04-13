/**
 * Talia UI theme registry — background gradient, accent palette, optional default header logo.
 * The persisted settings key remains `bgColor` (theme id) for backward compatibility.
 * Runtime registry may merge rows from `taliaUiThemeRegistry` (database) over these defaults.
 */

import { resolveAppPublicUrl } from '../lib/headerLogoAsset';

export const TALIA_UI_THEMES = {
  midnight: {
    label: 'Midnight',
    swatch: '#1a1d33',
    bg: { solid: [26, 29, 51], g1: [17, 19, 37], g2: [32, 36, 59] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  charcoal: {
    label: 'Charcoal',
    swatch: '#1e1e22',
    bg: { solid: [30, 30, 34], g1: [20, 20, 24], g2: [38, 38, 44] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  navy: {
    label: 'Navy',
    swatch: '#12182a',
    bg: { solid: [18, 24, 42], g1: [12, 16, 30], g2: [26, 34, 56] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  graphite: {
    label: 'Graphite',
    swatch: '#222428',
    bg: { solid: [34, 36, 40], g1: [24, 26, 30], g2: [42, 44, 50] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  ocean: {
    label: 'Ocean',
    swatch: '#121e26',
    bg: { solid: [18, 30, 38], g1: [12, 20, 28], g2: [26, 40, 52] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  obsidian: {
    label: 'Obsidian',
    swatch: '#101014',
    bg: { solid: [16, 16, 20], g1: [10, 10, 14], g2: [22, 22, 28] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  porcelain: {
    label: 'Porcelain (light)',
    swatch: '#e8eaef',
    bg: { solid: [236, 238, 242], g1: [248, 249, 251], g2: [226, 230, 238] },
    palette: 'light',
    defaultHeaderLogoUrl: null,
  },
  linen: {
    label: 'Linen (light)',
    swatch: '#ebe6dc',
    bg: { solid: [240, 236, 228], g1: [250, 247, 240], g2: [230, 224, 212] },
    palette: 'light',
    defaultHeaderLogoUrl: null,
  },
  celestyal: {
    label: 'Celestyal',
    swatch: '#34302c',
    bg: { solid: [52, 48, 44], g1: [38, 35, 32], g2: [64, 58, 52] },
    palette: 'warmMediterranean',
    /** Served from /public; resolved with Vite BASE_URL in the shell */
    defaultHeaderLogoUrl: 'celestyal-client-mark.svg',
  },
};

export const TALIA_UI_THEME_KEYS = Object.keys(TALIA_UI_THEMES);

export const getTaliaUiTheme = (key) => TALIA_UI_THEMES[key] || TALIA_UI_THEMES.midnight;

const FALLBACK_THEME_SHAPE = {
  label: 'Theme',
  swatch: '#1a1d33',
  bg: { solid: [26, 29, 51], g1: [17, 19, 37], g2: [32, 36, 59] },
  palette: 'default',
  defaultHeaderLogoUrl: null,
};

/**
 * Merge database-backed theme definitions (e.g. from config_setting) over built-in defaults.
 * @param {Record<string, object>} builtin
 * @param {unknown} dbThemes
 */
export function mergeTaliaUiThemesFromDb(builtin, dbThemes) {
  const base = builtin && typeof builtin === 'object' ? builtin : TALIA_UI_THEMES;
  if (!dbThemes || typeof dbThemes !== 'object' || Array.isArray(dbThemes)) {
    return { ...base };
  }
  const out = { ...base };
  for (const key of Object.keys(dbThemes)) {
    const patch = dbThemes[key];
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) continue;
    const prev = base[key] || FALLBACK_THEME_SHAPE;
    const mergedBg =
      patch.bg && typeof patch.bg === 'object' && !Array.isArray(patch.bg)
        ? { ...prev.bg, ...patch.bg }
        : prev.bg;
    out[key] = {
      ...prev,
      ...patch,
      bg: mergedBg,
    };
  }
  return out;
}

/**
 * Resolve default header logo for a theme: data URL from inline DB assets, absolute URL, or /public path.
 */
export function resolveThemeDefaultHeaderLogoUrl(theme, assetOverrides) {
  if (!theme || typeof theme !== 'object') return '';
  const raw = theme.defaultHeaderLogoUrl;
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (s.startsWith('data:') || /^https?:\/\//i.test(s)) return s;
  const blob =
    assetOverrides && typeof assetOverrides === 'object' && !Array.isArray(assetOverrides)
      ? assetOverrides[s]
      : null;
  if (typeof blob === 'string' && blob.trim().startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blob.trim())}`;
  }
  return resolveAppPublicUrl(s);
}

/** @deprecated Use TALIA_UI_THEMES — kept for imports expecting { key: { solid, g1, g2 } } */
export const TALIA_BG_PRESETS = Object.fromEntries(
  TALIA_UI_THEME_KEYS.map((k) => [k, TALIA_UI_THEMES[k].bg])
);
