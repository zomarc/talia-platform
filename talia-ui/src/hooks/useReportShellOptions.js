/**
 * Shared report chrome from component Options (user profile) + header Details.
 * Snapshot / Details / Filters are Views — every user can toggle; persisted via useComponentOptions.
 *
 * When a panel declares Views → Details, that Options toggle is the source of truth
 * for ReportDataDetails (header ≣ still applies only to panels without that view).
 */

import { useMemo } from 'react';
import { useComponentOptions } from './useComponentOptions';
import { usePanelDetailsVisibility } from './usePanelDetailsVisibility';
import { resolveViewValue } from '../lib/componentOptionsCatalog';

const SNAPSHOT_DEF = { id: 'snapshot', default: true };
const DETAILS_DEF = { id: 'details', default: true };
const FILTERS_DEF = { id: 'filters', default: true };

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

  const [headerDetailsVisible] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: key,
    fallback: true,
  });

  const optionsSnapshot = resolveViewValue(viewsState, SNAPSHOT_DEF) !== false;
  const optionsDetails = resolveViewValue(viewsState, DETAILS_DEF) !== false;
  const optionsFilters = resolveViewValue(viewsState, FILTERS_DEF) !== false;

  // Legacy Operations "Show filters" (admin capability) still forces off when disabled.
  const opsFilters = operations.find((op) => op.id === 'showFilters');
  const opsFiltersAllowed = !opsFilters || opsFilters.enabled !== false;

  return {
    ...options,
    showSnapshot: hasSnapshotView ? optionsSnapshot : true,
    // Options Details owns panels that declare the view; otherwise header ≣.
    showDetails: hasDetailsView ? optionsDetails : headerDetailsVisible,
    showFilters: (hasFiltersView ? optionsFilters : true) && opsFiltersAllowed,
    hasSnapshotView,
    hasDetailsView,
    hasFiltersView,
  };
}

export default useReportShellOptions;
