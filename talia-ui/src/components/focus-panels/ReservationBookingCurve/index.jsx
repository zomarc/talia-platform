/**
 * Reservation Booking Curve — original booked date, MSE-aligned cabins.
 */

import React, { useEffect, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  extractSailCodeFromEvent,
} from '../../../lib/eventBus';
import { resolveSelectionScope } from '../../../lib/inventoryReference';
import { useReservationBookingCurve } from '../../../hooks/data/useBookingProfile';
import { useGlobalMarketDimension } from '../../../hooks/useGlobalMarketDimension';
import ReservationBookingCurvePresenter from './ReservationBookingCurvePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const resolveSailFromDetail = (detail) => {
  const scope = detail?.canonical_scope;
  if (scope?.reference_sail_code) return scope.reference_sail_code;
  if (Array.isArray(scope?.sail_codes) && scope.sail_codes.length) {
    return scope.sail_codes[0];
  }
  try {
    const resolved = resolveSelectionScope(detail);
    if (resolved?.reference_sail_code) return resolved.reference_sail_code;
  } catch {
    // ignore
  }
  return extractSailCodeFromEvent(detail);
};

const ReservationBookingCurveContainer = ({
  panelInstanceId,
  panelComponentId,
  ...props
}) => {
  const { sailCode: sailProp, theme, params = {} } = props;
  const sailFromParams = params.sailCode ?? sailProp ?? null;
  const [sailCode, setSailCode] = useState(sailFromParams);
  const marketBreakdown = useGlobalMarketDimension();
  const [seriesMode, setSeriesMode] = useState(params.seriesMode || 'market');
  const [chartMode, setChartMode] = useState(params.chartMode || 'totals');
  const [showRevenue, setShowRevenue] = useState(params.showRevenue === true);
  const [showCompetitor, setShowCompetitor] = useState(params.showCompetitor === true);

  useEffect(() => {
    if (sailFromParams) setSailCode(sailFromParams);
  }, [sailFromParams]);

  useEffect(() => {
    const handleSelect = (e) => {
      const code = resolveSailFromDetail(e?.detail);
      if (code) setSailCode(code);
    };
    const handleClear = () => setSailCode(null);
    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, []);

  useEffect(() => {
    if (sailFromParams || sailCode) return;
    const keys = ['talia:persisted:lastEvent', 'talia:test:lastEvent'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const code = resolveSailFromDetail(parsed?.detail);
        if (code) {
          setSailCode(code);
          return;
        }
      } catch {
        // ignore
      }
    }
    const fromWindow = resolveSailFromDetail(window?.lastSailSelectEvent?.detail);
    if (fromWindow) setSailCode(fromWindow);
  }, [sailFromParams, sailCode]);

  const { data, loading, error, refetch } = useReservationBookingCurve(sailCode, {
    marketBreakdown,
    seriesMode,
    includeCompetitor: showCompetitor,
    panelInstanceId,
    panelComponentId: panelComponentId || 'reservation-booking-curve',
  });

  // Initial load only — keep prior curve mounted on sail change so ReportShell can grey-out.
  if (loading && !data) {
    return <LoadingSpinner message="Loading reservation booking curve..." fullScreen={false} />;
  }

  if (error && !data) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to load reservation booking curve"
        onRetry={refetch}
      />
    );
  }

  if (!sailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Select a sailing to view the reservation booking curve</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="focus-panel-empty">
        <p>No reservation curve for {sailCode}</p>
        <div className="focus-panel-empty__action">
          <button type="button" className="talia-btn talia-btn--primary" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReservationBookingCurvePresenter
      data={data}
      sailCode={sailCode}
      theme={theme}
      seriesMode={seriesMode}
      onSeriesModeChange={setSeriesMode}
      chartMode={chartMode}
      onChartModeChange={setChartMode}
      showRevenue={showRevenue}
      onShowRevenueChange={setShowRevenue}
      showCompetitor={showCompetitor}
      onShowCompetitorChange={setShowCompetitor}
      marketBreakdown={marketBreakdown}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default ReservationBookingCurveContainer;
