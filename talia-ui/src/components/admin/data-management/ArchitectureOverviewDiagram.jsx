/**
 * Layered project architecture board for management.
 * Live status overlays probes from instanceConnectionProfile.
 */

import React, { useState } from 'react';
import HoverPreview from '../../shared/HoverPreview';
import ArchitectureNodeInspector from './ArchitectureNodeInspector.jsx';
import { buildArchitectureOverviewLayers } from './architectureOverviewModel.js';

function flagLabel(state) {
  if (state === 'blocked') return 'Blocked';
  if (state === 'warn') return 'Attention';
  if (state === 'ok') return 'OK';
  if (state === 'unknown') return 'Unknown';
  return null;
}

function NodeButton({ node, onShow, onHide, onOpen }) {
  const flag = flagLabel(node.state);
  return (
    <button
      type="button"
      className={`dm-arch-node dm-arch-node--${node.state}${node.family ? ' dm-arch-node--family' : ''}`}
      aria-label={`${node.title}${flag ? `, ${flag}` : ''}. Double-click for copyable details.`}
      title="Hover for tip · Double-click to open and copy"
      onMouseEnter={(event) => onShow(node, event.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHide}
      onFocus={(event) => onShow(node, event.currentTarget.getBoundingClientRect())}
      onBlur={onHide}
      onDoubleClick={(event) => {
        event.preventDefault();
        onOpen?.(node);
      }}
    >
      <span className="dm-arch-node__title">{node.title}</span>
      <span className="dm-arch-node__blurb">{node.blurb}</span>
      {node.address ? <span className="dm-arch-node__addr">{node.address}</span> : null}
      {flag && node.state !== 'static' ? (
        <span className={`dm-arch-node__flag dm-arch-node__flag--${node.state}`}>{flag}</span>
      ) : null}
    </button>
  );
}

function Layer({ title, children, className = '' }) {
  return (
    <section className={`dm-arch-layer ${className}`.trim()} aria-label={title}>
      <h4 className="dm-arch-layer__title">{title}</h4>
      <div className="dm-arch-layer__nodes">{children}</div>
    </section>
  );
}

function LayerConnector({ label, blocked = false }) {
  return (
    <div
      className={`dm-arch-vconnector${blocked ? ' dm-arch-vconnector--blocked' : ''}`}
      aria-hidden="true"
    >
      <span className="dm-arch-vconnector__line" />
      {label ? <span className="dm-arch-vconnector__label">{label}</span> : null}
      <span className="dm-arch-vconnector__arrow" />
    </div>
  );
}

export default function ArchitectureOverviewDiagram({
  profile,
  networking,
  integrationSettings,
}) {
  const [tip, setTip] = useState(null);
  const [pinned, setPinned] = useState(null);
  const layers = buildArchitectureOverviewLayers({ profile, networking, integrationSettings });
  const pathBlocked = layers.path.some((n) => n.state === 'blocked');

  const showTip = (node, rect) => {
    if (pinned) return;
    if (!rect || !node) {
      setTip(null);
      return;
    }
    setTip({
      rect,
      title: node.title,
      blurb: node.blurb,
      detail: node.detail,
      address: node.address,
      concern: node.concern,
      state: node.state,
    });
  };

  const openPinned = (node) => {
    setTip(null);
    setPinned(node);
  };

  return (
    <div className="dm-arch-diagram" aria-label="Talia architecture overview">
      <p className="dm-arch-diagram__lead">
        How Talia fits together — hover for a tip, double-click a box to open copyable details.
      </p>

      <div className="dm-arch-board">
        <Layer title="People">
          {layers.people.map((node) => (
            <NodeButton
              key={node.id}
              node={node}
              onShow={showTip}
              onHide={() => showTip(null, null)}
              onOpen={openPinned}
            />
          ))}
        </Layer>

        <LayerConnector label="HTTPS" />

        <Layer title="Workspace" className="dm-arch-layer--workspace">
          <div className="dm-arch-workspace">
            <NodeButton
              node={layers.workspace[0]}
              onShow={showTip}
              onHide={() => showTip(null, null)}
              onOpen={openPinned}
            />
            <div className="dm-arch-families" role="group" aria-label="Panel families">
              {layers.workspace.slice(1).map((node) => (
                <NodeButton
                  key={node.id}
                  node={node}
                  onShow={showTip}
                  onHide={() => showTip(null, null)}
                  onOpen={openPinned}
                />
              ))}
            </div>
          </div>
        </Layer>

        <LayerConnector label="GraphQL" />

        <Layer title="Application">
          {layers.application.map((node) => (
            <NodeButton
              key={node.id}
              node={node}
              onShow={showTip}
              onHide={() => showTip(null, null)}
              onOpen={openPinned}
            />
          ))}
        </Layer>

        <LayerConnector label="Reads & sync" blocked={pathBlocked} />

        <div className="dm-arch-split">
          <Layer title="Data" className="dm-arch-layer--data">
            {layers.data.map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                onShow={showTip}
                onHide={() => showTip(null, null)}
                onOpen={openPinned}
              />
            ))}
          </Layer>
          <Layer title="Path to warehouse" className="dm-arch-layer--path">
            {layers.path.map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                onShow={showTip}
                onHide={() => showTip(null, null)}
                onOpen={openPinned}
              />
            ))}
          </Layer>
        </div>

        <p className="dm-arch-diagram__footnote">
          Warehouse sync is one-way into Talia mirrors → canonical inventory_item. Networking detail also lives under Instance &amp; keys.
        </p>
      </div>

      <HoverPreview open={Boolean(tip) && !pinned} anchorRect={tip?.rect || null} placement="bottom">
        {tip ? (
          <div className="dm-arch-diagram__tip">
            <strong>{tip.title}</strong>
            {tip.blurb ? <p>{tip.blurb}</p> : null}
            {tip.detail ? <p>{tip.detail}</p> : null}
            {tip.address ? <p><code>{tip.address}</code></p> : null}
            {tip.concern ? (
              <p className={`dm-arch-diagram__tip-concern dm-arch-diagram__tip-concern--${tip.concern.severity}`}>
                {tip.concern.title}: {tip.concern.detail}
              </p>
            ) : null}
            <p className="dm-arch-diagram__tip-hint">Double-click to open and copy</p>
          </div>
        ) : null}
      </HoverPreview>

      <ArchitectureNodeInspector node={pinned} onClose={() => setPinned(null)} />
    </div>
  );
}
