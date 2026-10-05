import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions, captureTableScroll, restoreTableScrollSoon } from '../../../lib/tabulatorConfig';
import { REPORT_ACTIVE_PANEL_EVENT } from '../../dockview/eventConstants';
import { emitSailSelect, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { chainRowFormatters, createReferenceRowFormatter, forEachTableRow, paintSingleReferenceRow, REFERENCE_ROW_CLASS } from '../../../lib/tabulatorReferenceSelection';
import { formatMonYear } from '../../../lib/dateFormat';
import { clipAnchorRectToViewport } from '../../../lib/clipAnchorRect';
import { ALL_DEPARTURE_MONTH_KEY } from '../../../lib/globalDepartureMonth';
import { useGlobalDepartureMonth } from '../../../hooks/useGlobalDepartureMonth';
import { useGlobalDemandUnit } from '../../../hooks/useGlobalDemandUnit';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  demandUnitNoun,
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
import {
  MSE_COMPACT_BREAKPOINT,
  buildMasterSailingExplorerColumns,
} from './masterSailingExplorerColumns';
import {
  buildMseSailSelectDetail,
  resolveMseMasterCode,
  shouldEmitMseSelection,
  shouldSkipDuplicateMseEmit,
} from './masterSailingExplorerSelect';

const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';
const DISTRIBUTION_HOVER_DELAY_MS = 400;

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

const MasterSailingExplorerPresenter = ({
  masters,
  dayDetailsByMaster,
  distributionBySailCode = null,
  distributionLoading = false,
  onDistributionIntent = null,
  marketDimension = 'market_group',
  bookedComposition = 'group_fit_expected',
  showCommercialTargets = false,
  panelInstanceId,
  panelComponentId,
}) => {
  const panelRef = useRef(null);
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const lastEmitRef = useRef({ code: null, t: 0 });
  const gestureEmittedRef = useRef(false);
  const emitMasterSelectionRef = useRef(null);
  const applyReferenceHighlightRef = useRef(null);
  const afterTableDataRefreshRef = useRef(null);
  const applyGroupDepthRef = useRef(null);
  const collapseAllGroupsRef = useRef(null);
  const openAllGroupsRef = useRef(null);
  const openFirstMonthOnlyRef = useRef(null);
  const lastHighlightElRef = useRef(null);
  const hoverDistTimerRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const didApplyInitialGroupOpenRef = useRef(false);
  const suppressMonthAutoOpenRef = useRef(false);
  const suppressClearOnRefreshRef = useRef(false);
  const selectedReferenceRef = useRef(
    resolveSelectionReferenceCode(typeof window !== 'undefined' ? window.lastSailSelectEvent?.detail : null)
  );
  const lastVisibleScrollRef = useRef({ top: 0, left: 0 });
  const rememberVisibleScrollRef = useRef(null);
  const restoreViewportAfterShowRef = useRef(null);
  const bindVisibleScrollHolderRef = useRef(null);
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
  const densityPref = viewsState.density === 'compact' ? 'compact' : 'full';
  const isCompact = densityPref === 'compact';
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

  // Narrow dock panes switch to Compact once; the user can still choose Full.
  useEffect(() => {
    const node = panelRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    let wasNarrow = null;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      if (!(width > 0)) return;
      const narrow = width < MSE_COMPACT_BREAKPOINT;
      if (wasNarrow === narrow) return;
      const crossedIntoNarrow = wasNarrow === false && narrow;
      wasNarrow = narrow;
      if (crossedIntoNarrow) setView('density', 'compact');
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [setView]);

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
    () => buildExplorerDisplayRows(
      masters,
      isCompact ? null : dayDetailsByMaster,
      isCompact ? new Set() : expandedMasters
    ),
    [dayDetailsByMaster, expandedMasters, isCompact, masters]
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

  const columns = useMemo(() => buildMasterSailingExplorerColumns({
    compact: isCompact,
    segmentsVisible,
    viewMode,
    demandUnit,
    demandNoun,
    onExpandToggle: handleExpandToggle,
    showCommercialTargets,
  }), [demandNoun, demandUnit, handleExpandToggle, isCompact, segmentsVisible, showCommercialTargets, viewMode]);

  const processedTableOptions = useCallback((extra = {}) => getTabulatorOptions({
    ...extra,
    columns,
    panelInstanceId,
    panelComponentId: panelComponentId || 'master-sailing-explorer',
    exportTitle: 'Master Sailing Explorer',
    enforceGlobalLayout: !isCompact,
    layout: isCompact ? 'fitColumns' : undefined,
    freezeLeadingColumns: isCompact ? 0 : 1,
  }), [columns, isCompact, panelComponentId, panelInstanceId]);

  const processedTableOptionsRef = useRef(processedTableOptions);
  processedTableOptionsRef.current = processedTableOptions;

  const applyTableColumns = useCallback((table) => {
    if (!table || typeof table.setColumns !== 'function') return;
    const processed = processedTableOptionsRef.current();
    if (processed.columns) table.setColumns(processed.columns);
  }, []);

  const emitMasterSelection = useCallback((row, event, { fromClick = false } = {}) => {
    if (fromClick && gestureEmittedRef.current) {
      gestureEmittedRef.current = false;
      return true;
    }
    const rowData = row?.getData?.() || null;
    if (!shouldEmitMseSelection(rowData, event)) return false;
    const code = resolveMseMasterCode(rowData);
    if (shouldSkipDuplicateMseEmit(lastEmitRef.current, code)) return true;
    lastEmitRef.current = { code, t: Date.now() };
    selectedReferenceRef.current = code;
    if (!fromClick) gestureEmittedRef.current = true;
    const rowEl = row?.getElement?.();
    if (lastHighlightElRef.current && lastHighlightElRef.current !== rowEl) {
      lastHighlightElRef.current.classList.remove(REFERENCE_ROW_CLASS);
    }
    if (rowEl) {
      rowEl.classList.add(REFERENCE_ROW_CLASS);
      lastHighlightElRef.current = rowEl;
    }
    const detail = buildMseSailSelectDetail(rowData);
    if (detail) emitSailSelect(detail);
    return true;
  }, []);
  emitMasterSelectionRef.current = emitMasterSelection;

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
    lastHighlightElRef.current = paintSingleReferenceRow(table, isReferenceMasterRow);
  }, [isReferenceMasterRow]);
  applyReferenceHighlightRef.current = applyReferenceHighlight;

  const rememberVisibleScroll = useCallback(() => {
    const snapshot = captureTableScroll(instanceRef.current);
    if (!snapshot.holder || snapshot.holder.clientHeight < 16) return;
    const activeId = typeof window !== 'undefined' ? window.__taliaActivePanelId : null;
    if (panelInstanceId && activeId && activeId !== panelInstanceId) return;
    const host = instanceRef.current?.element;
    const hostHeight = host?.getBoundingClientRect?.()?.height ?? 0;
    if (hostHeight <= 1) return;
    lastVisibleScrollRef.current = { top: snapshot.top, left: snapshot.left };
  }, [panelInstanceId]);
  rememberVisibleScrollRef.current = rememberVisibleScroll;

  const openGroupsForReference = useCallback((table, referenceCode) => {
    if (!table || !referenceCode || viewMode !== 'nested') return;
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
  }, [viewMode]);

  const revealSelectedMaster = useCallback(() => {
    const table = instanceRef.current;
    const referenceCode = selectedReferenceRef.current;
    if (!table || !tableBuiltRef.current || !referenceCode) {
      applyReferenceHighlight();
      return false;
    }
    openGroupsForReference(table, referenceCode);
    let match = null;
    forEachTableRow(table, (row) => {
      if (match) return;
      if (masterRowMatchesReference(row.getData?.(), referenceCode)) match = row;
    });
    applyReferenceHighlight();
    if (!match) return false;
    const scrollRow = () => {
      if (typeof match.scrollTo === 'function') {
        Promise.resolve(match.scrollTo('center', false)).catch(() => {
          match.getElement?.()?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
        });
        return;
      }
      match.getElement?.()?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    };
    scrollRow();
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        scrollRow();
        rememberVisibleScrollRef.current?.();
      });
    }
    return true;
  }, [applyReferenceHighlight, openGroupsForReference]);

  const restoreViewportAfterShow = useCallback(() => {
    const apply = () => {
      const snapshot = captureTableScroll(instanceRef.current);
      const remembered = lastVisibleScrollRef.current;
      if (snapshot.holder && snapshot.holder.clientHeight >= 16) {
        snapshot.holder.scrollTop = remembered.top;
        snapshot.holder.scrollLeft = remembered.left;
      }
      applyReferenceHighlight();
    };
    apply();
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        apply();
        window.setTimeout(apply, 80);
      });
    });
  }, [applyReferenceHighlight]);
  restoreViewportAfterShowRef.current = restoreViewportAfterShow;

  const afterTableDataRefresh = useCallback((refreshPromise) => {
    const apply = () => {
      if (revealSelectedMaster()) return;
      if (selectedReferenceRef.current) {
        window.setTimeout(() => revealSelectedMaster(), 50);
        return;
      }
      if (viewMode === 'nested') {
        openFirstMonthOnlyRef.current?.();
      }
    };
    if (refreshPromise && typeof refreshPromise.then === 'function') {
      refreshPromise.then(apply).catch(apply);
      return;
    }
    window.requestAnimationFrame(apply);
  }, [revealSelectedMaster, viewMode]);
  afterTableDataRefreshRef.current = afterTableDataRefresh;
  applyGroupDepthRef.current = applyGroupDepth;
  collapseAllGroupsRef.current = collapseAllGroups;
  openAllGroupsRef.current = openAllGroups;
  openFirstMonthOnlyRef.current = openFirstMonthOnly;

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
      // Own click already painted the row. Skip the table walk and group open.
      if (fromSelf || alreadySelected) {
        return;
      }
      revealSelectedMaster();
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
  }, [applyReferenceHighlight, revealSelectedMaster]);

  useEffect(() => {
    let holder = null;
    let host = null;
    let wasVisible = true;
    const onScroll = () => rememberVisibleScroll();
    const bindHolder = () => {
      const snapshot = captureTableScroll(instanceRef.current);
      if (snapshot.holder === holder) return;
      if (holder) holder.removeEventListener('scroll', onScroll);
      holder = snapshot.holder;
      if (holder) {
        holder.addEventListener('scroll', onScroll, { passive: true });
        rememberVisibleScroll();
      }
    };
    bindVisibleScrollHolderRef.current = bindHolder;
    bindHolder();
    const bindTimers = [200, 800].map((ms) => window.setTimeout(bindHolder, ms));

    const onActivePanel = (event) => {
      const activeId = event?.detail?.activePanelId || window.__taliaActivePanelId || null;
      if (!panelInstanceId || !activeId || activeId !== panelInstanceId) return;
      restoreViewportAfterShowRef.current?.();
    };
    window.addEventListener(REPORT_ACTIVE_PANEL_EVENT, onActivePanel);

    if (typeof ResizeObserver !== 'undefined') {
      host = tableRef.current || panelRef.current;
      if (host) {
        const observer = new ResizeObserver(() => {
          const snapshot = captureTableScroll(instanceRef.current);
          const visible = Boolean(snapshot.holder && snapshot.holder.clientHeight >= 16);
          if (visible && !wasVisible) {
            restoreViewportAfterShowRef.current?.();
          } else if (visible) {
            rememberVisibleScroll();
          }
          wasVisible = visible;
        });
        observer.observe(host);
        return () => {
          bindTimers.forEach((id) => window.clearTimeout(id));
          window.removeEventListener(REPORT_ACTIVE_PANEL_EVENT, onActivePanel);
          if (holder) holder.removeEventListener('scroll', onScroll);
          observer.disconnect();
        };
      }
    }

    return () => {
      bindTimers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener(REPORT_ACTIVE_PANEL_EVENT, onActivePanel);
      if (holder) holder.removeEventListener('scroll', onScroll);
    };
  }, [panelInstanceId, rememberVisibleScroll]);

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

        instanceRef.current = new Tabulator(tableRef.current, processedTableOptionsRef.current({
          data: [],
          index: 'row_key',
          initialSort: [{ column: 'sail_date_from', dir: 'asc' }],
          height: '100%',
          selectableRows: false,
          resizableColumns: true,
          movableColumns: true,
          pagination: false,
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
          bindVisibleScrollHolderRef.current?.();
          try {
            const table = instanceRef.current;
            afterTableDataRefreshRef.current?.(table.replaceData(displayRowsRef.current || []));
          } catch { /* noop */ }
          if (!didApplyInitialGroupOpenRef.current && !selectedReferenceRef.current && viewMode === 'nested') {
            openFirstMonthOnlyRef.current?.();
            didApplyInitialGroupOpenRef.current = true;
          }
          const pendingAction = pendingGroupActionRef.current;
          if (pendingAction === 'openAll') {
            pendingGroupActionRef.current = null;
            openAllGroupsRef.current?.();
          } else if (pendingAction === 'collapseAll') {
            pendingGroupActionRef.current = null;
            collapseAllGroupsRef.current?.();
          } else if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepthRef.current?.(Number.isNaN(depth) ? 0 : depth);
          }
        });

        instanceRef.current.on('rowMouseDown', (event, row) => {
          emitMasterSelectionRef.current?.(row, event, { fromClick: false });
        });
        instanceRef.current.on('rowClick', (event, row) => {
          emitMasterSelectionRef.current?.(row, event, { fromClick: true });
        });

        instanceRef.current.on('rowMouseEnter', (event, row) => {
          if (hoverDistTimerRef.current) {
            window.clearTimeout(hoverDistTimerRef.current);
            hoverDistTimerRef.current = null;
          }
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
            hoverDistTimerRef.current = window.setTimeout(() => {
              hoverDistTimerRef.current = null;
              onDistributionIntentRef.current?.();
            }, DISTRIBUTION_HOVER_DELAY_MS);
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
          if (hoverDistTimerRef.current) {
            window.clearTimeout(hoverDistTimerRef.current);
            hoverDistTimerRef.current = null;
          }
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
      lastHighlightElRef.current = null;
      if (hoverDistTimerRef.current) {
        window.clearTimeout(hoverDistTimerRef.current);
        hoverDistTimerRef.current = null;
      }
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
    };
  }, [panelComponentId, viewMode]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    applyTableColumns(instanceRef.current);
  }, [applyTableColumns, columns, isCompact]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      suppressClearOnRefreshRef.current = true;
      const table = instanceRef.current;
      const scroll = captureTableScroll(table);
      const nextRows = displayRows || [];
      const currentKeys = (table.getData?.() || []).map((row) => row?.row_key).join('\n');
      const nextKeys = nextRows.map((row) => row?.row_key).join('\n');
      const refresh = currentKeys && currentKeys === nextKeys && typeof table.updateData === 'function'
        ? table.updateData(nextRows)
        : table.replaceData(nextRows);
      const apply = () => {
        if (selectedReferenceRef.current) {
          afterTableDataRefreshRef.current?.();
          return;
        }
        applyReferenceHighlightRef.current?.();
        restoreTableScrollSoon(scroll);
      };
      if (refresh && typeof refresh.then === 'function') {
        refresh.then(apply).catch(apply);
      } else {
        apply();
      }
      if (!didApplyInitialGroupOpenRef.current && !selectedReferenceRef.current && viewMode === 'nested') {
        openFirstMonthOnlyRef.current?.();
        didApplyInitialGroupOpenRef.current = true;
      }
    } catch (error) {
      console.warn('[MasterSailingExplorer] Failed to update table data:', error);
    } finally {
      window.setTimeout(() => {
        suppressClearOnRefreshRef.current = false;
      }, 0);
    }
  }, [displayRows, viewMode]);

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
    <div
      ref={panelRef}
      className={`focus-panel talia-report master-sailing-panel ms-explorer-panel${isCompact ? ' ms-explorer-panel--compact' : ''}${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Master Sailing Explorer</h2>
          <p className="talia-report__subtitle">
            {isCompact
              ? `${masterCount} master sailings · date · booked · vs target`
              : `${masterCount} master sailings · physical berths by day · actual vs potential booked cabin percentages`}
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
      {showControls && !isCompact ? (
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
        {hoverPreview?.row?.target_review_pending ? (
          <p className="mse-hover-target">Target · loading…</p>
        ) : hoverPreview?.row?.target_profile_name ? (
          <p className="mse-hover-target">
            Target · {hoverPreview.row.target_profile_name}
          </p>
        ) : hoverPreview?.row ? (
          <p className="mse-hover-target mse-hover-target--empty">No target profile</p>
        ) : null}
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
