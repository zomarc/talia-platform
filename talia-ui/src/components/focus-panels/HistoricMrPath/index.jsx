/**
 * Historic MR path — what the source rate held, and what Talia MR would have held.
 * Dates default to the sailed extract. A sailing selection narrows the window.
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
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import PanelDataState from '../../shared/PanelDataState';
import HistoricMrPathPresenter from './HistoricMrPathPresenter';

const COMPONENT = 'HistoricMrPath';

const PATH_QUERY = `
  query HistoricMrPath($shipCode: String, $dateFrom: String, $dateTo: String) {
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
      months {
        month
        groups
        highlightedGroups
        requestedGuests
        namedGuests
        sourceExpectedGuests
        taliaExpectedGuests
        qualifyingGap
        highlighted
      }
      highlights {
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
    }
  }
`;

const DAYS_QUERY = `
  query HistoricMrPathDays($groupId: ID!) {
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

const HistoricMrPathContainer = ({ panelInstanceId, panelComponentId }) => {
  const [path, setPath] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipChoice, setShipChoice] = useState('global');
  const [datesFollowGlobal, setDatesFollowGlobal] = useState(false);
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [planningRate, setPlanningRate] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
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

  const loadPath = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: PATH_QUERY,
        variables: { shipCode: queryShip, dateFrom: queryFrom, dateTo: queryTo },
        component: panelComponentId || COMPONENT,
        purpose: 'Load historic MR path',
        tableName: 'sw_etl_group',
      });
      setPath(data?.sourceMrPath || null);
    } catch (err) {
      setError(err?.message || 'Failed to load the historic MR path');
      setPath(null);
    } finally {
      setLoading(false);
    }
  }, [panelComponentId, queryFrom, queryShip, queryTo]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  useEffect(() => {
    const list = path?.groups?.length ? path.groups : (path?.highlights || []);
    // Keep bus/manual focus when the sailed filter list is empty (e.g. open sailing).
    if (!list.length) return;
    setSelectedGroupId((current) => {
      if (current && list.some((row) => row.groupId === current)) return current;
      const fromBus = extractGroupIdFromEvent(window.lastGroupSelectEvent?.detail);
      if (fromBus) return fromBus;
      if (current) return current;
      return list[0].groupId;
    });
  }, [path]);

  useEffect(() => {
    if (!selectedGroupId) {
      setSeries(null);
      return undefined;
    }
    let cancelled = false;
    trackedFetchGraphql({
      query: DAYS_QUERY,
      variables: { groupId: selectedGroupId },
      component: panelComponentId || COMPONENT,
      purpose: 'Load historic MR path for one group',
      tableName: 'sw_etl_group_header',
    }).then((data) => {
      if (!cancelled) setSeries(data?.sourceMrPathDays || null);
    }).catch(() => {
      if (!cancelled) setSeries(null);
    });
    return () => {
      cancelled = true;
    };
  }, [panelComponentId, selectedGroupId]);

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
    const onGroupClear = () => setSelectedGroupId(null);
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

  useReportPanelLoading(panelInstanceId, panelComponentId, loading);

  const selectedGroup = useMemo(() => {
    const list = [...(path?.groups || []), ...(path?.highlights || [])];
    return list.find((row) => row.groupId === selectedGroupId) || null;
  }, [path, selectedGroupId]);

  const handleSelectGroup = (group) => {
    if (!group?.groupId) return;
    setSelectedGroupId(group.groupId);
    emitGroupSelect({
      group_id: group.groupId,
      sail_code: null,
      ship_code: group.shipCode || null,
      selection_origin: 'historic-mr-path',
      row_data: {
        group_id: group.groupId,
        ship_code: group.shipCode || null,
        sail_date_from: group.sailDateFrom || null,
      },
    });
  };

  return (
    <PanelDataState
      loading={loading && !path}
      loadingMessage="Loading the historic MR path…"
      error={error}
      errorTitle="Historic MR path is not available"
      empty={!loading && !error && (!path || (path.unfilteredSailedCount ?? 0) === 0)}
      emptyMessage="The source MR extract has not been synced yet."
      onRetry={loadPath}
    >
      <HistoricMrPathPresenter
        path={path}
        series={series}
        selectedGroup={selectedGroup}
        onSelectGroup={handleSelectGroup}
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
        cutsHistory={Boolean(datesFollowGlobal && effectiveFrom && path?.feedThrough && effectiveFrom > path.feedThrough)}
        planningRate={planningRate}
        onPlanningRate={setPlanningRate}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'historic-mr-path'}
      />
    </PanelDataState>
  );
};

export default HistoricMrPathContainer;
