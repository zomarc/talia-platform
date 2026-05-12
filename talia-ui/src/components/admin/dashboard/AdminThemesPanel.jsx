/**
 * Admin Styles / themes: same sources as the header & sidebar Style control —
 * named appearance profiles first, then palette themes (built-ins + DB registry).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import {
  APPEARANCE_PROFILE_BUCKETS_QUERY,
  SAVE_APPEARANCE_PROFILES_MUTATION,
  SAVE_APPEARANCE_SETTINGS_MUTATION,
  TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT,
} from '../../../graphql/taliaAppearanceOperations';
import {
  SAVE_TALIA_UI_THEME_REGISTRY_MUTATION,
  TALIA_UI_THEME_REGISTRY_QUERY,
  TALIA_UI_THEME_REGISTRY_UPDATED_EVENT,
} from '../../../graphql/taliaUiThemeRegistryOperations';
import {
  buildAppearanceProfileExportPack,
  buildRegistryPaletteExportPack,
  generateAppearanceProfileId,
  parseThemeExportPack,
  parseThemePackJsonFileText,
  slugifyExportFilenamePart,
  THEME_EXPORT_ROOT_KEY,
} from '../../../lib/taliaThemeExportPack';
import { resolveTaliaAppearanceUserId } from '../../../lib/resolveTaliaAppearanceUserId';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import {
  TALIA_UI_THEMES,
  TALIA_UI_THEME_KEYS,
  mergeTaliaUiThemesFromDb,
} from '../../../themes/taliaUiThemes';

const ROW_PROFILE = 'p';
const ROW_PALETTE = 't';

const rowKeyProfile = (id) => `${ROW_PROFILE}:${id}`;
const rowKeyPalette = (key) => `${ROW_PALETTE}:${key}`;

const parseRowKey = (rowKey) => {
  if (!rowKey || typeof rowKey !== 'string') return null;
  if (rowKey.startsWith(`${ROW_PROFILE}:`)) {
    return { kind: 'profile', id: rowKey.slice(2) };
  }
  if (rowKey.startsWith(`${ROW_PALETTE}:`)) {
    return { kind: 'palette', key: rowKey.slice(2) };
  }
  return null;
};

const cloneThemes = (raw) => {
  try {
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? JSON.parse(JSON.stringify(raw))
      : {};
  } catch {
    return {};
  }
};

const normalizeProfiles = (raw) => {
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

/** Same merge as server: global first, then user overrides by id. */
const mergeProfileBuckets = (globalList, userList) => {
  const g = normalizeProfiles(globalList);
  const u = normalizeProfiles(userList);
  const map = new Map();
  for (const p of g) {
    if (p.id) map.set(p.id, p);
  }
  for (const p of u) {
    if (p.id) map.set(p.id, p);
  }
  return Array.from(map.values());
};

const orderedPaletteKeys = (dbThemes) => {
  const merged = mergeTaliaUiThemesFromDb(TALIA_UI_THEMES, dbThemes);
  const keys = Object.keys(merged);
  const ordered = [...TALIA_UI_THEME_KEYS];
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
};

