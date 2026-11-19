import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REPORT_REFRESH_EVENT } from '../../dockview/eventConstants';
import {
  emitSailSelect,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
  SHIP_CLEAR_EVENT,
  SHIP_SELECT_EVENT,
} from '../../../lib/eventBus';
import { pickDefaultEvidence } from '../../../lib/driverAnalysisView';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import PanelDataState from '../../shared/PanelDataState';
import DriverAnalysisPresenter from './DriverAnalysisPresenter';

const LIST_QUERY = `
  query ScienceEvidenceList($filters: ScienceEvidenceFilters) {
    scienceEvidence(filters: $filters) {
      evidenceId
      taskId
      methodVersion
      role
      asOf
      scopeType
      scope
      subjectType
      subjectId
      subject
      peerset
      prior
      decisionMoments
      materialValue
      revenueValue
      covariateRanks
      forwardNow
      reasons
      diagnostics
      runId
      createdAt
    }
    rmEngineStatus {
      online
      pythonAvailable
      pythonInterpreter
      error
      url
    }
  }
`;

const RUN_MUTATION = `
  mutation RunDriverAnalysis($input: RunDriverAnalysisInput) {
    runDriverAnalysis(input: $input) {
      success
      runId
      artifactCount
      portfolioRevenueValue
      message
      error
      citations
      artifacts {
        evidenceId
        role
        subjectId
        subject
        revenueValue
        materialValue
      }
    }
  }
`;

const PROMOTE_MUTATION = `
  mutation PromoteScienceEvidence($evidenceId: ID!) {
    promoteScienceEvidence(evidenceId: $evidenceId) {
      success
      role
      blockers
      citation
      evidence {
        evidenceId
        role
      }
    }
  }
`;

const DRIVER_SELECT_ORIGIN = 'driver-analysis';

const detailSailCodes = (detail) => {
  const scope = detail?.canonical_scope || {};
  const codes = [
    ...(Array.isArray(scope.sail_codes) ? scope.sail_codes : []),
    ...(Array.isArray(detail?.sail_codes) ? detail.sail_codes : []),
    detail?.reference_sail_code,
    detail?.sail_code,
    detail?.Sail_Code,
  ]
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  return [...new Set(codes)];
};

const detailShipCode = (detail) => {
  const scope = detail?.canonical_scope || {};
  return String(
    scope.ship_code
    || detail?.ship_code
    || detail?.Ship_Code
    || ''
  ).trim() || null;
};

const matchEvidenceFromSelection = (rows, detail) => {
  if (!rows?.length || !detail) return null;
  const sailCodes = new Set(detailSailCodes(detail).map((c) => c.toUpperCase()));
  const ship = detailShipCode(detail)?.toUpperCase() || null;

  const bySail = (horizon) => rows.find((r) => {
    const id = String(r.subjectId || r.subject?.id || '').toUpperCase();
    if (!sailCodes.has(id)) return false;
    if (horizon && r.subject?.horizon !== horizon) return false;
    return true;
  });

  return bySail('forward_now')
    || bySail('historic')
    || bySail(null)
    || (ship
      ? (rows.find((r) => String(r.subject?.ship_code || '').toUpperCase() === ship && r.subject?.horizon === 'forward_now')
        || rows.find((r) => String(r.subject?.ship_code || '').toUpperCase() === ship))
      : null);
};

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

