/**
 * Presenter: define/edit/activate Target Profiles (LF% goals + optional week grid).
 */

import React, { useEffect, useState } from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportSnapshot from '../../shared/ReportSnapshot';
import TargetProfileCurveEditor from './TargetProfileCurveEditor';
import {
  minimiseTargetWaypoints,
  smoothTargetWaypoints,
} from './suggestTargetProfile';

const emptyDraft = () => ({
  id: null,
  name: 'Commercial plan',
  perspective: 'commercial',
  description: '',
  isActive: true,
  nodes: [
    {
      tempKey: 'voyage',
      dimensionLevel: 'voyage',
      dimensionKey: 'TOTAL',
      weeksUntilSailing: 0,
      weekLabel: 'Sail',
      lfPct: 85,
      pointOrder: 0,
    },
  ],
});

const applySuggestedDraft = (suggestion) => {
  if (!suggestion) return emptyDraft();
  const { suggestionMeta, ...rest } = suggestion;
  return {
    ...emptyDraft(),
    ...rest,
    isActive: true,
    nodes: (suggestion.nodes || []).map((n, idx) => ({
      ...n,
      tempKey: n.tempKey || `sug-${idx}`,
      pointOrder: n.pointOrder ?? idx,
    })),
    suggestionMeta,
  };
};

const draftFromProfile = (profile) => ({
  id: profile.id,
  name: profile.name,
  perspective: profile.perspective,
  description: profile.description || '',
  isActive: Boolean(profile.isActive),
  nodes: (profile.nodes || []).map((n, idx) => ({
    tempKey: `n${n.id || idx}`,
    parentTempKey: n.parentNodeId ? `n${n.parentNodeId}` : null,
    dimensionLevel: n.dimensionLevel,
    dimensionKey: n.dimensionKey,
    weekLabel: n.weekLabel,
    weeksUntilSailing: n.weeksUntilSailing,
    lfPct: n.lfPct,
    pointOrder: n.pointOrder ?? idx,
  })),
});

const formatTargetProfileError = (error) => {
  const raw = error?.message || String(error || '');
  if (/23505|one_active|already exists/i.test(raw)) {
    return 'This sailing already has an active target. Assign replaces that profile instead of creating another.';
  }
  const quoted = raw.match(/message:\s*'([^']+)'/);
  return quoted?.[1] || raw;
};

