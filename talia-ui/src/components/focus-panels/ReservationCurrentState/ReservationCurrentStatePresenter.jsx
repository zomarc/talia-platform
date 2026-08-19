/**
 * Reservation Current State Presentational Component
 * Pure UI component - receives data as props
 * 
 * IMPORTANT: This component uses TABULATOR LIBRARY FEATURES ONLY
 * - No custom filter generation → Uses valuesLookup
 * - No custom styling → Uses Tabulator themes
 * - No custom sorting → Uses Tabulator initialSort
 * See CODING-STANDARDS.md for principles
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { initTabulator, getTabulatorOptions, captureTableScroll, withColumnTotal } from '../../../lib/tabulatorConfig';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import { useTabulatorColumnTotals } from '../../../hooks/useTabulatorColumnTotals';
import { formatDayMon, formatSailDateRange } from '../../../lib/dateFormat';
import { clipAnchorRectToViewport } from '../../../lib/clipAnchorRect';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import ReportDataDetails from '../../shared/ReportDataDetails';
import { ReportTableOrRecord } from '../../shared/ReportRecordForm';
import HoverPreview from '../../shared/HoverPreview';
import ReservationHoverSummary from '../../shared/ReservationHoverSummary';
import {
  RESERVATION_CLEAR_EVENT,
  RESERVATION_SELECT_EVENT,
  emitReservationClear,
  emitReservationSelect,
} from '../../../lib/eventBus';
import {
  payloadFromTabulator,
  registerPanelDataExport,
} from '../../../lib/panelDataExport';

/**
 * Presentational component for reservation current state
 */
