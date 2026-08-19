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

const InventoryTargetProfilePresenter = ({
  sailCode,
  inventoryItemId,
  profiles = [],
  suggestedDraft = null,
  overlaySeries = null,
  loadError = null,
  onSave,
  onDelete,
  onActivate,
  onRefresh,
  onResuggest,
  onBackfill,
  backfillBusy = false,
  backfillResult = null,
  panelInstanceId,
  panelComponentId,
}) => {
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedId, setSelectedId] = useState(null);
  const [usingSuggestion, setUsingSuggestion] = useState(false);
  const componentKey = panelComponentId || 'inventory-target-profile-editor';
  const { showSnapshot, showDetails, showFilters, showLegends, reportShellClassName } = useReportShellOptions(
    componentKey,
    panelInstanceId
  );

  useEffect(() => {
    if (profiles.length) {
      const active = profiles.find((p) => p.isActive) || profiles[0];
      setSelectedId(active.id);
      setUsingSuggestion(false);
      setDraft({
        id: active.id,
        name: active.name,
        perspective: active.perspective,
        description: active.description || '',
        isActive: Boolean(active.isActive),
        nodes: (active.nodes || []).map((n, idx) => ({
          tempKey: `n${n.id}`,
          parentTempKey: n.parentNodeId ? `n${n.parentNodeId}` : null,
          dimensionLevel: n.dimensionLevel,
          dimensionKey: n.dimensionKey,
          weekLabel: n.weekLabel,
          weeksUntilSailing: n.weeksUntilSailing,
          lfPct: n.lfPct,
          pointOrder: n.pointOrder ?? idx,
        })),
      });
      return;
    }
    setSelectedId(null);
    if (suggestedDraft) {
      setDraft(applySuggestedDraft(suggestedDraft));
      setUsingSuggestion(true);
    } else {
      setDraft(emptyDraft());
      setUsingSuggestion(false);
    }
  }, [sailCode, suggestedDraft, profiles]);

  const loadProfile = (profile) => {
    setSelectedId(profile.id);
    setUsingSuggestion(false);
    setDraft({
      id: profile.id,
      name: profile.name,
      perspective: profile.perspective,
      description: profile.description || '',
      isActive: Boolean(profile.isActive),
      nodes: (profile.nodes || []).map((n, idx) => ({
        tempKey: `n${n.id}`,
        parentTempKey: n.parentNodeId ? `n${n.parentNodeId}` : null,
        dimensionLevel: n.dimensionLevel,
        dimensionKey: n.dimensionKey,
        weekLabel: n.weekLabel,
        weeksUntilSailing: n.weeksUntilSailing,
        lfPct: n.lfPct,
        pointOrder: n.pointOrder ?? idx,
      })),
    });
  };

  const updateNode = (tempKey, patch) => {
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.tempKey === tempKey ? { ...n, ...patch } : n)),
    }));
  };

  const addChild = (parentTempKey, level) => {
    const key = `n${Date.now()}`;
    setDraft((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          tempKey: key,
          parentTempKey,
          dimensionLevel: level,
          dimensionKey: level === 'market_group' ? 'HOME' : 'NEW',
          lfPct: 0,
          pointOrder: prev.nodes.length,
        },
      ],
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

  const roots = draft.nodes.filter((n) => !n.parentTempKey);
  const childrenOf = (tempKey) => draft.nodes.filter((n) => n.parentTempKey === tempKey);
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

  const renderTree = (node) => (
    <div key={node.tempKey} className="target-profile-node">
      <div className="target-profile-node__row">
        <span className="target-profile-node__level">{node.dimensionLevel}</span>
        <input
          className="talia-report-filters__input"
          value={node.dimensionKey}
          onChange={(e) => updateNode(node.tempKey, { dimensionKey: e.target.value })}
          aria-label="Dimension key"
        />
        <input
          type="number"
          className="talia-report-filters__input"
          value={node.lfPct}
          step="0.1"
          onChange={(e) => updateNode(node.tempKey, { lfPct: Number(e.target.value) })}
          aria-label="Load factor percent"
        />
        <span>%</span>
        {node.dimensionLevel === 'voyage' ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => addChild(node.tempKey, 'market_group')}
          >
            + Group
          </button>
        ) : null}
        {node.dimensionLevel === 'market_group' ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => addChild(node.tempKey, 'market')}
          >
            + Market
          </button>
        ) : null}
        {node.dimensionLevel === 'market' ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => addChild(node.tempKey, 'currency')}
          >
            + Currency
          </button>
        ) : null}
        {node.dimensionLevel !== 'voyage' || weekNodes.length > 1 ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => removeNode(node.tempKey)}
          >
            Remove
          </button>
        ) : null}
      </div>
      {childrenOf(node.tempKey).map((child) => renderTree(child))}
    </div>
  );

  const emptyProfiles = !profiles.length;
  const suggestionMeta = draft.suggestionMeta || suggestedDraft?.suggestionMeta || null;

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
            {[sailCode, inventoryItemId ? `item ${inventoryItemId}` : 'new']
              .filter(Boolean)
              .join(' · ')}
          </p>
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
        <label className="talia-report-filters__group talia-report-filters__group--toggle">
          <input
            type="checkbox"
            checked={emptyProfiles ? true : Boolean(draft.isActive)}
            onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
          />
          <span className="talia-report-filters__label">Active on save</span>
        </label>
        {profiles.length ? (
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Saved</span>
            <select
              className="talia-report-filters__input"
              value={selectedId || ''}
              onChange={(e) => {
                const next = profiles.find((p) => String(p.id) === e.target.value);
                if (next) loadProfile(next);
              }}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isActive ? '★ ' : ''}
                  {p.perspective}: {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {emptyProfiles && usingSuggestion && suggestionMeta ? (
        <div className="talia-callout" role="note">
          Suggested target from{' '}
          <strong>
            {suggestionMeta.source === 'model'
              ? `model prior${suggestionMeta.modelSailCode ? ` ${suggestionMeta.modelSailCode}` : ''}`
              : 'current REAL curve'}
          </strong>
          {suggestionMeta.endLfPct != null ? ` · end LF ~${suggestionMeta.endLfPct}%` : ''}.
          Drag amber points to move them. Shift-click adds a week; double-click removes.
          Use Minimise points / Smooth to simplify the curve.
        </div>
      ) : emptyProfiles ? (
        <div className="talia-callout" role="note">
          No target profile yet. Use a suggestion or blank draft, then Create profile. Manager+ to save.
        </div>
      ) : (
        <div className="talia-callout" role="note">
          Drag amber points to move them. Shift-click adds a week; double-click removes.
          Use Minimise points / Smooth to simplify. Manager+ to save.
        </div>
      )}

      {loadError ? (
        <div className="talia-callout" role="note">
          Load note: {loadError.message || String(loadError)}. You can still create a profile.
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
        {emptyProfiles && suggestedDraft ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => {
              setSelectedId(null);
              setDraft(applySuggestedDraft(suggestedDraft));
              setUsingSuggestion(true);
            }}
          >
            Use suggestion
          </button>
        ) : null}
        {emptyProfiles ? (
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
            setSelectedId(null);
            setUsingSuggestion(false);
            setDraft(emptyDraft());
          }}
        >
          Blank profile
        </button>
      </div>

      <div className="talia-report__actions-bar" aria-label="Target profile actions">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          disabled={backfillBusy}
          onClick={() => onBackfill?.({ fromDate: '2026-06-01' })}
        >
          {backfillBusy ? 'Backfilling…' : 'Backfill from Jun 2026'}
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          onClick={() =>
            onSave?.({
              ...draft,
              isActive: emptyProfiles ? true : Boolean(draft.isActive),
            })
          }
        >
          {emptyProfiles ? 'Create profile' : 'Save'}
        </button>
        {selectedId ? (
          <>
            <button
              type="button"
              className="talia-btn talia-btn--secondary"
              onClick={() => onActivate?.(selectedId)}
            >
              Set active
            </button>
            <button
              type="button"
              className="talia-btn talia-btn--secondary"
              onClick={() => onDelete?.(selectedId)}
            >
              Delete
            </button>
          </>
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
          <h3 className="booking-profile__section-title">Nested dimensions</h3>
          {(() => {
            const voyageRoot =
              roots.find((n) => n.dimensionLevel === 'voyage' && childrenOf(n.tempKey).length) ||
              roots.find((n) => n.dimensionLevel === 'voyage') ||
              roots[0];
            return voyageRoot ? renderTree(voyageRoot) : null;
          })()}
        </ReportDataDetails>
      </main>
    </div>
  );
};

export default InventoryTargetProfilePresenter;
