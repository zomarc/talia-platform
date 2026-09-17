/**
 * Groups Explorer Presenter — GRM table with Full/Compact density + details card.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { chainRowFormatters, createReferenceRowFormatter } from '../../../lib/tabulatorReferenceSelection';
import { formatDayMonYy } from '../../../lib/dateFormat';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportProvenance from '../../shared/ReportProvenance';
import ReportDataDetails from '../../shared/ReportDataDetails';
import { formatMrPct } from './groupsMaterialisation';
import './groups-explorer.css';

const formatInt = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatEur = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
};

const withTip = (text, title) => {
  const el = document.createElement('span');
  el.className = 'groups-explorer__tip';
  el.textContent = text == null || text === '' ? '—' : String(text);
  if (title) el.title = title;
  return el;
};

const formatRiskCell = (cell) => {
  const weak = cell.getValue() === true;
  const el = document.createElement('span');
  el.className = weak
    ? 'groups-explorer__badge groups-explorer__badge--weak'
    : 'groups-explorer__badge';
  el.textContent = weak ? 'Weak' : 'OK';
  const flags = cell.getRow()?.getData?.()?.performance_flags || [];
  el.title = flags.length ? flags.join(', ') : 'Within norms';
  return el;
};

/** Compact: Dep over Group ID, tooltip carries sail / agency. */
const formatCompactGroupCell = (cell) => {
  const row = cell.getRow()?.getData?.() || {};
  const el = document.createElement('div');
  el.className = 'groups-explorer__stack';
  const dep = document.createElement('span');
  dep.className = 'groups-explorer__stack-primary';
  dep.textContent = formatDayMonYy(row.sail_date_from, '—');
  const gid = document.createElement('span');
  gid.className = 'groups-explorer__stack-secondary';
  gid.textContent = row.group_id || '—';
  el.appendChild(dep);
  el.appendChild(gid);
  el.title = [
    row.group_id ? `Group ${row.group_id}` : null,
    row.sail_code ? `Sail ${row.sail_code}` : null,
    row.agency_name || row.agency_id || null,
    formatDayMonYy(row.sail_date_from, null),
  ].filter(Boolean).join(' · ');
  return el;
};

const buildGroupsColumns = ({ isCompact, showColumnFilters }) => {
  const riskCol = {
    field: 'non_performant',
    title: 'Risk',
    width: isCompact ? 64 : 72,
    hozAlign: 'center',
    headerFilter: showColumnFilters ? 'list' : false,
    headerFilterParams: { values: { true: 'Weak', false: 'OK' } },
    formatter: formatRiskCell,
  };

  if (isCompact) {
    return [
      riskCol,
      {
        field: 'group_id',
        title: 'Group',
        titleLong: 'Departure / Group',
        minWidth: 78,
        width: 88,
        headerFilter: showColumnFilters ? 'input' : false,
        formatter: formatCompactGroupCell,
      },
      {
        field: 'agency_name',
        title: 'Agency',
        minWidth: 90,
        headerFilter: showColumnFilters ? 'input' : false,
        formatter: (cell) => {
          const row = cell.getRow()?.getData?.() || {};
          const name = cell.getValue() || row.agency_id || '—';
          return withTip(name, [
            row.agency_id ? `Agency ${row.agency_id}` : null,
            row.sail_code ? `Sail ${row.sail_code}` : null,
          ].filter(Boolean).join(' · '));
        },
      },
      {
        field: 'requested_cabins',
        title: 'Req',
        titleLong: 'Requested cabins',
        hozAlign: 'right',
        width: 44,
        formatter: (cell) => formatInt(cell.getValue()),
      },
      {
        field: 'reserved_cabins',
        title: 'Res',
        titleLong: 'Reserved cabins',
        hozAlign: 'right',
        width: 44,
        formatter: (cell) => formatInt(cell.getValue()),
      },
      {
        field: 'talia_mr',
        title: 'MR',
        titleLong: 'Talia materialisation rate',
        hozAlign: 'right',
        width: 48,
        formatter: (cell) => {
          const row = cell.getRow()?.getData?.() || {};
          return withTip(
            formatMrPct(cell.getValue()),
            `Talia ${formatMrPct(row.talia_mr)} · Source ${formatMrPct(row.source_mr)}${row.mr_reason ? `\n${row.mr_reason}` : ''}`
          );
        },
      },
      {
        field: 'value_at_risk',
        title: 'At risk',
        hozAlign: 'right',
        width: 76,
        formatter: (cell) => formatEur(cell.getValue()),
      },
    ];
  }

  return [
    riskCol,
    {
      field: 'sail_date_from',
      title: 'Dep',
      width: 72,
      formatter: (cell) => formatDayMonYy(cell.getValue(), '—'),
    },
    {
      field: 'group_id',
      title: 'Group',
      width: 88,
      headerFilter: showColumnFilters ? 'input' : false,
    },
    {
      field: 'agency_name',
      title: 'Agency',
      minWidth: 110,
      headerFilter: showColumnFilters ? 'input' : false,
      formatter: (cell) => {
        const row = cell.getRow()?.getData?.() || {};
        const name = cell.getValue() || row.agency_id || '—';
        return withTip(name, row.agency_id ? `Agency ${row.agency_id}` : '');
      },
    },
    {
      field: 'requested_cabins',
      title: 'Req',
      titleLong: 'Requested cabins',
      hozAlign: 'right',
      width: 52,
      formatter: (cell) => formatInt(cell.getValue()),
    },
    {
      field: 'reserved_cabins',
      title: 'Res',
      titleLong: 'Reserved / named booked cabins',
      hozAlign: 'right',
      width: 52,
      formatter: (cell) => formatInt(cell.getValue()),
    },
    {
      field: 'source_mr',
      title: 'Src',
      titleLong: 'Source MR (display only)',
      hozAlign: 'right',
      width: 52,
      formatter: (cell) => withTip(
        formatMrPct(cell.getValue()),
        'Source probability — display only'
      ),
    },
    {
      field: 'talia_mr',
      title: 'Talia',
      titleLong: 'Talia materialisation rate',
      hozAlign: 'right',
      width: 56,
      formatter: (cell) => {
        const row = cell.getRow()?.getData?.() || {};
        return withTip(formatMrPct(cell.getValue()), row.mr_reason || 'Talia MR');
      },
    },
    {
      field: 'value_at_risk',
      title: 'At risk',
      hozAlign: 'right',
      width: 84,
      formatter: (cell) => formatEur(cell.getValue()),
    },
  ];
};

