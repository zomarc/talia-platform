/**
 * Pure wireframe block renderers — skeleton only, no live data widgets.
 */

import React, { useMemo } from 'react';
import { labelAt } from '../../../lib/placeholderWireframeDoc';

const BAR_HEIGHTS = [42, 68, 55, 78, 48, 72, 38, 64, 58, 80, 45, 70, 52, 66, 40, 74];

const WireTable = ({ rows = 6, cols = 4, columnLabels = [] }) => {
  const gridStyle = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div className="ui-placeholder-wire__table" role="presentation">
      <div className="ui-placeholder-wire__table-head" style={gridStyle}>
        {Array.from({ length: cols }, (_, c) => (
          <span key={`h-${c}`} className="ui-placeholder-wire__col-label">
            {labelAt(columnLabels, c, `Col ${c + 1}`)}
          </span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={`r-${r}`}
          className={`ui-placeholder-wire__table-row${r % 2 ? ' ui-placeholder-wire__table-row--alt' : ''}${r === 1 ? ' ui-placeholder-wire__table-row--selected' : ''}`}
          style={gridStyle}
        >
          {Array.from({ length: cols }, (_, c) => (
            <span key={`c-${r}-${c}`} className="ui-placeholder-wire__bar" />
          ))}
        </div>
      ))}
    </div>
  );
};

const WireCards = ({ cardCount = 3, cardLabels = [] }) => (
  <div className="ui-placeholder-wire__cards" role="presentation">
    {Array.from({ length: cardCount }, (_, i) => (
      <div key={`card-${i}`} className="ui-placeholder-wire__card">
        <span className="ui-placeholder-wire__card-label">
          {labelAt(cardLabels, i, `Card ${i + 1}`)}
        </span>
        <span className="ui-placeholder-wire__bar" />
        <span className="ui-placeholder-wire__bar ui-placeholder-wire__bar--short" />
        <span className="ui-placeholder-wire__metric">Wire</span>
      </div>
    ))}
  </div>
);

const WireList = ({ itemCount = 5 }) => (
  <ul className="ui-placeholder-wire__list" role="presentation">
    {Array.from({ length: itemCount }, (_, i) => (
      <li
        key={`item-${i}`}
        className={`ui-placeholder-wire__list-item${i === 0 ? ' ui-placeholder-wire__list-item--selected' : ''}`}
      >
        <span className="ui-placeholder-wire__glyph" aria-hidden="true" />
        <span className="ui-placeholder-wire__bar" />
        <span className="ui-placeholder-wire__bar ui-placeholder-wire__bar--short" />
      </li>
    ))}
  </ul>
);

const WireBlank = ({ showX, caption }) => (
  <div className={`ui-placeholder-wire__blank${showX ? ' ui-placeholder-wire__blank--x' : ''}`}>
    {showX ? (
      <svg className="ui-placeholder__x" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </svg>
    ) : null}
    {caption ? <p className="ui-placeholder__caption">{caption}</p> : null}
  </div>
);

const WireChart = ({ chartKind = 'bar', points = 6 }) => {
  const n = Math.max(3, Math.min(16, points));
  const heights = useMemo(
    () => Array.from({ length: n }, (_, i) => BAR_HEIGHTS[i % BAR_HEIGHTS.length]),
    [n]
  );

  if (chartKind === 'line') {
    const w = 280;
    const h = 100;
    const padX = 12;
    const padY = 10;
    const step = n <= 1 ? 0 : (w - padX * 2) / (n - 1);
    const coords = heights.map((val, i) => {
      const x = padX + i * step;
      const y = h - padY - (val / 100) * (h - padY * 2);
      return `${x},${y}`;
    });
    const polyline = coords.join(' ');
    return (
      <div className="ui-placeholder-wire__chart" role="presentation" data-kind="line">
        <svg className="ui-placeholder-wire__chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          <line className="ui-placeholder-wire__chart-axis" x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} />
          <line className="ui-placeholder-wire__chart-axis" x1={padX} y1={padY} x2={padX} y2={h - padY} />
          <polyline className="ui-placeholder-wire__chart-line" points={polyline} fill="none" />
          {coords.map((pt, i) => {
            const [x, y] = pt.split(',').map(Number);
            return <circle key={`pt-${i}`} className="ui-placeholder-wire__chart-dot" cx={x} cy={y} r={2.5} />;
          })}
        </svg>
        <span className="ui-placeholder-wire__chart-badge">Line</span>
      </div>
    );
  }

  return (
    <div className="ui-placeholder-wire__chart" role="presentation" data-kind="bar">
      <div className="ui-placeholder-wire__chart-bars">
        {heights.map((val, i) => (
          <span
            key={`bar-${i}`}
            className="ui-placeholder-wire__chart-bar"
            style={{ height: `${val}%` }}
          />
        ))}
      </div>
      <span className="ui-placeholder-wire__chart-badge">Bar</span>
    </div>
  );
};

export const WireframeBlockBody = ({ block, showWireframe }) => {
  if (!block) return null;
  if (block.type === 'table') {
    return (
      <WireTable
        rows={block.rows}
        cols={block.cols}
        columnLabels={block.columnLabels}
      />
    );
  }
  if (block.type === 'cards') {
    return (
      <WireCards
        cardCount={block.cardCount}
        cardLabels={block.cardLabels}
      />
    );
  }
  if (block.type === 'list') {
    return <WireList itemCount={block.itemCount} />;
  }
  if (block.type === 'chart') {
    return <WireChart chartKind={block.chartKind} points={block.points} />;
  }
  return <WireBlank showX={showWireframe !== false} caption={block.title} />;
};

export default WireframeBlockBody;
