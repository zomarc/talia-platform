import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PanelDataState from '../../shared/PanelDataState';
import GroupBookingReviewPresenter from './GroupBookingReviewPresenter';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const RESERVATION_REVIEW_QUERY = `
  query GroupBookingReviewReservations($filters: ReservationFilters) {
    reservations(filters: $filters) {
      id
      res_id
      res_status
      res_probability
      source_code
      ship
      sail_code
      sail_from_date
      sail_to_date
      cabin_category
      cabin_type
      guest_count
      gross_ticket_revenue
      net_ticket_revenue
      created_at
    }
  }
`;

const normalizeSailContext = (detail) => {
  const row = detail?.row_data || detail || {};
  const sailCode = String(
    row?.reference_sail_code
    || row?.sail_code
    || detail?.reference_sail_code
    || detail?.sail_code
    || ''
  ).trim();
  const ship = String(row?.ship_code || row?.ship || detail?.ship || '').trim();
  return {
    sailCode: sailCode || '',
    ship: ship || '',
  };
};

const classifyReservation = (row) => {
  const hasResId = row?.res_id !== null && row?.res_id !== undefined && row?.res_id !== '';
  return {
    ...row,
    booking_kind: hasResId ? 'REAL' : 'GROUP',
    booking_kind_label: hasResId ? 'Real booking' : 'Group pending',
  };
};

const GroupBookingReviewContainer = ({ panelInstanceId, panelComponentId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(() => normalizeSailContext(window.lastSailSelectEvent?.detail));
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadRowsRef = useRef(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const loadRows = useCallback(async (nextContext = context) => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filters = {
        limit: 20000,
        ...(nextContext?.sailCode ? { sail_code: nextContext.sailCode } : {}),
      };
      if (!nextContext?.sailCode && nextContext?.ship) {
        filters.ship = nextContext.ship;
      }
      const payload = await fetchGraphql({
        query: RESERVATION_REVIEW_QUERY,
        variables: { filters },
        component: panelComponentId || 'GroupBookingReview',
        purpose: 'Review group bookings vs confirmed reservations from GraphQL',
        tableName: 'reservation',
      });
      const nextRows = Array.isArray(payload?.reservations) ? payload.reservations : [];
      setRows(nextRows.map(classifyReservation));
    } catch (fetchError) {
      if (fetchError?.code === 'PANEL_PAUSED') return;
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [context, fetchGraphql, panelComponentId, shouldSkipRefresh]);

  loadRowsRef.current = loadRows;

  useEffect(() => {
    onResumeFetch(() => { loadRowsRef.current?.(contextRef.current); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => {
    loadRows(context);
  }, [context, loadRows]);

  useEffect(() => {
    const handleSailSelect = (event) => {
      setContext(normalizeSailContext(event?.detail));
    };
    const handleSailClear = () => {
      setContext({ sailCode: '', ship: '' });
    };
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, []);

  const summary = useMemo(() => {
    const groupCount = rows.filter((row) => row.booking_kind === 'GROUP').length;
    const realCount = rows.filter((row) => row.booking_kind === 'REAL').length;
    return {
      total: rows.length,
      groupCount,
      realCount,
    };
  }, [rows]);

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading booking review from GraphQL..."
      error={error}
      errorTitle="Failed to load group booking review"
      empty={!rows.length}
      emptyMessage="No booking rows found for current selection."
      onRetry={() => loadRows(context)}
    >
      <GroupBookingReviewPresenter
        rows={rows}
        summary={summary}
        context={context}
        onRefresh={() => loadRows(context)}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default GroupBookingReviewContainer;
