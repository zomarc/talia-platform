import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions, captureTableScroll, restoreTableScrollSoon } from '../../../lib/tabulatorConfig';
import { emitSailSelect, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { chainRowFormatters, createReferenceRowFormatter, refreshReferenceRowClasses } from '../../../lib/tabulatorReferenceSelection';
import { formatDayMonYy, formatMonYear } from '../../../lib/dateFormat';
import { clipAnchorRectToViewport } from '../../../lib/clipAnchorRect';
import { ALL_DEPARTURE_MONTH_KEY } from '../../../lib/globalDepartureMonth';
import { useGlobalDepartureMonth } from '../../../hooks/useGlobalDepartureMonth';
import { useGlobalDemandUnit } from '../../../hooks/useGlobalDemandUnit';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  demandUnitNoun,
  toDemandVolume,
} from '../../../lib/demandUnit';
import DistributionSummary from '../../shared/DistributionSummary';
import MsePerformanceSummary from '../../shared/MsePerformanceSummary';
import HoverPreview from '../../shared/HoverPreview';
import {
  payloadFromTabulator,
  registerPanelDataExport,
} from '../../../lib/panelDataExport';
import {
  buildExplorerDisplayRows,
  masterRowMatchesReference,
  resolveSelectionReferenceCode,
} from './masterSailingExplorerTransform';

const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

const FILTER_FIELDS = [
  ['sail_date_from', 'Departure'],
  ['sail_code', 'Sail Code'],
  ['sail_days', 'Duration'],
  ['package_name', 'Package'],
  ['package_type', 'Type'],
  ['route', 'Route'],
];

const GROUP_BY = [
  (rowData) => {
    if (rowData?.row_type === 'day') {
      return rowData?.departure_month_label || 'Unknown month';
    }
    const dateValue = rowData?.sail_date_from;
    if (dateValue) {
      const formatted = formatMonYear(dateValue, '');
      if (formatted) return formatted;
    }
    return rowData?.departure_month_label || 'Unknown month';
  },
  (rowData) => rowData?.ship_group_label || 'Unknown ship',
];

const GROUP_MAX_DEPTH = GROUP_BY.length;

const groupHeaders = [
  (value, count) => `<span class="master-sailing-group master-sailing-group--month">${value} (${count})</span>`,
  (value, count) => `<span class="master-sailing-group master-sailing-group--ship">${value} (${count})</span>`,
];

