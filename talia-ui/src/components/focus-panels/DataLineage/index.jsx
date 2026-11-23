/**
 * Data Lineage — ADMIN+ container.
 * Primary: Synapse → Talia (tableSources) × component consumers × usage.
 * etl_table_parameters is an optional Seaware/original reference only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import tableSources from '../../../config/tableSources';
import { REPORT_REFRESH_EVENT } from '../../dockview/eventConstants';
import {
  VIEW_COLUMN_FILTERS,
  VIEW_DETAILS,
  VIEW_FILTERS,
  VIEW_LEGENDS,
  VIEW_LINEAGE_CO_CONSUMERS,
  VIEW_LINEAGE_DISPLAY,
  VIEW_LINEAGE_LOGICAL_LINKS,
  VIEW_LINEAGE_ORIENTATION,
  VIEW_PROVENANCE,
  resolveViewValue,
} from '../../../lib/componentOptionsCatalog';
import {
  buildKnownTableNames,
  buildPanelCatalog,
  generatedPanelTableColumns,
  generatedSyncTableColumns,
  invertFieldUsageCatalog,
} from '../../../lib/dataLineageCatalog';
import {
  COVERAGE_FILTER_DEFAULT,
  KEY_FILTER_DEFAULT,
  SUGGESTED_KEY_SINCE_MINUTES,
  buildSuggestedKeySet,
  filterRowsByCoverage,
  filterRowsByKey,
  indexKeyPanels,
  summarizeLineageCoverage,
  withLineageCoverage,
} from '../../../lib/dataLineageCoverage';
import {
  buildLineageDiagramModel,
  filterRowsBySourceAndComponent,
  listLineageComponentOptions,
  listLineageSources,
} from '../../../lib/dataLineageDiagram';
import {
  CATEGORY_FILTER_DEFAULT,
  buildComponentOrientationRows,
  buildFieldOrientationRows,
  buildSelectionDetail,
  buildSynapseEdges,
  buildTableOrientationRows,
  filterRowsByCategory,
  filterRowsByScope,
  filterRowsBySharedOnly,
  indexByTarget,
  indexEtlReferenceByTarget,
  indexUsageByPanel,
  listLineageCategories,
  sinceMinutesForRecency,
  withUsageIntensity,
} from '../../../lib/dataLineageView';
import fieldLabels from '../../../lib/tabulatorColumnLabelDictionary';
import tabulatorFieldUsageCatalog from '../../../lib/tabulatorFieldUsageCatalog';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import componentRegistry from '../registry';
import DataLineagePresenter from './DataLineagePresenter';

const LINEAGE_OPTIONS = {
  views: [
    VIEW_LINEAGE_ORIENTATION,
    VIEW_LINEAGE_DISPLAY,
    VIEW_LINEAGE_CO_CONSUMERS,
    VIEW_LINEAGE_LOGICAL_LINKS,
    VIEW_LEGENDS,
    VIEW_FILTERS,
    VIEW_COLUMN_FILTERS,
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const USAGE_QUERY = `
  query UiActivityPanelUsage(
    $sinceMinutes: Int
    $suggestSinceMinutes: Int
    $userId: String
    $userEmail: String
    $userRole: String
  ) {
    uiActivityPanelUsage(
      sinceMinutes: $sinceMinutes
      userId: $userId
      userEmail: $userEmail
      userRole: $userRole
    ) {
      panelComponent
      openCount
      lastAt
      roles
    }
    suggestedUsage: uiActivityPanelUsage(sinceMinutes: $suggestSinceMinutes) {
      panelComponent
      openCount
      lastAt
      roles
    }
    panelLineageFlags {
      panelComponent
      isKey
      updatedAt
      updatedBy
    }
    taliaUsers {
      email
      role
    }
  }
`;

const SET_KEY_MUTATION = `
  mutation SetPanelLineageKey($panelComponent: String!, $isKey: Boolean!) {
    setPanelLineageKey(panelComponent: $panelComponent, isKey: $isKey) {
      panelComponent
      isKey
      updatedAt
      updatedBy
    }
  }
`;

const refreshTargetsThisPanel = (detail, panelInstanceId, panelComponentId) => {
  const scope = detail?.scope;
  const targetPanel = detail?.panelId;
  const targetInstance = detail?.panelInstanceId;
  const targetComponent = detail?.panelComponent;
  const isGlobal = scope === 'all' || (!targetPanel && !targetInstance && !targetComponent);
  if (isGlobal) return true;
  if (panelComponentId && (targetPanel === panelComponentId || targetComponent === panelComponentId)) {
    return true;
  }
  if (panelInstanceId && targetInstance === panelInstanceId) return true;
  return false;
};

const DataLineageContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const panelInstanceIdRef = useRef(panelInstanceId);
  const panelComponentIdRef = useRef(panelComponentId || 'data-lineage');
  panelInstanceIdRef.current = panelInstanceId;
  panelComponentIdRef.current = panelComponentId || 'data-lineage';
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);

  const {
    viewsState,
    showFilters,
    showDetails,
    showProvenance,
    showColumnFilters,
    showLegends,
    reportShellClassName,
  } = useReportShellOptions(
    panelComponentId || 'data-lineage',
    panelInstanceId,
    LINEAGE_OPTIONS,
  );

  const orientationRaw = resolveViewValue(viewsState, VIEW_LINEAGE_ORIENTATION);
  const orientation = orientationRaw === 'components'
    ? 'components'
    : orientationRaw === 'fields'
      ? 'fields'
      : 'tables';
  const displayRaw = resolveViewValue(viewsState, VIEW_LINEAGE_DISPLAY);
  const display = displayRaw === 'table'
    ? 'table'
    : displayRaw === 'diagram'
      ? 'diagram'
      : 'grid';
  const viewsCoConsumers = resolveViewValue(viewsState, VIEW_LINEAGE_CO_CONSUMERS) === true;
  const showLogicalLinks = resolveViewValue(viewsState, VIEW_LINEAGE_LOGICAL_LINKS) === true;

  const [roleFilter, setRoleFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [recency, setRecency] = useState('30d');
  const [scopeFilter, setScopeFilter] = useState('used');
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_FILTER_DEFAULT);
  const [keyFilter, setKeyFilter] = useState(KEY_FILTER_DEFAULT);
  const [coverageFilter, setCoverageFilter] = useState(COVERAGE_FILTER_DEFAULT);
  const [sharedOnly, setSharedOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  // Filter-bar quick toggle (OR'd with Views → Co-consumers). Must sit after componentFilter.
  const [fanOutChecked, setFanOutChecked] = useState(false);
  useEffect(() => {
    if (!componentFilter) setFanOutChecked(false);
  }, [componentFilter]);
  const includeCoConsumers = viewsCoConsumers || fanOutChecked;
  const [usageRows, setUsageRows] = useState([]);
  const [suggestedUsageRows, setSuggestedUsageRows] = useState([]);
  const [lineageFlags, setLineageFlags] = useState([]);
  const [userEmails, setUserEmails] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadUsageRef = useRef(null);
  const [keySaving, setKeySaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const {
    data: etlData,
    loading: etlLoading,
    error: etlError,
    refetch: refetchEtl,
  } = useTableDataWithContext({
    tableName: 'etl_table_parameters',
    panelInstanceId,
    panelComponentId: panelComponentId || 'data-lineage',
    fetchWithoutContext: true,
    limit: 5000,
  });

  const etlRows = Array.isArray(etlData) ? etlData : [];
  const synapseEdges = useMemo(() => buildSynapseEdges(tableSources), []);
  const etlByTarget = useMemo(() => indexEtlReferenceByTarget(etlRows), [etlRows]);

  const knownTables = useMemo(
    () => buildKnownTableNames(tableSources, etlRows),
    [etlRows],
  );
  const panelCatalog = useMemo(
    () => buildPanelCatalog(componentRegistry, knownTables),
    [knownTables],
  );
  const fieldByPanel = useMemo(
    () => invertFieldUsageCatalog(tabulatorFieldUsageCatalog),
    [],
  );

  const loadUsage = useCallback(async () => {
    if (!allowed) return;
    if (shouldSkipRefresh()) {
      setUsageLoading(false);
      return;
    }
    setUsageLoading(true);
    setUsageError(null);
    try {
      const sinceMinutes = sinceMinutesForRecency(recency);
      const data = await fetchGraphql({
        query: USAGE_QUERY,
        variables: {
          sinceMinutes,
          suggestSinceMinutes: SUGGESTED_KEY_SINCE_MINUTES,
          userId: null,
          userEmail: userFilter || null,
          userRole: roleFilter || null,
        },
        component: 'DataLineage',
        tableName: 'ui_activity_events',
        purpose: 'panel-usage',
      });
      setUsageRows(Array.isArray(data?.uiActivityPanelUsage) ? data.uiActivityPanelUsage : []);
      setSuggestedUsageRows(Array.isArray(data?.suggestedUsage) ? data.suggestedUsage : []);
      setLineageFlags(Array.isArray(data?.panelLineageFlags) ? data.panelLineageFlags : []);
      const emails = (data?.taliaUsers || [])
        .map((u) => String(u?.email || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setUserEmails(emails);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setUsageError(err?.message || String(err));
      setUsageRows([]);
      setSuggestedUsageRows([]);
      setLineageFlags([]);
    } finally {
      setUsageLoading(false);
    }
  }, [allowed, fetchGraphql, recency, userFilter, roleFilter, shouldSkipRefresh]);

  loadUsageRef.current = loadUsage;

  useEffect(() => {
    onResumeFetch(() => { loadUsageRef.current?.(); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleRefresh = useCallback(() => {
    refetchEtl?.();
    loadUsage();
  }, [refetchEtl, loadUsage]);

  const handleSetKey = useCallback(async (panelComponent, isKey) => {
    const key = String(panelComponent || '').trim();
    if (!key || keySaving) return;
    setKeySaving(true);
    try {
      const data = await fetchGraphql({
        query: SET_KEY_MUTATION,
        variables: { panelComponent: key, isKey: Boolean(isKey) },
        component: 'DataLineage',
        tableName: 'panel_lineage_flag',
        purpose: 'set-key',
      });
      const next = data?.setPanelLineageKey;
      if (next?.panelComponent) {
        setLineageFlags((prev) => {
          const others = (prev || []).filter((row) => row.panelComponent !== next.panelComponent);
          return [...others, next].sort((a, b) => a.panelComponent.localeCompare(b.panelComponent));
        });
      }
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setUsageError(err?.message || String(err));
    } finally {
      setKeySaving(false);
    }
  }, [fetchGraphql, keySaving]);

  useEffect(() => {
    const onRefresh = (event) => {
      if (!refreshTargetsThisPanel(
        event?.detail,
        panelInstanceIdRef.current,
        panelComponentIdRef.current,
      )) {
        return;
      }
      handleRefresh();
    };
    window.addEventListener(REPORT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, onRefresh);
  }, [handleRefresh]);

  const usageMap = useMemo(
    () => indexUsageByPanel(usageRows, panelCatalog),
    [usageRows, panelCatalog],
  );

  const tableRowsAll = useMemo(
    () => buildTableOrientationRows({
      synapseEdges,
      panelCatalog,
      usageMap,
      etlByTarget,
    }),
    [synapseEdges, panelCatalog, usageMap, etlByTarget],
  );
  const tableByTarget = useMemo(() => indexByTarget(tableRowsAll), [tableRowsAll]);
  const componentRowsAll = useMemo(
    () => buildComponentOrientationRows(panelCatalog, usageMap, tableByTarget),
    [panelCatalog, usageMap, tableByTarget],
  );
  const fieldRowsAll = useMemo(
    () => buildFieldOrientationRows({
      panelCatalog,
      fieldCatalog: tabulatorFieldUsageCatalog,
      panelTableColumns: generatedPanelTableColumns,
      syncTableColumns: generatedSyncTableColumns,
      tableByTarget,
      usageMap,
      fieldLabels,
    }),
    [panelCatalog, usageMap, tableByTarget],
  );

  const categoryOptions = useMemo(
    () => listLineageCategories(componentRowsAll),
    [componentRowsAll],
  );

  const keySet = useMemo(() => indexKeyPanels(lineageFlags), [lineageFlags]);
  const suggestedSet = useMemo(
    () => buildSuggestedKeySet(suggestedUsageRows),
    [suggestedUsageRows],
  );

  const sourceOptions = useMemo(
    () => listLineageSources([...tableRowsAll, ...componentRowsAll, ...fieldRowsAll]),
    [tableRowsAll, componentRowsAll, fieldRowsAll],
  );
  const componentOptions = useMemo(
    () => listLineageComponentOptions(panelCatalog),
    [panelCatalog],
  );

  const { rows, coverageSummary } = useMemo(() => {
    const base = orientation === 'components'
      ? componentRowsAll
      : orientation === 'fields'
        ? fieldRowsAll
        : tableRowsAll;
    const scoped = filterRowsByScope(base, scopeFilter, orientation);
    const shared = orientation === 'fields'
      ? filterRowsBySharedOnly(scoped, sharedOnly)
      : scoped;
    const categorized = orientation === 'components'
      ? filterRowsByCategory(shared, categoryFilter)
      : shared;
    const covered = withLineageCoverage(withUsageIntensity(categorized), {
      keySet,
      suggestedSet,
      fieldByPanel,
      panelTableColumns: generatedPanelTableColumns,
      syncTableColumns: generatedSyncTableColumns,
    });
    const keyed = orientation === 'components'
      ? filterRowsByKey(covered, keyFilter)
      : covered;
    const coverageFiltered = orientation === 'components' || orientation === 'tables'
      ? filterRowsByCoverage(keyed, coverageFilter)
      : keyed;
    const filtered = filterRowsBySourceAndComponent(coverageFiltered, {
      sourceFilter,
      componentFilter,
      orientation,
    });
    return {
      rows: filtered,
      coverageSummary: summarizeLineageCoverage(keyed),
    };
  }, [
    orientation,
    componentRowsAll,
    tableRowsAll,
    fieldRowsAll,
    scopeFilter,
    sharedOnly,
    categoryFilter,
    keyFilter,
    coverageFilter,
    sourceFilter,
    componentFilter,
    keySet,
    suggestedSet,
    fieldByPanel,
  ]);

  // Diagram may surface component nodes while Orientation is tables/fields.
  // Keep those rows selectable for Details without switching orientation.
  const diagramSelectableRows = useMemo(() => {
    const byId = new Map();
    rows.forEach((row) => {
      if (row?.id) byId.set(row.id, row);
    });
    // Always keep component rows selectable for diagram clicks / PDF context.
    componentRowsAll.forEach((row) => {
      if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
    });
    return [...byId.values()];
  }, [rows, componentRowsAll]);

  // Always build so PDF export can embed the graph from any Display mode.
  const diagramModel = useMemo(() => {
    // Only merge in the filtered component row(s) so the diagram stays scoped;
    // full componentRowsAll is for selection lookup, not for edge expansion.
    const diagramRows = orientation === 'components'
      ? rows
      : [
        ...rows,
        ...componentRowsAll.filter((row) => {
          if (!componentFilter) return false;
          return row.panelId === componentFilter || row.componentKey === componentFilter;
        }),
      ];
    return buildLineageDiagramModel({
      rows: diagramRows,
      orientation,
      componentFilter,
      includeCoConsumers,
      showLogicalLinks,
      appearance: 'screen',
      interactive: true,
    });
  }, [
    rows,
    orientation,
    componentFilter,
    componentRowsAll,
    includeCoConsumers,
    showLogicalLinks,
  ]);

  useEffect(() => {
    if (!selectedId) return;
    const stillVisible = diagramSelectableRows.some((row) => row.id === selectedId);
    if (!stillVisible) setSelectedId(null);
  }, [diagramSelectableRows, selectedId]);

  const selection = useMemo(
    () => diagramSelectableRows.find((row) => row.id === selectedId) || null,
    [diagramSelectableRows, selectedId],
  );

  const detail = useMemo(() => {
    const base = buildSelectionDetail({
      selection,
      fieldByPanel,
      panelTableColumns: generatedPanelTableColumns,
      syncTableColumns: generatedSyncTableColumns,
      tableSourcesMap: tableSources,
      fieldLabels,
    });
    if (!base || !selection) return base;
    return {
      ...base,
      isKey: Boolean(selection.isKey),
      isSuggested: Boolean(selection.isSuggested),
      coverageStatus: selection.coverageStatus,
      coverageLabel: selection.coverageLabel,
      coverageIssue: Boolean(selection.coverageIssue),
      coverageGap: Boolean(selection.coverageGap),
      panelId: selection.panelId,
      componentKey: selection.componentKey,
    };
  }, [selection, fieldByPanel]);

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required to view Data Lineage.</p>
      </div>
    );
  }

  // Synapse catalog is static; do not block the panel on ETL reference fetch.
  const bootLoading = usageLoading && usageRows.length === 0 && etlLoading && etlRows.length === 0;
  const bootError = null;

  return (
    <PanelDataState
      loading={bootLoading}
      loadingMessage="Loading data lineage..."
      error={bootError}
      errorTitle="Failed to load data lineage"
      empty={false}
      onRetry={handleRefresh}
    >
      <DataLineagePresenter
        rows={rows}
        orientation={orientation}
        display={display}
        roleFilter={roleFilter}
        userFilter={userFilter}
        recency={recency}
        scopeFilter={scopeFilter}
        sharedOnly={sharedOnly}
        sourceFilter={sourceFilter}
        componentFilter={componentFilter}
        includeCoConsumers={includeCoConsumers}
        viewsCoConsumers={viewsCoConsumers}
        onIncludeCoConsumers={setFanOutChecked}
        showLogicalLinks={showLogicalLinks}
        sourceOptions={sourceOptions}
        componentOptions={componentOptions}
        categoryFilter={categoryFilter}
        categoryOptions={categoryOptions}
        keyFilter={keyFilter}
        coverageFilter={coverageFilter}
        coverageSummary={orientation === 'fields' ? null : coverageSummary}
        userEmails={userEmails}
        onRoleFilter={setRoleFilter}
        onUserFilter={setUserFilter}
        onRecency={setRecency}
        onScopeFilter={setScopeFilter}
        onSharedOnly={setSharedOnly}
        onSourceFilter={setSourceFilter}
        onComponentFilter={setComponentFilter}
        onCategoryFilter={setCategoryFilter}
        onKeyFilter={setKeyFilter}
        onCoverageFilter={setCoverageFilter}
        onSetKey={handleSetKey}
        keySaving={keySaving}
        selectedId={selectedId}
        onSelect={setSelectedId}
        detail={detail}
        diagramModel={diagramModel}
        showFilters={showFilters}
        showDetails={showDetails}
        showProvenance={showProvenance}
        showColumnFilters={showColumnFilters}
        showLegends={showLegends}
        reportShellClassName={reportShellClassName}
        usageError={usageError || (etlError ? `ETL reference unavailable: ${etlError}` : null)}
        usageLoading={usageLoading}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'data-lineage'}
      />
    </PanelDataState>
  );
};

export default DataLineageContainer;
