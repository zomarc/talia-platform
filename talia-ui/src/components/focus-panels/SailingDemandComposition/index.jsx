import React, { useEffect, useMemo, useState } from 'react';
import PanelDataState from '../../shared/PanelDataState';
import { extractSailCodeFromEvent, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import SailingDemandCompositionPresenter from './SailingDemandCompositionPresenter';
import { buildSailingDemandComposition } from './sailingDemandComposition';
import './sailingDemandComposition.css';

const RESERVATION_COLUMNS = [
  'res_id',
  'res_status',
  'sail_code',
  'guest_count',
  'pax_type',
  'pax_status',
  'group_id',
  'source_origin',
  'res_probability',
  'group_probability',
  'gross_ticket_revenue_eur',
  'net_ticket_revenue_eur',
];

const SailingDemandCompositionContainer = ({ panelInstanceId, panelComponentId }) => {
  const [sailMeta, setSailMeta] = useState(() => {
    const detail = window.lastSailSelectEvent?.detail;
    return {
      sailCode: extractSailCodeFromEvent(detail) || '',
      shipName: detail?.ship_name || detail?.canonical_scope?.ship_name || '',
    };
  });

  useEffect(() => {
    const onSelect = (event) => {
      const detail = event?.detail;
      setSailMeta({
        sailCode: extractSailCodeFromEvent(detail) || '',
        shipName: detail?.ship_name || detail?.canonical_scope?.ship_name || '',
      });
    };
    const onClear = () => setSailMeta({ sailCode: '', shipName: '' });
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  const {
    data: reservationRows,
    loading,
    error,
    refetch,
  } = useTableDataWithContext({
    tableName: 'reservation',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId: panelComponentId || 'sailing-demand-composition',
    columns: RESERVATION_COLUMNS,
    contextMapper: (detail) => {
      const sailCode = extractSailCodeFromEvent(detail);
      return sailCode ? { sail_code: sailCode } : null;
    },
  });

  useEffect(() => {
    const onRefresh = () => refetch?.();
    window.addEventListener('talia:panel.refresh', onRefresh);
    return () => window.removeEventListener('talia:panel.refresh', onRefresh);
  }, [refetch]);

  const composition = useMemo(
    () => buildSailingDemandComposition(reservationRows || []),
    [reservationRows]
  );

  const note = useMemo(() => {
    if (!sailMeta.sailCode) return null;
    if (composition.contracted.rows === 0 && composition.booked.rows === 0) {
      return 'No reservation rows for this sail yet — sync reservations (includes Fact group-OF) if Est/Contr stay empty.';
    }
    if (composition.contracted.rows === 0) {
      return 'No group/offer contracted rows — Fact synthetic OF ingest runs after reservation sync.';
    }
    return null;
  }, [composition, sailMeta.sailCode]);

  if (loading && !(reservationRows?.length)) {
    return <PanelDataState loading message="Loading sailing demand…" />;
  }
  if (error) {
    return <PanelDataState error={error} onRetry={refetch} />;
  }

  return (
    <SailingDemandCompositionPresenter
      sailCode={sailMeta.sailCode}
      shipName={sailMeta.shipName}
      composition={composition}
      note={note}
    />
  );
};

export default SailingDemandCompositionContainer;