const GroupsExplorerPresenter = ({
  rows = [],
  snapshot = {},
  selectedSailCode = null,
  selectedGroupKey = null,
  onSelectGroup,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const selectedGroupKeyRef = useRef(selectedGroupKey);
  const onSelectGroupRef = useRef(onSelectGroup);
  selectedGroupKeyRef.current = selectedGroupKey;
  onSelectGroupRef.current = onSelectGroup;

  const {
    showSnapshot,
    showDetails,
    showProvenance,
    showColumnFilters,
    isCompact,
    reportShellClassName,
  } = useReportShellOptions(
    panelComponentId || 'groups-explorer',
    panelInstanceId
  );

  const columns = useMemo(
    () => buildGroupsColumns({ isCompact, showColumnFilters }),
    [isCompact, showColumnFilters]
  );

  const isFocusRow = (data) => (
    selectedGroupKeyRef.current
    && data?.group_key
    && data.group_key === selectedGroupKeyRef.current
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
        placeholder: selectedSailCode
          ? 'No group commitments for this sailing'
          : 'Select a sailing',
        selectableRows: 1,
        panelInstanceId,
        panelComponentId: panelComponentId || 'groups-explorer',
        exportTitle: 'Groups Explorer',
        initialSort: [{ column: 'value_at_risk', dir: 'desc' }],
        rowFormatter: chainRowFormatters(createReferenceRowFormatter(isFocusRow)),
      }));
      instanceRef.current.on('rowClick', (_event, row) => {
        onSelectGroupRef.current?.(row?.getData?.());
      });
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [columns, isCompact, panelComponentId, panelInstanceId, rows, selectedSailCode]);

  useEffect(() => () => {
    try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
    instanceRef.current = null;
  }, []);

  const selectedRow = rows.find((row) => row.group_key === selectedGroupKey) || null;

  return (
    <div className={`focus-panel talia-report groups-explorer${isCompact ? ' groups-explorer--compact' : ''}${reportShellClassName ? ` ${reportShellClassName}` : ''}`}>
      <header className="talia-report__header">
        <h2 className="talia-report__title">Groups Explorer</h2>
        <p className="talia-report__subtitle">
          Group risk · commitment & materialisation
          {selectedSailCode ? ` · ${selectedSailCode}` : ''}
        </p>
      </header>

      <div className="talia-callout groups-explorer__callout" role="note">
        Source MR is warehouse display-only. Talia MR is computed separately and drives Potential / at-risk.
        Hover Talia / Group for reasons and IDs.
      </div>

      <ReportSnapshot
        visible={showSnapshot}
        items={[
          { key: 'groups', label: 'Groups', value: formatInt(snapshot.group_count) },
          { key: 'req', label: 'Req C', value: formatInt(snapshot.requested_cabins) },
          {
            key: 'mr',
            label: 'MR',
            value: formatMrPct(snapshot.portfolio_mr),
            tone: snapshot.portfolio_mr != null && snapshot.portfolio_mr < 0.4 ? 'negative' : 'neutral',
          },
          {
            key: 'risk',
            label: 'At risk',
            value: formatEur(snapshot.value_at_risk_eur),
            tone: snapshot.value_at_risk_eur > 0 ? 'negative' : 'neutral',
            concern: snapshot.weak_count > 0,
          },
          {
            key: 'weak',
            label: 'Weak',
            value: formatInt(snapshot.weak_count),
            tone: snapshot.weak_count ? 'negative' : 'positive',
          },
        ]}
      />

      <main className="talia-report__content talia-report__content--scroll">
        <div ref={tableRef} className="talia-table groups-explorer__table" role="grid" />

        <ReportDataDetails visible={showDetails} className="groups-explorer__details">
          {selectedRow ? (
            <article className="talia-card groups-explorer__card" aria-label={`Group ${selectedRow.group_id}`}>
              <header className="groups-explorer__card-header">
                <div className="groups-explorer__card-title">
                  <span className={selectedRow.non_performant
                    ? 'groups-explorer__badge groups-explorer__badge--weak'
                    : 'groups-explorer__badge'}
                  >
                    {selectedRow.non_performant ? 'Weak' : 'OK'}
                  </span>
                  <strong>{selectedRow.group_id}</strong>
                  <span className="groups-explorer__card-meta">
                    {formatDayMonYy(selectedRow.sail_date_from, '—')}
                    {selectedRow.sail_code ? ` · ${selectedRow.sail_code}` : ''}
                  </span>
                </div>
                <p className="groups-explorer__card-agency">
                  {selectedRow.agency_name || selectedRow.agency_id || '—'}
                </p>
              </header>
              <div className="groups-explorer__card-metrics">
                <div><span className="groups-explorer__card-label">Req / Res</span><span>{formatInt(selectedRow.requested_pax)} / {formatInt(selectedRow.reserved_pax)} pax</span></div>
                <div><span className="groups-explorer__card-label">Cabins</span><span>{formatInt(selectedRow.requested_cabins)} / {formatInt(selectedRow.reserved_cabins)}</span></div>
                <div><span className="groups-explorer__card-label">Value</span><span>{formatEur(selectedRow.group_value_eur)}</span></div>
                <div><span className="groups-explorer__card-label">At risk</span><span className={selectedRow.value_at_risk > 0 ? 'groups-explorer__card-neg' : ''}>{formatEur(selectedRow.value_at_risk)}</span></div>
                <div><span className="groups-explorer__card-label">Source MR</span><span>{formatMrPct(selectedRow.source_mr)}</span></div>
                <div><span className="groups-explorer__card-label">Talia MR</span><span>{formatMrPct(selectedRow.talia_mr)}</span></div>
                <div><span className="groups-explorer__card-label">Potential</span><span>{formatInt(selectedRow.potential_pax)}</span></div>
                <div><span className="groups-explorer__card-label">Status</span><span>{selectedRow.status_mix || '—'}</span></div>
              </div>
              <div className="groups-explorer__card-notes">
                <div>
                  <span className="groups-explorer__card-label">Reasons</span>
                  <p>{selectedRow.mr_reason || '—'}</p>
                </div>
                <div>
                  <span className="groups-explorer__card-label">Flags</span>
                  <p>{(selectedRow.performance_flags || []).join(', ') || 'None'}</p>
                </div>
              </div>
            </article>
          ) : (
            <div className="talia-card groups-explorer__card groups-explorer__card--empty">
              <p className="groups-explorer__hint">Select a group row for detail.</p>
            </div>
          )}
        </ReportDataDetails>

        <ReportProvenance visible={showProvenance}>
          <p>
            Groups roll up from <code>reservation</code> (including <code>fact_group_alloc</code> OF rows)
            by <code>group_id</code>. Source MR uses warehouse probabilities.
            Talia MR is an independent local model (reserved/requested blend, offer weight, mild source temper,
            distress rules). Agency history and peerset benchmarks arrive in a later iteration.
          </p>
        </ReportProvenance>
      </main>
    </div>
  );
};

export default GroupsExplorerPresenter;
