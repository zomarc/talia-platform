/**
 * Shared report chrome from component Options (user profile) + header Details.
 * Snapshot / Details / Provenance / Filters / Column filters / Controls / Totals / Tooltip / Legends are Views.
 * Role can hide a view via minRole or roleOpsAllow[componentId][viewId].
 *
 * When a panel declares Views → Details, that Options toggle is the source of truth
 * for ReportDataDetails (header ≣ still applies only to panels without that view).
 *
 * Until Options hydrate, hide Views chrome that defaults to "on" so refresh does not
 * flash all filters/details before the user's prefs apply.
 */

import { useMemo } from 'react';
import { useComponentOptions } from './useComponentOptions';
import { usePanelDetailsVisibility } from './usePanelDetailsVisibility';
import {
  buildReportShellClassName,
  resolveViewValue,
  VIEW_PROVENANCE,
  VIEW_SOURCE_NUDGE,
} from '../lib/componentOptionsCatalog';

const SNAPSHOT_DEF = { id: 'snapshot', default: true };
const DETAILS_DEF = { id: 'details', default: true };
const FILTERS_DEF = { id: 'filters', default: true };
const COLUMN_FILTERS_DEF = { id: 'columnFilters', default: true };
const CONTROLS_DEF = { id: 'controls', default: true };
const TOTALS_DEF = { id: 'totals', default: true };
const TOOLTIP_DEF = { id: 'tooltip', default: true };
const TOOLTIP_VIEW_DEF = { id: 'tooltipView', default: 'distribution' };
const LEGENDS_DEF = { id: 'legends', default: true };
const AXIS_LABELS_DEF = { id: 'axisLabels', default: true };
const GRAPH_DEF = { id: 'graph', default: true };

/**
 * @param {string} [panelComponentId]
 * @param {string} [panelInstanceId]
 * @param {object|null} [registryOptions]
 */
