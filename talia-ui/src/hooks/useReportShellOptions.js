/**
 * Shared report chrome from component Options (user profile) + header Details.
 * Snapshot / Details / Filters / Column filters / Controls / Totals / Tooltip / Legends are Views.
 * Role can hide a view via minRole or roleOpsAllow[componentId][viewId].
 *
 * When a panel declares Views → Details, that Options toggle is the source of truth
 * for ReportDataDetails (header ≣ still applies only to panels without that view).
 */

import { useMemo } from 'react';
import { useComponentOptions } from './useComponentOptions';
import { usePanelDetailsVisibility } from './usePanelDetailsVisibility';
import { buildReportShellClassName, resolveViewValue } from '../lib/componentOptionsCatalog';

const SNAPSHOT_DEF = { id: 'snapshot', default: true };
const DETAILS_DEF = { id: 'details', default: true };
const FILTERS_DEF = { id: 'filters', default: true };
const COLUMN_FILTERS_DEF = { id: 'columnFilters', default: true };
const CONTROLS_DEF = { id: 'controls', default: true };
const TOTALS_DEF = { id: 'totals', default: true };
const TOOLTIP_DEF = { id: 'tooltip', default: true };
const TOOLTIP_VIEW_DEF = { id: 'tooltipView', default: 'distribution' };
const LEGENDS_DEF = { id: 'legends', default: true };

/**
 * @param {string} [panelComponentId]
 * @param {string} [panelInstanceId]
 * @param {object|null} [registryOptions]
 */
export function useReportShellOptions(panelComponentId, panelInstanceId, registryOptions = null) {
  const key = String(panelComponentId || '');
  const options = useComponentOptions(key, registryOptions);
  const { viewsState, views, operations } = options;

  const catalogIds = useMemo(() => new Set((views || []).map((v) => v.id)), [views]);
  const hasSnapshotView = catalogIds.has('snapshot');
  const hasDetailsView = catalogIds.has('details');
  const hasFiltersView = catalogIds.has('filters');
  const hasColumnFiltersView = catalogIds.has('columnFilters');
  const hasControlsView = catalogIds.has('controls');
  const hasTotalsView = catalogIds.has('totals');
  const hasTooltipView = catalogIds.has('tooltip');
  const hasTooltipViewChoice = catalogIds.has('tooltipView');
  const hasLegendsView = catalogIds.has('legends');

  const [headerDetailsVisible] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: key,
    fallback: true,
  });

  const optionsSnapshot = resolveViewValue(viewsState, SNAPSHOT_DEF) !== false;
  const optionsDetails = resolveViewValue(viewsState, DETAILS_DEF) !== false;
  const optionsFilters = resolveViewValue(viewsState, FILTERS_DEF) !== false;
  const optionsColumnFilters = resolveViewValue(viewsState, COLUMN_FILTERS_DEF) !== false;
  const optionsControls = resolveViewValue(viewsState, CONTROLS_DEF) !== false;
  const optionsTotals = resolveViewValue(viewsState, TOTALS_DEF) !== false;
  const optionsTooltip = resolveViewValue(viewsState, TOOLTIP_DEF) !== false;
  const optionsLegends = resolveViewValue(viewsState, LEGENDS_DEF) !== false;
  const tooltipView = hasTooltipViewChoice
    ? String(resolveViewValue(viewsState, TOOLTIP_VIEW_DEF) || TOOLTIP_VIEW_DEF.default)
    : null;

  const showColumnFilters = hasColumnFiltersView ? optionsColumnFilters : true;
  const showControls = hasControlsView ? optionsControls : true;
  const showLegends = hasLegendsView ? optionsLegends : true;

  // Legacy Operations "Show filters" (admin capability) still forces off when disabled.
  const opsFilters = operations.find((op) => op.id === 'showFilters');
  const opsFiltersAllowed = !opsFilters || opsFilters.enabled !== false;

  return {
    ...options,
    showSnapshot: hasSnapshotView ? optionsSnapshot : true,
    // Options Details owns panels that declare the view; otherwise header ≣.
    showDetails: hasDetailsView ? optionsDetails : headerDetailsVisible,
    showFilters: (hasFiltersView ? optionsFilters : true) && opsFiltersAllowed,
    showColumnFilters,
    showControls,
    // Panels without Views → Totals keep footer visible (legacy default).
    showTotals: hasTotalsView ? optionsTotals : true,
    showTooltip: hasTooltipView ? optionsTooltip : true,
    showLegends,
    tooltipView,
    reportShellClassName: buildReportShellClassName('', { showColumnFilters, showControls, showLegends }),
    hasSnapshotView,
    hasDetailsView,
    hasFiltersView,
    hasColumnFiltersView,
    hasControlsView,
    hasTotalsView,
    hasTooltipView,
    hasTooltipViewChoice,
    hasLegendsView,
  };
}

export default useReportShellOptions;
