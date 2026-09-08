import React, { useMemo, useState } from 'react';
import { formatDayMonYy } from '../../../lib/dateFormat';
import HoverPreview from '../../shared/HoverPreview';
import { findingSailCode } from './rmChecklistScope';
import { buildChecklistHeatmap } from './rmChecklistHeatmapTransform';

const SEVERITY_LABELS = {
  critical: 'Critical',
  action: 'Action',
  warning: 'Warning',
  warn: 'Warning',
  info: 'Info',
};

const RmChecklistHeatmap = ({
  rows = [],
  selectedSailCode = null,
  selectedFindingId = null,
  onSelectFinding,
}) => {
  const grid = useMemo(() => buildChecklistHeatmap(rows), [rows]);
  const [hover, setHover] = useState(null);

  if (!grid.rows.length || !grid.actions.length) {
    return (
      <div className="rm-checklist-heatmap rm-checklist-heatmap--empty" role="status">
        No dated Findings to plot.
      </div>
    );
  }

  return (
    <div className="rm-checklist-heatmap" role="table" aria-label="RM Checklist heatmap">
      <div
        className="rm-checklist-heatmap__grid"
        style={{ gridTemplateColumns: `minmax(7.5rem, 10rem) repeat(${grid.actions.length}, minmax(4.5rem, 1fr))` }}
      >
        <div className="rm-checklist-heatmap__corner" role="columnheader">Date</div>
        {grid.actions.map((action) => (
          <div key={action.id} className="rm-checklist-heatmap__colhead" role="columnheader">
            {action.label}
          </div>
        ))}
        {grid.rows.map((row) => {
          const rowFocus = selectedSailCode && row.sailCodes.includes(selectedSailCode);
          const rowLabel = row.sailCodes.length === 1
            ? `${formatDayMonYy(row.date, row.date)} · ${row.sailCodes[0]}`
            : `${formatDayMonYy(row.date, row.date)}${row.sailCodes.length > 1 ? ` · ${row.sailCodes.length}` : ''}`;
          return (
            <React.Fragment key={row.date}>
              <div
                className={`rm-checklist-heatmap__rowhead${rowFocus ? ' rm-checklist-heatmap__rowhead--focus' : ''}`}
                role="rowheader"
              >
                {rowLabel}
              </div>
              {row.cells.map((cell) => {
                const isSelected = Boolean(
                  selectedFindingId
                  && cell.findings.some((finding) => finding.findingId === selectedFindingId)
                );
                const isFocus = Boolean(
                  selectedSailCode
                  && cell.sailCodes?.includes(selectedSailCode)
                );
                const severity = cell.severity || 'empty';
                return (
                  <button
                    key={`${row.date}-${cell.action}`}
                    type="button"
                    disabled={cell.empty}
                    className={[
                      'rm-checklist-heatmap__cell',
                      `rm-checklist-heatmap__cell--${severity}`,
                      isSelected ? 'rm-checklist-heatmap__cell--selected' : '',
                      isFocus ? 'rm-checklist-heatmap__cell--focus' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={cell.empty ? `${rowLabel} ${cell.action} empty` : cell.tooltip}
                    onMouseEnter={(event) => {
                      if (cell.empty) {
                        setHover(null);
                        return;
                      }
                      const rect = event.currentTarget.getBoundingClientRect();
                      setHover({ cell, rect });
                    }}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (cell.empty || !cell.primary) return;
                      onSelectFinding?.(cell.primary);
                    }}
                  >
                    {cell.empty ? '' : (cell.count > 1 ? cell.count : (cell.severity?.[0] || '').toUpperCase())}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <ul className="rm-checklist-heatmap__legend" aria-label="Severity legend">
        {['info', 'warning', 'action', 'critical'].map((severity) => (
          <li key={severity}>
            <span className={`rm-checklist-heatmap__swatch rm-checklist-heatmap__cell--${severity}`} />
            {SEVERITY_LABELS[severity]}
          </li>
        ))}
      </ul>

      <HoverPreview
        open={Boolean(hover?.cell)}
        anchorRect={hover?.rect || null}
        placement="right"
        onRequestClose={() => setHover(null)}
      >
        {hover?.cell ? (
          <div className="rm-checklist-heatmap__tip">
            <p className="rm-checklist-heatmap__tip-kicker">
              {hover.cell.sailCodes?.join(' · ') || findingSailCode(hover.cell.primary)}
            </p>
            <p className="rm-checklist-heatmap__tip-title">
              {SEVERITY_LABELS[hover.cell.severity] || hover.cell.severity}
              {' · '}
              {grid.actions.find((action) => action.id === hover.cell.action)?.label || hover.cell.action}
            </p>
            <p className="rm-checklist-heatmap__tip-body">
              {hover.cell.rationale || 'No rationale'}
            </p>
          </div>
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default RmChecklistHeatmap;
