/**
 * Admin Styles / themes: same sources as the header & sidebar Style control —
 * named appearance profiles first, then palette themes (built-ins + DB registry).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import {
  APPEARANCE_SETTINGS_QUERY,
  SAVE_APPEARANCE_PROFILES_MUTATION,
  TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT,
} from '../../../graphql/taliaAppearanceOperations';
import {
  SAVE_TALIA_UI_THEME_REGISTRY_MUTATION,
  TALIA_UI_THEME_REGISTRY_QUERY,
  TALIA_UI_THEME_REGISTRY_UPDATED_EVENT,
} from '../../../graphql/taliaUiThemeRegistryOperations';
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

const orderedPaletteKeys = (dbThemes) => {
  const merged = mergeTaliaUiThemesFromDb(TALIA_UI_THEMES, dbThemes);
  const keys = Object.keys(merged);
  const ordered = [...TALIA_UI_THEME_KEYS];
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
};

const AdminThemesPanel = () => {
  const { user } = useSupabaseAuth();
  const appearanceUserId = resolveTaliaAppearanceUserId(user);

  const [dbThemes, setDbThemes] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [editorLabel, setEditorLabel] = useState('');

  const mergedPalettes = useMemo(() => mergeTaliaUiThemesFromDb(TALIA_UI_THEMES, dbThemes), [dbThemes]);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const appearanceVariables =
      appearanceUserId != null && String(appearanceUserId).trim() !== ''
        ? { userId: String(appearanceUserId) }
        : {};
    try {
      const [registryData, appearanceData] = await Promise.all([
        trackedFetchGraphql({
          query: TALIA_UI_THEME_REGISTRY_QUERY,
          component: 'AdminThemesPanel',
          purpose: 'Load Talia UI theme registry for admin',
          tableName: 'config_setting',
        }),
        trackedFetchGraphql({
          query: APPEARANCE_SETTINGS_QUERY,
          variables: appearanceVariables,
          component: 'AdminThemesPanel',
          purpose: 'Load appearance profiles for admin (same scope as Style menu)',
          tableName: 'config_setting',
        }),
      ]);
      const reg = registryData?.taliaUiThemeRegistry;
      setDbThemes(cloneThemes(reg?.themes));
      const payload = appearanceData?.appearanceSettings;
      setProfiles(normalizeProfiles(payload?.profiles || []));
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

  const persistPalettes = async (nextThemes) => {
    const data = await trackedFetchGraphql({
      query: SAVE_TALIA_UI_THEME_REGISTRY_MUTATION,
      variables: { themes: nextThemes },
      component: 'AdminThemesPanel',
      purpose: 'Save Talia UI theme registry from admin',
      tableName: 'config_setting',
    });
    const saved = data?.saveTaliaUiThemeRegistry?.themes;
    setDbThemes(cloneThemes(saved != null ? saved : nextThemes));
    window.dispatchEvent(new CustomEvent(TALIA_UI_THEME_REGISTRY_UPDATED_EVENT));
  };

  const persistProfiles = async (nextProfiles) => {
    const data = await trackedFetchGraphql({
      query: SAVE_APPEARANCE_PROFILES_MUTATION,
      variables: { profiles: nextProfiles, userId: appearanceUserId ?? null },
      component: 'AdminThemesPanel',
      purpose: 'Save appearance profiles from admin',
      tableName: 'config_setting',
    });
    const saved = data?.saveAppearanceProfiles;
    setProfiles(normalizeProfiles(Array.isArray(saved) ? saved : nextProfiles));
    window.dispatchEvent(new CustomEvent(TALIA_APPEARANCE_SETTINGS_UPDATED_EVENT));
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
        const next = profiles.map((p) =>
          p.id === parsed.id ? { ...p, name: trimmed, updatedAt: now } : p
        );
        await persistProfiles(next);
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
      setMessage(e?.message || 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleRemove = async () => {
    const parsed = parseRowKey(selectedRowKey);
    if (!parsed) return;

    if (parsed.kind === 'profile') {
      const row = profiles.find((p) => p.id === parsed.id);
      const nm = row?.name || parsed.id;
      if (!window.confirm(`Delete named profile "${nm}"? Users lose this preset from the Style list.`)) return;
      setSaveBusy(true);
      setMessage('');
      try {
        const next = profiles.filter((p) => p.id !== parsed.id);
        await persistProfiles(next);
        setMessage('Saved.');
      } catch (e) {
        setMessage(e?.message || 'Delete failed');
      } finally {
        setSaveBusy(false);
      }
      return;
    }

    const key = parsed.key;
    const isBuiltIn = TALIA_UI_THEME_KEYS.includes(key);
    const confirmText = isBuiltIn
      ? `Remove all registry overrides for palette "${key}"? The default name and colours return.`
      : `Permanently delete registry palette "${key}"? Saved appearances that reference this id may fall back.`;
    if (!window.confirm(confirmText)) return;

    setSaveBusy(true);
    setMessage('');
    try {
      const next = cloneThemes(dbThemes);
      delete next[key];
      await persistPalettes(next);
      setMessage('Saved.');
    } catch (e) {
      setMessage(e?.message || 'Delete failed');
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
            Named profiles and palette themes in one list — same order and sources as the header / sidebar Style
            control. Rename updates menu labels; delete removes a profile or a registry palette entry.
          </p>
        </div>
        <div className="admin-access__create">
          <button type="button" className="talia-btn talia-btn--primary" onClick={() => load()} disabled={loading || saveBusy}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      <div className="admin-access__status" role="status" aria-live="polite">
        {message ? <span className="admin-access__message">{message}</span> : null}
        {!message && error ? <span className="admin-access__error">Error: {error}</span> : null}
      </div>

      <div className="admin-access__main-fill">
        {loading ? (
          <div className="admin-access__loading">Loading profiles and theme registry…</div>
        ) : error ? (
          <div className="admin-access__empty" style={{ padding: 'var(--theme-component-padding-sm)' }}>
            Unable to load themes. See the error message above.
          </div>
        ) : (
          <div className="admin-access__grid">
            <section className="admin-access__panel">
              <header className="admin-access__panel-header">
                <h3>Style Catalogue</h3>
                <span className="admin-access__hint">Profiles first, then palettes — matches the Style menu.</span>
              </header>
              <div className="admin-access__panel-body">
                <table className="admin-access__themes-table">
                  <thead>
                    <tr>
                      <th scope="col">Style id</th>
                      <th scope="col">Display name</th>
                      <th scope="col">Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedRows.map((row) => (
                      <tr
                        key={row.rowKey}
                        onClick={() => setSelectedRowKey(row.rowKey)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedRowKey(row.rowKey);
                          }
                        }}
                        role="row"
                        aria-selected={selectedRowKey === row.rowKey}
                        tabIndex={0}
                      >
                        <td className="admin-access__themes-id">{row.styleId}</td>
                        <td>{row.displayName}</td>
                        <td>{row.origin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-access__panel admin-access__panel--editor">
              <header className="admin-access__panel-header">
                <h3>Selected Style Editor</h3>
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
                  <div className="admin-access__actions">
                    <button
                      type="button"
                      className="talia-btn talia-btn--primary"
                      onClick={handleSaveLabel}
                      disabled={saveBusy}
                    >
                      {saveBusy ? 'Saving…' : 'Save display name'}
                    </button>
                    <button type="button" className="talia-btn" onClick={handleRemove} disabled={saveBusy}>
                      {removeButtonLabel}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminThemesPanel;
