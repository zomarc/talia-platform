/**
 * Wireframe ideas canvas — stack of table/cards/list/chart/blank blocks with light editing.
 */

import React, { useMemo } from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { fitLabels } from '../../../lib/placeholderWireframeDoc';
import ReportProvenance from '../../shared/ReportProvenance';
import { WireframeBlockBody } from './wireframeBlocks';
import './placeholder-wireframe.css';

const CountStepper = ({ label, value, min = 1, max = 24, onChange }) => (
  <label className="ui-placeholder__block-stepper">
    <span>{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  </label>
);

const LabelRow = ({ labels, count, prefix, onChange }) => {
  const values = fitLabels(labels, count);
  return (
    <div className="ui-placeholder__label-row talia-report__controls" role="group" aria-label={`${prefix} names`}>
      {values.map((value, index) => (
        <input
          key={`${prefix}-${index}`}
          className="ui-placeholder__label-input"
          type="text"
          value={value}
          maxLength={40}
          placeholder={`${prefix} ${index + 1}`}
          onChange={(event) => {
            const next = [...values];
            next[index] = event.target.value;
            onChange(next);
          }}
          aria-label={`${prefix} ${index + 1} name`}
        />
      ))}
    </div>
  );
};

const BlockChrome = ({
  block,
  index,
  total,
  selected,
  onSelect,
  onChange,
  onMove,
  onRemove,
  onPromoteBlock,
  canPromote,
}) => (
  <div className="ui-placeholder__block-chrome talia-report__controls">
    <button
      type="button"
      className="talia-btn talia-btn--small talia-btn--secondary ui-placeholder__chrome-btn"
      aria-pressed={selected}
      onClick={onSelect}
      title="Select block"
    >
      {index + 1}
    </button>
    <span className="ui-placeholder__block-type">
      {block.type === 'chart' ? `${block.chartKind} chart` : block.type}
    </span>
    <input
      className="ui-placeholder__block-title"
      type="text"
      value={block.title}
      maxLength={80}
      onChange={(event) => onChange({ title: event.target.value })}
      aria-label="Block title"
    />
    {block.type === 'table' ? (
      <>
        <CountStepper label="Rows" value={block.rows} max={24} onChange={(v) => onChange({ rows: v })} />
        <CountStepper
          label="Cols"
          value={block.cols}
          max={12}
          onChange={(v) => onChange({
            cols: v,
            columnLabels: fitLabels(block.columnLabels, Number.parseInt(v, 10) || block.cols),
          })}
        />
      </>
    ) : null}
    {block.type === 'cards' ? (
      <CountStepper
        label="Cards"
        value={block.cardCount}
        max={12}
        onChange={(v) => onChange({
          cardCount: v,
          cardLabels: fitLabels(block.cardLabels, Number.parseInt(v, 10) || block.cardCount),
        })}
      />
    ) : null}
    {block.type === 'list' ? (
      <CountStepper label="Items" value={block.itemCount} max={20} onChange={(v) => onChange({ itemCount: v })} />
    ) : null}
    {block.type === 'chart' ? (
      <>
        <label className="ui-placeholder__block-stepper">
          <span>Kind</span>
          <select
            className="ui-placeholder__kind-select"
            value={block.chartKind || 'bar'}
            onChange={(event) => onChange({ chartKind: event.target.value })}
            aria-label="Chart kind"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
        </label>
        <CountStepper label="Points" value={block.points} min={3} max={16} onChange={(v) => onChange({ points: v })} />
      </>
    ) : null}
    <button
      type="button"
      className="talia-btn talia-btn--small talia-btn--secondary ui-placeholder__chrome-btn"
      disabled={index === 0}
      onClick={() => onMove('up')}
      title="Move up"
      aria-label="Move block up"
    >
      ↑
    </button>
    <button
      type="button"
      className="talia-btn talia-btn--small talia-btn--secondary ui-placeholder__chrome-btn"
      disabled={index >= total - 1}
      onClick={() => onMove('down')}
      title="Move down"
      aria-label="Move block down"
    >
      ↓
    </button>
    <button
      type="button"
      className="talia-btn talia-btn--small talia-btn--secondary ui-placeholder__chrome-btn"
      onClick={onRemove}
      title="Remove block"
      aria-label="Remove block"
    >
      ✕
    </button>
    {canPromote ? (
      <button
        type="button"
        className="talia-btn talia-btn--small talia-btn--secondary ui-placeholder__chrome-btn"
        onClick={onPromoteBlock}
        title="Promote this block to Requirements"
      >
        Promote
      </button>
    ) : null}
    <input
      className="ui-placeholder__block-note"
      type="text"
      value={block.note || ''}
      maxLength={240}
      placeholder="Optional note for requirements…"
      onChange={(event) => onChange({ note: event.target.value })}
      aria-label="Block note"
    />
  </div>
);

const PlaceHolderPresenter = ({
  panelInstanceId = null,
  panelComponentId = null,
  doc,
  selectedBlockId = null,
  showWireframe = true,
  caption = 'Place Holder',
  canPromote = false,
  promoteMessage = null,
  promoting = false,
  onSelectBlock,
  onAddBlock,
  onUpdateBlock,
  onMoveBlock,
  onRemoveBlock,
  onPromotePanel,
  onPromoteBlock,
  showProvenance = false,
}) => {
  const { reportShellClassName, showControls } = useReportShellOptions(
    panelComponentId || 'ui-placeholder',
    panelInstanceId
  );

  const blocks = useMemo(() => (Array.isArray(doc?.blocks) ? doc.blocks : []), [doc]);

  return (
    <article
      className={`focus-panel talia-report ui-placeholder ${reportShellClassName}`}
      role="region"
      aria-label="Place Holder wireframe ideas"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">{caption || 'Place Holder'}</h2>
          <span className="talia-report__subtitle">Wireframe ideas — not live data</span>
        </div>
      </header>

      <div className="talia-callout ui-placeholder__callout" role="note">
        Workshop flow: save this dock as a SHARED focus, compose Place Holders here,
        then promote blocks into the Requirements Log. Toggle Views → Controls to hide editors.
      </div>

      <ReportProvenance visible={showProvenance}>
        <p>
          Place Holder is a wireframe canvas for client workshops. Blocks are skeletons only.
          Persist the discussion by saving the focus layout; capture intent with
          Promote to requirements (ADMIN+). Use Views → Controls to present without edit chrome.
        </p>
      </ReportProvenance>

      {showControls ? (
        <div className="talia-report__actions-bar talia-report__controls" role="toolbar" aria-label="Wireframe actions">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('table')}>
            Add table
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('cards')}>
            Add cards
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('list')}>
            Add list
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('chart-bar')}>
            Add bar chart
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('chart-line')}>
            Add line chart
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={() => onAddBlock('blank')}>
            Add blank
          </button>
          {canPromote ? (
            <button
              type="button"
              className="talia-btn talia-btn--primary"
              disabled={promoting}
              onClick={onPromotePanel}
              title="Promote whole panel to Requirements"
            >
              {promoting ? 'Promoting…' : 'Promote panel to requirements'}
            </button>
          ) : null}
        </div>
      ) : null}

      {promoteMessage && showControls ? (
        <p
          className={`ui-placeholder__promote-msg${
            promoteMessage.ok ? ' ui-placeholder__promote-msg--ok' : ' ui-placeholder__promote-msg--err'
          }`}
          role="status"
        >
          {promoteMessage.text}
        </p>
      ) : null}

      <main className="talia-report__content ui-placeholder__stack">
        {blocks.map((block, index) => {
          const selected = block.id === selectedBlockId;
          return (
            <section
              key={block.id}
              className={`ui-placeholder__block${selected ? ' ui-placeholder__block--selected' : ''}`}
              aria-label={`${block.type} block ${block.title}`}
            >
              {showControls ? (
                <>
                  <BlockChrome
                    block={block}
                    index={index}
                    total={blocks.length}
                    selected={selected}
                    onSelect={() => onSelectBlock?.(block.id)}
                    onChange={(patch) => onUpdateBlock?.(block.id, patch)}
                    onMove={(direction) => onMoveBlock?.(block.id, direction)}
                    onRemove={() => onRemoveBlock?.(block.id)}
                    onPromoteBlock={() => onPromoteBlock?.(block.id)}
                    canPromote={canPromote}
                  />
                  {block.type === 'table' ? (
                    <LabelRow
                      labels={block.columnLabels}
                      count={block.cols}
                      prefix="Col"
                      onChange={(columnLabels) => onUpdateBlock?.(block.id, { columnLabels })}
                    />
                  ) : null}
                  {block.type === 'cards' ? (
                    <LabelRow
                      labels={block.cardLabels}
                      count={block.cardCount}
                      prefix="Card"
                      onChange={(cardLabels) => onUpdateBlock?.(block.id, { cardLabels })}
                    />
                  ) : null}
                </>
              ) : (
                <div className="ui-placeholder__block-readonly-title">
                  <span className="ui-placeholder__block-type">
                    {block.type === 'chart' ? `${block.chartKind} chart` : block.type}
                  </span>
                  <span className="ui-placeholder__block-readonly-name">{block.title}</span>
                </div>
              )}
              <div className="ui-placeholder__block-body">
                <WireframeBlockBody block={block} showWireframe={showWireframe} />
              </div>
            </section>
          );
        })}
      </main>
    </article>
  );
};

export default PlaceHolderPresenter;
