/**
 * Promo Explorer Presenter — Full/Compact density + details card.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { chainRowFormatters, createReferenceRowFormatter } from '../../../lib/tabulatorReferenceSelection';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportDataDetails from '../../shared/ReportDataDetails';
import './promo-explorer.css';

const formatInt = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatFare = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const withTip = (text, title) => {
  const el = document.createElement('span');
  el.className = 'promo-explorer__tip';
  el.textContent = text == null || text === '' ? '—' : String(text);
  if (title) el.title = title;
  return el;
};

const formatStatusCell = (cell) => {
  const row = cell.getRow()?.getData?.() || {};
  const el = document.createElement('span');
  const status = String(cell.getValue() || '');
  el.className = 'promo-explorer__badge';
  if (status === 'Flagged') el.classList.add('promo-explorer__badge--flag');
  else if (status === 'Active') el.classList.add('promo-explorer__badge--active');
  else if (status === 'Related') el.classList.add('promo-explorer__badge--related');
  el.textContent = status || '—';
  el.title = row.flag_reason || status;
  return el;
};

const formatCompactPromoCell = (cell) => {
  const row = cell.getRow()?.getData?.() || {};
  const el = document.createElement('div');
  el.className = 'promo-explorer__stack';
  const name = document.createElement('span');
  name.className = 'promo-explorer__stack-primary';
  name.textContent = row.promo_name || '—';
  const meta = document.createElement('span');
  meta.className = 'promo-explorer__stack-secondary';
  const bits = [
    row.promo_type && row.promo_type !== '—' ? row.promo_type : null,
    Number.isFinite(Number(row.sail_count)) ? `${row.sail_count} sails` : null,
  ].filter(Boolean);
  meta.textContent = bits.join(' · ') || '—';
  el.appendChild(name);
  el.appendChild(meta);
  el.title = [row.promo_name, row.flag_reason, row.cabin_categories].filter(Boolean).join('\n');
  return el;
};

const buildPromoColumns = ({ isCompact, showColumnFilters }) => {
  const statusCol = {
    field: 'status',
    title: 'Status',
    width: isCompact ? 76 : 84,
    headerFilter: showColumnFilters ? 'list' : false,
    headerFilterParams: { valuesLookup: true },
    formatter: formatStatusCell,
  };

  if (isCompact) {
    return [
      statusCol,
      {
        field: 'promo_name',
        title: 'Promo',
        minWidth: 120,
        headerFilter: showColumnFilters ? 'input' : false,
        formatter: formatCompactPromoCell,
      },
      {
        field: 'min_fare',
        title: 'Min',
        hozAlign: 'right',
        width: 56,
        formatter: (cell) => formatFare(cell.getValue()),
      },
      {
        field: 'max_discount',
        title: 'Disc',
        hozAlign: 'right',
        width: 48,
        formatter: (cell) => {
          const n = Number(cell.getValue());
          if (!Number.isFinite(n)) return '—';
          return `${n.toFixed(0)}%`;
        },
      },
      {
        field: 'worked_before',
        title: 'Prior',
        width: 48,
        hozAlign: 'center',
        formatter: (cell) => (cell.getValue() ? 'Yes' : '—'),
      },
    ];
  }

  return [
    statusCol,
    {
      field: 'promo_name',
      title: 'Promo',
      minWidth: 140,
      headerFilter: showColumnFilters ? 'input' : false,
      formatter: (cell) => withTip(cell.getValue(), cell.getRow()?.getData?.()?.flag_reason),
    },
    {
      field: 'min_fare',
      title: 'Min',
      hozAlign: 'right',
      width: 64,
      formatter: (cell) => formatFare(cell.getValue()),
    },
    {
      field: 'max_discount',
      title: 'Disc',
      hozAlign: 'right',
      width: 52,
      formatter: (cell) => {
        const n = Number(cell.getValue());
        if (!Number.isFinite(n)) return '—';
        return `${n.toFixed(0)}%`;
      },
    },
    {
      field: 'cabin_count',
      title: 'Cats',
      hozAlign: 'right',
      width: 48,
      formatter: (cell) => formatInt(cell.getValue()),
    },
    {
      field: 'sail_count',
      title: 'Sails',
      hozAlign: 'right',
      width: 52,
      formatter: (cell) => formatInt(cell.getValue()),
    },
    {
      field: 'worked_before',
      title: 'Prior',
      width: 52,
      hozAlign: 'center',
      formatter: (cell) => (cell.getValue() ? 'Yes' : '—'),
    },
  ];
};

const PromoExplorerPresenter = ({
  rows = [],
  snapshot = {},
  selectedSailCode = null,
  selectedPromoKey = null,
  onSelectPromo,
  onSelectRelatedSail,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const selectedPromoKeyRef = useRef(selectedPromoKey);
  const onSelectPromoRef = useRef(onSelectPromo);
  selectedPromoKeyRef.current = selectedPromoKey;
  onSelectPromoRef.current = onSelectPromo;

  const {
    showSnapshot,
    showDetails,
    showProvenance,
    showColumnFilters,
    isCompact,
    reportShellClassName,
  } = useReportShellOptions(
    panelComponentId || 'promo-explorer',
    panelInstanceId
  );

  const columns = useMemo(
    () => buildPromoColumns({ isCompact, showColumnFilters }),
    [isCompact, showColumnFilters]
  );

  const isFocusRow = (data) => (
    selectedPromoKeyRef.current
    && data?.promo_key === selectedPromoKeyRef.current
  );

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        instanceRef.current.setColumns(columns);
        instanceRef.current.replaceData(rows);
        return;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: rows,
        columns,
        layout: isCompact ? 'fitColumns' : 'fitDataStretch',
        placeholder: selectedSailCode ? 'No promos for this sailing' : 'Select a sailing',
        selectableRows: 1,
        panelInstanceId,
        panelComponentId: panelComponentId || 'promo-explorer',
        exportTitle: 'Promo Explorer',
        rowFormatter: chainRowFormatters(createReferenceRowFormatter(isFocusRow)),
      }));
      instanceRef.current.on('rowClick', (_event, row) => {
        onSelectPromoRef.current?.(row?.getData?.());
      });
    };
    init();
    return () => { cancelled = true; };
  }, [columns, isCompact, panelComponentId, panelInstanceId, rows, selectedSailCode]);

  useEffect(() => () => {
    try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
    instanceRef.current = null;
  }, []);

  const selectedRow = rows.find((row) => row.promo_key === selectedPromoKey) || null;

  return (
    <div className={`focus-panel talia-report promo-explorer${isCompact ? ' promo-explorer--compact' : ''}${reportShellClassName ? ` ${reportShellClassName}` : ''}`}>
      <header className="talia-report__header">
        <h2 className="talia-report__title">Promo Explorer</h2>
        <p className="talia-report__subtitle">
          Active / related / flagged promotions
          {selectedSailCode ? ` · ${selectedSailCode}` : ''}
        </p>
      </header>

      <div className="talia-callout promo-explorer__callout" role="note">
        Flagged uses conservative heuristics: deep discount vs baseline, stacked bands, late activity while ahead of target.
      </div>

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          { key: 'promos', label: 'Promos', value: formatInt(snapshot.promo_count) },
          { key: 'active', label: 'On sail', value: formatInt(snapshot.active_count) },
          {
            key: 'flagged',
            label: 'Flagged',
            value: formatInt(snapshot.flagged_count),
            tone: snapshot.flagged_count ? 'negative' : 'positive',
            concern: snapshot.flagged_count > 0,
          },
          { key: 'prior', label: 'Prior', value: formatInt(snapshot.worked_before_count) },
        ]}
      />

      <main className="talia-report__content talia-report__content--scroll">
        <div ref={tableRef} className="talia-table promo-explorer__table" role="grid" />

        <ReportDataDetails visible={showDetails} className="promo-explorer__details">
          {selectedRow ? (
            <article className="talia-card promo-explorer__card" aria-label={selectedRow.promo_name}>
              <header className="promo-explorer__card-header">
                <span className={`promo-explorer__badge${selectedRow.status === 'Flagged' ? ' promo-explorer__badge--flag' : selectedRow.status === 'Active' ? ' promo-explorer__badge--active' : selectedRow.status === 'Related' ? ' promo-explorer__badge--related' : ''}`}>
                  {selectedRow.status}
                </span>
                <strong>{selectedRow.promo_name}</strong>
                <span className="promo-explorer__card-meta">{selectedRow.promo_type || '—'}</span>
              </header>
              <div className="promo-explorer__card-metrics">
                <div><span className="promo-explorer__card-label">Fare</span><span>{formatFare(selectedRow.min_fare)} – {formatFare(selectedRow.max_fare)}</span></div>
                <div><span className="promo-explorer__card-label">Disc</span><span>{Number.isFinite(Number(selectedRow.max_discount)) ? `${Number(selectedRow.max_discount).toFixed(0)}%` : '—'}</span></div>
                <div><span className="promo-explorer__card-label">Sails</span><span>{formatInt(selectedRow.sail_count)}</span></div>
                <div><span className="promo-explorer__card-label">Prior</span><span>{selectedRow.worked_before ? 'Yes' : '—'}</span></div>
              </div>
              <div className="promo-explorer__card-notes">
                <div>
                  <span className="promo-explorer__card-label">Cabins</span>
                  <p>{selectedRow.cabin_categories || '—'}</p>
                </div>
                <div>
                  <span className="promo-explorer__card-label">Flags</span>
                  <p>{selectedRow.flag_reason || 'None'}</p>
                </div>
              </div>
              <div className="promo-explorer__related">
                <h4 className="promo-explorer__card-label">Related sailings</h4>
                <div className="promo-explorer__sail-list">
                  {(selectedRow.related_sails || []).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`talia-btn talia-btn--secondary promo-explorer__sail-btn${code === selectedSailCode ? ' is-active' : ''}`}
                      onClick={() => onSelectRelatedSail?.(code)}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ) : (
            <div className="talia-card promo-explorer__card promo-explorer__card--empty">
              <p className="promo-explorer__hint">Select a promo row for related sailings.</p>
            </div>
          )}
        </ReportDataDetails>

        <ReportProvenance visible={showProvenance}>
          <p>
            Promo lines come from <code>published_rates_current_state</code>.
            Related sails use the same ship when available. Detrimental flags are advisory heuristics only —
            booking take-up and profit models come later.
          </p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default PromoExplorerPresenter;
