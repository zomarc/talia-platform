/**
 * Source MR effectiveness — frozen SW_ETL extract versus Talia MR.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { useGlobalDateWindow } from '../../../hooks/useGlobalDateWindow';
import { useGlobalDepartureMonth } from '../../../hooks/useGlobalDepartureMonth';
import { isShipFilterActive, useGlobalShipFilter } from '../../../hooks/useGlobalShipFilter';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { formatCriteriaDateSummary, resolveEffectiveCriteriaDateWindow } from '../../../lib/globalCriteriaDateWindow';
import { emitSailSelect } from '../../../lib/eventBus';
import { setInventoryItems } from '../../../services/data/inventoryReferenceService';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import PanelDataState from '../../shared/PanelDataState';
import SourceMrReviewPresenter from './SourceMrReviewPresenter';

const COMPONENT = 'SourceMrReview';

const REVIEW_QUERY = `
  query SourceMrReview($shipCode: String, $dateFrom: String, $dateTo: String) {
    sourceMrReview(shipCode: $shipCode, dateFrom: $dateFrom, dateTo: $dateTo) {
      feedThrough
      extractLoadThrough
      groupCount
      unfilteredGroupCount
      ships
      sailDateMin
      sailDateMax
      statuses {
        status
        label
        sailedGroups
        sailedRequestedGuests
        sailedNamedGuests
        sailedSourceExpectedGuests
        sailedTaliaExpectedGuests
        sailedRealisedRate
        openGroups
        openRequestedGuests
        openSourceExpectedGuests
        openTaliaExpectedGuests
      }
      bands {
        status
        band
        groups
        requestedGuests
        namedGuests
        sourceExpectedGuests
        taliaExpectedGuests
        realisedRate
      }
      months {
        status
        month
        requestedGuests
        namedGuests
        sourceExpectedGuests
        taliaExpectedGuests
      }
      candidate {
        groupId
        shipCode
        sailId
        sailDateFrom
        sailDateTo
        status
        requestedGuests
        namedGuests
        cabins
        sourceMr
        taliaMr
        sourceExpectedGuests
        taliaExpectedGuests
        manual
        reasons
        versions
        history { changedDate status probability requestedGuests manual }
      }
      notableQuotes {
        groupId
        shipCode
        sailDateFrom
        sailDateTo
        requestedGuests
        namedGuests
        sourceMr
        taliaMr
        sourceExpectedGuests
        taliaExpectedGuests
      }
      allocations { ownerType allocationRows owners avgProbability }
    }
  }
`;

const HISTORY_QUERY = `
  query SourceMrGroupHistory($groupId: ID!) {
    sourceMrGroupHistory(groupId: $groupId) {
      groupId
      versions
      history { changedDate status probability requestedGuests manual }
    }
  }
`;

const dateKey = (value) => {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const findSail = (masterSailRows, inventoryRows, group) => {
  if (!group?.shipCode || !group?.sailDateFrom) return null;
  const ship = String(group.shipCode).trim().toUpperCase();
  const sailDate = dateKey(group.sailDateFrom);
  const matches = (masterSailRows || []).filter((row) => {
    const rowShip = String(row.ship_code || '').trim().toUpperCase();
    return rowShip === ship && dateKey(row.sail_date_from) === sailDate && row.sail_code;
  });
  if (!matches.length) return null;
  const sailTo = dateKey(group.sailDateTo);
  const exact = matches.find((row) => dateKey(row.sail_date_to) === sailTo);
  const row = exact || matches[0];
  const inventory = (inventoryRows || []).find((item) => (
    item.sail_code === row.sail_code && String(item.ship_code || '').trim().toUpperCase() === ship
  ));
  return {
    sailCode: row.sail_code,
    shipCode: row.ship_code || group.shipCode,
    referenceSailCode: inventory?.reference_sail_code || row.sail_code,
  };
};

const SourceMrReviewContainer = ({ panelInstanceId, panelComponentId }) => {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('QT');
  const [shipChoice, setShipChoice] = useState('global');
  const [datesFollowGlobal, setDatesFollowGlobal] = useState(true);
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [history, setHistory] = useState([]);
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

  const { data: inventoryRows } = useTableDataWithContext({
    tableName: 'inventory_item',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 20000,
    columns: ['sail_code', 'reference_sail_code', 'ship_code', 'ship_name'],
  });

  const { data: masterSailRows } = useTableDataWithContext({
    tableName: 'master_sail',
    panelInstanceId,
    panelComponentId,
    fetchWithoutContext: true,
    limit: 20000,
    columns: ['sail_code', 'ship_code', 'sail_date_from', 'sail_date_to'],
  });

  useEffect(() => {
    if (inventoryRows?.length) setInventoryItems(inventoryRows);
  }, [inventoryRows]);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: REVIEW_QUERY,
        variables: { shipCode: queryShip, dateFrom: queryFrom, dateTo: queryTo },
        component: panelComponentId || COMPONENT,
        purpose: 'Load source MR review',
        tableName: 'sw_etl_group',
      });
      const next = data?.sourceMrReview || null;
      setReview(next);
      const candidateId = next?.candidate?.groupId || null;
      setSelectedGroupId(candidateId);
      setHistory(next?.candidate?.history || []);
    } catch (err) {
      setError(err?.message || 'Failed to load the source MR extract');
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [panelComponentId, queryFrom, queryShip, queryTo]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading && !review);

  const selectedGroup = useMemo(() => {
    if (!review) return null;
    const quotes = review.notableQuotes || [];
    return quotes.find((row) => row.groupId === selectedGroupId)
      || (review.candidate?.groupId === selectedGroupId ? review.candidate : null)
      || review.candidate;
  }, [review, selectedGroupId]);

  const sailMatch = useMemo(
    () => findSail(masterSailRows, inventoryRows, selectedGroup),
    [masterSailRows, inventoryRows, selectedGroup]
  );

  const handleSelectGroup = async (group) => {
    if (!group?.groupId) return;
    setSelectedGroupId(group.groupId);
    if (review?.candidate?.groupId === group.groupId) {
      setHistory(review.candidate.history || []);
      return;
    }
    try {
      const data = await trackedFetchGraphql({
        query: HISTORY_QUERY,
        variables: { groupId: group.groupId },
        component: panelComponentId || COMPONENT,
        purpose: 'Load source MR history for one group',
        tableName: 'sw_etl_group_header',
      });
      setHistory(data?.sourceMrGroupHistory?.history || []);
    } catch {
      setHistory([]);
    }
  };

  const handleOpenSailing = () => {
    if (!sailMatch?.sailCode || !selectedGroup) return;
    emitSailSelect({
      sail_code: sailMatch.sailCode,
      reference_sail_code: sailMatch.referenceSailCode || sailMatch.sailCode,
      ship_code: sailMatch.shipCode,
      selection_origin: 'source-mr-review',
      row_data: {
        sail_code: sailMatch.sailCode,
        ship_code: sailMatch.shipCode,
        group_id: selectedGroup.groupId,
      },
    });
  };

  return (
    <PanelDataState
      loading={loading && !review}
      loadingMessage="Loading source MR extract…"
      error={error}
      errorTitle="Source MR extract is not available"
      empty={!loading && !error && (!review || (review.unfilteredGroupCount ?? review.groupCount) === 0)}
      emptyMessage="The source MR extract has not been synced yet."
      onRetry={loadReview}
    >
      <SourceMrReviewPresenter
        review={review}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        shipChoice={shipChoice}
        onShipChoice={setShipChoice}
        globalShip={globalShip}
        dateFrom={effectiveFrom}
        dateTo={effectiveTo}
        datesFollowGlobal={datesFollowGlobal}
        onDateFrom={(value) => {
          setDatesFollowGlobal(false);
          setLocalFrom(value);
          setLocalTo((current) => (datesFollowGlobal ? (globalWindow.to || '') : current));
        }}
        onDateTo={(value) => {
          setDatesFollowGlobal(false);
          setLocalTo(value);
          setLocalFrom((current) => (datesFollowGlobal ? (globalWindow.from || '') : current));
        }}
        onFollowGlobal={() => {
          setShipChoice('global');
          setDatesFollowGlobal(true);
          setLocalFrom('');
          setLocalTo('');
        }}
        onExtractWindow={() => {
          setDatesFollowGlobal(false);
          setLocalFrom(review?.sailDateMin || '');
          setLocalTo(review?.sailDateMax || review?.feedThrough || '');
        }}
        criteriaSummary={formatCriteriaDateSummary({
          dateFrom: globalWindow.from,
          dateTo: globalWindow.to,
          departureMonth: globalMonth,
          source: globalWindow.source,
        })}
        followingGlobal={shipChoice === 'global' && datesFollowGlobal}
        outsideExtract={Boolean(
          (effectiveFrom && review?.sailDateMax && effectiveFrom > review.sailDateMax)
          || (effectiveTo && review?.sailDateMin && effectiveTo < review.sailDateMin)
        )}
        cutsHistory={Boolean(effectiveFrom && review?.feedThrough && effectiveFrom > review.feedThrough)}
        selectedGroup={selectedGroup}
        history={history}
        onSelectGroup={handleSelectGroup}
        sailMatch={sailMatch}
        onOpenSailing={handleOpenSailing}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || COMPONENT}
      />
    </PanelDataState>
  );
};

export default SourceMrReviewContainer;
