/**
 * Theme export JSON: Admin → Themes → Export / Load. Root property is {@link THEME_EXPORT_ROOT_KEY}.
 * Import also accepts legacy key `taliaThemeExportV1` if present.
 */
export const THEME_EXPORT_ROOT_KEY = 'ThemeExport';

const THEME_EXPORT_LEGACY_ROOT_KEY = 'taliaThemeExportV1';

/**
 * Parse JSON from a file or textarea (strip UTF-8 BOM; trim whitespace).
 * @param {string} text
 * @returns {unknown}
 */
export function parseThemePackJsonFileText(text) {
  const s = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (!s) {
    throw new Error('File is empty.');
  }
  return JSON.parse(s);
}

const deepClone = (v) => {
  try {
    return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  } catch {
    return v;
  }
};

const asPlainObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const asProfilesArray = (v) => (Array.isArray(v) ? v : []);

const idOk = (p) =>
  p &&
  typeof p === 'object' &&
  !Array.isArray(p) &&
  (typeof p.id === 'string' || typeof p.id === 'number') &&
  String(p.id).trim() !== '';

/**
 * Full catalogue: themes + assets + appearance (import replaces registry + appearance).
 */
export function buildThemeExportPack({ themes, assets, appearance }) {
  const safeThemes =
    themes && typeof themes === 'object' && !Array.isArray(themes) ? themes : {};
  const safeAssets =
    assets && typeof assets === 'object' && !Array.isArray(assets) ? assets : {};
  const prof = appearance?.profiles;
  const safeProfiles = Array.isArray(prof) ? prof : [];
  const safeSettings =
    appearance?.settings && typeof appearance.settings === 'object' && !Array.isArray(appearance.settings)
      ? appearance.settings
      : {};
  const aid = appearance?.activeProfileId;
  const safeActive =
    typeof aid === 'string' && aid.trim() !== '' ? aid.trim() : null;

  return {
    [THEME_EXPORT_ROOT_KEY]: {
      themes: safeThemes,
      assets: safeAssets,
      appearance: {
        settings: safeSettings,
        profiles: safeProfiles,
        activeProfileId: safeActive,
      },
    },
  };
}

/**
 * One named profile + optional registry patch for its bg palette.
 */
export function buildAppearanceProfileExportPack({ profile, dbThemes, dbAssets }) {
  const p = profile && typeof profile === 'object' ? deepClone(profile) : null;
  if (!p?.id) {
    throw new Error('Profile export requires a profile with id');
  }
  const settings = p.settings && typeof p.settings === 'object' && !Array.isArray(p.settings) ? p.settings : {};
  const bgRaw = settings.bgColor;
  const bgKey =
    typeof bgRaw === 'string' && bgRaw.trim() !== '' ? bgRaw.trim() : null;

  const themes = {};
  const assets = {};
  const dt = dbThemes && typeof dbThemes === 'object' && !Array.isArray(dbThemes) ? dbThemes : {};
  const da = dbAssets && typeof dbAssets === 'object' && !Array.isArray(dbAssets) ? dbAssets : {};

  if (bgKey && dt[bgKey] && typeof dt[bgKey] === 'object' && !Array.isArray(dt[bgKey])) {
    themes[bgKey] = deepClone(dt[bgKey]);
    const logoRef = themes[bgKey].defaultHeaderLogoUrl;
    if (typeof logoRef === 'string' && logoRef && da[logoRef]) {
      assets[logoRef] = deepClone(da[logoRef]);
    }
  }

  return {
    [THEME_EXPORT_ROOT_KEY]: {
      profile: {
        id: String(p.id),
        name: String(p.name || '').trim() || `Profile ${String(p.id).slice(-6)}`,
        settings: deepClone(settings),
        updatedAt: p.updatedAt || new Date().toISOString(),
      },
      themes,
      assets,
      appearance: {
        settings: {},
        profiles: [],
        activeProfileId: null,
      },
    },
  };
}

/**
 * One registry palette + referenced assets.
 */
export function buildRegistryPaletteExportPack({ themeKey, mergedTheme, dbThemes, dbAssets }) {
  const key = typeof themeKey === 'string' && themeKey.trim() !== '' ? themeKey.trim() : '';
  if (!key) throw new Error('Palette export requires themeKey');

  const dt = dbThemes && typeof dbThemes === 'object' && !Array.isArray(dbThemes) ? dbThemes : {};
  const da = dbAssets && typeof dbAssets === 'object' && !Array.isArray(dbAssets) ? dbAssets : {};
  const themes = {};
  if (dt[key] && typeof dt[key] === 'object' && !Array.isArray(dt[key])) {
    themes[key] = deepClone(dt[key]);
  } else if (mergedTheme && typeof mergedTheme === 'object') {
    themes[key] = deepClone(mergedTheme);
  }
  const assets = {};
  const logoRef = themes[key]?.defaultHeaderLogoUrl;
  if (typeof logoRef === 'string' && logoRef && da[logoRef]) {
    assets[logoRef] = deepClone(da[logoRef]);
  }

  return {
    [THEME_EXPORT_ROOT_KEY]: {
      exportedPaletteKey: key,
      themes,
      assets,
      appearance: {
        settings: {},
        profiles: [],
        activeProfileId: null,
      },
    },
  };
}

/**
 * Accept any object under {@link THEME_EXPORT_ROOT_KEY}; coerce missing fields; infer import path from shape only.
 * @param {unknown} raw — parsed JSON root object
 * @returns {{ ok: true, pack: object, importMode: 'fullReplace' | 'mergeProfile' | 'mergePalette' } | { ok: false, error: string }}
 */
export function parseThemeExportPack(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Not a JSON object.' };
  }
  const root = raw[THEME_EXPORT_ROOT_KEY] ?? raw[THEME_EXPORT_LEGACY_ROOT_KEY];
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      ok: false,
      error: `Expected { "${THEME_EXPORT_ROOT_KEY}": { … } } (Export from Admin → Themes).`,
    };
  }

  root.themes = asPlainObject(root.themes);
  root.assets = asPlainObject(root.assets);
  const appearance = asPlainObject(root.appearance);
  appearance.settings = asPlainObject(appearance.settings);
  appearance.profiles = asProfilesArray(appearance.profiles);
  const aid = appearance.activeProfileId;
  appearance.activeProfileId =
    typeof aid === 'string' && aid.trim() !== '' ? aid.trim() : null;
  root.appearance = appearance;

  const themeKeyCount = Object.keys(root.themes).length;
  let importMode = 'fullReplace';

  const direct = root.profile && typeof root.profile === 'object' && !Array.isArray(root.profile) ? root.profile : null;
  if (idOk(direct)) {
    importMode = 'mergeProfile';
  } else if (appearance.profiles.length === 1 && idOk(appearance.profiles[0]) && themeKeyCount <= 1) {
    root.profile = appearance.profiles[0];
    importMode = 'mergeProfile';
  } else {
    const pk =
      typeof root.exportedPaletteKey === 'string' && root.exportedPaletteKey.trim() !== ''
        ? root.exportedPaletteKey.trim()
        : null;
    if (pk || themeKeyCount === 1) {
      importMode = 'mergePalette';
      if (!pk && themeKeyCount === 1) {
        root.exportedPaletteKey = Object.keys(root.themes)[0];
      }
    }
  }

  return { ok: true, pack: root, importMode };
}

/** @param {string} name */
export function slugifyExportFilenamePart(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'style';
}

export function generateAppearanceProfileId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ap-${Date.now()}-${rand}`;
}
