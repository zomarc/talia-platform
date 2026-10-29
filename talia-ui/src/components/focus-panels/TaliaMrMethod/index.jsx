/**
 * Talia MR — how the rate is calculated.
 * A sailing selection on the message bus replaces the worked examples
 * with the groups on that sailing.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import useReportPanelLoading from '../../../hooks/useReportPanelLoading';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
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

const groupIdFromDetail = (detail) => {
  const raw = detail?.row_data?.group_id ?? detail?.group_id ?? null;
  const text = raw == null ? '' : String(raw).trim();
  return text || null;
};

const TaliaMrMethodContainer = ({ panelInstanceId, panelComponentId }) => {
  const [pickedId, setPickedId] = useState(null);

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
    const onSelect = (event) => setPickedId(groupIdFromDetail(event?.detail));
    const onClear = () => setPickedId(null);
    const existing = typeof window !== 'undefined' ? window.lastSailSelectEvent?.detail : null;
    if (existing) setPickedId(groupIdFromDetail(existing));
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  const rows = useMemo(
    () => (selectedSailCode ? buildGroupsExplorerRows(reservationRows || []) : []),
    [reservationRows, selectedSailCode]
  );

  const cases = useMemo(() => {
    if (selectedSailCode && rows.length) {
      return rows.map((row) => caseFromGroupRow(row, { sailCode: selectedSailCode }));
    }
    return buildIllustrationCases();
  }, [rows, selectedSailCode]);

  const worked = activeCase(cases, pickedId) || activeCase(cases, pickDefaultCaseId(cases));

  useReportPanelLoading(
    panelInstanceId,
    panelComponentId,
    Boolean(selectedSailCode) && loading && rows.length === 0
  );

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
      usingIllustrations={!selectedSailCode || rows.length === 0}
      loading={Boolean(selectedSailCode) && loading && rows.length === 0}
      error={error}
      onPick={setPickedId}
      onRetry={selectedSailCode ? refetch : null}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId || 'talia-mr-method'}
    />
  );
};

export default TaliaMrMethodContainer;
