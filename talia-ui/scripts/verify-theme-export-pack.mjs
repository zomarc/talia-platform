/**
 * Smoke test: theme export packs parse correctly (no server).
 * Run: node ./scripts/verify-theme-export-pack.mjs
 */
import {
  buildAppearanceProfileExportPack,
  buildRegistryPaletteExportPack,
  parseThemeExportPack,
  parseThemePackJsonFileText,
  THEME_EXPORT_ROOT_KEY,
} from '../src/lib/taliaThemeExportPack.js';

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const profileDoc = buildAppearanceProfileExportPack({
  profile: {
    id: 'ap-export-verify',
    name: 'Vampire',
    settings: { bgColor: 'midnight', fontSize: 13 },
    updatedAt: '2026-04-16T00:00:00.000Z',
  },
  dbThemes: {},
  dbAssets: {},
});
const p1 = parseThemeExportPack(JSON.parse(JSON.stringify(profileDoc)));
if (!p1.ok || p1.importMode !== 'mergeProfile') fail('profile pack');
const r1 = profileDoc[THEME_EXPORT_ROOT_KEY];
if (THEME_EXPORT_ROOT_KEY !== 'ThemeExport') fail('root key constant');
if (!r1.profile || r1.profile.id !== 'ap-export-verify') fail('profile payload');
if (Object.keys(r1.themes).length !== 0) fail('expected empty themes for built-in bg');

const paletteDoc = buildRegistryPaletteExportPack({
  themeKey: 'zombie',
  mergedTheme: {
    label: 'Zombie',
    swatch: '#111',
    bg: { solid: [1, 1, 1], g1: [2, 2, 2], g2: [3, 3, 3] },
    palette: 'default',
    defaultHeaderLogoUrl: null,
  },
  dbThemes: { zombie: { label: 'Z Patch' } },
  dbAssets: {},
});
const p2 = parseThemeExportPack(JSON.parse(JSON.stringify(paletteDoc)));
if (!p2.ok || p2.importMode !== 'mergePalette') fail('palette pack');

const fullSnapshot = {
  [THEME_EXPORT_ROOT_KEY]: {
    themes: { x: { label: 'X' }, y: { label: 'Y' } },
    assets: {},
    appearance: { settings: {}, profiles: [], activeProfileId: null },
  },
};
const p3 = parseThemeExportPack(fullSnapshot);
if (!p3.ok || p3.importMode !== 'fullReplace') fail('full catalogue');

const bomText = `\uFEFF${JSON.stringify(profileDoc)}`;
const bomParsed = parseThemePackJsonFileText(bomText);
const p4 = parseThemeExportPack(bomParsed);
if (!p4.ok || p4.importMode !== 'mergeProfile') fail('UTF-8 BOM strip');

const singleProfileInAppearance = {
  [THEME_EXPORT_ROOT_KEY]: {
    themes: {},
    assets: {},
    appearance: {
      settings: {},
      profiles: [
        {
          id: 'ap-only-in-appearance',
          name: 'Darth Talius',
          settings: { bgColor: 'midnight' },
          updatedAt: '2026-04-16T00:00:00.000Z',
        },
      ],
      activeProfileId: null,
    },
  },
};
const p5 = parseThemeExportPack(singleProfileInAppearance);
if (!p5.ok || p5.importMode !== 'mergeProfile') fail('profile from appearance.profiles[0]');
if (p5.pack.profile?.id !== 'ap-only-in-appearance') fail('profile normalized onto pack.profile');

const legacyRootKey = {
  taliaThemeExportV1: {
    profile: {
      id: 'ap-legacy-key',
      name: 'Legacy wrapper',
      settings: { bgColor: 'navy' },
      updatedAt: '2026-04-16T00:00:00.000Z',
    },
    themes: {},
    assets: {},
    appearance: { settings: {}, profiles: [], activeProfileId: null },
  },
};
const p6 = parseThemeExportPack(legacyRootKey);
if (!p6.ok || p6.importMode !== 'mergeProfile') fail('legacy taliaThemeExportV1 root key');

console.log('verify-theme-export-pack: ok');
