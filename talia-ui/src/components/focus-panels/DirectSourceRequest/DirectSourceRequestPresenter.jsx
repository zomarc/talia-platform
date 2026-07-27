/**
 * Direct Source Request Presenter Component
 *
 * Displays results from external GraphQL queries in a Tabulator table.
 * Uses standard talia-report shell vocabulary.
 */

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';
import { ReportTableOrRecord } from '../../shared/ReportRecordForm';

const DirectSourceRequestPresenter = ({
  data,
  loading,
  queryInfo,
  onRefresh,
  testMode = false,
  onToggleTestMode,
  manualDates = {},
  onDateChange,
  onTestQuery,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [tableInitialized, setTableInitialized] = useState(false);
  const [showQueryDetails, setShowQueryDetails] = useState(false);
  const lastDataRef = useRef(null);

  const columns = [
    {
      title: 'Package Code',
      field: 'packageCode',
      width: 120,
      headerFilter: 'input',
      headerFilterPlaceholder: 'Filter...',
    },
    {
      title: 'Package Name',
      field: 'packageName',
      widthGrow: 2,
      headerFilter: 'list',
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true,
      },
    },
    {
      title: 'Sail Date',
      field: 'sailDate',
      width: 120,
      sorter: 'date',
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return 'N/A';
        return formatDayMon(value, 'N/A');
      },
    },
    {
      title: 'Days',
      field: 'sailDays',
      hozAlign: 'center',
      width: 80,
      headerFilter: 'number',
    },
    {
      title: 'Cabin Category',
      field: 'cabinCategoryCode',
      width: 130,
      headerFilter: 'list',
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true,
      },
    },
    {
      title: 'Availability',
      field: 'availabilityResult',
      width: 120,
      headerFilter: 'list',
      headerFilterParams: {
        valuesLookup: true,
        autocomplete: true,
      },
      formatter: (cell) => {
        const value = cell.getValue();
        if (!value) return '';
        let variant = 'neutral';
        if (value === 'AVAILABLE') variant = 'available';
        else if (value === 'LIMITED') variant = 'limited';
        else if (value === 'SOLD_OUT' || value === 'UNAVAILABLE') variant = 'unavailable';
        return `<span class="direct-source__availability direct-source__availability--${variant}">${value}</span>`;
      },
    },
    {
      title: 'Can Book',
      field: 'canBookCabins',
      hozAlign: 'center',
      width: 100,
      formatter: 'tickCross',
      headerFilter: 'tickCross',
      headerFilterParams: { tristate: true },
    },
    {
      title: 'Nested',
      field: 'canBookNestedCabins',
      hozAlign: 'center',
      width: 90,
      formatter: 'tickCross',
      headerFilterParams: { tristate: true },
    },
    {
      title: 'Total Cabins',
      field: 'totalCabins',
      hozAlign: 'right',
      width: 110,
      headerFilter: 'number',
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      },
    },
    {
      title: 'Available',
      field: 'availableCabins',
      hozAlign: 'right',
      width: 100,
      headerFilter: 'number',
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      },
    },
    {
      title: 'Absolute',
      field: 'totalAvailableAbsolute',
      hozAlign: 'right',
      width: 100,
      headerFilter: 'number',
      formatter: (cell) => {
        const value = cell.getValue();
        return value ? value.toLocaleString() : '0';
      },
    },
    {
      title: 'Weighted',
      field: 'totalAvailableWeighted',
      hozAlign: 'right',
      width: 100,
      headerFilter: 'number',
      formatter: (cell) => {
        const value = cell.getValue();
        return value !== null && value !== undefined ? value.toFixed(2) : '0.00';
      },
    },
  ];

  const context = queryInfo?.variables?._context || {};
  const validation = queryInfo?.validation || null;
  const selectedSailCode = context?.sailCode || null;
  const selectedSailDate = context?.sailDate || null;
  const rangeDaysBefore = context?.rangeDaysBefore;
  const rangeDaysAfter = context?.rangeDaysAfter;

  const availabilitySummary = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        beforeAvailable: 0,
        afterAvailable: 0,
        selectedAvailable: 0,
        beforeCount: 0,
        afterCount: 0,
        selectedCount: 0,
        matchedCount: 0,
      };
    }

    const anchorDate = selectedSailDate ? new Date(selectedSailDate) : null;
    const anchorDay = anchorDate && !Number.isNaN(anchorDate.getTime())
      ? anchorDate.toISOString().split('T')[0]
      : null;

    let beforeAvailable = 0;
    let afterAvailable = 0;
    let selectedAvailable = 0;
    let beforeCount = 0;
    let afterCount = 0;
    let selectedCount = 0;
    let matchedCount = 0;

    data.forEach((row) => {
      if (row?.isSelectedSail) matchedCount += 1;
      if (!anchorDay || !row?.sailDate) return;
      const rowDate = new Date(row.sailDate);
      if (Number.isNaN(rowDate.getTime())) return;
      const rowDay = rowDate.toISOString().split('T')[0];
      if (rowDay < anchorDay) {
        beforeAvailable += Number(row.availableCabins || 0);
        beforeCount += 1;
      } else if (rowDay > anchorDay) {
        afterAvailable += Number(row.availableCabins || 0);
        afterCount += 1;
      } else {
        selectedAvailable += Number(row.availableCabins || 0);
        selectedCount += 1;
      }
    });

    return {
      beforeAvailable,
      afterAvailable,
      selectedAvailable,
      beforeCount,
      afterCount,
      selectedCount,
      matchedCount,
    };
  }, [data, selectedSailDate]);

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

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data,
          columns,
          height: '100%',
          selectableRows: 1,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [{ column: 'packageName', dir: 'asc' }],
          rowClick: (e, row) => {
            try { row?.select?.(); } catch { /* noop */ }
          },
          rowFormatter: (row) => {
            const rowElement = row.getElement();
            const rowData = row.getData();
            if (rowData?.isSelectedSail) {
              rowElement.classList.add('direct-source__row--selected');
            } else {
              rowElement.classList.remove('direct-source__row--selected');
            }
          },
          rowSelectionChanged: (selectedData) => {
            const rec = selectedData && selectedData[0];
            if (rec) {
              window.dispatchEvent(new CustomEvent('talia:directsource.select', {
                detail: {
                  source: 'DirectSourceRequest',
                  row_data: rec,
                  timestamp: new Date().toISOString(),
                },
              }));
            }
          },
        }));

        lastDataRef.current = data ? JSON.stringify(data) : null;
        setTableInitialized(true);
      } catch (err) {
        console.error('[DirectSourceRequest] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
    };
  }, [data, tableInitialized]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('[DirectSourceRequest] Error destroying table:', e);
        }
        instanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tableInitialized || !instanceRef.current || !data) return;

    const currentDataStr = data ? JSON.stringify(data) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      instanceRef.current.replaceData(data);
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[DirectSourceRequest] Error updating data:', e);
    }
  }, [data, tableInitialized]);

  const onRecordActive = useCallback((rec) => {
    if (!rec) return;
    window.dispatchEvent(new CustomEvent('talia:directsource.select', {
      detail: {
        source: 'DirectSourceRequest',
        row_data: rec,
        timestamp: new Date().toISOString(),
      },
    }));
  }, []);

  const formatDateLabel = (value) => {
    if (!value) return '—';
    return formatDayMon(value, '—');
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '0';
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? '0' : numberValue.toLocaleString();
  };

  const getContextDisplay = () => {
    const ctx = queryInfo?.variables?._context || {};

    if (testMode) {
      return 'Manual Date Selection';
    }

    if (ctx.fallbackReason) {
      return 'Fallback: Next 4 Weeks';
    }

    if (ctx.sailDate) {
      return `From Sail: ${formatDayMon(ctx.sailDate, '—')}`;
    }

    if (ctx.source === 'persisted-event') {
      return 'From Selected Event';
    }

    return 'Default Range';
  };

  const endpointLabel = queryInfo?.endpointSource
    ? `[${queryInfo.endpointSource}]`
    : '';
  const endpointSummary = queryInfo?.endpoint
    ? `${endpointLabel} ${queryInfo.endpoint}`.trim()
    : 'No endpoint';

  const subtitleParts = [
    `${data?.length || 0} results`,
    queryInfo?.executionTime ? `${queryInfo.executionTime}ms` : null,
    endpointLabel || null,
  ].filter(Boolean);

  const showValidationCallout = validation?.status === 'matched' || validation?.status === 'no_match';
  const showFallbackCallout = Boolean(queryInfo?.variables?._context?.fallbackReason);
  const showParityCallout = Boolean(queryInfo?.parity);

  return (
    <div className="focus-panel talia-report direct-source" role="region" aria-label="Direct source request">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Direct Source Request</h2>
          <p className="talia-report__subtitle">{subtitleParts.join(' · ')}</p>
        </div>
      </header>

      {showValidationCallout ? (
        <div className="direct-source__callout talia-callout" role="note">
          {validation?.status === 'matched' ? (
            <span>
              Validated against sail.select: {validation.matchedRows} rows matched
              {validation.totalRows != null ? ` of ${validation.totalRows} total` : ''}
            </span>
          ) : (
            <span className="direct-source__callout-item--warning">
              Validation failed: no direct rows matched selected sail
              {validation?.selectedSailCode ? ` (${validation.selectedSailCode})` : ''}
            </span>
          )}
        </div>
      ) : null}

      {showFallbackCallout ? (
        <div className="direct-source__callout talia-callout" role="note">
          <span>{queryInfo.variables._context.fallbackReason} — showing next 4 weeks instead</span>
        </div>
      ) : null}

      {showParityCallout ? (
        <div className="direct-source__callout talia-callout" role="note">
          <span className="direct-source__context-label">Parity:</span>
          <span>
            {queryInfo.parity.error
              ? `error (${queryInfo.parity.error})`
              : `rows ${queryInfo.parity.directRows}/${queryInfo.parity.localRows}, Δavail ${queryInfo.parity.availableDelta}`}
          </span>
        </div>
      ) : null}

      <div className="talia-report__controls" aria-label="Direct source request controls">
        <span className="direct-source__source">{endpointSummary}</span>
        <button
          type="button"
          className="talia-btn talia-btn--secondary"
          onClick={() => setShowQueryDetails((prev) => !prev)}
          title="Show/hide query details"
        >
          {showQueryDetails ? '▼' : '▶'} Query
        </button>
        <label className="direct-source__test-toggle">
          <input
            type="checkbox"
            checked={testMode}
            onChange={onToggleTestMode}
            className="direct-source__test-checkbox"
          />
          <span className="direct-source__test-label">Test Mode</span>
        </label>
      </div>

      {testMode ? (
        <div className="direct-source__filters talia-report-filters" aria-label="Test mode date filters">
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Effective Date</span>
            <input
              type="date"
              value={manualDates.effectiveDate || ''}
              onChange={(e) => onDateChange('effectiveDate', e.target.value)}
              className="talia-report-filters__input"
            />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Start Date</span>
            <input
              type="date"
              value={manualDates.startDate || ''}
              onChange={(e) => onDateChange('startDate', e.target.value)}
              className="talia-report-filters__input"
            />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">End Date</span>
            <input
              type="date"
              value={manualDates.endDate || ''}
              onChange={(e) => onDateChange('endDate', e.target.value)}
              className="talia-report-filters__input"
            />
          </label>
          <span className="direct-source__test-note">Override event context with manual dates</span>
        </div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Direct source request actions">
        {testMode ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={onTestQuery}
            disabled={loading}
          >
            {loading ? 'Querying…' : 'Execute Test Query'}
          </button>
        ) : onRefresh ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Querying…' : 'Query'}
          </button>
        ) : null}
      </div>

      {showQueryDetails ? (
        <div className="direct-source__query-panel">
          <div className="direct-source__query-title">GraphQL Query:</div>
          <pre className="direct-source__query-pre">{queryInfo?.query || 'No query'}</pre>
          {queryInfo?.variables ? (
            <>
              <div className="direct-source__query-title direct-source__query-title--spaced">Variables:</div>
              <pre className="direct-source__query-pre">
                {JSON.stringify({
                  effectiveDate: queryInfo.variables.effectiveDate,
                  startDateFrom: queryInfo.variables.startDateFrom,
                  startDateTo: queryInfo.variables.startDateTo,
                }, null, 2)}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}

      <main className="talia-report__content">
          <div className="direct-source__summary">
            <div className="direct-source__summary-card">
              <div className="direct-source__summary-label">Sail Code</div>
              <div className="direct-source__summary-value">{selectedSailCode || '—'}</div>
              {availabilitySummary.matchedCount > 0 ? (
                <div className="direct-source__summary-meta">
                  {availabilitySummary.matchedCount.toLocaleString()} matches in data
                </div>
              ) : null}
            </div>
            <div className="direct-source__summary-card">
              <div className="direct-source__summary-label">Sail Date</div>
              <div className="direct-source__summary-value">{formatDateLabel(selectedSailDate)}</div>
              {availabilitySummary.selectedCount > 0 ? (
                <div className="direct-source__summary-meta">
                  Selected day cabins: {formatNumber(availabilitySummary.selectedAvailable)}
                </div>
              ) : null}
            </div>
            <div className="direct-source__summary-card">
              <div className="direct-source__summary-label">Query Window</div>
              <div className="direct-source__summary-value">
                {queryInfo?.variables
                  ? `${queryInfo.variables.startDateFrom} → ${queryInfo.variables.startDateTo}`
                  : '—'}
              </div>
              {Number.isFinite(rangeDaysBefore) && Number.isFinite(rangeDaysAfter) ? (
                <div className="direct-source__summary-meta">
                  {rangeDaysBefore} days before / {rangeDaysAfter} days after
                </div>
              ) : null}
            </div>
            <div className="direct-source__summary-card">
              <div className="direct-source__summary-label">Availability</div>
              <div className="direct-source__summary-value">
                Before {formatNumber(availabilitySummary.beforeAvailable)} • After {formatNumber(availabilitySummary.afterAvailable)}
              </div>
              {(availabilitySummary.beforeCount > 0 || availabilitySummary.afterCount > 0) ? (
                <div className="direct-source__summary-meta">
                  {availabilitySummary.beforeCount + availabilitySummary.afterCount} rows around selection
                </div>
              ) : null}
            </div>
          </div>

          <div className="direct-source__context-bar direct-source__context-bar--meta" aria-label="Query context metadata">
            <div className="direct-source__context-item">
              <span className="direct-source__context-label">Context:</span>
              <span className="direct-source__context-value">{getContextDisplay()}</span>
            </div>
            {queryInfo?.variables ? (
              <>
                <div className="direct-source__context-item">
                  <span className="direct-source__context-label">From:</span>
                  <span className="direct-source__context-value">{queryInfo.variables.startDateFrom}</span>
                </div>
                <div className="direct-source__context-item">
                  <span className="direct-source__context-label">To:</span>
                  <span className="direct-source__context-value">{queryInfo.variables.startDateTo}</span>
                </div>
              </>
            ) : null}
            {queryInfo?.lastExecuted ? (
              <div className="direct-source__context-item">
                <span className="direct-source__context-label">Executed:</span>
                <span className="direct-source__context-value">
                  {new Date(queryInfo.lastExecuted).toLocaleTimeString()}
                </span>
              </div>
            ) : null}
            {Number.isFinite(queryInfo?.retryCount) ? (
              <div className="direct-source__context-item">
                <span className="direct-source__context-label">Retries:</span>
                <span className="direct-source__context-value">{queryInfo.retryCount}</span>
              </div>
            ) : null}
          </div>

          <div className="direct-source__table-container">
            {loading ? (
              <div className="direct-source__loading-overlay">
                <div className="direct-source__loading-card">Querying external source...</div>
              </div>
            ) : null}
            <ReportTableOrRecord
              data={data}
              columns={columns}
              tableRef={tableRef}
              tableClassName="direct-source__table-host talia-table"
              tableProps={{ role: 'grid' }}
              onRecordActive={onRecordActive}
              ariaLabel="Direct source record"
            />
          </div>
      </main>
    </div>
  );
};

export default DirectSourceRequestPresenter;
