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

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import ReportDataDetails from '../../shared/ReportDataDetails';

/**
 * Presentational component for reservation current state
 */
const ReservationCurrentStatePresenter = ({
  data,
  reservationHistory = [],
  selectedReservationId = null,
  selectedReservationRecord = null,
  historyLoading = false,
  panelInstanceId,
  panelComponentId
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'reservation-current-state',
  });

  // Column definitions using Tabulator's native features
  const columns = [
    { 
      field: "res_id", 
      title: "Res ID",
      headerFilter: "input",
      formatter: (cell) => {
        const value = cell.getValue();
        const rowData = cell.getRow()?.getData?.() || {};
        const resId = value ? Math.floor(value).toString() : '';
        const historyCount = Number.parseInt(rowData.history_count, 10) || 0;
        if (!historyCount) return resId;
        const intensityClass = historyCount >= 5
          ? 'reservation-current-state__history-count--5'
          : `reservation-current-state__history-count--${historyCount}`;
        return `<span class="reservation-current-state__res-id-cell">${resId}</span><span class="reservation-current-state__history-count ${intensityClass}" title="${historyCount} history records">${historyCount}</span>`;
      }
    },
    { 
      field: "sail_code", 
      title: "Sail Code",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "ship", 
      title: "Ship",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "res_status", 
      title: "Status",
      headerFilter: "autocomplete",
      headerFilterParams: {
        valuesLookup: true
      }
    },
    { 
      field: "sail_from_date", 
      title: "Sail From Date",
      headerFilter: "input",
      formatter: (cell) => {
        const date = cell.getValue();
        return formatDayMon(date, '');
      }
    },
    { 
      field: "sail_to_date", 
      title: "Sail To Date",
      headerFilter: "input",
      formatter: (cell) => {
        const date = cell.getValue();
        return formatDayMon(date, '');
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
    { 
      field: "guest_count", 
      title: "Guest Count",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        if (value == null || value === '') return '';
        const numeric = Number.parseFloat(value);
        if (!Number.isFinite(numeric)) return '';
        return numeric.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
      }
    },
    { 
      field: "gross_selling_fare", 
      title: "Gross Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
    { 
      field: "net_selling_fare", 
      title: "Net Selling Fare",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
    { 
      field: "net_ticket_revenue_eur", 
      title: "Net Revenue (EUR)",
      hozAlign: "right",
      headerFilter: "number",
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
    },
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
  ];

  // Initialize Tabulator table
  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;

      try {
        // Load Tabulator resources using shared config
        const Tabulator = await initTabulator();

        if (cancelled) return;

        // Create Tabulator instance
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: data,
          columns: columns,
          layout: "fitDataTable",
          initialSort: [
            { column: "sail_from_date", dir: "desc" }
          ],
          height: "100%",
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false
        });

        // Register event listeners using Tabulator's .on() method
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch { /* noop */ }
        });

        instanceRef.current.on("rowSelected", (row) => {
          const rowData = row.getData();
          console.log("[ReservationCurrentState] Row selected:", rowData);
          window.dispatchEvent(new CustomEvent('talia:reservation.select', { 
            detail: {
              res_id: rowData.res_id,
              sail_code: rowData.sail_code,
              row_data: rowData,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[ReservationCurrentState] Row deselected");
          window.dispatchEvent(new CustomEvent('talia:reservation.clear', {
            detail: {
              timestamp: new Date().toISOString()
            }
          }));
        });

        console.log('[ReservationCurrentState] Table initialized with event listeners');
      } catch (err) {
        console.error('[ReservationCurrentState] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying table:', e);
        }
      }
    };
  }, [data]);

  // Update table data when data prop changes
  useEffect(() => {
    if (instanceRef.current && data) {
      try {
        instanceRef.current.replaceData(data);
      } catch (e) {
        console.warn('[ReservationCurrentState] Error updating data:', e);
      }
    }
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
    <div className="focus-panel reservation-current-state">
      <div
        ref={tableRef}
        className="focus-panel__table reservation-current-state__table"
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
    </div>
  );
};

export default ReservationCurrentStatePresenter;
