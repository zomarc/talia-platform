/**
 * MR Retrospect — for a sailing window or one group, step days before departure
 * and compare what Talia MR would have suggested with the named outcome.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { useGlobalDateWindow } from '../../../hooks/useGlobalDateWindow';
import { useGlobalDepartureMonth } from '../../../hooks/useGlobalDepartureMonth';
import { isShipFilterActive, useGlobalShipFilter } from '../../../hooks/useGlobalShipFilter';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { formatCriteriaDateSummary, resolveEffectiveCriteriaDateWindow } from '../../../lib/globalCriteriaDateWindow';
import {
  emitGroupSelect,
  extractGroupIdFromEvent,
  extractSailCodeFromEvent,
  extractShipCodeFromEvent,
  GROUP_CLEAR_EVENT,
  GROUP_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  aggregateDtdSeries,
  buildCompareRetrospect,
  buildDtdSeries,
  buildRetrospectAnnotations,
} from '../../../lib/mrRetrospect';
import { rescorePathDays } from '../../../lib/mrPathRescore.js';
import { buildAccuracyLeaderboard } from '../../../lib/mrModels/index.js';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import PanelDataState from '../../shared/PanelDataState';
import MrRetrospectPresenter from './MrRetrospectPresenter';

const COMPONENT = 'MrRetrospect';
const SAIL_SERIES_LIMIT = 25;

const isActiveForwardGroup = (row) => row && !row.cancelled;

const PATH_QUERY = `
  query MrRetrospectPath($shipCode: String, $dateFrom: String, $dateTo: String) {
    sourceMrPath(shipCode: $shipCode, dateFrom: $dateFrom, dateTo: $dateTo) {
      feedThrough
      namesFromHistory
      assumptions
      sailedGroupCount
      unfilteredSailedCount
      ships
      sailDateMin
      sailDateMax
      sourceExpectedGuests
      taliaExpectedGuests
      namedGuests
      groups {
        groupId
        shipCode
        sailDateFrom
        sailDateTo
        status
        currentStatus
        changeDays
        holdDate
        requestedGuests
        namedGuests
        sourceMr
        taliaMr
        sourceExpectedGuests
        taliaExpectedGuests
        manual
        highlighted
        cancelled
      }
      highlights {
        groupId
        shipCode
        sailDateFrom
      }
    }
  }
`;

const DAYS_QUERY = `
  query MrRetrospectDays($groupId: ID!) {
    sourceMrPathDays(groupId: $groupId) {
      groupId
      namesFromHistory
      sailDateFrom
      namedGuests
      assumptions
      days {
        changedDate
        status
        requestedGuests
        namedGuests
        sourceMr
        taliaMr
        sourceExpectedGuests
        taliaExpectedGuests
        manual
        cancelled
      }
    }
  }
`;

const dateKey = (value) => {
  const match = String(value || '').match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const sailDatesFromDetail = (detail, masterSailRows) => {
  const row = detail?.row_data && typeof detail.row_data === 'object' ? detail.row_data : {};
  const directFrom = dateKey(detail?.sail_date_from || row.sail_date_from || row.sail_from_date);
  const directTo = dateKey(detail?.sail_date_to || row.sail_date_to || row.sail_to_date);
  if (directFrom) return { from: directFrom, to: directTo || directFrom };
  const code = String(extractSailCodeFromEvent(detail) || '').trim();
  if (!code) return null;
  const match = (masterSailRows || []).find((item) => item.sail_code === code);
  if (!match) return null;
  const from = dateKey(match.sail_date_from);
  if (!from) return null;
  return { from, to: dateKey(match.sail_date_to) || from };
};

const MrRetrospectContainer = ({ panelInstanceId, panelComponentId }) => {
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipChoice, setShipChoice] = useState('global');
  const [datesFollowGlobal, setDatesFollowGlobal] = useState(false);
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [scopeMode, setScopeMode] = useState('group');
  const [selectedDtd, setSelectedDtd] = useState(30);
  const [groupSeries, setGroupSeries] = useState(null);
  const [sailSeriesList, setSailSeriesList] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const {
    useSourceNudge,
    mrModelId,
    mr01Params,
    compareModelIds,
  } = useReportShellOptions(panelComponentId, panelInstanceId);

  const scoreOptions = useMemo(() => ({
    modelId: mrModelId,
    mr01Params,
    useSourceNudge,
  }), [mrModelId, mr01Params, useSourceNudge]);

  const overlayModelIds = useMemo(() => {
    const ids = [...(compareModelIds || [])];
    if (mrModelId && !ids.includes(mrModelId)) ids.unshift(mrModelId);
    return ids.length ? ids : [mrModelId || 'MR01'];
  }, [compareModelIds, mrModelId]);

  const globalDates = useGlobalDateWindow();
  const globalMonth = useGlobalDepartureMonth();
  const globalShip = useGlobalShipFilter();
  const globalWindow = useMemo(() => resolveEffectiveCriteriaDateWindow({
    dateFrom: globalDates.dateFrom,
    dateTo: globalDates.dateTo,
    departureMonth: globalMonth,
  }), [globalDates.dateFrom, globalDates.dateTo, globalMonth]);

  const effectiveShip = shipChoice === 'global' ? globalShip : shipChoice;
  const effectiveFrom = datesFollowGlobal ? (globalWindow.from || '') : localFrom;
  const effectiveTo = datesFollowGlobal ? (globalWindow.to || '') : localTo;
  const queryShip = isShipFilterActive(effectiveShip) ? effectiveShip : null;
  const queryFrom = effectiveFrom || null;
  const queryTo = effectiveTo || null;

  const { data: masterSailRows } = useTableDataWithContext({
    tableName: 'master_sail',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 20000,
    columns: ['sail_code', 'ship_code', 'sail_date_from', 'sail_date_to'],
  });

  const groups = path?.groups || [];
  const forwardGroups = useMemo(
    () => groups.filter(isActiveForwardGroup),
    [groups]
  );

  const loadPath = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: PATH_QUERY,
        variables: { shipCode: queryShip, dateFrom: queryFrom, dateTo: queryTo },
        component: panelComponentId || COMPONENT,
        purpose: 'Load MR retrospect path',
        tableName: 'sw_etl_group',
      });
      setPath(data?.sourceMrPath || null);
    } catch (err) {
      setError(err?.message || 'Failed to load MR retrospect');
      setPath(null);
    } finally {
      setLoading(false);
    }
  }, [panelComponentId, queryFrom, queryShip, queryTo]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  // Path lists sailed groups only. An open-sailing group.select still loads days by id —
  // never wipe that focus just because the sailed filter list is empty.
  useEffect(() => {
    if (!groups.length) return;
    setSelectedGroupId((current) => {
      if (current && groups.some((row) => row.groupId === current)) return current;
      const fromBus = extractGroupIdFromEvent(window.lastGroupSelectEvent?.detail);
      if (fromBus) return fromBus;
      if (current) return current;
      return groups[0].groupId;
    });
  }, [groups]);

  useEffect(() => {
    if (scopeMode !== 'group' || !selectedGroupId) {
      setGroupSeries(null);
      return undefined;
    }
    let cancelled = false;
    setSeriesLoading(true);
    trackedFetchGraphql({
      query: DAYS_QUERY,
      variables: { groupId: selectedGroupId },
      component: panelComponentId || COMPONENT,
      purpose: 'Load MR retrospect group days',
      tableName: 'sw_etl_group_header',
    }).then((data) => {
      if (!cancelled) setGroupSeries(data?.sourceMrPathDays || null);
    }).catch(() => {
      if (!cancelled) setGroupSeries(null);
    }).finally(() => {
      if (!cancelled) setSeriesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [panelComponentId, scopeMode, selectedGroupId]);

  useEffect(() => {
    if (scopeMode !== 'sail') {
      setSailSeriesList([]);
      return undefined;
    }
    const ids = forwardGroups.slice(0, SAIL_SERIES_LIMIT).map((row) => row.groupId).filter(Boolean);
    if (!ids.length) {
      setSailSeriesList([]);
      return undefined;
    }
    let cancelled = false;
    setSeriesLoading(true);
    Promise.all(ids.map((groupId) => trackedFetchGraphql({
      query: DAYS_QUERY,
      variables: { groupId },
      component: panelComponentId || COMPONENT,
      purpose: 'Load MR retrospect sail group days',
      tableName: 'sw_etl_group_header',
    }).then((data) => data?.sourceMrPathDays || null).catch(() => null)))
      .then((rows) => {
        if (!cancelled) setSailSeriesList(rows.filter(Boolean));
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forwardGroups, panelComponentId, scopeMode]);

  useEffect(() => {
    const onSailSelect = (event) => {
      const detail = event?.detail;
      const ship = extractShipCodeFromEvent(detail);
      const dates = sailDatesFromDetail(detail, masterSailRows);
      if (ship) setShipChoice(String(ship).trim().toUpperCase());
      if (dates?.from) {
        setDatesFollowGlobal(false);
        setLocalFrom(dates.from);
        setLocalTo(dates.to || dates.from);
        if (!extractGroupIdFromEvent(detail) && !window.lastGroupSelectEvent) {
          setScopeMode('sail');
        }
      }
    };
    const onSailClear = () => {
      setShipChoice('global');
      setDatesFollowGlobal(false);
      setLocalFrom('');
      setLocalTo('');
    };
    const onGroupSelect = (event) => {
      const groupId = extractGroupIdFromEvent(event?.detail);
      if (!groupId) return;
      setScopeMode('group');
      setSelectedGroupId(groupId);
      const ship = extractShipCodeFromEvent(event?.detail);
      const dates = sailDatesFromDetail(event?.detail, masterSailRows);
      if (ship) setShipChoice(String(ship).trim().toUpperCase());
      if (dates?.from) {
        setDatesFollowGlobal(false);
        setLocalFrom(dates.from);
        setLocalTo(dates.to || dates.from);
      }
    };
    const onGroupClear = () => {
      setSelectedGroupId(null);
      setScopeMode('sail');
    };
    if (window.lastSailSelectEvent?.detail) onSailSelect({ detail: window.lastSailSelectEvent.detail });
    if (window.lastGroupSelectEvent?.detail) onGroupSelect({ detail: window.lastGroupSelectEvent.detail });
    window.addEventListener(SAIL_SELECT_EVENT, onSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onSailClear);
    window.addEventListener(GROUP_SELECT_EVENT, onGroupSelect);
    window.addEventListener(GROUP_CLEAR_EVENT, onGroupClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onSailClear);
      window.removeEventListener(GROUP_SELECT_EVENT, onGroupSelect);
      window.removeEventListener(GROUP_CLEAR_EVENT, onGroupClear);
    };
  }, [masterSailRows]);

  const scoredByModel = useMemo(() => {
    const map = {};
    overlayModelIds.forEach((modelId) => {
      const opts = { ...scoreOptions, modelId };
      if (scopeMode === 'sail') {
        map[modelId] = sailSeriesList
          .map((series) => rescorePathDays(series, opts))
          .filter(Boolean);
      } else {
        map[modelId] = groupSeries ? rescorePathDays(groupSeries, opts) : null;
      }
    });
    return map;
  }, [groupSeries, overlayModelIds, sailSeriesList, scopeMode, scoreOptions]);

  const retrospectByModel = useMemo(() => {
    const map = {};
    overlayModelIds.forEach((modelId) => {
      const scored = scoredByModel[modelId];
      if (scopeMode === 'sail') {
        map[modelId] = aggregateDtdSeries(scored || []);
      } else {
        map[modelId] = scored ? buildDtdSeries(scored) : null;
      }
    });
    return map;
  }, [overlayModelIds, scopeMode, scoredByModel]);

  const retrospect = useMemo(
    () => buildCompareRetrospect(retrospectByModel, overlayModelIds),
    [overlayModelIds, retrospectByModel]
  );

  const leaderboard = useMemo(() => {
    const series = overlayModelIds.map((modelId) => {
      const steps = retrospectByModel[modelId]?.steps || [];
      return {
        modelId,
        points: steps.map((step) => ({
          dtd: step.dtd,
          expected: step.taliaExpectedGuests,
          outcomeNamed: step.outcomeNamed,
        })),
      };
    });
    return buildAccuracyLeaderboard(series);
  }, [overlayModelIds, retrospectByModel]);

  const annotations = useMemo(() => {
    if (scopeMode !== 'group') return [];
    const primary = scoredByModel[overlayModelIds[0]];
    if (!primary) return [];
    return buildRetrospectAnnotations(primary);
  }, [overlayModelIds, scopeMode, scoredByModel]);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading || seriesLoading);

  return (
    <PanelDataState
      loading={loading && !path}
      loadingMessage="Loading MR retrospect…"
      error={error}
      errorTitle="MR Retrospect is not available"
      empty={!loading && !error && (!path || (path.unfilteredSailedCount ?? 0) === 0)}
      emptyMessage="The source MR extract has not been synced yet."
      onRetry={loadPath}
    >
      <MrRetrospectPresenter
        path={path}
        retrospect={retrospect}
        leaderboard={leaderboard}
        compareModelIds={overlayModelIds}
        activeModelId={mrModelId}
        annotations={annotations}
        groups={groups}
        selectedGroupId={selectedGroupId}
        seriesLoading={seriesLoading}
        onSelectGroup={(groupId) => {
          const id = groupId == null ? null : String(groupId).trim();
          setSelectedGroupId(id);
          if (!id) return;
          const row = groups.find((group) => group.groupId === id);
          emitGroupSelect({
            group_id: id,
            ship_code: row?.shipCode || null,
            selection_origin: 'mr-retrospect',
            row_data: {
              group_id: id,
              ship_code: row?.shipCode || null,
              sail_date_from: row?.sailDateFrom || null,
            },
          });
        }}
        scopeMode={scopeMode}
        onScopeMode={setScopeMode}
        selectedDtd={selectedDtd}
        onSelectedDtd={setSelectedDtd}
        shipChoice={shipChoice}
        ships={path?.ships || []}
        onShipChoice={setShipChoice}
        globalShip={globalShip}
        dateFrom={effectiveFrom}
        dateTo={effectiveTo}
        datesFollowGlobal={datesFollowGlobal}
        onDateFrom={(value) => {
          setDatesFollowGlobal(false);
          setLocalFrom(value);
        }}
        onDateTo={(value) => {
          setDatesFollowGlobal(false);
          setLocalTo(value);
        }}
        onUseHeaderDates={() => {
          setDatesFollowGlobal(true);
          setLocalFrom('');
          setLocalTo('');
        }}
        onFullHistory={() => {
          setShipChoice('global');
          setDatesFollowGlobal(false);
          setLocalFrom('');
          setLocalTo('');
        }}
        criteriaSummary={formatCriteriaDateSummary({
          dateFrom: globalWindow.from,
          dateTo: globalWindow.to,
          departureMonth: globalMonth,
          source: globalWindow.source,
        })}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'mr-retrospect'}
      />
    </PanelDataState>
  );
};

export default MrRetrospectContainer;
