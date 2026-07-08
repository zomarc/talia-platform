import React, { useEffect, useRef, useState } from 'react';
import { getTabulatorOptions, initTabulator } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';
import { CABIN_CLEAR_EVENT, CABIN_SELECT_EVENT } from '../../../lib/eventBus';

const DirectAvailabilityPresenter = ({ data, loading, queryInfo, onRefresh }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const selectedSailCodeRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const lastDataRef = useRef(null);
  const [showQueryDetails, setShowQueryDetails] = useState(false);

  const context = queryInfo?.variables?._context || {};
  const selectedSailCode = context?.sailCode || '—';
  const selectedSailDate = context?.sailDate || null;
  const packageName = context?.packageName || '—';
  const validation = queryInfo?.validation || null;
  selectedSailCodeRef.current = selectedSailCode;

  const columns = [
    {
      title: 'Cabin',
      field: 'cabinCategoryCode',
      width: 88,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: false,
      headerTooltip: 'Cabin category from direct Seaware availability response.'
    },
    {
      title: 'Status',
      field: 'availabilityResult',
      width: 112,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: false,
      headerTooltip: 'Availability result returned by Seaware for this cabin category.',
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return '';
        let variant = 'neutral';
        if (value === 'AVAILABLE') variant = 'available';
        else if (value === 'LIMITED') variant = 'limited';
        else if (value === 'SOLD_OUT' || value === 'UNAVAILABLE') variant = 'unavailable';
        return `<span class="direct-source__availability direct-source__availability--${variant}">${value}</span>`;
      }
    },
    {
      title: 'Total',
      field: 'totalCabins',
      width: 84,
      hozAlign: 'right',
      headerHozAlign: 'right',
      headerSort: false,
      headerTooltip: 'Total cabins in this category for the selected sailing.',
      formatter: (cell) => Number(cell.getValue() || 0).toLocaleString()
    },
    {
      title: 'Avail',
      field: 'availableCabins',
      width: 84,
      hozAlign: 'right',
      headerHozAlign: 'right',
      headerSort: false,
      headerTooltip: 'Currently available cabins in this category.',
      formatter: (cell) => Number(cell.getValue() || 0).toLocaleString()
    },
    {
      title: 'Abs',
      field: 'totalAvailableAbsolute',
      width: 84,
      hozAlign: 'right',
      headerHozAlign: 'right',
      headerSort: false,
      headerTooltip: 'Absolute availability metric from Seaware response.',
      formatter: (cell) => Number(cell.getValue() || 0).toLocaleString()
    },
    {
      title: 'Wgt',
      field: 'totalAvailableWeighted',
      width: 84,
      hozAlign: 'right',
      headerHozAlign: 'right',
      headerSort: false,
      headerTooltip: 'Weighted availability metric from Seaware response.',
      formatter: (cell) => Number(cell.getValue() || 0).toFixed(2)
    },
    {
      title: 'Book',
      field: 'canBookCabins',
      width: 64,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: false,
      headerTooltip: 'Can Book: Seaware canBookCabins flag. ✓ means cabin can be booked now.',
      formatter: (cell) => {
        const raw = cell.getValue();
        const yes = raw === true || raw === 1 || raw === '1' || String(raw || '').toUpperCase() === 'Y';
        return yes ? '✓' : '✕';
      }
    },
    {
      title: 'Nest',
      field: 'canBookNestedCabins',
      width: 64,
      hozAlign: 'center',
      headerHozAlign: 'center',
      headerSort: false,
      headerTooltip: 'Nested Book: Seaware canBookNestedCabins flag for nested inventory.',
      formatter: (cell) => {
        const raw = cell.getValue();
        const yes = raw === true || raw === 1 || raw === '1' || String(raw || '').toUpperCase() === 'Y';
        return yes ? '✓' : '✕';
      }
    },
  ];

  useEffect(() => {
    if (!data || data.length === 0 || tableInitialized) return;
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(
          tableRef.current,
          getTabulatorOptions({
            data,
            columns,
            selectableRows: 1,
            movableColumns: false,
            resizableColumns: true,
            headerFilterLiveFilter: false,
            pagination: false
          })
        );

        instanceRef.current.on('rowClick', (e, row) => {
          try { row?.select?.(); } catch { /* noop */ }
        });

        instanceRef.current.on('rowSelected', (row) => {
          const rowData = row?.getData?.() || null;
          if (!rowData) return;
          window.dispatchEvent(new CustomEvent(CABIN_SELECT_EVENT, {
            detail: {
              sail_code: selectedSailCodeRef.current || null,
              cabin_category: rowData.cabinCategoryCode || null,
              row_data: rowData,
              timestamp: new Date().toISOString()
            }
          }));
        });

        instanceRef.current.on('rowDeselected', () => {
          window.dispatchEvent(new CustomEvent(CABIN_CLEAR_EVENT, {
            detail: {
              sail_code: selectedSailCodeRef.current || null,
              timestamp: new Date().toISOString()
            }
          }));
        });

        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[DirectAvailability] Error initializing table:', err);
      }
    };

    initTable();
    return () => {
      cancelled = true;
    };
  }, [columns, data, selectedSailCode, tableInitialized]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DirectAvailability] Error destroying table:', e);
        }
        instanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || !data) return;
    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) return;

    try {
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[DirectAvailability] Error updating data:', e);
    }
  }, [data, tableInitialized]);

  const subtitle = `${selectedSailCode} · ${packageName || '—'}${selectedSailDate ? ` · ${formatDayMon(selectedSailDate, '—')}` : ''}`;

  return (
    <div className="focus-panel talia-report direct-availability" role="region" aria-label="Direct availability">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Direct Availability</h2>
          <p className="talia-report__subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="direct-availability__callout talia-callout" role="note">
        <span className="direct-availability__callout-item">
          Source: [{queryInfo?.endpointSource || 'default'}] {queryInfo?.endpoint || '—'}
        </span>
        {validation?.status === 'matched' && (
          <span className="direct-availability__callout-item">
            Validated: {validation.matchedRows} rows match sail.select
          </span>
        )}
        {validation?.status === 'no_match' && (
          <span className="direct-availability__callout-item direct-availability__callout-item--warning">
            Validation failed: no rows matched selected sail
          </span>
        )}
      </div>

      <div className="talia-report__controls" aria-label="Direct availability controls">
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => setShowQueryDetails((prev) => !prev)}
        >
          {showQueryDetails ? '▼' : '▶'} Query
        </button>
      </div>

      <div className="talia-report__actions-bar" aria-label="Direct availability actions">
        <span className="direct-source__badge">{data?.length || 0} rows</span>
        {queryInfo?.executionTime ? <span className="direct-source__stats">{queryInfo.executionTime}ms</span> : null}
        <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {showQueryDetails ? (
        <div className="direct-source__query-panel">
          <div className="direct-source__query-title">GraphQL Query:</div>
          <pre className="direct-source__query-pre">{queryInfo?.query || 'No query'}</pre>
        </div>
      ) : null}

      <main className="talia-report__content">
        <div className="direct-source__table-container direct-availability__table-container">
          {loading ? (
            <div className="direct-source__loading-overlay">
              <div className="direct-source__loading-card">Querying external source...</div>
            </div>
          ) : null}
          <div ref={tableRef} className="direct-source__table-host talia-table" role="grid" />
        </div>
      </main>
    </div>
  );
};

export default DirectAvailabilityPresenter;
