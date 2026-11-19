import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emitSailSelect, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import useGlobalDateWindow from '../../../hooks/useGlobalDateWindow';
import useGlobalDepartureMonth from '../../../hooks/useGlobalDepartureMonth';
import useGlobalShipFilter, { isShipFilterActive } from '../../../hooks/useGlobalShipFilter';
import {
  formatCriteriaDateSummary,
  resolveEffectiveCriteriaDateWindow,
} from '../../../lib/globalCriteriaDateWindow';
import PanelDataState from '../../shared/PanelDataState';
import RmChecklistPresenter from './RmChecklistPresenter';
import {
  CHECKLIST_SCOPE_ALL,
  CHECKLIST_SCOPE_NEIGHBORS,
  CHECKLIST_SCOPE_THIS,
  CHECKLIST_SELECT_ORIGIN,
  buildFindingSailSelectDetail,
  filterFindingsByHorizon,
  filterFindingsBySailCodes,
  resolveFocusSailing,
  resolveNeighborSailCodes,
  sortFindingsWithFocusFirst,
  uniqueSailCodes,
} from './rmChecklistScope';

const FINDINGS_QUERY = `
  query RmFindings($filters: RmFindingFilters) {
    rmFindings(filters: $filters) {
      findingId
      agentId
      subjectId
      subject
      asOf
      score
      severity
      recommendedAction
      evidence
      confidence
      status
    }
  }
`;

const STATUS_MUTATION = `
  mutation UpdateRmFindingStatus($findingId: ID!, $status: String!) {
    updateRmFindingStatus(findingId: $findingId, status: $status) {
      findingId
      status
    }
  }
`;

const RUN_MUTATION = `
  mutation RunRmAgents($input: RunRmAgentsInput) {
    runRmAgents(input: $input) {
      success
      runId
      findingCount
      message
      error
    }
  }
`;

const INVENTORY_COLUMNS = [
  'sail_code',
  'ship_code',
  'ship_name',
  'reference_sail_code',
  'sail_date_from',
  'sailing_role',
];

const resolveSelectionFromEvent = (detail) => {
  if (!detail) return null;
  const sail_code = detail?.canonical_scope?.reference_sail_code
    || detail?.reference_sail_code
    || detail?.canonical_scope?.sail_codes?.[0]
    || detail?.sail_code
    || detail?.row_data?.sail_code
    || null;
  if (!sail_code) return null;
  return {
    sail_code: String(sail_code).trim(),
    ship_code: detail?.canonical_scope?.ship_code || detail?.ship_code || detail?.row_data?.ship_code || null,
    ship_name: detail?.canonical_scope?.ship_name || detail?.ship_name || detail?.row_data?.ship_name || null,
    sail_date_from: detail?.sail_date_from
      || detail?.row_data?.sail_date_from
      || detail?.canonical_scope?.sail_date_from
      || null,
    sail_codes: uniqueSailCodes(
      detail?.canonical_scope?.sail_codes,
      detail?.sail_codes,
      sail_code,
      detail?.reference_sail_code,
      detail?.canonical_scope?.reference_sail_code
    ),
    selection_origin: detail?.selection_origin || null,
  };
};

const RmChecklistContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selection, setSelection] = useState(() => (
    resolveSelectionFromEvent(typeof window !== 'undefined' ? window.lastSailSelectEvent?.detail : null)
  ));
  const selectedSailCode = selection?.sail_code || null;
  const [scope, setScope] = useState(() => (
    selectedSailCode ? CHECKLIST_SCOPE_THIS : CHECKLIST_SCOPE_ALL
  ));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runMessage, setRunMessage] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadFindingsRef = useRef(null);
  const { dateFrom, dateTo } = useGlobalDateWindow();
  const departureMonth = useGlobalDepartureMonth();
  const shipCode = useGlobalShipFilter();

  const {
    data: inventoryRows,
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    filters: { is_operational: true },
    columns: INVENTORY_COLUMNS,
    limit: 2000,
    fetchWithoutContext: true,
  });

  useEffect(() => {
    if (inventoryRows?.length) setInventoryItems(inventoryRows);
  }, [inventoryRows]);

  const horizonWindow = useMemo(
    () => resolveEffectiveCriteriaDateWindow({ dateFrom, dateTo, departureMonth }),
    [dateFrom, dateTo, departureMonth]
  );
  const horizonSummary = useMemo(
    () => formatCriteriaDateSummary({
      dateFrom: horizonWindow.from,
      dateTo: horizonWindow.to,
      departureMonth,
      source: horizonWindow.source,
    }),
    [horizonWindow, departureMonth]
  );

  const focus = useMemo(() => {
    const fromInventory = resolveFocusSailing(selectedSailCode, inventoryRows);
    return {
      sail_code: fromInventory?.sail_code || selectedSailCode,
      ship_code: fromInventory?.ship_code || selection?.ship_code || null,
      ship_name: fromInventory?.ship_name || selection?.ship_name || null,
      sail_date_from: fromInventory?.sail_date_from || selection?.sail_date_from || null,
    };
  }, [inventoryRows, selectedSailCode, selection]);
  const extraSailings = useMemo(() => {
    const fromFindings = rows.map((row) => ({
      sail_code: row.subjectId || row.subject?.sail_code,
      ship_code: row.subject?.ship_code,
      sail_date_from: row.subject?.sail_date_from || row.evidence?.sail_date_from,
      sailing_role: 'master',
      reference_sail_code: row.subjectId || row.subject?.sail_code,
    })).filter((row) => row.sail_code);
    if (focus.sail_code) {
      fromFindings.push({
        sail_code: focus.sail_code,
        ship_code: focus.ship_code,
        ship_name: focus.ship_name,
        sail_date_from: focus.sail_date_from,
        sailing_role: 'master',
        reference_sail_code: focus.sail_code,
      });
    }
    return fromFindings;
  }, [focus, rows]);
  const neighborSailCodes = useMemo(
    () => (selectedSailCode
      ? resolveNeighborSailCodes(selectedSailCode, inventoryRows, {
        extraSailings,
        shipCode: focus.ship_code,
      })
      : []),
    [extraSailings, focus.ship_code, inventoryRows, selectedSailCode]
  );

  const loadFindings = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphql({
        query: FINDINGS_QUERY,
        variables: {
          filters: {
            status: 'open',
            limit: 500,
          },
        },
        component: 'RmChecklist',
        purpose: 'Load open RM Findings',
        tableName: 'rm_findings',
      });
      setRows(data?.rmFindings || []);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, shouldSkipRefresh]);

  loadFindingsRef.current = loadFindings;

  useEffect(() => {
    onResumeFetch(() => { loadFindingsRef.current?.(); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => {
    const onSelect = (event) => {
      const next = resolveSelectionFromEvent(event?.detail);
      setSelection(next);
      const origin = event?.detail?.selection_origin;
      if (origin !== CHECKLIST_SELECT_ORIGIN) {
        setScope(next?.sail_code ? CHECKLIST_SCOPE_THIS : CHECKLIST_SCOPE_ALL);
        setSelectedFindingId(null);
      }
    };
    const onClear = () => {
      setSelection(null);
      setSelectedFindingId(null);
      setScope(CHECKLIST_SCOPE_ALL);
    };
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const mappedRows = useMemo(() => rows.map((row) => ({
    ...row,
    actionType: row.recommendedAction?.action_type || '',
    rationale: row.recommendedAction?.rationale || '',
    loadFactor: row.evidence?.load_factor,
    targetLoadFactor: row.evidence?.target_load_factor,
    gapSigned: row.evidence?.gap_signed,
    daysToSail: row.evidence?.days_to_sail,
  })), [rows]);

  const thisSailCodes = useMemo(
    () => uniqueSailCodes(
      focus?.sail_code,
      selectedSailCode,
      selection?.sail_codes
    ),
    [focus?.sail_code, selectedSailCode, selection?.sail_codes]
  );

  const visibleRows = useMemo(() => {
    if (scope === CHECKLIST_SCOPE_THIS && selectedSailCode) {
      return sortFindingsWithFocusFirst(
        filterFindingsBySailCodes(mappedRows, thisSailCodes),
        focus?.sail_code || selectedSailCode
      );
    }
    if (scope === CHECKLIST_SCOPE_NEIGHBORS && selectedSailCode) {
      const codes = neighborSailCodes.length
        ? uniqueSailCodes(neighborSailCodes, thisSailCodes)
        : thisSailCodes;
      return sortFindingsWithFocusFirst(
        filterFindingsBySailCodes(mappedRows, codes),
        focus?.sail_code || selectedSailCode
      );
    }
    return filterFindingsByHorizon(mappedRows, {
      dateFrom: horizonWindow.from,
      dateTo: horizonWindow.to,
      shipCode: isShipFilterActive(shipCode) ? shipCode : null,
    });
  }, [
    focus?.sail_code,
    horizonWindow,
    mappedRows,
    neighborSailCodes,
    scope,
    selectedSailCode,
    shipCode,
    thisSailCodes,
  ]);

  const handleSelectFinding = useCallback((finding) => {
    if (!finding?.findingId) return;
    setSelectedFindingId(finding.findingId);
    const detail = buildFindingSailSelectDetail(finding);
    if (detail) emitSailSelect(detail);
  }, []);

  useEffect(() => {
    if (!selectedFindingId) return;
    if (visibleRows.some((row) => row.findingId === selectedFindingId)) return;
    const stillOpen = mappedRows.some((row) => row.findingId === selectedFindingId);
    if (!stillOpen) setSelectedFindingId(null);
  }, [mappedRows, selectedFindingId, visibleRows]);

  const updateStatus = useCallback(async (findingId, status) => {
    try {
      await fetchGraphql({
        query: STATUS_MUTATION,
        variables: { findingId, status },
        component: 'RmChecklist',
        purpose: 'Update Finding status',
        tableName: 'rm_findings',
      });
      await loadFindings();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      throw err;
    }
  }, [fetchGraphql, loadFindings]);

  const runSailCodes = useMemo(() => {
    if (scope === CHECKLIST_SCOPE_THIS && selectedSailCode) {
      return [focus?.sail_code || selectedSailCode];
    }
    if (scope === CHECKLIST_SCOPE_NEIGHBORS && neighborSailCodes.length) {
      return neighborSailCodes;
    }
    return null;
  }, [focus?.sail_code, neighborSailCodes, scope, selectedSailCode]);

  const runRegulator = useCallback(async () => {
    setRunMessage(null);
    try {
      const data = await fetchGraphql({
        query: RUN_MUTATION,
        variables: {
          input: runSailCodes?.length
            ? { sailCodes: runSailCodes, limit: runSailCodes.length }
            : { limit: 40 },
        },
        component: 'RmChecklist',
        purpose: 'Run Regulator RM Agent',
        tableName: 'rm_findings',
      });
      const result = data?.runRmAgents;
      setRunMessage(result?.success
        ? `${result.message} (${result.findingCount} findings)`
        : (result?.error || result?.message || 'Run failed'));
      await loadFindings();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setRunMessage(err?.message || String(err));
    }
  }, [fetchGraphql, loadFindings, runSailCodes]);

  return (
    <PanelDataState
      loading={loading}
      error={error}
      empty={false}
      onRetry={loadFindings}
    >
      <RmChecklistPresenter
        rows={visibleRows}
        selectedSailCode={focus?.sail_code || selectedSailCode}
        selectedShipName={focus?.ship_name || null}
        selectedSailDate={focus?.sail_date_from || null}
        selectedFindingId={selectedFindingId}
        neighborSailCodes={neighborSailCodes}
        scope={selectedSailCode ? scope : CHECKLIST_SCOPE_ALL}
        horizonSummary={horizonSummary}
        shipCode={isShipFilterActive(shipCode) ? shipCode : null}
        runMessage={runMessage}
        onRun={runRegulator}
        onScopeChange={setScope}
        onSelectFinding={handleSelectFinding}
        onAcknowledge={(id) => updateStatus(id, 'acknowledged')}
        onDismiss={(id) => updateStatus(id, 'dismissed')}
        onRefresh={loadFindings}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'rm-checklist'}
      />
    </PanelDataState>
  );
};

export default RmChecklistContainer;