const InventoryTargetProfilePresenter = ({
  mode = 'sailing',
  onModeChange,
  sailCode,
  inventoryItemId,
  profiles = [],
  libraryProfiles = [],
  suggestedDraft = null,
  overlaySeries = null,
  loadError = null,
  onSave,
  onDelete,
  onRefresh,
  onResuggest,
  onCopyFromPeer,
  onBackfill,
  backfillBusy = false,
  backfillResult = null,
  panelInstanceId,
  panelComponentId,
}) => {
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedId, setSelectedId] = useState(null);
  const [usingSuggestion, setUsingSuggestion] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const isLibraryMode = mode === 'library';
  const componentKey = panelComponentId || 'inventory-target-profile-editor';
  const { showSnapshot, showDetails, showFilters, showLegends, reportShellClassName } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );

  useEffect(() => {
    if (isLibraryMode) {
      if (creatingNew) return;
      if (libraryProfiles.length) {
        const current = libraryProfiles.find((p) => String(p.id) === String(selectedId))
          || libraryProfiles[0];
        setSelectedId(current.id);
        setUsingSuggestion(false);
        setDraft({ ...draftFromProfile(current), sourceIsLibrary: false });
        return;
      }
      setSelectedId(null);
      setUsingSuggestion(false);
      setDraft({ ...emptyDraft(), name: 'Standard', sourceIsLibrary: false });
      return;
    }
    if (profiles.length) {
      const active = profiles.find((p) => p.isActive) || profiles[0];
      setSelectedId(active.id);
      setUsingSuggestion(false);
      setDraft({ ...draftFromProfile(active), sourceIsLibrary: false });
      return;
    }
    setSelectedId(null);
    if (suggestedDraft) {
      setDraft({ ...applySuggestedDraft(suggestedDraft), sourceIsLibrary: true });
      setUsingSuggestion(true);
    } else {
      setDraft({ ...emptyDraft(), sourceIsLibrary: true });
      setUsingSuggestion(false);
    }
  }, [creatingNew, isLibraryMode, sailCode, suggestedDraft, profiles, libraryProfiles]);

  const loadProfile = (profile, { fromLibrary = false } = {}) => {
    setCreatingNew(false);
    setSelectedId(profile.id);
    setUsingSuggestion(false);
    setDraft({
      ...draftFromProfile(profile),
      sourceIsLibrary: fromLibrary,
      id: fromLibrary ? null : profile.id,
    });
  };

  const updateNode = (tempKey, patch) => {
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.tempKey === tempKey ? { ...n, ...patch } : n)),
    }));
  };

  const addWeekPoint = (weeksUntilSailing = null, lfPct = 40) => {
    const key = `w${Date.now()}`;
    setDraft((prev) => {
      const existingWeeks = prev.nodes
        .filter((n) => n.dimensionLevel === 'voyage' && n.weeksUntilSailing != null)
        .map((n) => Number(n.weeksUntilSailing) || 0);
      const weeks = weeksUntilSailing != null
        ? Number(weeksUntilSailing)
        : Math.max(0, ...existingWeeks) + 4;
      if (existingWeeks.includes(weeks)) return prev;
      return {
        ...prev,
        nodes: [
          ...prev.nodes,
          {
            tempKey: key,
            parentTempKey: null,
            dimensionLevel: 'voyage',
            dimensionKey: 'TOTAL',
            weeksUntilSailing: weeks,
            weekLabel: weeks === 0 ? 'Sail' : `W-${weeks}`,
            lfPct,
            pointOrder: prev.nodes.length,
          },
        ],
      };
    });
  };

  const removeNode = (tempKey) => {
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.filter(
        (n) => n.tempKey !== tempKey && n.parentTempKey !== tempKey
      ),
    }));
  };

  const weekNodes = draft.nodes
    .filter((n) => n.dimensionLevel === 'voyage' && n.weeksUntilSailing != null)
    .sort((a, b) => Number(b.weeksUntilSailing) - Number(a.weeksUntilSailing));

  const endLf = weekNodes.find((n) => Number(n.weeksUntilSailing) === 0)?.lfPct
    ?? weekNodes[weekNodes.length - 1]?.lfPct
    ?? null;
  const snapshotItems = [
    {
      key: 'name',
      label: 'Profile',
      value: draft.name || '—',
      hint: draft.perspective || '',
    },
    {
      key: 'end-lf',
      label: 'End LF',
      value: endLf != null ? `${Number(endLf).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : '—',
      hint: 'sail week',
    },
    {
      key: 'points',
      label: 'Points',
      value: String(weekNodes.length),
      hint: draft.isActive ? 'active' : 'draft',
    },
  ];

  useEffect(() => {
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        if (!weekNodes.length) return null;
        return {
          title: `Target Profile ${draft.name || sailCode || ''}`.trim(),
          columns: [
            { field: 'weeksUntilSailing', title: 'Weeks to sail' },
            { field: 'weekLabel', title: 'Label' },
            { field: 'lfPct', title: 'LF%' },
          ],
          rows: weekNodes.map((n) => ({
            weeksUntilSailing: n.weeksUntilSailing,
            weekLabel: n.weekLabel,
            lfPct: n.lfPct,
          })),
        };
      },
    });
  }, [componentKey, draft.name, panelInstanceId, sailCode, weekNodes]);

  const emptyProfiles = !profiles.length;
  const suggestionMeta = draft.suggestionMeta || suggestedDraft?.suggestionMeta || null;
  const assigned = profiles.find((p) => p.isActive) || profiles[0] || null;
  const assignedName = assigned?.name ? String(assigned.name).trim() : '';
  const matchingLibrary = libraryProfiles.find(
    (p) => String(p.name || '').trim() === String(draft.name || '').trim()
  );
  const assignValue = usingSuggestion
    ? 'suggested'
    : (draft.sourceIsLibrary && matchingLibrary ? `lib:${matchingLibrary.id}` : 'current');

  return (
    <div
      className={`focus-panel talia-report inventory-target-profile${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Target Profile Editor"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Target Profile Editor</h2>
          <p className="talia-report__subtitle">
            {isLibraryMode
              ? 'Name and edit standard profiles, then assign them to sailings'
              : [sailCode || 'No sailing selected', assignedName ? `assigned · ${assignedName}` : 'no assignment']
                .filter(Boolean)
                .join(' · ')}
          </p>
        </div>
        <div className="inventory-target-profile__modes" aria-label="Editor mode">
          <button
            type="button"
            className={`talia-btn ${!isLibraryMode ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={!isLibraryMode}
            onClick={() => {
              setCreatingNew(false);
              onModeChange?.('sailing');
            }}
          >
            This sailing
          </button>
          <button
            type="button"
            className={`talia-btn ${isLibraryMode ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={isLibraryMode}
            onClick={() => {
              setCreatingNew(false);
              onModeChange?.('library');
            }}
          >
            Library
          </button>
        </div>
      </header>

      <div
        className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Target profile fields"
      >
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Name</span>
          <input
            className="talia-report-filters__input"
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Perspective</span>
          <input
            className="talia-report-filters__input"
            value={draft.perspective}
            onChange={(e) => setDraft((p) => ({ ...p, perspective: e.target.value }))}
            placeholder="commercial | finance | stretch"
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Description</span>
          <input
            className="talia-report-filters__input"
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          />
        </label>
        {isLibraryMode ? (
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Standard</span>
            <select
              className="talia-report-filters__input"
              value={creatingNew ? '' : (selectedId || '')}
              onChange={(e) => {
                const next = libraryProfiles.find((p) => String(p.id) === e.target.value);
                if (next) loadProfile(next);
              }}
            >
              {creatingNew ? <option value="">New standard…</option> : null}
              {libraryProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.name || '').trim()}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Assign</span>
            <select
              className="talia-report-filters__input"
              value={assignValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'suggested' && suggestedDraft) {
                  setSelectedId(null);
                  setUsingSuggestion(true);
                  setDraft({ ...applySuggestedDraft(suggestedDraft), sourceIsLibrary: true });
                  return;
                }
                if (value.startsWith('lib:')) {
                  const next = libraryProfiles.find((p) => `lib:${p.id}` === value);
                  if (next) loadProfile(next, { fromLibrary: true });
                }
              }}
            >
              {assignedName ? <option value="current">{`Current · ${assignedName}`}</option> : null}
              {suggestedDraft ? (
                <option value="suggested">
                  {`Suggested${suggestionMeta?.modelSailCode ? ` · ${suggestionMeta.modelSailCode}` : ''}`}
                </option>
              ) : null}
              {libraryProfiles.length ? (
                <optgroup label="Standards">
                  {libraryProfiles.map((p) => (
                    <option key={`lib-${p.id}`} value={`lib:${p.id}`}>
                      {String(p.name || '').trim()}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        )}
      </div>

      {!isLibraryMode && !sailCode ? (
        <div className="talia-callout" role="note">
          Select a sailing to assign a standard or suggested target.
        </div>
      ) : null}

      {!isLibraryMode && sailCode && emptyProfiles ? (
        <div className="talia-callout" role="note">
          {usingSuggestion && suggestionMeta
            ? `Draft from ${suggestionMeta.source === 'peer-profile' ? 'last-year profile' : suggestionMeta.source === 'model' ? `last year ${suggestionMeta.modelSailCode || ''}`.trim() : 'the booking curve'}${suggestionMeta.endLfPct != null ? ` · end LF ~${suggestionMeta.endLfPct}%` : ''}. Assign to this sailing.`
            : 'No target assigned yet. Choose a standard, use the suggestion, or copy last year.'}
        </div>
      ) : null}

      {isLibraryMode ? (
        <div className="talia-callout" role="note">
          Library profiles are reusable standards. Saving here does not change a sailing until you assign.
        </div>
      ) : null}

      {loadError ? (
        <div className="talia-callout" role="note">
          {formatTargetProfileError(loadError)}
        </div>
      ) : null}

      {backfillResult?.message ? (
        <div className="talia-callout" role="status">
          {backfillResult.message}
          {backfillResult.sampleSailCodes?.length
            ? ` · e.g. ${backfillResult.sampleSailCodes.join(', ')}`
            : ''}
        </div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Target curve actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={() => addWeekPoint()}>
          + Week point
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={weekNodes.length <= 2}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              nodes: minimiseTargetWaypoints(prev.nodes, { maxPoints: 6 }),
            }))
          }
        >
          Minimise points
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={weekNodes.length < 3}
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              nodes: smoothTargetWaypoints(prev.nodes),
            }))
          }
        >
          Smooth
        </button>
        {!isLibraryMode && suggestedDraft ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => {
              setSelectedId(null);
              setDraft({ ...applySuggestedDraft(suggestedDraft), sourceIsLibrary: true });
              setUsingSuggestion(true);
            }}
          >
            Use suggestion
          </button>
        ) : null}
        {!isLibraryMode ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={async () => {
              const next = await onCopyFromPeer?.();
              if (!next) return;
              setSelectedId(null);
              setUsingSuggestion(true);
              setDraft({ ...applySuggestedDraft(next), sourceIsLibrary: true });
            }}
          >
            Copy last year
          </button>
        ) : null}
        {!isLibraryMode && emptyProfiles ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => onResuggest?.()}
          >
            Resuggest
          </button>
        ) : null}
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => {
            setCreatingNew(true);
            setSelectedId(null);
            setUsingSuggestion(false);
            setDraft({
              ...emptyDraft(),
              name: isLibraryMode ? 'Standard' : 'Target',
              sourceIsLibrary: !isLibraryMode,
            });
          }}
        >
          {isLibraryMode ? 'New standard' : 'New blank'}
        </button>
      </div>

      <div className="talia-report__actions-bar" aria-label="Target profile actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
        {isLibraryMode ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            disabled={backfillBusy || !draft.id}
            onClick={() => onBackfill?.({ templateProfileId: draft.id || null })}
          >
            {backfillBusy ? 'Assigning…' : 'Assign this standard to current sailings'}
          </button>
        ) : null}
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          disabled={!isLibraryMode && !sailCode}
          onClick={() =>
            onSave?.(
              {
                ...draft,
                isActive: !isLibraryMode,
              },
              { asLibrary: isLibraryMode }
            )
          }
        >
          {isLibraryMode ? 'Save standard' : 'Assign to sailing'}
        </button>
        {isLibraryMode && selectedId ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => onDelete?.(selectedId)}
          >
            Delete standard
          </button>
        ) : null}
      </div>

      <ReportSnapshot
        title={null}
        ariaLabel="Target profile metrics"
        visible={showSnapshot}
        items={snapshotItems}
      />

      <main className="talia-report__content talia-report__content--scroll">
        <div className="inventory-target-profile__chart-host">
          <TargetProfileCurveEditor
            weekNodes={weekNodes}
            realSeries={overlaySeries?.real || []}
            modelSeries={overlaySeries?.model || []}
            onChangeLf={(tempKey, lfPct) => updateNode(tempKey, { lfPct })}
            onMovePoint={(tempKey, patch) => updateNode(tempKey, patch)}
            onAddPoint={(week, lfPct) => addWeekPoint(week, lfPct)}
            showLegends={showLegends}
          />
        </div>

        <ReportDataDetails visible={showDetails} as="section" aria-label="Target profile details">
          <h3 className="booking-profile__section-title">Week points</h3>
          <table className="talia-report-table">
            <thead>
              <tr>
                <th>Weeks to sail</th>
                <th>Label</th>
                <th>LF%</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weekNodes.map((n) => (
                <tr key={n.tempKey}>
                  <td>
                    <input
                      type="number"
                      className="talia-report-filters__input"
                      value={n.weeksUntilSailing ?? 0}
                      onChange={(e) =>
                        updateNode(n.tempKey, {
                          weeksUntilSailing: Number(e.target.value),
                          weekLabel:
                            Number(e.target.value) === 0
                              ? 'Sail'
                              : `W-${e.target.value}`,
                        })
                      }
                    />
                  </td>
                  <td>{n.weekLabel || '—'}</td>
                  <td>
                    <input
                      type="number"
                      className="talia-report-filters__input"
                      value={n.lfPct}
                      step="0.1"
                      onChange={(e) =>
                        updateNode(n.tempKey, { lfPct: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    {weekNodes.length > 1 ? (
                      <button
                        type="button"
                        className="talia-btn talia-btn--secondary"
                        onClick={() => removeNode(n.tempKey)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default InventoryTargetProfilePresenter;