/** Parse JSON into a concrete import plan (no side effects). */
function buildImportPlan(raw) {
  const parsed = parseThemeExportPack(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { pack, importMode } = parsed;
  const themesIn =
    pack.themes && typeof pack.themes === 'object' && !Array.isArray(pack.themes) ? pack.themes : {};
  const assetsIn =
    pack.assets && typeof pack.assets === 'object' && !Array.isArray(pack.assets) ? pack.assets : {};
  const app = pack.appearance || {};
  const profilesIn = Array.isArray(app.profiles) ? app.profiles : [];
  const settingsIn =
    app.settings && typeof app.settings === 'object' && !Array.isArray(app.settings) ? app.settings : {};
  const activeIn =
    typeof app.activeProfileId === 'string' && app.activeProfileId.trim() !== ''
      ? app.activeProfileId.trim()
      : null;
  const humanKind =
    importMode === 'mergeProfile'
      ? `named profile “${String(pack.profile?.name || pack.profile?.id || '').trim() || 'profile'}”`
      : importMode === 'mergePalette'
        ? `palette “${String(pack.exportedPaletteKey || '').trim()}”`
        : 'full theme catalogue';
  const modeLabel =
    importMode === 'mergeProfile'
      ? 'Merge named profile'
      : importMode === 'mergePalette'
        ? 'Merge palette overrides'
        : 'Replace full catalogue';
  if (
    importMode === 'mergePalette' &&
    Object.keys(themesIn).length === 0 &&
    Object.keys(assetsIn).length === 0
  ) {
    return { ok: false, error: 'Pack has no palette data to merge.' };
  }
  return {
    ok: true,
    plan: {
      importMode,
      pack,
      themesIn,
      assetsIn,
      profilesIn,
      settingsIn,
      activeIn,
      humanKind,
      modeLabel,
    },
  };
}

function enhanceConfigSaveError(message) {
  const m = String(message || '');
  if (/setting_id_seq|permission denied for sequence/i.test(m)) {
    return `${m} — Apply migration talia-server/supabase/migrations/20260416130000_talia_config_setting_insert_sequence_grants.sql on this Supabase (INSERT on talia_config.setting + USAGE on talia_config.setting_id_seq for authenticated).`;
  }
  return m;
}

const IMPORT_REVIEW_COPY = {
  fullReplace:
    'Replace this instance’s theme registry, asset overrides, and appearance (profiles + settings) with the contents of this file.',
  mergeProfile:
    'Adds the named profile (new id if that id already exists) and merges any bundled palette overrides. Does not change global appearance settings or active profile.',
  mergePalette:
    'Merges palette overrides from this file into this instance’s theme registry (existing keys are updated; others are kept).',
};

const AdminThemesPanel = () => {
  const { user } = useSupabaseAuth();
  const appearanceUserId = resolveTaliaAppearanceUserId(user);

  const [dbThemes, setDbThemes] = useState({});
  const [dbAssets, setDbAssets] = useState({});
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [globalProfiles, setGlobalProfiles] = useState([]);
  const [userProfiles, setUserProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [editorLabel, setEditorLabel] = useState('');
  const [importPaste, setImportPaste] = useState('');
  /** Short status line while a JSON import is running (read → validate → save → reload). */
  const [importPhase, setImportPhase] = useState('');
  /** Parsed pack waiting for in-page confirmation (replaces window.confirm). */
  const [importReview, setImportReview] = useState(null);
  const [deleteReview, setDeleteReview] = useState(null);

  const mergedPalettes = useMemo(() => mergeTaliaUiThemesFromDb(TALIA_UI_THEMES, dbThemes), [dbThemes]);

  const profiles = useMemo(
    () => mergeProfileBuckets(globalProfiles, userProfiles),
    [globalProfiles, userProfiles]
  );

  const unifiedRows = useMemo(() => {
    const paletteKeys = orderedPaletteKeys(dbThemes);
    const profileRows = profiles.map((p) => ({
      rowKey: rowKeyProfile(p.id),
      styleId: p.id,
      displayName: p.name,
      origin: 'Named profile',
    }));
    const paletteRows = paletteKeys.map((key) => ({
      rowKey: rowKeyPalette(key),
      styleId: key,
      displayName: mergedPalettes[key]?.label || key,
      origin: TALIA_UI_THEME_KEYS.includes(key) ? 'Built-in palette' : 'Registry palette',
    }));
    return [...profileRows, ...paletteRows];
  }, [profiles, dbThemes, mergedPalettes]);

  /** Tabulator row id + same fields as catalogue columns. */
  const catalogueTableRows = useMemo(
    () => unifiedRows.map((r) => ({ ...r, id: r.rowKey })),
    [unifiedRows]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const bucketVariables =
      appearanceUserId != null && String(appearanceUserId).trim() !== ''
        ? { userId: String(appearanceUserId) }
        : {};
    try {
      const [registryData, bucketsData] = await Promise.all([
        trackedFetchGraphql({
          query: TALIA_UI_THEME_REGISTRY_QUERY,
          component: 'AdminThemesPanel',
          purpose: 'Load Talia UI theme registry for admin',
          tableName: 'config_setting',
        }),
        trackedFetchGraphql({
          query: APPEARANCE_PROFILE_BUCKETS_QUERY,
          variables: bucketVariables,
          component: 'AdminThemesPanel',
          purpose: 'Load appearance profile buckets (global + user) for admin',
          tableName: 'config_setting',
        }),
      ]);
      const reg = registryData?.taliaUiThemeRegistry;
      setDbThemes(cloneThemes(reg?.themes));
      setDbAssets(
        reg?.assets && typeof reg.assets === 'object' && !Array.isArray(reg.assets) ? { ...reg.assets } : {}
      );
      const payload = bucketsData?.appearanceProfileBuckets;
      setActiveProfileId(
        typeof payload?.activeProfileId === 'string' && payload.activeProfileId.trim() !== ''
          ? payload.activeProfileId.trim()
          : null
      );
      setGlobalProfiles(normalizeProfiles(payload?.globalProfiles || []));
      setUserProfiles(normalizeProfiles(payload?.userProfiles || []));
    } catch (e) {
      setError(e?.message || 'Failed to load themes and profiles');
    } finally {
      setLoading(false);
    }
  }, [appearanceUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!unifiedRows.length) {
      setSelectedRowKey(null);
      return;
    }
    setSelectedRowKey((prev) =>
      prev && unifiedRows.some((r) => r.rowKey === prev) ? prev : unifiedRows[0].rowKey
    );
  }, [unifiedRows]);

  useEffect(() => {
    if (!selectedRowKey) {
      setEditorLabel('');
      return;
    }
    const row = unifiedRows.find((r) => r.rowKey === selectedRowKey);
    setEditorLabel(row?.displayName || '');
  }, [selectedRowKey, unifiedRows]);

  const persistPalettes = async (nextThemes, nextAssets) => {
    const assetsPayload = nextAssets !== undefined ? nextAssets : dbAssets;
    const data = await trackedFetchGraphql({
      query: SAVE_TALIA_UI_THEME_REGISTRY_MUTATION,
      variables: { themes: nextThemes, assets: assetsPayload },
      component: 'AdminThemesPanel',
      purpose: 'Save Talia UI theme registry from admin',
      tableName: 'config_setting',
    });
    const saved = data?.saveTaliaUiThemeRegistry;
    setDbThemes(cloneThemes(saved?.themes != null ? saved.themes : nextThemes));
    setDbAssets(
      saved?.assets && typeof saved.assets === 'object' && !Array.isArray(saved.assets)
        ? { ...saved.assets }
        : typeof assetsPayload === 'object' && !Array.isArray(assetsPayload)
          ? { ...assetsPayload }
          : {}
    );
    window.dispatchEvent(new CustomEvent(TALIA_UI_THEME_REGISTRY_UPDATED_EVENT));
  };

  const saveProfileBuckets = useCallback(
    async (nextGlobal, nextUser) => {
      const normG = normalizeProfiles(nextGlobal);
      const normU = normalizeProfiles(nextUser);
      const dataG = await trackedFetchGraphql({
        query: SAVE_APPEARANCE_PROFILES_MUTATION,
        variables: { profiles: normG, userId: null },
        component: 'AdminThemesPanel',
        purpose: 'Save global appearance profiles from admin',
        tableName: 'config_setting',
      });
      const savedG = dataG?.saveAppearanceProfiles;
      setGlobalProfiles(normalizeProfiles(Array.isArray(savedG) ? savedG : normG));

      const uid =
        appearanceUserId != null && String(appearanceUserId).trim() !== ''
          ? String(appearanceUserId)
          : null;
      if (uid) {
        const dataU = await trackedFetchGraphql({
          query: SAVE_APPEARANCE_PROFILES_MUTATION,
          variables: { profiles: normU, userId: uid },
          component: 'AdminThemesPanel',
          purpose: 'Save per-user appearance profiles from admin',
          tableName: 'config_setting',
        });
        const savedU = dataU?.saveAppearanceProfiles;
        setUserProfiles(normalizeProfiles(Array.isArray(savedU) ? savedU : normU));
      } else {
        setUserProfiles([]);
      }
      window.dispatchEvent(new CustomEvent(TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT));
    },
    [appearanceUserId]
  );

  const persistAppearanceSettings = async (nextSettings, nextActiveId) => {
    const data = await trackedFetchGraphql({
      query: SAVE_APPEARANCE_SETTINGS_MUTATION,
      variables: {
        settings: nextSettings && typeof nextSettings === 'object' ? nextSettings : {},
        activeProfileId: nextActiveId !== undefined ? nextActiveId : activeProfileId,
        userId: appearanceUserId ?? null,
      },
      component: 'AdminThemesPanel',
      purpose: 'Save appearance settings from admin (export/import)',
      tableName: 'config_setting',
    });
    const saved = data?.saveAppearanceSettings;
    if (saved?.activeProfileId !== undefined) {
      setActiveProfileId(
        typeof saved.activeProfileId === 'string' && saved.activeProfileId.trim() !== ''
          ? saved.activeProfileId.trim()
          : null
      );
    }
    window.dispatchEvent(new CustomEvent(TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT));
  };

  const importFileRef = useRef(null);
  const catalogueTableElRef = useRef(null);
  const catalogueTableRef = useRef(null);
  const selectedRowKeyRef = useRef(null);

  useEffect(() => {
    selectedRowKeyRef.current = selectedRowKey;
  }, [selectedRowKey]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!catalogueTableElRef.current || catalogueTableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !Tabulator || !catalogueTableElRef.current) return;

      catalogueTableRef.current = new Tabulator(catalogueTableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: 1,
          height: '100%',
          data: [],
          columns: [
            { title: 'Style id', field: 'styleId', headerFilter: 'input', minWidth: 140 },
            { title: 'Display name', field: 'displayName', headerFilter: 'input' },
            {
              title: 'Kind',
              field: 'origin',
              width: 170,
              headerFilter: 'list',
              headerFilterParams: { valuesLookup: true, clearable: true },
            },
          ],
        }),
      });

      catalogueTableRef.current.on('rowClick', (_, row) => {
        const data = row.getData();
        if (data?.rowKey) setSelectedRowKey(data.rowKey);
      });

      catalogueTableRef.current.on('dataLoaded', () => {
        const t = catalogueTableRef.current;
        const key = selectedRowKeyRef.current;
        if (!t) return;
        requestAnimationFrame(() => {
          if (!key) {
            try {
              t.deselectRow();
            } catch {
              /* no-op */
            }
            return;
          }
          const hit = t.getRows().find((r) => r.getData()?.rowKey === key);
          if (hit) t.selectRow(hit);
        });
      });
    };
    init();
    return () => {
      cancelled = true;
      if (catalogueTableRef.current) {
        try {
          catalogueTableRef.current.destroy();
        } catch {
          /* no-op */
        }
        catalogueTableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!catalogueTableRef.current) return;
    catalogueTableRef.current.setData(catalogueTableRows || []);
    requestAnimationFrame(() => catalogueTableRef.current?.redraw?.(true));
  }, [catalogueTableRows]);

  const appendMergedProfile = (existingMergedList, importedProfile) => {
    const normalized = normalizeProfiles([importedProfile]);
    const base = normalized[0];
    if (!base) return { merged: existingMergedList, added: null };
    let next = { ...base };
    if (existingMergedList.some((p) => p.id === next.id)) {
      next = { ...next, id: generateAppearanceProfileId() };
    }
    if (existingMergedList.some((p) => p.name === next.name && p.id !== next.id)) {
      next = { ...next, name: `${next.name} (imported)` };
    }
    return { merged: [...existingMergedList, next], added: next };
  };

  const handleExportJson = useCallback(() => {
    setMessage('');
    try {
      const parsed = parseRowKey(selectedRowKey);
      let doc;
      let fileStem = 'theme-export';
      if (parsed?.kind === 'profile') {
        const prof = profiles.find((p) => p.id === parsed.id);
        if (!prof) {
          setMessage('Selected profile not found.');
          return;
        }
        doc = buildAppearanceProfileExportPack({ profile: prof, dbThemes, dbAssets });
        fileStem = `theme-profile-${slugifyExportFilenamePart(prof.name)}`;
      } else if (parsed?.kind === 'palette') {
        const key = parsed.key;
        doc = buildRegistryPaletteExportPack({
          themeKey: key,
          mergedTheme: mergedPalettes[key],
          dbThemes,
          dbAssets,
        });
        fileStem = `theme-palette-${slugifyExportFilenamePart(mergedPalettes[key]?.label || key)}`;
      } else {
        setMessage('Select a profile or palette row in the catalogue, then export.');
        return;
      }
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${fileStem}-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Exported selected style — use Load JSON on another instance (import merges; legacy full packs still replace).');
    } catch (e) {
      setMessage(e?.message || 'Export failed');
    }
  }, [dbAssets, dbThemes, mergedPalettes, profiles, selectedRowKey]);

  const handlePickImportFile = useCallback(() => {
    setMessage('');
    setImportPhase('');
    setImportReview(null);
    importFileRef.current?.click();
  }, []);

  /** Apply a validated plan (after in-page confirmation). */
  const executeImportPlan = async (plan, opts = {}) => {
    const { onPhase, sourceLabel } = opts;
    const { importMode, pack, themesIn, assetsIn, profilesIn, settingsIn, activeIn } = plan;

    if (importMode === 'fullReplace') {
      onPhase?.('Saving theme registry and appearance…');
      await persistPalettes(cloneThemes(themesIn), { ...assetsIn });
      await saveProfileBuckets(normalizeProfiles(profilesIn), []);
      await persistAppearanceSettings(settingsIn, activeIn);
    } else if (importMode === 'mergeProfile') {
      const hasRegistryPatch = Object.keys(themesIn).length > 0 || Object.keys(assetsIn).length > 0;
      if (hasRegistryPatch) {
        onPhase?.('Merging palette overrides into this instance…');
        await persistPalettes(
          { ...cloneThemes(dbThemes), ...cloneThemes(themesIn) },
          { ...dbAssets, ...assetsIn }
        );
      }
      onPhase?.('Saving named profiles…');
      const incoming = pack.profile;
      const mergedBefore = mergeProfileBuckets(globalProfiles, userProfiles);
      const { added } = appendMergedProfile(mergedBefore, incoming);
      if (!added) {
        throw new Error('Import pack had no profile to merge.');
      }
      await saveProfileBuckets(globalProfiles, [...userProfiles, added]);
    } else if (importMode === 'mergePalette') {
      onPhase?.('Merging palette into theme registry…');
      await persistPalettes(
        { ...cloneThemes(dbThemes), ...cloneThemes(themesIn) },
        { ...dbAssets, ...assetsIn }
      );
    }

    onPhase?.('Refreshing catalogue…');
    await load();
    onPhase?.('');
    const doneDetail = sourceLabel ? ` (${sourceLabel})` : '';
    setMessage(`Import complete${doneDetail}. Reload the app or open Style to verify.`);
  };

  const handleCancelImport = useCallback(() => {
    setImportReview(null);
    setImportPhase('');
    setMessage('');
  }, []);

  const handleConfirmImport = async () => {
    if (!importReview) return;
    setSaveBusy(true);
    setMessage('');
    try {
      await executeImportPlan(importReview.plan, {
        onPhase: setImportPhase,
        sourceLabel: importReview.sourceLabel,
      });
      setImportReview(null);
      setImportPaste('');
    } catch (e) {
      setImportPhase('');
      setMessage(enhanceConfigSaveError(e?.message || 'Import failed'));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSaveBusy(true);
    setMessage('');
    setImportReview(null);
    setImportPhase('Reading file…');
    try {
      const text = await file.text();
      setImportPhase('Parsing JSON…');
      let raw;
      try {
        raw = parseThemePackJsonFileText(text);
      } catch (e) {
        setImportPhase('');
        setMessage(
          e?.message === 'File is empty.'
            ? 'That file is empty — choose the JSON you exported from Admin → Themes.'
            : `Invalid JSON (${e?.message || 'parse error'}). Save as UTF-8, one top-level object, root key "${THEME_EXPORT_ROOT_KEY}".`
        );
        return;
      }
      const built = buildImportPlan(raw);
      if (!built.ok) {
        setImportPhase('');
        setMessage(built.error);
        return;
      }
      setImportReview({ plan: built.plan, sourceLabel: file.name });
      setImportPhase(`Validated — ${built.plan.humanKind}. Review below, then Apply import.`);
    } catch (e) {
      setImportPhase('');
      setMessage(enhanceConfigSaveError(e?.message || 'Import failed'));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleApplyPasteImport = async () => {
    const trimmed = importPaste.trim();
    if (!trimmed) {
      setMessage('Paste JSON into the box first.');
      return;
    }
    setMessage('');
    setImportReview(null);
    setImportPhase('Parsing pasted JSON…');
    try {
      let raw;
      try {
        raw = parseThemePackJsonFileText(trimmed);
      } catch (e) {
        setImportPhase('');
        setMessage(
          e?.message === 'File is empty.'
            ? 'Paste is empty.'
            : `Invalid JSON (${e?.message || 'parse error'}). Root key "${THEME_EXPORT_ROOT_KEY}" required.`
        );
        return;
      }
      const built = buildImportPlan(raw);
      if (!built.ok) {
        setImportPhase('');
        setMessage(built.error);
        return;
      }
      setImportReview({ plan: built.plan, sourceLabel: 'Pasted JSON' });
      setImportPhase(`Validated — ${built.plan.humanKind}. Review below, then Apply import.`);
    } catch (e) {
      setImportPhase('');
      setMessage(enhanceConfigSaveError(e?.message || 'Import failed'));
    }
  };

  const handleSaveLabel = async () => {
    const parsed = parseRowKey(selectedRowKey);
    if (!parsed) return;
    const trimmed = editorLabel.trim();
    if (!trimmed) {
      setMessage('Display name cannot be empty.');
      return;
    }
    setSaveBusy(true);
    setMessage('');
    try {
      if (parsed.kind === 'profile') {
        const now = new Date().toISOString();
        const inUser = userProfiles.some((p) => p.id === parsed.id);
        if (inUser) {
          await saveProfileBuckets(
            globalProfiles,
            userProfiles.map((p) =>
              p.id === parsed.id ? { ...p, name: trimmed, updatedAt: now } : p
            )
          );
        } else {
          await saveProfileBuckets(
            globalProfiles.map((p) =>
              p.id === parsed.id ? { ...p, name: trimmed, updatedAt: now } : p
            ),
            userProfiles
          );
        }
        setMessage('Saved.');
      } else {
        const next = cloneThemes(dbThemes);
        const prevPatch =
          next[parsed.key] && typeof next[parsed.key] === 'object' && !Array.isArray(next[parsed.key])
            ? next[parsed.key]
            : {};
        next[parsed.key] = { ...prevPatch, label: trimmed };
        await persistPalettes(next);
      }
      setMessage('Saved.');
    } catch (e) {
      setMessage(enhanceConfigSaveError(e?.message || 'Save failed'));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleRemoveClick = () => {
    const parsed = parseRowKey(selectedRowKey);
    if (!parsed) return;

    if (parsed.kind === 'profile') {
      const row = profiles.find((p) => p.id === parsed.id);
      const nm = row?.name || parsed.id;
      setDeleteReview({
        kind: 'profile',
        id: parsed.id,
        name: nm,
        detail: 'Users lose this preset from the Style list.',
      });
      return;
    }

    const key = parsed.key;
    const isBuiltIn = TALIA_UI_THEME_KEYS.includes(key);
    setDeleteReview({
      kind: 'palette',
      key,
      isBuiltIn,
      detail: isBuiltIn
        ? 'The default name and colours return.'
        : 'Saved appearances that reference this id may fall back.',
    });
  };

  const handleCancelDelete = useCallback(() => {
    setDeleteReview(null);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteReview) return;
    setSaveBusy(true);
    setMessage('');
    try {
      if (deleteReview.kind === 'profile') {
        const nextGlobal = globalProfiles.filter((p) => p.id !== deleteReview.id);
        const nextUser = userProfiles.filter((p) => p.id !== deleteReview.id);
        await saveProfileBuckets(nextGlobal, nextUser);
        setMessage('Profile removed.');
        await load();
      } else {
        const key = deleteReview.key;
        if (!dbThemes[key]) {
          setMessage(
            deleteReview.isBuiltIn
              ? 'This built-in palette has no saved row in the theme registry on this instance — the list already matches app defaults; nothing was removed from the database.'
              : 'That palette id is not present in the saved registry (nothing to delete).'
          );
          setDeleteReview(null);
          return;
        }
        const next = cloneThemes(dbThemes);
        delete next[key];
        await persistPalettes(next);
        setMessage('Registry updated.');
        await load();
      }
      setDeleteReview(null);
    } catch (e) {
      setMessage(enhanceConfigSaveError(e?.message || 'Delete failed'));
    } finally {
      setSaveBusy(false);
    }
  };

  const selectedParsed = parseRowKey(selectedRowKey);
  const removeButtonLabel =
    selectedParsed?.kind === 'profile'
      ? 'Delete profile…'
      : selectedParsed?.kind === 'palette' && TALIA_UI_THEME_KEYS.includes(selectedParsed.key)
        ? 'Remove registry override…'
        : 'Delete registry palette…';

  return (
    <div className="admin-access">
      <div className="admin-access__top">
        <div className="admin-access__intro">
          <h2 className="admin-access__title">Themes Management</h2>
          <p className="admin-access__subtitle">
            Same catalogue as the header / sidebar <strong>Style</strong> menu: named <strong>appearance profiles</strong>{' '}
            first, then <strong>palette</strong> (registry) themes. Export / Load JSON to move items between instances
            (root key <code>{THEME_EXPORT_ROOT_KEY}</code>). See <code>talia-ui/docs/TALIA_UI_GLOSSARY.md</code> for
            naming. Select a row in the catalogue, then edit or import.
          </p>
        </div>
        <div className="admin-access__create">
          <button type="button" className="talia-btn talia-btn--primary" onClick={() => load()} disabled={loading || saveBusy}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
          <button
            type="button"
            className="talia-btn"
            onClick={handleExportJson}
            disabled={loading || saveBusy || !!error}
            title="Export the selected profile or palette row as JSON"
          >
            Export JSON…
          </button>
          <button
            type="button"
            className="talia-btn"
            onClick={handlePickImportFile}
            disabled={loading || saveBusy || !!error}
            title="Apply a JSON pack from another Talia instance"
          >
            Load JSON…
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="talia-sr-only"
            aria-label="Import theme pack JSON file"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {!loading && !error ? (
        <div className="admin-access__themes-paste">
          <details className="admin-access__window-toggle">
            <summary className="admin-access__hint">Paste JSON instead of file (same validation as Load JSON…)</summary>
            <div className="admin-access__field">
              <textarea
                className="admin-access__textarea"
                rows={5}
                spellCheck={false}
                aria-label="Theme pack JSON to import"
                placeholder='{ "ThemeExport": { … } }'
                value={importPaste}
                onChange={(e) => setImportPaste(e.target.value)}
                disabled={saveBusy}
              />
              <div className="admin-access__actions">
                <button
                  type="button"
                  className="talia-btn talia-btn--primary"
                  onClick={handleApplyPasteImport}
                  disabled={loading || saveBusy}
                >
                  Apply pasted JSON…
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      <div className="admin-access__status" role="status" aria-live="polite" aria-busy={!!importPhase || saveBusy}>
        {loading ? <span className="admin-access__loading">Loading profiles and theme registry…</span> : null}
        {importPhase ? (
          <div className="admin-access__import-phase" role="status">
            <strong>Import progress</strong> — {importPhase}
          </div>
        ) : null}
        {message ? <span className="admin-access__message">{message}</span> : null}
        {!message && error ? <span className="admin-access__error">Themes error: {error}</span> : null}
      </div>

      <div className="admin-access__main-fill">
        <div className="admin-access__grid">
          <section className="admin-access__panel">
            <header className="admin-access__panel-header">
              <h3>Style catalogue</h3>
            </header>
            <div className="admin-access__table" ref={catalogueTableElRef} />
          </section>

          <section className="admin-access__panel admin-access__panel--editor">
            <header className="admin-access__panel-header">
              <h3>Selected style editor</h3>
            </header>
            {!selectedRowKey ? (
              <div className="admin-access__empty">Select a style from the catalogue.</div>
            ) : (
              <div className="admin-access__form">
                <label className="admin-access__field">
                  <span>Style id</span>
                  <input
                    className="admin-access__input"
                    readOnly
                    value={unifiedRows.find((r) => r.rowKey === selectedRowKey)?.styleId || ''}
                  />
                </label>
                <label className="admin-access__field">
                  <span>Display name</span>
                  <input
                    className="admin-access__input"
                    value={editorLabel}
                    onChange={(event) => setEditorLabel(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <p className="admin-access__hint">
                  {selectedParsed?.kind === 'profile'
                    ? 'Profiles are saved in appearance settings (same as “Save As New” in the sidebar). Renaming updates the Style list for everyone in this config scope.'
                    : 'Palette rows live in the Talia UI theme registry (colours / gradients). Renaming only changes the menu label unless you remove overrides.'}
                </p>
                {deleteReview ? (
                  <div className="admin-access__delete-review" role="region" aria-label="Confirm delete">
                    <p className="admin-access__delete-review-lead">
                      <strong>
                        {deleteReview.kind === 'profile'
                          ? `Delete named profile “${deleteReview.name}”?`
                          : deleteReview.isBuiltIn
                            ? `Remove all registry overrides for palette “${deleteReview.key}”?`
                            : `Permanently delete registry palette “${deleteReview.key}”?`}
                      </strong>
                    </p>
                    <p className="admin-access__hint">{deleteReview.detail}</p>
                    <div className="admin-access__actions">
                      <button type="button" className="talia-btn" onClick={handleCancelDelete} disabled={saveBusy}>
                        Cancel
                      </button>
                      <button type="button" className="talia-btn" onClick={handleConfirmDelete} disabled={saveBusy}>
                        {saveBusy ? 'Deleting…' : 'Confirm delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-access__actions">
                    <button
                      type="button"
                      className="talia-btn talia-btn--primary"
                      onClick={handleSaveLabel}
                      disabled={saveBusy}
                    >
                      {saveBusy ? 'Saving…' : 'Save display name'}
                    </button>
                    <button type="button" className="talia-btn" onClick={handleRemoveClick} disabled={saveBusy}>
                      {removeButtonLabel}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {importReview ? (
            <section className="admin-access__panel admin-access__panel--full">
              <header className="admin-access__panel-header">
                <h3>Confirm import</h3>
              </header>
              <div className="admin-access__panel-body">
                <div className="admin-access__import-review" role="region" aria-label="Confirm theme import">
                  <dl className="admin-access__import-review-dl">
                    <div>
                      <dt>Source</dt>
                      <dd>{importReview.sourceLabel}</dd>
                    </div>
                    <div>
                      <dt>Action</dt>
                      <dd>{importReview.plan.modeLabel}</dd>
                    </div>
                    <div>
                      <dt>Detected</dt>
                      <dd>{importReview.plan.humanKind}</dd>
                    </div>
                  </dl>
                  <p className="admin-access__hint admin-access__import-review-detail">
                    {IMPORT_REVIEW_COPY[importReview.plan.importMode]}
                  </p>
                  <div className="admin-access__actions admin-access__import-review-actions">
                    <button type="button" className="talia-btn" onClick={handleCancelImport} disabled={saveBusy}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="talia-btn talia-btn--primary"
                      onClick={handleConfirmImport}
                      disabled={saveBusy}
                    >
                      {saveBusy ? 'Applying…' : 'Apply import'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

    </div>
  );
};

export default AdminThemesPanel;
