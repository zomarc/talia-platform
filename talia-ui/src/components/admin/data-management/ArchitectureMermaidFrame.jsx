/**
 * Mermaid host with zoom / fit.
 * Sizing is width-based (no transform scale): Mermaid SVGs ship with
 * width="100%" + inline max-width, so we force full container width and
 * let zoom change the wrapper width percentage.
 */

import React, { useEffect, useState } from 'react';
import MermaidDiagram from '../../focus-panels/DocumentRepository/MermaidDiagram';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export default function ArchitectureMermaidFrame({
  source,
  diagramRef = null,
  maximized = false,
}) {
  const [zoom, setZoom] = useState(1);

  const clamp = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  // Re-fit whenever the diagram source or maximize state changes.
  useEffect(() => {
    setZoom(1);
  }, [source, maximized]);

  return (
    <div
      className={`dm-arch-mermaid-frame${maximized ? ' dm-arch-mermaid-frame--maximized' : ''}`}
      ref={diagramRef}
    >
      <div className="dm-arch-mermaid-frame__toolbar" role="toolbar" aria-label="Diagram zoom">
        <button
          type="button"
          className="admin-button admin-button--secondary dm-arch-mermaid-frame__btn"
          onClick={() => setZoom((z) => clamp(Number((z - ZOOM_STEP).toFixed(3))))}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out"
        >
          −
        </button>
        <span className="dm-arch-mermaid-frame__zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="admin-button admin-button--secondary dm-arch-mermaid-frame__btn"
          onClick={() => setZoom((z) => clamp(Number((z + ZOOM_STEP).toFixed(3))))}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          onClick={() => setZoom(1)}
          title="Fit diagram to panel width"
        >
          Fit width
        </button>
        <button
          type="button"
          className="admin-button admin-button--secondary"
          onClick={() => setZoom(1.5)}
          title="Larger diagram (150%)"
        >
          150%
        </button>
      </div>
      <div className="dm-arch-mermaid-frame__viewport">
        <div
          className="dm-arch-mermaid-frame__scaler"
          style={{ width: `${Math.round(zoom * 100)}%` }}
        >
          <MermaidDiagram source={source} />
        </div>
      </div>
    </div>
  );
}
