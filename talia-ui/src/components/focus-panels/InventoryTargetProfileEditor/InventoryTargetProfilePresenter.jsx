/**
 * Presenter: create/edit nested LF target profiles (voyage → market_group → market).
 */

import React, { useState } from 'react';

const emptyDraft = () => ({
  id: null,
  name: 'Commercial plan',
  perspective: 'commercial',
  description: '',
  nodes: [
    {
      tempKey: 'voyage',
      dimensionLevel: 'voyage',
      dimensionKey: 'TOTAL',
      lfPct: 85,
      pointOrder: 0,
    },
  ],
});

const InventoryTargetProfilePresenter = ({
  sailCode,
  inventoryItemId,
  profiles = [],
  onSave,
  onDelete,
  onRefresh,
}) => {
  const [draft, setDraft] = useState(emptyDraft());
  const [selectedId, setSelectedId] = useState(null);

  const loadProfile = (profile) => {
    setSelectedId(profile.id);
    setDraft({
      id: profile.id,
      name: profile.name,
      perspective: profile.perspective,
      description: profile.description || '',
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

  const renderTree = (node, depth = 0) => (
    <div key={node.tempKey} className="target-profile-node" style={{ marginLeft: depth * 16 }}>
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
        {node.dimensionLevel !== 'voyage' ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => removeNode(node.tempKey)}
          >
            Remove
          </button>
        ) : null}
      </div>
      {childrenOf(node.tempKey).map((child) => renderTree(child, depth + 1))}
    </div>
  );

  return (
    <div
      className="focus-panel talia-report inventory-target-profile"
      role="region"
      aria-label="Inventory target profiles"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Nested LF Target Profiles</h2>
          <p className="talia-report__subtitle">
            {[sailCode, inventoryItemId ? `item ${inventoryItemId}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </header>

      <div className="talia-callout">
        Multiple named perspectives per voyage (e.g. Finance, Commercial, Stretch). Values are
        load-factor %; edit at any nest level (voyage → market group → market → currency).
        Forecast is deferred.
      </div>

      <div className="talia-report__actions-bar">
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => {
            setSelectedId(null);
            setDraft(emptyDraft());
          }}
        >
          New profile
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--primary"
          onClick={() => onSave?.(draft)}
        >
          Save
        </button>
        {selectedId ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => onDelete?.(selectedId)}
          >
            Delete
          </button>
        ) : null}
      </div>

      <main className="talia-report__content">
        <div className="talia-report-filters">
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
        </div>

        {profiles.length ? (
          <div className="inventory-target-profile__list">
            <h3 className="booking-profile__comparison-title">Saved perspectives</h3>
            <ul>
              {profiles.map((p) => (
                <li key={p.id}>
                  <button type="button" className="talia-btn talia-btn--secondary" onClick={() => loadProfile(p)}>
                    {p.perspective}: {p.name} ({p.nodes?.length || 0} nodes)
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h3 className="booking-profile__comparison-title">Nested LF tree</h3>
        {roots.map((n) => renderTree(n))}
      </main>
    </div>
  );
};

export default InventoryTargetProfilePresenter;