const ReservationCurrentStatePresenter = ({
  data,
  hoverByResId = null,
  reservationHistory = [],
  selectedReservationId = null,
  selectedReservationRecord = null,
  historyLoading = false,
  statusFilter = 'all',
  onStatusFilterChange,
  panelInstanceId,
  panelComponentId
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const suppressSelectionEventsRef = useRef(false);
  const dataRef = useRef(data);
  const hoverByResIdRef = useRef(hoverByResId);
  const selectedResIdRef = useRef(
    selectedReservationId != null && selectedReservationId !== ''
      ? String(selectedReservationId)
      : null
  );
  dataRef.current = data;
  hoverByResIdRef.current = hoverByResId;
  const [historyFilter, setHistoryFilter] = useState('all');
  const [hoverPreview, setHoverPreview] = useState(null);
  const [tableReadyToken, setTableReadyToken] = useState(0);
  const { showDetails, showFilters, showTotals, showTooltip, reportShellClassName } = useReportShellOptions(
    panelComponentId || 'reservation-current-state',
    panelInstanceId
  );
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;

  useEffect(() => {
    if (!showTooltip) setHoverPreview(null);
  }, [showTooltip]);

  // Views → Totals → native ColumnCalcs (also applied framework-wide via tabulatorConfig).
  useTabulatorColumnTotals(instanceRef, showTotals, tableReadyToken);

  // Sail scope change clears reservation via eventBus; sync table selection without re-emitting.
  useEffect(() => {
    const handleReservationClear = () => {
      selectedResIdRef.current = null;
      const table = instanceRef.current;
      if (!table) return;
      suppressSelectionEventsRef.current = true;
      try {
        table.deselectRow?.();
      } catch { /* noop */ }
      suppressSelectionEventsRef.current = false;
    };
    window.addEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
    return () => window.removeEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
  }, []);

  // Column definitions using Tabulator's native features
  const columns = useMemo(() => ([
    withColumnTotal({
      field: "res_id",
      title: "Res ID",
      // Floor for 12-digit id + SYN badge + history count (fixed width is stripped in global fit).
      minWidth: 176,
      headerFilter: "input",
      formatter: (cell) => {
        const value = cell.getValue();
        const rowData = cell.getRow()?.getData?.() || {};
        const resId = value ? Math.floor(value).toString() : '';
        const origin = String(rowData.source_origin || '').trim();
        const synthetic = origin === 'fact_group_alloc'
          || (rowData.group_id != null
            && resId
            && String(resId).startsWith(String(rowData.group_id))
            && String(resId).length >= String(rowData.group_id).length + 4
            && ['OF', 'OPTION', 'QT', 'QUOTE'].includes(String(rowData.res_status || '').toUpperCase()));
        // Rich HoverPreview replaces native title tooltips (avoid double tooltips).
        const historyCount = Number.parseInt(rowData.history_count, 10) || 0;
        const synBadge = synthetic
          ? '<span class="reservation-current-state__synthetic-badge" title="Synthetic group-OF res_id">SYN</span>'
          : '';
        if (!historyCount) {
          return `<span class="reservation-current-state__res-id-cell">${resId}</span>${synBadge}`;
        }
        const intensityClass = historyCount >= 5
          ? 'reservation-current-state__history-count--5'
          : `reservation-current-state__history-count--${historyCount}`;
        return `<span class="reservation-current-state__res-id-cell">${resId}</span>${synBadge}<span class="reservation-current-state__history-count ${intensityClass}" title="${historyCount} history records">${historyCount}</span>`;
      }
    }, 'count'),
    { 
      field: "res_status", 
      title: "Status",
      width: 80,
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    {
      field: "source_origin",
      title: "Origin",
      width: 100,
      headerFilter: "autocomplete",
      headerFilterParams: { valuesLookup: true },
      formatter: (cell) => {
        const value = String(cell.getValue() || '').trim();
        if (value === 'fact_group_alloc') return 'Synthetic';
        if (value === 'res_header') return 'Header';
        return value || '';
      },
    },
    { 
      field: "sail_from_date", 
      title: "Dates",
      width: 130,
      headerFilter: "input",
      formatter: (cell) => {
        const rowData = cell.getRow()?.getData?.() || {};
        return formatSailDateRange(rowData.sail_from_date, rowData.sail_to_date, '');
      }
    },
    { 
      field: "cabin_category", 
      title: "Cabin Category",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    withColumnTotal({
      field: "guest_count",
      title: "Guest Count",
      hozAlign: "right",
      headerFilter: "number",
    }, 'sum'),
    withColumnTotal({
      field: "gross_selling_fare",
      title: "Gross Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
    }, 'sum'),
    withColumnTotal({
      field: "net_selling_fare",
      title: "Net Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
    }, 'sum'),
    withColumnTotal({
      field: "net_ticket_revenue_eur",
      title: "Net Revenue (EUR)",
      hozAlign: "right",
      headerFilter: "number",
    }, 'sum'),
    { 
      field: "agency_id", 
      title: "Agency ID",
      headerFilter: "input",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? Math.floor(value).toString() : '';
      }
    },
    { 
      field: "currency", 
      title: "Currency",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "pax_status", 
      title: "PAX Status",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    }
  ]), []);

  const emitSelectFromRowData = useCallback((rowData) => {
    if (!rowData) return;
    const resId = rowData.res_id;
    selectedResIdRef.current = resId != null && resId !== '' ? String(resId) : null;
    emitReservationSelect({
      res_id: rowData.res_id,
      sail_code: rowData.sail_code,
      agency_id: rowData.agency_id ?? null,
      row_data: rowData,
      source: 'reservation-current-state',
      timestamp: new Date().toISOString(),
    });
  }, []);

  const onRecordActive = useCallback((row) => {
    emitSelectFromRowData(row);
  }, [emitSelectFromRowData]);

  const applyTableData = (table) => {
    if (!table) return;
    suppressSelectionEventsRef.current = true;
    const rows = Array.isArray(dataRef.current) ? dataRef.current : [];
    const scroll = captureTableScroll(table);
    const refreshPromise = Promise.resolve(table.replaceData(rows))
      .catch((error) => {
        console.warn('[ReservationCurrentState] Error updating data:', error);
      })
      .finally(() => {
        const keepId = selectedResIdRef.current;
        if (keepId) {
          try {
            const match = (table.getRows?.() || []).find(
              (row) => String(row.getData?.()?.res_id ?? '') === keepId
            );
            if (match) {
              match.select?.();
            } else {
              selectedResIdRef.current = null;
            }
          } catch { /* noop */ }
        }
        suppressSelectionEventsRef.current = false;
      });
    afterTabulatorDataRefresh(table, refreshPromise, scroll);
  };

  // Initialize Tabulator once — never rebuild on data identity changes (that raced clear events).
  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          suppressSelectionEventsRef.current = true;
          try { instanceRef.current.destroy(); } catch { /* noop */ }
          instanceRef.current = null;
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          columns,
          initialSort: [
            { column: "sail_from_date", dir: "desc" }
          ],
          height: "100%",
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          panelInstanceId,
          panelComponentId: panelComponentId || 'reservation-current-state',
          exportTitle: 'Reservation',
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          setTableReadyToken((n) => n + 1);
          applyTableData(instanceRef.current);
        });

        // Capture selection *before* Tabulator processes the click. Otherwise rowClick
        // runs after rowSelectionChanged has already selected the row, and we would
        // immediately deselect (cabin highlight flashes then clears).
        const rowSelectedBeforePointerRef = { current: false };
        instanceRef.current.on('rowMouseDown', (_event, row) => {
          const resId = row?.getData?.()?.res_id;
          const key = resId != null && resId !== '' ? String(resId) : '';
          rowSelectedBeforePointerRef.current = Boolean(
            key
            && selectedResIdRef.current === key
            && row.isSelected?.()
          );
        });

        // Click: select row. Re-click a row that was already selected: deselect → general view.
        instanceRef.current.on('rowClick', (_event, row) => {
          if (rowSelectedBeforePointerRef.current) {
            try { row?.deselect?.(); } catch { /* noop */ }
            return;
          }
          try {
            if (!row?.isSelected?.()) row?.select?.();
          } catch { /* noop */ }
        });

        instanceRef.current.on('rowSelectionChanged', (selectedData) => {
          if (suppressSelectionEventsRef.current) return;
          const rowData = selectedData?.[0];
          if (rowData) {
            emitSelectFromRowData(rowData);
            return;
          }
          selectedResIdRef.current = null;
          emitReservationClear({
            reason: 'reservation-cleared',
            source: 'reservation-current-state',
            timestamp: new Date().toISOString(),
          });
        });

        instanceRef.current.on('rowMouseEnter', (_event, row) => {
          if (!showTooltipRef.current) {
            setHoverPreview(null);
            return;
          }
          const rowData = row?.getData?.() || {};
          const resId = rowData.res_id != null ? String(rowData.res_id) : '';
          if (!resId || !hoverByResIdRef.current?.get?.(resId)) {
            setHoverPreview(null);
            return;
          }
          const element = row.getElement?.();
          const rowRect = element?.getBoundingClientRect?.();
          const rect = clipAnchorRectToViewport(rowRect, tableRef.current);
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            setHoverPreview(null);
            return;
          }
          setHoverPreview({ resId, rect });
        });

        instanceRef.current.on('rowMouseLeave', () => {
          setHoverPreview(null);
        });
      } catch (err) {
        console.error('[ReservationCurrentState] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      suppressSelectionEventsRef.current = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying table:', e);
        }
        instanceRef.current = null;
      }
    };
  }, [columns, panelComponentId]);

  // Framework tab Export (CSV / PDF) — visible/filtered Tabulator rows.
  useEffect(() => {
    const componentKey = panelComponentId || 'reservation-current-state';
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        const table = instanceRef.current;
        if (!table) return null;
        const payload = payloadFromTabulator(table, 'Reservation');
        if (payload?.rows?.length) return payload;
        // Fallback: raw prop data if Tabulator active set is empty/unavailable
        const rows = Array.isArray(dataRef.current) ? dataRef.current : [];
        if (!rows.length || !payload?.columns?.length) return payload;
        return { ...payload, rows };
      },
    });
  }, [panelComponentId, panelInstanceId]);

  // Keep row selection in sync when cabin (or another panel) drives reservation select/clear.
  useEffect(() => {
    const selectRowByResId = (resId) => {
      const table = instanceRef.current;
      if (!table || !tableBuiltRef.current) return;
      const key = resId != null && String(resId).trim() !== '' ? String(resId).trim() : null;
      if (!key) return;
      if (selectedResIdRef.current === key) {
        // Already selected locally — ensure Tabulator selection matches.
      }
      selectedResIdRef.current = key;
      suppressSelectionEventsRef.current = true;
      try {
        const rows = table.getRows?.() || [];
        const match = rows.find((row) => String(row.getData?.()?.res_id ?? '') === key);
        rows.forEach((row) => {
          try {
            if (row === match) row.select?.();
            else if (row.isSelected?.()) row.deselect?.();
          } catch { /* noop */ }
        });
      } finally {
        suppressSelectionEventsRef.current = false;
      }
    };

    const clearRowSelection = () => {
      const table = instanceRef.current;
      selectedResIdRef.current = null;
      if (!table || !tableBuiltRef.current) return;
      suppressSelectionEventsRef.current = true;
      try {
        (table.getSelectedRows?.() || []).forEach((row) => {
          try { row.deselect?.(); } catch { /* noop */ }
        });
      } finally {
        suppressSelectionEventsRef.current = false;
      }
    };

    const onReservationSelect = (event) => {
      const detail = event?.detail || {};
      // Ignore our own emits — rowSelectionChanged already updated selection.
      if (detail.source === 'reservation-current-state') return;
      const resId = detail.res_id ?? detail.row_data?.res_id ?? null;
      selectRowByResId(resId);
    };

    const onReservationClear = (event) => {
      const detail = event?.detail || {};
      if (detail.source === 'reservation-current-state') return;
      clearRowSelection();
    };

    window.addEventListener(RESERVATION_SELECT_EVENT, onReservationSelect);
    window.addEventListener(RESERVATION_CLEAR_EVENT, onReservationClear);
    return () => {
      window.removeEventListener(RESERVATION_SELECT_EVENT, onReservationSelect);
      window.removeEventListener(RESERVATION_CLEAR_EVENT, onReservationClear);
    };
  }, []);

  // Replace data without destroying the table; suppress clear events during refresh.
  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    applyTableData(instanceRef.current);
  }, [data]);

  const historyRows = useMemo(() => {
    const rows = Array.isArray(reservationHistory) ? reservationHistory : [];
    if (historyFilter === 'all') return rows;
    if (historyFilter === 'changes') {
      return rows.filter((row) => (
        row?.change_kind === 'history_change'
        && (
          row?.sail_code_changed
          || row?.agency_id_changed
          || row?.group_id_changed
          || Number.parseFloat(row?.guest_count_delta || 0) !== 0
        )
      ));
    }
    if (historyFilter === 'events') {
      return rows.filter((row) => row?.change_kind === 'booking_created' || row?.change_kind === 'cancellation_state');
    }
    return rows;
  }, [reservationHistory, historyFilter]);

  const formatValue = (value) => {
    if (value == null || value === '') return 'N/A';
    return String(value);
  };

  const getHistorySummary = (row) => {
    if (row?.change_kind === 'booking_created') {
      return 'Booking created';
    }
    if (row?.change_kind === 'cancellation_state') {
      return 'Cancellation state detected';
    }
    const parts = [];
    if (row?.sail_code_changed) {
      parts.push(`Sail -> ${formatValue(row.sail_code)}`);
    }
    if (row?.agency_id_changed) {
      parts.push(`Agency -> ${formatValue(row.agency_id)}`);
    }
    if (row?.group_id_changed) {
      parts.push(`Group -> ${formatValue(row.group_id)}`);
    }
    const guestDelta = Number.parseFloat(row?.guest_count_delta);
    if (Number.isFinite(guestDelta) && guestDelta !== 0) {
      const signed = guestDelta > 0 ? `+${guestDelta}` : `${guestDelta}`;
      parts.push(`Guests ${signed} (now ${formatValue(row.guest_count)})`);
    }
    if (parts.length > 0) return parts.join(' • ');
    return `Snapshot • Guests ${formatValue(row?.guest_count)} • Sail ${formatValue(row?.sail_code)}`;
  };

  return (
    <div className={`focus-panel reservation-current-state talia-report${reportShellClassName ? ` ${reportShellClassName}` : ''}`}>
      <div
        className={`reservation-current-state__filters talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}
        aria-label="Reservation status filter"
      >
        <button
          type="button"
          className={`talia-btn ${statusFilter === 'booked' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={statusFilter === 'booked'}
          onClick={() => onStatusFilterChange?.('booked')}
          title="Named / materialised bookings only"
        >
          Booked
        </button>
        <button
          type="button"
          className={`talia-btn ${statusFilter === 'estimated' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={statusFilter === 'estimated'}
          onClick={() => onStatusFilterChange?.('estimated')}
          title="Named booked plus expected groups and offers"
        >
          Estimated
        </button>
        <button
          type="button"
          className={`talia-btn ${statusFilter === 'synthetic' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={statusFilter === 'synthetic'}
          onClick={() => onStatusFilterChange?.('synthetic')}
          title="Warehouse synthetic group-OF res_id rows only"
        >
          Synthetic
        </button>
        <button
          type="button"
          className={`talia-btn ${statusFilter === 'cancelled' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={statusFilter === 'cancelled'}
          onClick={() => onStatusFilterChange?.('cancelled')}
        >
          Cancelled
        </button>
        <button
          type="button"
          className={`talia-btn ${statusFilter === 'all' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={statusFilter === 'all'}
          onClick={() => onStatusFilterChange?.('all')}
        >
          All
        </button>
      </div>
      <ReportTableOrRecord
        data={data}
        columns={columns}
        tableRef={tableRef}
        tableClassName="focus-panel__table reservation-current-state__table"
        onRecordActive={onRecordActive}
        ariaLabel="Reservation record"
      />
      <ReportDataDetails
        visible={showDetails}
        as="section"
        className="reservation-current-state__details talia-card"
      >
        <header className="reservation-current-state__details-header">
          <div className="reservation-current-state__details-heading">
            <span className="reservation-current-state__details-subtitle">
              {selectedReservationId != null
                ? <>Reservation <span className="reservation-current-state__reservation-id">{selectedReservationId}</span></>
                : 'Select a booking to view history'}
            </span>
            {selectedReservationId != null && (
              <label htmlFor="reservation-history-filter" className="reservation-current-state__details-inline-filter">
                <span className="reservation-current-state__details-key">View</span>
                <select
                  id="reservation-history-filter"
                  className="reservation-current-state__details-select"
                  value={historyFilter}
                  onChange={(event) => setHistoryFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  <option value="changes">Only field changes</option>
                  <option value="events">Booking/cancellation events</option>
                </select>
              </label>
            )}
          </div>
        </header>
        {!historyLoading && selectedReservationId != null && (
          <div className="reservation-current-state__details-card">
            <div className="reservation-current-state__details-summary">
              <span className="reservation-current-state__details-key">Booking</span>
              <span className="reservation-current-state__details-value">
                {selectedReservationRecord?.created_at ? formatDayMon(selectedReservationRecord.created_at, '') : 'N/A'}
              </span>
              <span className="reservation-current-state__details-key">Status</span>
              <span className="reservation-current-state__details-value">{formatValue(selectedReservationRecord?.res_status)}</span>
              <span className="reservation-current-state__details-key">Guests</span>
              <span className="reservation-current-state__details-value">{formatValue(selectedReservationRecord?.guest_count)}</span>
            </div>
          </div>
        )}
        {historyLoading && (
          <p className="reservation-current-state__details-empty">Loading booking history...</p>
        )}
        {!historyLoading && selectedReservationId == null && (
          <p className="reservation-current-state__details-empty">No booking selected.</p>
        )}
        {!historyLoading && selectedReservationId != null && historyRows.length === 0 && (
          <p className="reservation-current-state__details-empty">No history rows found for this booking.</p>
        )}
        {!historyLoading && selectedReservationId != null && historyRows.length > 0 && (
          <div className="reservation-current-state__history-list">
            {historyRows.map((row, index) => (
              <div key={`${row.res_id}-${row.snapshot_date}-${index}`} className="reservation-current-state__history-item">
                <div className="reservation-current-state__history-main">
                  <div className="reservation-current-state__history-dates">
                    <span className="reservation-current-state__history-date">
                      Change date: {row.change_date ? formatDayMon(row.change_date, '') : 'N/A'}
                    </span>
                    <span className="reservation-current-state__history-date reservation-current-state__history-date--muted">
                      Booking date: {row.booking_date ? formatDayMon(row.booking_date, '') : 'N/A'}
                    </span>
                  </div>
                  <span className="reservation-current-state__history-meta">
                    {getHistorySummary(row)}
                  </span>
                  <span className="reservation-current-state__history-meta">
                    sail {formatValue(row.sail_code)} • agency {formatValue(row.agency_id)} • group {formatValue(row.group_id)} • guests {formatValue(row.guest_count)} (delta {formatValue(row.guest_count_delta)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ReportDataDetails>
      <HoverPreview
        open={Boolean(showTooltip && hoverPreview?.resId)}
        anchorRect={hoverPreview?.rect || null}
        containRef={tableRef}
        placement="right"
        onRequestClose={() => setHoverPreview(null)}
      >
        {hoverPreview?.resId && hoverByResId?.get?.(hoverPreview.resId) ? (
          <ReservationHoverSummary card={hoverByResId.get(hoverPreview.resId)} />
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default ReservationCurrentStatePresenter;