const formatCount = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatPercent = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const buildSelectValues = (rows, field) => {
  const masterRows = (rows || []).filter((row) => row?.row_type === 'master');
  const values = [...new Set(
    masterRows
      .map((row) => row?.[field])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return values.reduce((acc, value) => {
    acc[value] = value;
    return acc;
  }, { '': 'All' });
};

const formatSegmentHighlights = (segments = []) => {
  if (!segments.length) return '<span class="ms-explorer-segments ms-explorer-segments--empty">—</span>';
  const items = segments.map((segment) => {
    const guests = Number.parseFloat(segment?.guests ?? segment?.booked);
    const guestsValue = Number.isFinite(guests) && guests > 0 ? guests : 0;
    const guestsLabel = `${guestsValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const bookingClass = segment?.is_booking ? 'ms-explorer-segment--booking' : 'ms-explorer-segment--active';
    return `<span class="ms-explorer-segment ${bookingClass}" title="${segment.sail_code}: ${guestsLabel} guests (selling)"><span class="ms-explorer-segment__code">${segment.sail_code}</span><span class="ms-explorer-segment__metrics">${guestsLabel}</span></span>`;
  }).join('');
  return `<span class="ms-explorer-segments">${items}</span>`;
};

const MasterSailingExplorerPresenter = ({
  masters,
  dayDetailsByMaster,
  distributionBySailCode = null,
  distributionLoading = false,
  onDistributionIntent = null,
  marketDimension = 'market_group',
  bookedComposition = 'group_fit_expected',
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const didApplyInitialGroupOpenRef = useRef(false);
  const suppressMonthAutoOpenRef = useRef(false);
  const suppressClearOnRefreshRef = useRef(false);
  const selectedReferenceRef = useRef(
    resolveSelectionReferenceCode(typeof window !== 'undefined' ? window.lastSailSelectEvent?.detail : null)
  );
  const pendingGroupActionRef = useRef(null);
  const groupCycleDepthRef = useRef(1);
  const distributionBySailCodeRef = useRef(distributionBySailCode);
  const onDistributionIntentRef = useRef(onDistributionIntent);
  const [expandedMasters, setExpandedMasters] = useState(() => new Set());
  const {
    viewsState,
    setView,
    showFilters,
    showControls,
    showTooltip,
    tooltipView,
    reportShellClassName,
  } = useReportShellOptions(
    panelComponentId || 'master-sailing-explorer',
    panelInstanceId
  );
  const viewMode = viewsState.viewMode === 'flat' ? 'flat' : 'nested';
  const segmentsVisible = viewsState.segments === true;
  const showTooltipRef = useRef(showTooltip);
  const tooltipViewRef = useRef(tooltipView);
  showTooltipRef.current = showTooltip;
  tooltipViewRef.current = tooltipView;
  const [hoverPreview, setHoverPreview] = useState(null);
  const departureMonth = useGlobalDepartureMonth();
  useEffect(() => {
    if (!showTooltip) setHoverPreview(null);
  }, [showTooltip]);
  const demandUnit = useGlobalDemandUnit();
  const demandNoun = demandUnitNoun(demandUnit);
  const previousDepartureMonthRef = useRef(departureMonth);

  // When a global departure month is chosen, prefer Flat (keeps Nested available).
  useEffect(() => {
    const prev = previousDepartureMonthRef.current;
    previousDepartureMonthRef.current = departureMonth;
    if (departureMonth === ALL_DEPARTURE_MONTH_KEY) return;
    if (prev === departureMonth) return;
    setView('viewMode', 'flat');
  }, [departureMonth, setView]);

  useEffect(() => {
    distributionBySailCodeRef.current = distributionBySailCode;
  }, [distributionBySailCode]);
  useEffect(() => {
    onDistributionIntentRef.current = onDistributionIntent;
  }, [onDistributionIntent]);
  const [filters, setFilters] = useState({
    sail_code: '',
    sail_date_from: '',
    sail_days: '',
    package_name: '',
    package_type: '',
    route: '',
  });

  const displayRows = useMemo(
    () => buildExplorerDisplayRows(masters, dayDetailsByMaster, expandedMasters),
    [masters, dayDetailsByMaster, expandedMasters]
  );
  const displayRowsRef = useRef(displayRows);
  useEffect(() => {
    displayRowsRef.current = displayRows;
  }, [displayRows]);

  const masterCount = masters?.length || 0;
  const filterOptions = useMemo(
    () => Object.fromEntries(FILTER_FIELDS.map(([field]) => [field, buildSelectValues(masters, field)])),
    [masters]
  );

  const toggleMasterExpanded = useCallback((masterCode) => {
    if (!masterCode) return;
    setExpandedMasters((prev) => {
      const next = new Set(prev);
      if (next.has(masterCode)) next.delete(masterCode);
      else next.add(masterCode);
      return next;
    });
  }, []);

  const handleExpandToggle = useCallback((event, rowData) => {
    event?.stopPropagation?.();
    if (rowData?.row_type !== 'master' || !rowData?.is_expandable) return;
    toggleMasterExpanded(rowData.sail_code);
  }, [toggleMasterExpanded]);

  const expandAllMasters = useCallback(() => {
    setExpandedMasters(new Set((masters || []).map((row) => String(row.sail_code || '').trim()).filter(Boolean)));
  }, [masters]);

  const collapseAllMasters = useCallback(() => {
    setExpandedMasters(new Set());
  }, []);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        field: 'expand_toggle',
        title: '',
        width: 34,
        hozAlign: 'center',
        headerSort: false,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row?.row_type !== 'master' || !row?.is_expandable) return '';
          return row?.is_expanded ? '▾' : '▸';
        },
        cellClick: (event, cell) => {
          handleExpandToggle(event, cell.getRow().getData());
        },
      },
      {
        field: 'sail_date_from',
        title: 'Date',
        headerTooltip: 'Departure date',
        width: 96,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row?.row_type === 'day') return `Day ${row?.voyage_day_index || ''}`;
          return formatDayMonYy(cell.getValue(), '');
        },
        headerSort: viewMode === 'flat',
      },
      {
        field: 'row_label',
        title: 'Sail/Day',
        headerTooltip: 'Master sail / voyage day',
        minWidth: 130,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row?.row_type === 'day') {
            return formatDayMonYy(row?.voyage_day_date, row?.day_label || '');
          }
          return row?.sail_code || '';
        },
        headerSort: false,
      },
    ];

    if (segmentsVisible) {
      baseColumns.push({
        field: 'contributing_segments',
        title: 'Segs',
        headerTooltip: 'Contributing segments',
        minWidth: 220,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row?.row_type === 'day') {
            return formatSegmentHighlights(row?.contributing_segments);
          }
          return formatSegmentHighlights(row?.segment_summaries || []);
        },
        headerSort: false,
      });
    }

    baseColumns.push(
      {
        field: 'sail_days',
        title: 'Dur',
        headerTooltip: 'Duration',
        hozAlign: 'center',
        width: 72,
        headerSort: false,
      },
      {
        field: 'package_name',
        title: 'Pkg',
        headerTooltip: 'Package',
        minWidth: 120,
        headerSort: false,
      },
      {
        field: 'route',
        titleShort: 'Route',
        titleLong: 'Route',
        width: 96,
        headerSort: false,
      },
      {
        field: 'berths_occupied',
        titleShort: 'Bk B',
        titleLong: 'Booked (berths)',
        hozAlign: 'right',
        width: 100,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const value = row?.row_type === 'day' ? row?.booked : row?.total_booked;
          return formatCount(value);
        },
        headerSort: false,
      },
      {
        field: 'total_cabins',
        titleShort: 'Tot C',
        titleLong: 'Nameplate cabins',
        hozAlign: 'right',
        width: 96,
        formatter: (cell) => formatCount(cell.getRow().getData()?.total_cabins),
        headerSort: false,
      },
      {
        field: 'offsale_cabins',
        titleShort: 'Off C',
        titleLong: 'Offsale / blocked cabins',
        hozAlign: 'right',
        width: 88,
        formatter: (cell) => formatCount(cell.getRow().getData()?.offsale_cabins),
        headerSort: false,
      },
      {
        field: 'booked_cabins',
        titleShort: 'Bk C',
        titleLong: 'Booked cabins',
        hozAlign: 'right',
        width: 104,
        formatter: (cell) => formatCount(cell.getRow().getData()?.booked_cabins),
        headerSort: false,
      },
      {
        field: 'booked_guests',
        titleShort: 'Booked',
        titleLong: `Booked ${demandNoun} (real / materialised; presentation from guests)`,
        hozAlign: 'right',
        width: 96,
        formatter: (cell) => formatCount(
          toDemandVolume(cell.getRow().getData()?.booked_guests, demandUnit)
        ),
        headerSort: false,
      },
      {
        field: 'estimated_guests',
        titleShort: 'Est',
        titleLong: `Estimated ${demandNoun} (contracted × probability; presentation from guests)`,
        hozAlign: 'right',
        width: 88,
        formatter: (cell) => formatCount(
          toDemandVolume(cell.getRow().getData()?.estimated_guests, demandUnit)
        ),
        headerSort: false,
      },
      {
        field: 'contracted_guests',
        titleShort: 'Contr',
        titleLong: `Contracted ${demandNoun} (synthetic group OF face; presentation from guests)`,
        hozAlign: 'right',
        width: 96,
        formatter: (cell) => formatCount(
          toDemandVolume(cell.getRow().getData()?.contracted_guests, demandUnit)
        ),
        headerSort: false,
      },
      {
        field: 'guaranteed_cabins',
        titleShort: 'Res C',
        titleLong: 'Reserved cabins (group × probability)',
        hozAlign: 'right',
        width: 184,
        formatter: (cell) => formatCount(cell.getRow().getData()?.guaranteed_cabins),
        headerSort: false,
      },
      {
        field: 'actual_booked_pct',
        titleShort: 'Bk%',
        titleLong: 'Actual booked cabins %',
        hozAlign: 'right',
        width: 92,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const pct = row?.row_type === 'day'
            ? (
              Number(row?.sellable_cabins || row?.total_cabins) > 0
                ? (Number(row?.booked_cabins || 0) / Number(row?.sellable_cabins || row?.total_cabins)) * 100
                : null
            )
            : row?.actual_booked_pct;
          return formatPercent(pct);
        },
        headerSort: false,
      },
      {
        field: 'potential_booked_pct',
        titleShort: 'Pot%',
        titleLong: 'Potential booked cabins % (booked + reserved)',
        hozAlign: 'right',
        width: 102,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const pct = row?.row_type === 'day'
            ? (
              Number(row?.sellable_cabins || row?.total_cabins) > 0
                ? ((Number(row?.booked_cabins || 0) + Number(row?.guaranteed_cabins || 0)) / Number(row?.sellable_cabins || row?.total_cabins)) * 100
                : null
            )
            : row?.potential_booked_pct;
          return formatPercent(pct);
        },
        headerSort: false,
      },
      {
        field: 'booking_upside_pct',
        titleShort: 'Up%',
        titleLong: 'Upside % (potential - actual)',
        hozAlign: 'right',
        width: 92,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const pct = row?.row_type === 'day'
            ? (
              Number(row?.sellable_cabins || row?.total_cabins) > 0
                ? ((Number(row?.guaranteed_cabins || 0) / Number(row?.sellable_cabins || row?.total_cabins)) * 100)
                : null
            )
            : row?.booking_upside_pct;
          return formatPercent(pct);
        },
        headerSort: false,
      },
      {
        field: 'target_review_status',
        titleShort: 'vs Tgt',
        titleLong: 'Actual cabin LF vs active target (behind / on / ahead)',
        hozAlign: 'center',
        width: 88,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row?.row_type === 'day') return '';
          const status = row?.target_review_status;
          if (!status || status === 'unknown') return '—';
          const gap = row?.target_gap_pp;
          const gapTxt = gap != null && Number.isFinite(Number(gap))
            ? ` ${Number(gap) > 0 ? '+' : ''}${Number(gap).toFixed(0)}`
            : '';
          const label =
            status === 'behind' ? `▼${gapTxt}` : status === 'ahead' ? `▲${gapTxt}` : `●${gapTxt}`;
          const el = document.createElement('span');
          el.className = `mse-target-review mse-target-review--${status}`;
          el.textContent = label;
          el.title = [
            row?.target_profile_name ? `Target: ${row.target_profile_name}` : null,
            row?.target_lf_pct != null ? `Goal ${Number(row.target_lf_pct).toFixed(1)}%` : null,
            status,
          ]
            .filter(Boolean)
            .join(' · ');
          return el;
        },
        headerSort: false,
      },
      {
        field: 'berth_capacity',
        titleShort: 'Cap B',
        titleLong: 'Capacity (berths)',
        hozAlign: 'right',
        width: 108,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const value = row?.row_type === 'day' ? row?.capacity : row?.total_capacity;
          return formatCount(value);
        },
        headerSort: false,
      },
      {
        field: 'berths_available',
        titleShort: 'Avl B',
        titleLong: 'Available (berths)',
        hozAlign: 'right',
        width: 88,
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const value = row?.row_type === 'day' ? row?.available : row?.total_available;
          return formatCount(value);
        },
        headerSort: false,
      }
    );

    return baseColumns;
  }, [demandNoun, demandUnit, handleExpandToggle, segmentsVisible, viewMode]);

  const openOnlyMonthGroup = useCallback((targetGroup) => {
    const table = instanceRef.current;
    if (!table || !targetGroup) return;
    const topGroups = table.getGroups?.() || [];
    topGroups.forEach((group) => {
      if (!group) return;
      if (group === targetGroup) group.show?.();
      else group.hide?.();
    });
  }, []);

  const openFirstMonthOnly = useCallback(() => {
    const table = instanceRef.current;
    if (!table) return;
    const topGroups = table.getGroups?.() || [];
    topGroups.forEach((group, index) => {
      if (!group) return;
      if (index === 0) {
        group.show?.();
        const shipGroups = group.getSubGroups?.() || [];
        if (shipGroups[0]) shipGroups[0].show?.();
      } else {
        group.hide?.();
      }
    });
  }, []);

  const applyGroupDepth = useCallback((depth) => {
    const table = instanceRef.current;
    const targetDepth = Math.max(0, Math.min(depth, GROUP_MAX_DEPTH));
    groupCycleDepthRef.current = targetDepth;
    if (!table) return targetDepth;
    if (viewMode === 'flat') return targetDepth;
    if (!tableBuiltRef.current) {
      pendingGroupActionRef.current = `depth:${targetDepth}`;
      return targetDepth;
    }
    const groupStartOpen = Array.from({ length: GROUP_MAX_DEPTH }, (_unused, index) => index < targetDepth);
    table.setGroupStartOpen?.(groupStartOpen);
    table.setGroupBy?.(GROUP_BY);
    table.setData?.(table.getData?.() || []);
    return targetDepth;
  }, [viewMode]);

  const collapseAllGroups = useCallback(() => {
    applyGroupDepth(0);
  }, [applyGroupDepth]);

  const openAllGroups = useCallback(() => {
    applyGroupDepth(GROUP_MAX_DEPTH);
  }, [applyGroupDepth]);

  const cycleGroupState = useCallback(() => {
    const nextDepth = (groupCycleDepthRef.current + 1) % (GROUP_MAX_DEPTH + 1);
    return applyGroupDepth(nextDepth);
  }, [applyGroupDepth]);

  const getGroupCycleState = useCallback(() => ({
    depth: groupCycleDepthRef.current,
    maxDepth: GROUP_MAX_DEPTH,
  }), []);

  const isReferenceMasterRow = useCallback((data) => (
    data?.row_type === 'master'
    && masterRowMatchesReference(data, selectedReferenceRef.current)
  ), []);

  const applyReferenceHighlight = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    refreshReferenceRowClasses(table, isReferenceMasterRow);
  }, [isReferenceMasterRow]);

  const getTableScrollHolder = useCallback((table) => (
    table?.rowManager?.element
    || table?.element?.querySelector?.('.tabulator-tableholder')
    || null
  ), []);

  const withPreservedTableScroll = useCallback((table, fn) => {
    const holder = getTableScrollHolder(table);
    const top = holder?.scrollTop ?? 0;
    const left = holder?.scrollLeft ?? 0;
    fn();
    const restore = () => {
      if (!holder) return;
      holder.scrollTop = top;
      holder.scrollLeft = left;
    };
    restore();
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(restore);
    }
  }, [getTableScrollHolder]);

  const focusSelectedMaster = useCallback(() => {
    const table = instanceRef.current;
    const referenceCode = selectedReferenceRef.current;
    if (!table || !tableBuiltRef.current) {
      return;
    }

    withPreservedTableScroll(table, () => {
      if (referenceCode && viewMode === 'nested') {
        const monthGroups = table.getGroups?.() || [];
        monthGroups.forEach((monthGroup) => {
          const shipGroups = monthGroup.getSubGroups?.() || [];
          shipGroups.forEach((shipGroup) => {
            const rows = shipGroup.getRows?.() || [];
            const hasMatch = rows.some((row) => masterRowMatchesReference(row.getData?.(), referenceCode));
            if (hasMatch) {
              monthGroup.show?.();
              shipGroup.show?.();
            }
          });
        });
      }

      applyReferenceHighlight();
    });
  }, [applyReferenceHighlight, viewMode, withPreservedTableScroll]);

  const afterTableDataRefresh = useCallback((refreshPromise, scrollSnapshot = null) => {
    const table = instanceRef.current;
    const snapshot = scrollSnapshot || captureTableScroll(table);
    const apply = () => {
      focusSelectedMaster();
      restoreTableScrollSoon(snapshot);
    };
    if (refreshPromise && typeof refreshPromise.then === 'function') {
      refreshPromise.then(apply).catch(apply);
      return;
    }
    window.requestAnimationFrame(apply);
  }, [focusSelectedMaster]);

  useEffect(() => {
    const handleSelect = (event) => {
      const referenceCode = resolveSelectionReferenceCode(event?.detail);
      const fromSelf = event?.detail?.selection_origin === 'master-sailing-explorer';
      const alreadySelected = Boolean(
        referenceCode
        && selectedReferenceRef.current
        && String(selectedReferenceRef.current) === String(referenceCode)
      );
      selectedReferenceRef.current = referenceCode;
      // Own click already highlighted the row; never reopen groups from self
      // (group show → layout refresh → scroll bounce / feels like a missed click).
      if (fromSelf || alreadySelected) {
        applyReferenceHighlight();
        return;
      }
      focusSelectedMaster();
    };
    const handleClear = () => {
      selectedReferenceRef.current = null;
      applyReferenceHighlight();
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);

    const persisted = resolveSelectionReferenceCode(window.lastSailSelectEvent?.detail);
    if (persisted) {
      selectedReferenceRef.current = persisted;
    }

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, [applyReferenceHighlight, focusSelectedMaster]);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled) return;

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          columns,
          index: 'row_key',
          initialSort: [{ column: 'sail_date_from', dir: 'asc' }],
          height: '100%',
          selectableRows: false,
          resizableColumns: true,
          movableColumns: true,
          pagination: false,
          panelInstanceId,
          panelComponentId: panelComponentId || 'master-sailing-explorer',
          exportTitle: 'Master Sailing Explorer',
          ...(viewMode === 'nested'
            ? {
              groupBy: GROUP_BY,
              groupStartOpen: [true, true],
              groupHeader: groupHeaders,
            }
            : {
              groupBy: false,
            }),
          rowFormatter: chainRowFormatters(
            (row) => {
              const data = row.getData();
              const element = row.getElement();
              if (!element || !data) return;
              element.classList.toggle('ms-explorer-row--day', data.row_type === 'day');
              element.classList.toggle('ms-explorer-row--master', data.row_type === 'master');
            },
            createReferenceRowFormatter(isReferenceMasterRow),
          ),
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          try {
            const table = instanceRef.current;
            const scroll = captureTableScroll(table);
            afterTableDataRefresh(table.replaceData(displayRowsRef.current || []), scroll);
          } catch { /* noop */ }
          if (!didApplyInitialGroupOpenRef.current && !selectedReferenceRef.current && viewMode === 'nested') {
            openFirstMonthOnly();
            didApplyInitialGroupOpenRef.current = true;
          }
          const pendingAction = pendingGroupActionRef.current;
          if (pendingAction === 'openAll') {
            pendingGroupActionRef.current = null;
            openAllGroups();
          } else if (pendingAction === 'collapseAll') {
            pendingGroupActionRef.current = null;
            collapseAllGroups();
          } else if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepth(Number.isNaN(depth) ? 0 : depth);
          }
        });

        instanceRef.current.on('rowClick', (event, row) => {
          const rowData = row.getData();
          if (rowData?.row_type === 'day') return;
          if (event?.target?.closest?.('.tabulator-cell[tabulator-field="expand_toggle"]')) {
            handleExpandToggle(event, rowData);
            return;
          }
          if (rowData?.row_type !== 'master') return;
          const managementSailCode = rowData.reference_sail_code || rowData.sail_code;
          selectedReferenceRef.current = managementSailCode ? String(managementSailCode).trim() : null;
          applyReferenceHighlight();
          emitSailSelect({
            sail_code: managementSailCode,
            reference_sail_code: managementSailCode,
            segment_sail_codes: rowData.segment_codes || [],
            sailing_role: rowData.sailing_role,
            row_data: rowData,
            selection_origin: 'master-sailing-explorer',
            timestamp: new Date().toISOString(),
          });
        });

        instanceRef.current.on('rowMouseEnter', (event, row) => {
          if (!showTooltipRef.current) {
            setHoverPreview(null);
            return;
          }
          const rowData = row.getData();
          if (rowData?.row_type !== 'master') {
            setHoverPreview(null);
            return;
          }
          const sailCode = String(rowData.sail_code || '').trim();
          if (!sailCode) {
            setHoverPreview(null);
            return;
          }
          if (tooltipViewRef.current !== 'performance') {
            onDistributionIntentRef.current?.();
          }
          const element = row.getElement?.();
          const rowRect = element?.getBoundingClientRect?.();
          const rect = clipAnchorRectToViewport(rowRect, tableRef.current);
          if (!rect || rect.width <= 0 || rect.height <= 0) {
            setHoverPreview(null);
            return;
          }
          setHoverPreview({
            sailCode,
            row: rowData,
            rect,
            x: Number.isFinite(event?.clientX) ? event.clientX : null,
            y: Number.isFinite(event?.clientY) ? event.clientY : null,
          });
        });

        instanceRef.current.on('rowMouseLeave', () => {
          setHoverPreview(null);
        });

        instanceRef.current.on('groupClick', (_event, group) => {
          if (suppressMonthAutoOpenRef.current) return;
          const level = group?.getLevel?.() ?? -1;
          if (level === 0) openOnlyMonthGroup(group);
        });
      } catch (error) {
        console.error('[MasterSailingExplorer] Failed to initialize table:', error);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      pendingGroupActionRef.current = null;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
    };
  }, [
    afterTableDataRefresh,
    applyGroupDepth,
    applyReferenceHighlight,
    collapseAllGroups,
    columns,
    handleExpandToggle,
    isReferenceMasterRow,
    openAllGroups,
    openFirstMonthOnly,
    openOnlyMonthGroup,
    panelComponentId,
    viewMode,
  ]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      suppressClearOnRefreshRef.current = true;
      const table = instanceRef.current;
      const scroll = captureTableScroll(table);
      afterTableDataRefresh(table.replaceData(displayRows || []), scroll);
      if (!didApplyInitialGroupOpenRef.current && !selectedReferenceRef.current && viewMode === 'nested') {
        openFirstMonthOnly();
        didApplyInitialGroupOpenRef.current = true;
      }
    } catch (error) {
      console.warn('[MasterSailingExplorer] Failed to update table data:', error);
    } finally {
      window.setTimeout(() => {
        suppressClearOnRefreshRef.current = false;
      }, 0);
    }
  }, [afterTableDataRefresh, displayRows, openFirstMonthOnly, viewMode]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([field, value]) => ({ field, type: '=', value }));
    if (activeFilters.length) instanceRef.current.setFilter(activeFilters);
    else instanceRef.current.clearFilter(true);
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'master-sailing-explorer';
    const actions = {
      openAll: () => {
        openAllGroups();
        expandAllMasters();
      },
      collapseAll: () => {
        collapseAllGroups();
        collapseAllMasters();
      },
      cycle: cycleGroupState,
      getCycleState: getGroupCycleState,
    };
    window.__taliaPanelGroupActions[componentKey] = actions;
    if (panelInstanceId) {
      window.__taliaPanelGroupActions[panelInstanceId] = actions;
    }
    return () => {
      if (!window.__taliaPanelGroupActions) return;
      delete window.__taliaPanelGroupActions[componentKey];
      if (panelInstanceId) delete window.__taliaPanelGroupActions[panelInstanceId];
    };
  }, [
    collapseAllGroups,
    collapseAllMasters,
    cycleGroupState,
    expandAllMasters,
    getGroupCycleState,
    openAllGroups,
    panelComponentId,
    panelInstanceId,
  ]);

  // Dock-tab Export to CSV / PDF — registered payload (e.g. visible/filtered rows).
  useEffect(() => {
    const componentKey = panelComponentId || 'master-sailing-explorer';
    return registerPanelDataExport({
      panelInstanceId,
      panelComponentId: componentKey,
      getPayload: () => {
        const table = instanceRef.current;
        if (!table) return null;
        const payload = payloadFromTabulator(table, 'Master Sailing Explorer');
        if (payload?.rows?.length) return payload;
        const rows = Array.isArray(displayRowsRef.current) ? displayRowsRef.current : [];
        if (!rows.length || !payload?.columns?.length) return payload;
        return { ...payload, rows };
      },
    });
  }, [panelComponentId, panelInstanceId]);

  useEffect(() => {
    const handleGroupAction = (event) => {
      const detail = event?.detail || {};
      const thisComponent = panelComponentId || 'master-sailing-explorer';
      const isTargeted = !detail.panelId && !detail.panelComponent
        ? true
        : detail.panelId === panelInstanceId || detail.panelComponent === thisComponent;
      if (!isTargeted) return;
      if (detail.action === 'openAll') {
        openAllGroups();
        expandAllMasters();
      } else if (detail.action === 'collapseAll') {
        collapseAllGroups();
        collapseAllMasters();
      } else if (detail.action === 'cycle') {
        cycleGroupState();
      }
    };
    window.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    document.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    return () => {
      window.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
      document.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    };
  }, [
    collapseAllGroups,
    collapseAllMasters,
    cycleGroupState,
    expandAllMasters,
    openAllGroups,
    panelComponentId,
    panelInstanceId,
  ]);

  return (
    <div className={`focus-panel talia-report master-sailing-panel ms-explorer-panel${reportShellClassName ? ` ${reportShellClassName}` : ''}`}>
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Master Sailing Explorer</h2>
          <p className="talia-report__subtitle">
            {masterCount} master sailings · physical berths by day · actual vs potential booked cabin percentages
          </p>
        </div>
      </header>
      <div className={`master-sailing-panel__filters talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`}>
        {FILTER_FIELDS.map(([field, label]) => (
          <label key={field} className="master-sailing-panel__filter talia-report-filters__group">
            <span className="talia-report-filters__label">{label}</span>
            <select
              className="talia-report-filters__input"
              value={filters[field] || ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, [field]: event.target.value }))}
            >
              {Object.entries(filterOptions[field] || { '': 'All' }).map(([value, text]) => (
                <option key={`${field}-${value || 'all'}`} value={value}>{text}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {showControls ? (
        <div className="talia-report__controls" aria-label="Master sailing explorer controls">
          <button type="button" className="talia-btn talia-btn--secondary" onClick={expandAllMasters}>
            Expand all days
          </button>
          <button type="button" className="talia-btn talia-btn--secondary" onClick={collapseAllMasters}>
            Collapse days
          </button>
        </div>
      ) : null}
      <div ref={tableRef} className="focus-panel__table master-sailing-table ms-explorer-table" />
      <HoverPreview
        open={Boolean(showTooltip && hoverPreview?.sailCode)}
        anchorRect={hoverPreview?.rect || null}
        containRef={tableRef}
        placement="right"
        onRequestClose={() => setHoverPreview(null)}
      >
        {tooltipView === 'performance' ? (
          <MsePerformanceSummary row={hoverPreview?.row || null} />
        ) : hoverPreview?.sailCode && distributionBySailCode?.get?.(hoverPreview.sailCode) ? (
          <DistributionSummary
            bundle={distributionBySailCode.get(hoverPreview.sailCode)}
            dense
            title={hoverPreview.sailCode}
            marketDimension={marketDimension}
            bookedComposition={bookedComposition}
          />
        ) : hoverPreview?.sailCode && distributionLoading ? (
          <div className="ms-explorer-hover-loading">
            Loading distribution…
          </div>
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default MasterSailingExplorerPresenter;
