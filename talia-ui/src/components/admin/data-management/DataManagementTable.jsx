import React, { useEffect, useMemo, useRef } from 'react';
import { buildDataManagementExport } from '../../../lib/dataManagementPrint';
import { initTabulator, getTabulatorOptions, observeTabulatorHost } from '../../../lib/tabulatorConfig';
import { formatDayMonYear, formatSailDateRange } from '../../../lib/dateFormat';
import { computeIntegrationHealth } from '../../../lib/integrationDateHealth.js';
import { getPanelActionIconMarkup, PANEL_ACTION_IDS } from '../../shared/panelActions';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return formatDayMonYear(value, String(value));
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dateLabel = formatDayMonYear(date, String(value));
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateLabel} ${timeLabel}`;
};

const formatRange = (range) => {
  if (!range || (!range.min && !range.max)) return 'N/A';
  if (range.min === range.max) return formatDate(range.min);
  return formatSailDateRange(range.min, range.max, 'N/A');
};

const formatDuration = (durationMs) => {
  if (durationMs === null || durationMs === undefined) return 'N/A';
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return durationMs < 1000 ? `${durationMs}ms` : `${seconds}s`;
};

const computeHealth = (table, configuredRange) => computeIntegrationHealth(table, configuredRange);

const getStatusVariant = (status) => {
  if (!status) return 'default';
  if (status.includes('Synced') && status.includes('Has Data')) return 'synced';
  if (status.includes('Outdated') || status.includes('Stale')) return 'outdated';
  if (status.includes('Never Synced') || status.includes('Not Synced')) return 'never';
  if (status.includes('Empty')) return 'empty';
  return 'default';
};

const getRowVariantClass = (rowData) => {
  if (!rowData) return 'dm-row--default';
  if (rowData._isSyncing) return 'dm-row--syncing';
  if (rowData._isBlocked) return 'dm-row--blocked';
  const variant = getStatusVariant(rowData.status || '');
  if (variant === 'synced') return 'dm-row--synced';
  if (variant === 'outdated') return 'dm-row--outdated';
  if (variant === 'never') return 'dm-row--never';
  if (variant === 'empty') return 'dm-row--empty';
  return 'dm-row--default';
};

const DataManagementTable = ({
  tableId,
  panelInstanceId = null,
  panelComponentId = 'data-management-panel',
  data,
  configuredRange,
  selectedTable,
  onSelectedTableChange,
  syncingTables,
  syncProgress,
  blockedTableName = null,
  statusLoadingTable,
  reviewLoading,
  onOpenStatus,
  tableActions,
}) => {
  const hostRef = useRef(null);
  const instanceRef = useRef(null);

  const rows = useMemo(() => (
    (data || []).map((table) => {
      const health = computeHealth(table, configuredRange);
      const isSyncing = syncingTables.has(table.tableName);
      const progress = syncProgress[table.tableName];
      return {
        ...table,
        _health: health,
        _isSyncing: isSyncing,
        _isBlocked: blockedTableName ? table.tableName === blockedTableName : false,
        _progress: progress,
      };
    })
  ), [blockedTableName, configuredRange, data, syncingTables, syncProgress]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    let cancelled = false;
    let stopObserve = () => {};

    const init = async () => {
      if (!hostRef.current) return;
      const Tabulator = await initTabulator();
      if (cancelled) return;

      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }

      const table = new Tabulator(hostRef.current, getTabulatorOptions({
        data: rowsRef.current || [],
        panelInstanceId,
        panelComponentId,
        exportTitle: 'Data management',
        buildExportPayload: () => buildDataManagementExport(rowsRef.current),
        index: 'tableName',
        height: '100%',
        selectableRows: 1,
        movableColumns: true,
        resizableColumns: true,
        responsiveLayout: 'collapse',
        responsiveLayoutCollapseUseFormatters: true,
        responsiveLayoutCollapseStartOpen: false,
        pagination: false,
        initialSort: [{ column: 'rowCount', dir: 'desc' }],
        columns: [
          { title: 'Table', field: 'tableName', minWidth: 140, headerFilter: 'input' },
          { title: 'Source', field: 'source', minWidth: 120, headerFilter: 'input' },
          { title: 'Load', field: 'loadMethod', hozAlign: 'center', minWidth: 90, headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true } },
          { title: 'Rows', field: 'rowCount', hozAlign: 'right', minWidth: 90, sorter: 'number', formatter: (cell) => (cell.getValue() || 0).toLocaleString() },
          { title: 'Range', field: 'dateRange', minWidth: 180, formatter: (cell) => formatRange(cell.getValue()) },
          { title: 'Last Sync', field: 'lastSync', minWidth: 170, formatter: (cell) => formatDateTime(cell.getValue()) },
          { title: 'Latest Data', field: 'latestAvailableData', minWidth: 170, formatter: (cell) => formatDateTime(cell.getValue()) },
          {
            title: 'Quality',
            field: '_health',
            minWidth: 170,
            formatter: (cell) => {
              const health = cell.getValue() || {};
              return `<span class="dm-health-chip dm-health-chip--${health.variant || 'unknown'}">${health.label || 'Unknown'}</span>
                <span class="dm-health-meta">${health.gridMeta || 'N/A'}</span>`;
            },
          },
          { title: 'Records', field: 'recordsProcessed', hozAlign: 'right', minWidth: 100, sorter: 'number', formatter: (cell) => cell.getValue() != null ? Number(cell.getValue()).toLocaleString() : '—' },
          { title: 'Changes', field: 'changesDetected', hozAlign: 'right', minWidth: 100, sorter: 'number', formatter: (cell) => cell.getValue() != null ? Number(cell.getValue()).toLocaleString() : '—' },
          { title: 'Duration', field: 'syncDuration', minWidth: 100, formatter: (cell) => formatDuration(cell.getValue()) },
          {
            title: 'Status',
            field: 'status',
            minWidth: 140,
            formatter: (cell) => {
              const row = cell.getRow().getData();
              if (row._isSyncing) {
                return `<span class="dm-status-badge dm-status-badge--default">Syncing ${row._progress?.percentage || 0}%</span>`;
              }
              const variant = getStatusVariant(cell.getValue() || '');
              return `<span class="dm-status-badge dm-status-badge--${variant}">${cell.getValue() || 'N/A'}</span>`;
            },
          },
          {
            title: 'Actions',
            field: '_actions',
            minWidth: 210,
            formatter: (cell) => {
              const row = cell.getRow().getData();
              if (row.hasSyncConfig !== true) return '<span class="dm-action-placeholder">—</span>';
              const statusBusy = statusLoadingTable === row.tableName;
              const stopButton = row._isSyncing
                ? `<button class="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--danger" data-action="stop" title="Stop this sync">${getPanelActionIconMarkup(PANEL_ACTION_IDS.STOP)}</button>`
                : '';
              return `
                <div class="talia-action-group dm-actions-inline">
                  <button class="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--neutral" data-action="status" ${statusBusy ? 'disabled' : ''}>${getPanelActionIconMarkup(PANEL_ACTION_IDS.STATUS, { busy: statusBusy })}</button>
                  <button class="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--success" data-action="review" ${reviewLoading ? 'disabled' : ''}>${getPanelActionIconMarkup(PANEL_ACTION_IDS.REVIEW, { busy: reviewLoading })}</button>
                  <button class="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--primary" data-action="sync" ${row._isSyncing ? 'disabled' : ''}>${getPanelActionIconMarkup(PANEL_ACTION_IDS.SYNC, { busy: row._isSyncing })}</button>
                  <button class="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--warning" data-action="full" ${row._isSyncing ? 'disabled' : ''}>${getPanelActionIconMarkup(PANEL_ACTION_IDS.FULL, { busy: row._isSyncing })}</button>
                  ${stopButton}
                </div>`;
            },
            cellClick: (event, cell) => {
              const target = event?.target?.closest?.('button[data-action]');
              if (!target) return;
              const action = target.getAttribute('data-action');
              const row = cell.getRow().getData();
              if (action === 'status') onOpenStatus(row);
              if (action === 'review') tableActions.handleReview(row);
              if (action === 'sync') tableActions.handleIncrementalSync(row);
              if (action === 'full') tableActions.handleFullSync(row);
              if (action === 'stop') tableActions.handleStop(row);
            },
          },
        ],
        rowFormatter: (row) => {
          const rowData = row.getData();
          const rowEl = row.getElement();
          rowEl.classList.remove('dm-row--synced', 'dm-row--outdated', 'dm-row--never', 'dm-row--empty', 'dm-row--default', 'dm-row--syncing', 'dm-row--blocked');
          rowEl.classList.add(getRowVariantClass(rowData));
        },
      }));

      instanceRef.current = table;
      table.on('tableBuilt', () => {
        if (cancelled) return;
        try {
          table.replaceData(rowsRef.current || []);
          table.redraw(true);
        } catch { /* destroyed */ }
      });
      stopObserve = observeTabulatorHost(hostRef.current, () => instanceRef.current);

      table.on('rowClick', (_event, row) => {
        const rowData = row?.getData?.();
        if (rowData?.tableName && typeof onSelectedTableChange === 'function') {
          onSelectedTableChange(rowData.tableName);
        }
        try { row?.select?.(); } catch { /* noop */ }
      });

      instanceRef.current.on('rowSelected', (row) => {
        const rowData = row?.getData?.();
        if (rowData?.tableName && typeof onSelectedTableChange === 'function') {
          onSelectedTableChange(rowData.tableName);
        }
      });
    };

    init();
    return () => {
      cancelled = true;
      stopObserve();
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelComponentId, panelInstanceId]);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table) return;
    try {
      table.replaceData(rows || []);
      if (hostRef.current && hostRef.current.clientHeight >= 8) table.redraw(true);
    } catch { /* not built yet */ }
  }, [rows]);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table) return;
    if (!selectedTable) {
      table.deselectRow?.();
      return;
    }
    try {
      table.selectRow?.(selectedTable);
    } catch {
      // no-op
    }
  }, [selectedTable]);

  return <div id={tableId} ref={hostRef} className="dm-tabulator" />;
};

export default DataManagementTable;