export function useReportShellOptions(panelComponentId, panelInstanceId, registryOptions = null) {
  const key = String(panelComponentId || '');
  const options = useComponentOptions(key, registryOptions, panelInstanceId);
  const { viewsState, views, operations, hydrated } = options;

  const catalogIds = useMemo(() => new Set((views || []).map((v) => v.id)), [views]);
  const hasSnapshotView = catalogIds.has('snapshot');
  const hasDetailsView = catalogIds.has('details');
  // Provenance is role-filtered out of `views` for non–SUPER_USER; never show without the toggle.
  const hasProvenanceView = catalogIds.has('provenance');
  const hasFiltersView = catalogIds.has('filters');
  const hasColumnFiltersView = catalogIds.has('columnFilters');
  const hasControlsView = catalogIds.has('controls');
  const hasTotalsView = catalogIds.has('totals');
  const hasTooltipView = catalogIds.has('tooltip');
  const hasTooltipViewChoice = catalogIds.has('tooltipView');
  const hasLegendsView = catalogIds.has('legends');
  const hasAxisLabelsView = catalogIds.has('axisLabels');
  const hasGraphView = catalogIds.has('graph');
  const hasSourceNudgeView = catalogIds.has('sourceNudge');

  const [headerDetailsVisible] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: key,
    fallback: true,
  });

  const detailsViewDef = (views || []).find((v) => v?.id === 'details') || DETAILS_DEF;
  const optionsSnapshot = resolveViewValue(viewsState, SNAPSHOT_DEF) !== false;
  const optionsDetails = resolveViewValue(viewsState, detailsViewDef) !== false;
  const optionsProvenance = resolveViewValue(viewsState, VIEW_PROVENANCE) === true;
  const densityPref = resolveViewValue(viewsState, { id: 'density', default: 'full' }) === 'compact'
    ? 'compact'
    : 'full';
  const isCompact = densityPref === 'compact';
  const hasDensityView = catalogIds.has('density');
  const optionsFilters = resolveViewValue(viewsState, FILTERS_DEF) !== false;
  const optionsColumnFilters = resolveViewValue(viewsState, COLUMN_FILTERS_DEF) !== false;
  const optionsControls = resolveViewValue(viewsState, CONTROLS_DEF) !== false;
  const optionsTotals = resolveViewValue(viewsState, TOTALS_DEF) !== false;
  const optionsTooltip = resolveViewValue(viewsState, TOOLTIP_DEF) !== false;
  const optionsLegends = resolveViewValue(viewsState, LEGENDS_DEF) !== false;
  const optionsAxisLabels = resolveViewValue(viewsState, AXIS_LABELS_DEF) !== false;
  const optionsGraph = resolveViewValue(viewsState, GRAPH_DEF) !== false;
  const optionsSourceNudge = resolveViewValue(viewsState, VIEW_SOURCE_NUDGE) !== false;
  const tooltipView = hasTooltipViewChoice
    ? String(resolveViewValue(viewsState, TOOLTIP_VIEW_DEF) || TOOLTIP_VIEW_DEF.default)
    : null;

  // Hide-until-known only for Views this panel declares (catalog defaults are true).
  const prefsReady = hydrated === true;

  const showColumnFilters = (!prefsReady && hasColumnFiltersView)
    ? false
    : (hasColumnFiltersView ? optionsColumnFilters : true);
  const showControls = (!prefsReady && hasControlsView)
    ? false
    : (hasControlsView ? optionsControls : true);
  const showLegends = (!prefsReady && hasLegendsView)
    ? false
    : (hasLegendsView ? optionsLegends : true);
  // Default is on. Keep labels visible until saved prefs arrive so charts do not flash blank axes.
  const showAxisLabels = hasAxisLabelsView
    ? (prefsReady ? optionsAxisLabels : true)
    : true;
  const showGraph = (!prefsReady && hasGraphView)
    ? false
    : (hasGraphView ? optionsGraph : true);
  // Default on (method includes source nudge). False only when the view exists and the user turned it off.
  const useSourceNudge = hasSourceNudgeView
    ? (prefsReady ? optionsSourceNudge : true)
    : true;

  // Legacy Operations "Show filters" (admin capability) still forces off when disabled.
  const opsFilters = operations.find((op) => op.id === 'showFilters');
  const opsFiltersAllowed = !opsFilters || opsFilters.enabled !== false;

  const showSnapshot = (!prefsReady && hasSnapshotView)
    ? false
    : (hasSnapshotView ? optionsSnapshot : true);
  const showDetails = (!prefsReady && hasDetailsView)
    ? false
    : (hasDetailsView ? optionsDetails : headerDetailsVisible);
  const showProvenance = hasProvenanceView && prefsReady && optionsProvenance;
  const showFilters = (!prefsReady && hasFiltersView)
    ? false
    : ((hasFiltersView ? optionsFilters : true) && opsFiltersAllowed);
  const showTotals = (!prefsReady && hasTotalsView)
    ? false
    : (hasTotalsView ? optionsTotals : true);
  const showTooltip = (!prefsReady && hasTooltipView)
    ? false
    : (hasTooltipView ? optionsTooltip : true);

  return {
    ...options,
    showSnapshot,
    showDetails,
    showProvenance,
    showFilters,
    showColumnFilters,
    showControls,
    showTotals,
    showTooltip,
    showLegends,
    showAxisLabels,
    showGraph,
    useSourceNudge,
    tooltipView,
    density: densityPref,
    isCompact,
    hasDensityView,
    reportShellClassName: buildReportShellClassName('', {
      showColumnFilters,
      showControls,
      showLegends,
      optionsPending: !prefsReady,
    }),
    hasSnapshotView,
    hasDetailsView,
    hasProvenanceView,
    hasFiltersView,
    hasColumnFiltersView,
    hasControlsView,
    hasTotalsView,
    hasTooltipView,
    hasTooltipViewChoice,
    hasLegendsView,
    hasAxisLabelsView,
    hasGraphView,
    hasSourceNudgeView,
  };
}

export default useReportShellOptions;