const DriverAnalysisContainer = ({ panelInstanceId, panelComponentId }) => {
  const componentId = panelComponentId || 'driver-analysis';
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runMessage, setRunMessage] = useState(null);
  const [frameworkMessage, setFrameworkMessage] = useState(null);
  const [running, setRunning] = useState(false);
  const [frameworkBusy, setFrameworkBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectionFocus, setSelectionFocus] = useState(() => {
    if (typeof window === 'undefined') return null;
    const detail = window.lastSailSelectEvent?.detail || window.lastShipSelectEvent?.detail || null;
    if (!detail) return null;
    return {
      sailCodes: detailSailCodes(detail),
      shipCode: detailShipCode(detail),
      origin: detail?.selection_origin || null,
    };
  });
  const { isPaused, shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    componentId
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const panelInstanceIdRef = useRef(panelInstanceId);
  const panelComponentIdRef = useRef(componentId);
  panelInstanceIdRef.current = panelInstanceId;
  panelComponentIdRef.current = componentId;
  const loadRef = useRef(null);
  const busyUntilRef = useRef(0);
  const busyTimerRef = useRef(null);

  /** Keep shell/tab wash visible long enough to read during fast framework updates. */
  const pulseFrameworkBusy = useCallback((message, minMs = 350) => {
    // Framework pause: no busy wash / selection churn while paused.
    if (shouldSkipRefresh()) return;
    if (message) setFrameworkMessage(message);
    setFrameworkBusy(true);
    const until = Date.now() + minMs;
    busyUntilRef.current = until;
    if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current);
    busyTimerRef.current = window.setTimeout(() => {
      if (Date.now() >= busyUntilRef.current) setFrameworkBusy(false);
      busyTimerRef.current = null;
    }, minMs + 16);
  }, [shouldSkipRefresh]);

  useEffect(() => () => {
    if (busyTimerRef.current) window.clearTimeout(busyTimerRef.current);
  }, []);

  const updating = !isPaused && (loading || running || frameworkBusy);

  const applySelectionFocus = useCallback((detail, { announce = true } = {}) => {
    if (shouldSkipRefresh()) return;
    const fromFramework = announce && detail?.selection_origin !== DRIVER_SELECT_ORIGIN;
    if (!detail) {
      setSelectionFocus(null);
      if (fromFramework) {
        pulseFrameworkBusy('Framework clear — default peerset proof');
      }
      setSelectedId((prev) => {
        const list = rowsRef.current;
        if (prev && list.some((r) => r.evidenceId === prev)) return prev;
        return pickDefaultEvidence(list);
      });
      return;
    }
    const focus = {
      sailCodes: detailSailCodes(detail),
      shipCode: detailShipCode(detail),
      origin: detail?.selection_origin || null,
    };
    setSelectionFocus(focus);
    const match = matchEvidenceFromSelection(rowsRef.current, detail);
    if (match) {
      setSelectedId(match.evidenceId);
      if (fromFramework) {
        pulseFrameworkBusy(
          `Framework selection → ${match.subjectId} (${match.subject?.horizon || 'subject'})`
        );
      }
    } else if (fromFramework) {
      const label = focus.sailCodes[0] || focus.shipCode || 'selection';
      pulseFrameworkBusy(`No Evidence for ${label} yet — run analysis or pick another sail.`);
    }
  }, [pulseFrameworkBusy, shouldSkipRefresh]);

  const load = useCallback(async ({ reason } = {}) => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFrameworkMessage(reason || 'Updating…');
    try {
      const data = await fetchGraphql({
        query: LIST_QUERY,
        variables: { filters: { limit: 150 } },
        component: 'DriverAnalysis',
        purpose: 'Load science driver Evidence',
        tableName: 'rm_science_evidence',
      });
      const list = data?.scienceEvidence || [];
      setRows(list);
      setStatus(data?.rmEngineStatus || null);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.evidenceId === prev)) return prev;
        const fromFocus = selectionFocus
          ? matchEvidenceFromSelection(list, {
            sail_codes: selectionFocus.sailCodes,
            ship_code: selectionFocus.shipCode,
          })
          : null;
        return fromFocus?.evidenceId || pickDefaultEvidence(list);
      });
      const countLabel = `${list.length} artifact${list.length === 1 ? '' : 's'}`;
      setFrameworkMessage(
        reason && reason !== 'Updating…'
          ? `${reason} · ${countLabel}`
          : `Updated · ${countLabel}`
      );
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err);
      setFrameworkMessage(`${reason || 'Update'} failed: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, selectionFocus, shouldSkipRefresh]);

  loadRef.current = load;

  useEffect(() => {
    onResumeFetch(() => { loadRef.current?.({ reason: 'Resume Evidence load' }); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => { load({ reason: 'Initial Evidence load' }); }, []); // initial load once

  // Publish raw in-flight flag so Dockview tab spinner + ReportShell wash appear.
  useReportPanelLoading(panelInstanceId, componentId, updating);

  useEffect(() => {
    const onSailSelect = (event) => applySelectionFocus(event?.detail);
    const onSailClear = () => applySelectionFocus(null);
    const onShipSelect = (event) => applySelectionFocus(event?.detail);
    const onShipClear = () => applySelectionFocus(null);

    if (window.lastSailSelectEvent?.detail) {
      applySelectionFocus(window.lastSailSelectEvent.detail, { announce: false });
    } else if (window.lastShipSelectEvent?.detail) {
      applySelectionFocus(window.lastShipSelectEvent.detail, { announce: false });
    }

    window.addEventListener(SAIL_SELECT_EVENT, onSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onSailClear);
    window.addEventListener(SHIP_SELECT_EVENT, onShipSelect);
    window.addEventListener(SHIP_CLEAR_EVENT, onShipClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onSailClear);
      window.removeEventListener(SHIP_SELECT_EVENT, onShipSelect);
      window.removeEventListener(SHIP_CLEAR_EVENT, onShipClear);
    };
  }, [applySelectionFocus]);

  useEffect(() => {
    const onRefresh = (event) => {
      if (!refreshTargetsThisPanel(event?.detail, panelInstanceIdRef.current, panelComponentIdRef.current)) {
        return;
      }
      const scope = event?.detail?.scope || 'active';
      load({ reason: scope === 'all' ? 'Framework refresh (all panels)' : 'Framework refresh' });
    };
    window.addEventListener(REPORT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, onRefresh);
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.evidenceId === selectedId) || null,
    [rows, selectedId]
  );

  const handleSelect = useCallback((evidenceId) => {
    setSelectedId(evidenceId || null);
    const row = rowsRef.current.find((r) => r.evidenceId === evidenceId);
    if (!row) return;
    emitSailSelect({
      sail_code: row.subjectId,
      ship_code: row.subject?.ship_code || null,
      sail_date_from: row.subject?.sail_date_from || null,
      selection_origin: DRIVER_SELECT_ORIGIN,
    });
    setFrameworkMessage(`Selected ${row.subjectId} · emitted sail.select`);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (running) return;
    if (status && status.online === false) {
      setRunMessage(
        `talia-engine is offline${status.url ? ` (${status.url})` : ''}. Start it with: cd talia-engine && npm run dev`
      );
      return;
    }
    setRunning(true);
    setRunMessage('Running driver analysis…');
    setFrameworkMessage('Engine job science.driver_analysis.v0 in flight');
    try {
      const sailCodes = selectionFocus?.sailCodes?.length ? selectionFocus.sailCodes : undefined;
      const data = await fetchGraphql({
        query: RUN_MUTATION,
        variables: {
          input: {
            historicLimit: 24,
            forwardLimit: 8,
            sailCodes,
            shipCode: selectionFocus?.shipCode || undefined,
          },
        },
        component: 'DriverAnalysis',
        purpose: 'Run science.driver_analysis.v0',
        tableName: 'rm_science_evidence',
      });
      const result = data?.runDriverAnalysis;
      if (result?.success) {
        const euro = result.portfolioRevenueValue != null
          ? ` · portfolio €${Number(result.portfolioRevenueValue).toLocaleString()}`
          : '';
        setRunMessage(`${result.message} (${result.artifactCount} artifacts${euro})`);
        setFrameworkMessage(`Engine run ${result.runId || 'ok'} complete`);
        await load({ reason: 'Post-run Evidence reload' });
      } else {
        setRunMessage(result?.error || result?.message || 'Driver analysis failed');
        setFrameworkMessage(result?.error || 'Engine run failed');
      }
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setRunMessage(err?.message || String(err));
      setFrameworkMessage(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  }, [fetchGraphql, load, running, selectionFocus, status]);

  const promoteSelected = useCallback(async () => {
    if (!selectedId) return;
    setRunMessage(null);
    setFrameworkMessage(`Promoting ${selectedId}…`);
    try {
      const data = await fetchGraphql({
        query: PROMOTE_MUTATION,
        variables: { evidenceId: selectedId },
        component: 'DriverAnalysis',
        purpose: 'Promote Evidence to source',
        tableName: 'rm_science_evidence',
      });
      const result = data?.promoteScienceEvidence;
      if (result?.success) {
        setRunMessage(`Promoted ${selectedId} to source (future prior/peerset consumers)`);
        setFrameworkMessage(`Evidence ${selectedId} role → source`);
        await load({ reason: 'Post-promote reload' });
      } else {
        const blockers = (result?.blockers || []).join('; ') || 'unknown';
        setRunMessage(`Promote blocked: ${blockers}`);
        setFrameworkMessage(`Promote blocked: ${blockers}`);
      }
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setRunMessage(err?.message || String(err));
      setFrameworkMessage(err?.message || String(err));
    }
  }, [fetchGraphql, load, selectedId]);

  return (
    <PanelDataState
      loading={loading && rows.length === 0}
      loadingMessage="Loading Driver Analysis Evidence…"
      error={error}
      empty={false}
      onRetry={() => load({ reason: 'Retry' })}
    >
      <DriverAnalysisPresenter
        rows={rows}
        selected={selected}
        status={status}
        runMessage={runMessage}
        frameworkMessage={frameworkMessage}
        selectionFocus={selectionFocus}
        running={running}
        loading={loading}
        updating={updating}
        onSelect={handleSelect}
        onRun={runAnalysis}
        onPromote={promoteSelected}
        onRefresh={() => load({ reason: 'Manual refresh' })}
        panelInstanceId={panelInstanceId}
        panelComponentId={componentId}
      />
    </PanelDataState>
  );
};

export default DriverAnalysisContainer;
