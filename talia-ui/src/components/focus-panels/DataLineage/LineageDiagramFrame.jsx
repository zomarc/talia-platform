/**
 * Zoomable Mermaid host for Data Lineage Display → Diagram.
 * Keeps dependency direction inside focus-panels (does not import admin/).
 */

import React, { useEffect, useRef, useState } from 'react';
import MermaidDiagram from '../DocumentRepository/MermaidDiagram';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

const resolveNodeKey = (rawId) => {
  const raw = String(rawId || '');
  if (!raw) return '';
  return raw
    .replace(/^flowchart-/, '')
    .replace(/-\d+$/, '');
};

const resolveRowIdFromNode = (node, nodeToRowId = {}, labelToRowId = {}) => {
  const rawId = String(node?.id || node?.getAttribute?.('id') || '');
  const cleaned = resolveNodeKey(rawId);
  if (nodeToRowId[rawId]) return nodeToRowId[rawId];
  if (nodeToRowId[cleaned]) return nodeToRowId[cleaned];

  const entries = Object.entries(nodeToRowId || {});
  for (const [key, rowId] of entries) {
    if (!key || !rowId) continue;
    if (cleaned === key || cleaned.endsWith(key) || key.endsWith(cleaned)) return rowId;
  }

  const label = String(node?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (label && labelToRowId[label]) return labelToRowId[label];
  const lower = label.toLowerCase();
  for (const [key, rowId] of Object.entries(labelToRowId || {})) {
    if (String(key).toLowerCase() === lower) return rowId;
  }
  return null;
};

/** HTML strip uses `.talia-chart-legend` so Views / StatusBar Legends toggles apply. */
const LineageDiagramLegend = () => (
  <div className="talia-chart-legend dl-diagram-legend" aria-label="Lineage arrow legend">
    <span className="dl-diagram-legend__item">
      <i className="dl-diagram-legend__edge dl-diagram-legend__edge--hot" aria-hidden="true" />
      High refreshes
    </span>
    <span className="dl-diagram-legend__item">
      <i className="dl-diagram-legend__edge dl-diagram-legend__edge--active" aria-hidden="true" />
      Pipeline (some usage)
    </span>
    <span className="dl-diagram-legend__item">
      <i className="dl-diagram-legend__edge dl-diagram-legend__edge--muted" aria-hidden="true" />
      Zero usage in window
    </span>
    <span className="dl-diagram-legend__item">
      <i className="dl-diagram-legend__edge dl-diagram-legend__edge--logical" aria-hidden="true" />
      Logical link (advisory)
    </span>
  </div>
);

const LineageDiagramFrame = ({
  source,
  nodeToRowId = {},
  labelToRowId = {},
  onNodeSelect,
  frameRef = null,
  showLegends = true,
}) => {
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef(null);
  const nodeToRowIdRef = useRef(nodeToRowId);
  const labelToRowIdRef = useRef(labelToRowId);
  const onNodeSelectRef = useRef(onNodeSelect);
  nodeToRowIdRef.current = nodeToRowId;
  labelToRowIdRef.current = labelToRowId;
  onNodeSelectRef.current = onNodeSelect;

  const clamp = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  useEffect(() => {
    setZoom(1);
  }, [source]);

  // Mermaid `click nodeId taliaLineageNodeClick` callbacks (securityLevel loose).
  useEffect(() => {
    const handler = (nodeId) => {
      const key = resolveNodeKey(nodeId) || String(nodeId || '');
      const map = nodeToRowIdRef.current || {};
      const rowId = map[key]
        || map[nodeId]
        || Object.entries(map).find(([k]) => key === k || key.endsWith(k) || k.endsWith(key))?.[1];
      if (rowId && typeof onNodeSelectRef.current === 'function') {
        onNodeSelectRef.current(rowId);
      }
    };
    window.taliaLineageNodeClick = handler;
    return () => {
      if (window.taliaLineageNodeClick === handler) {
        delete window.taliaLineageNodeClick;
      }
    };
  }, []);

  // DOM fallback if Mermaid click hooks are unavailable.
  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return undefined;

    const onClick = (event) => {
      const node = event.target?.closest?.('g.node');
      if (!node) return;
      const rowId = resolveRowIdFromNode(
        node,
        nodeToRowIdRef.current,
        labelToRowIdRef.current,
      );
      if (rowId && typeof onNodeSelectRef.current === 'function') {
        onNodeSelectRef.current(rowId);
      }
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [source]);

  return (
    <div className="dl-diagram-frame" ref={frameRef}>
      <div className="dl-diagram-frame__toolbar" role="toolbar" aria-label="Lineage diagram zoom">
        <button
          type="button"
          className="talia-btn talia-btn--small talia-btn--secondary"
          onClick={() => setZoom((z) => clamp(Number((z - ZOOM_STEP).toFixed(3))))}
          disabled={zoom <= MIN_ZOOM + 0.001}
          title="Zoom out"
        >
          −
        </button>
        <span className="dl-diagram-frame__zoom">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="talia-btn talia-btn--small talia-btn--secondary"
          onClick={() => setZoom((z) => clamp(Number((z + ZOOM_STEP).toFixed(3))))}
          disabled={zoom >= MAX_ZOOM - 0.001}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--small talia-btn--secondary"
          onClick={() => setZoom(1)}
          title="Fit diagram to panel width"
        >
          Fit width
        </button>
        <button
          type="button"
          className="talia-btn talia-btn--small talia-btn--secondary"
          onClick={() => setZoom(0.5)}
          title="Zoom to 50%"
        >
          50%
        </button>
        {showLegends ? <LineageDiagramLegend /> : null}
      </div>
      <div className="dl-diagram-frame__viewport" ref={viewportRef}>
        <div
          className="dl-diagram-frame__scaler"
          style={{ width: `${Math.round(zoom * 100)}%` }}
        >
          <MermaidDiagram source={source} securityLevel="loose" />
        </div>
      </div>
    </div>
  );
};

export default LineageDiagramFrame;
