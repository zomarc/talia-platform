/**
 * Talia MR — how the rate is calculated.
 * A sailing selection on the message bus replaces the worked examples
 * with the groups on that sailing.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  emitGroupSelect,
  extractGroupIdFromEvent,
  GROUP_CLEAR_EVENT,
  GROUP_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';
import {
  activeCase,
  buildIllustrationCases,
  caseFromGroupRow,
  pickDefaultCaseId,
} from '../../../lib/taliaMrMethod';
import {
  mapSailCodesToReservationFilters,
  resolveReferenceSailCodeFromDetail,
  resolveSailCodesFromDetail,
} from '../Agency/agencyDirectoryContext';
import { buildGroupsExplorerRows } from '../GroupsExplorer/groupsExplorerTransform';
import TaliaMrMethodPresenter from './TaliaMrMethodPresenter';

const RESERVATION_COLUMNS = [
  'res_id',
  'sail_code',
  'ship',
  'sail_from_date',
  'agency_id',
  'group_id',
  'guest_count',
  'pax_type',
  'res_status',
  'source_origin',
  'res_probability',
  'group_probability',
  'gross_ticket_revenue_eur',
  'net_ticket_revenue_eur',
  'gross_ticket_revenue',
  'net_ticket_revenue',
];

const TaliaMrMethodContainer = ({ panelInstanceId, panelComponentId }) => {
  const [pickedId, setPickedId] = useState(null);
  const { mrModelId, mr01Params, mr01PresetId, useSourceNudge } = useReportShellOptions(
    panelComponentId,
    panelInstanceId
  );

  const {
    data: reservationRows,
    loading,
    error,
    refetch,
    context,
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: (detail) => mapSailCodesToReservationFilters(resolveSailCodesFromDetail(detail)),
    fetchWithoutContext: false,
    limit: 50000,
    columns: RESERVATION_COLUMNS,
  });

  const selectedSailCode = String(
    resolveReferenceSailCodeFromDetail(context)
    || resolveSailCodesFromDetail(context)[0]
    || ''
  ).trim();

  useEffect(() => {
    const onGroupSelect = (event) => setPickedId(extractGroupIdFromEvent(event?.detail));
    const onGroupClear = () => setPickedId(null);
    const existingGroup = typeof window !== 'undefined' ? window.lastGroupSelectEvent?.detail : null;
    if (existingGroup) setPickedId(extractGroupIdFromEvent(existingGroup));
    window.addEventListener(GROUP_SELECT_EVENT, onGroupSelect);
    window.addEventListener(GROUP_CLEAR_EVENT, onGroupClear);
    window.addEventListener(SAIL_CLEAR_EVENT, onGroupClear);
    return () => {
      window.removeEventListener(GROUP_SELECT_EVENT, onGroupSelect);
      window.removeEventListener(GROUP_CLEAR_EVENT, onGroupClear);
      window.removeEventListener(SAIL_CLEAR_EVENT, onGroupClear);
    };
  }, []);

  const rows = useMemo(
    () => (selectedSailCode
      ? buildGroupsExplorerRows(reservationRows || [], {
        modelId: mrModelId,
        mr01Params,
        useSourceNudge,
      })
      : []),
    [reservationRows, selectedSailCode, mrModelId, mr01Params, useSourceNudge]
  );

  const cases = useMemo(() => {
    if (selectedSailCode && rows.length) {
      return rows.map((row) => caseFromGroupRow(row, {
        sailCode: selectedSailCode,
        useSourceNudge,
        mr01Params,
        modelId: mrModelId,
      }));
    }
    return buildIllustrationCases({ useSourceNudge, mr01Params, modelId: mrModelId });
  }, [rows, selectedSailCode, useSourceNudge, mr01Params, mrModelId]);

  const worked = activeCase(cases, pickedId) || activeCase(cases, pickDefaultCaseId(cases));

  useReportPanelLoading(
    panelInstanceId,
    panelComponentId,
    Boolean(selectedSailCode) && loading && rows.length === 0
  );

  const handlePick = (caseId) => {
    const id = caseId == null ? null : String(caseId).trim();
    setPickedId(id);
    if (!id) return;
    const match = cases.find((item) => item.id === id);
    emitGroupSelect({
      group_id: id,
      sail_code: selectedSailCode || null,
      ship_code: match?.shipCode || null,
      selection_origin: 'talia-mr-method',
      row_data: {
        group_id: id,
        sail_code: selectedSailCode || null,
      },
    });
  };

  const subtitle = selectedSailCode
    ? (rows.length
      ? `Sailing ${selectedSailCode}. Same steps, on the current book.`
      : `Sailing ${selectedSailCode} has no group commitments. Showing a worked example.`)
    : 'Select a sailing to run this on the current book. Until then, these are worked examples from the frozen extract.';

  return (
    <TaliaMrMethodPresenter
      cases={cases}
      worked={worked}
      subtitle={subtitle}
      modelId={mrModelId}
      mr01PresetId={mr01PresetId}
      usingIllustrations={!selectedSailCode || rows.length === 0}
      loading={Boolean(selectedSailCode) && loading && rows.length === 0}
      error={error}
      onPick={handlePick}
      onRetry={selectedSailCode ? refetch : null}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId || 'talia-mr-method'}
    />
  );
};

export default TaliaMrMethodContainer;
