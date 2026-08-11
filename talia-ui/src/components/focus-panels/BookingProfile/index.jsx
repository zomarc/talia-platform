/**
 * Booking Profile Container — inventory-scoped dimensional REAL profile.
 */

import React, { useEffect, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  extractSailCodeFromEvent,
} from '../../../lib/eventBus';
import { resolveSelectionScope } from '../../../lib/inventoryReference';
import { useBookingProfileDimensional } from '../../../hooks/data/useBookingProfile';
import { useGlobalMarketDimension } from '../../../hooks/useGlobalMarketDimension';
import BookingProfilePresenter from './BookingProfilePresenter';
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

const BookingProfileContainer = ({ panelInstanceId, panelComponentId, ...props }) => {
  const {
    sailCode: sailProp,
    includeComparison: includeComparisonProp = false,
    previousYearSailCode: previousYearProp = null,
    includeBudget: includeBudgetProp = true,
    theme,
    params = {},
  } = props;

  const includeComparison = params.includeComparison ?? includeComparisonProp;
  const previousYearSailCode = params.previousYearSailCode ?? previousYearProp;
  const includeBudget = params.includeBudget ?? includeBudgetProp;
  const sailFromParams = params.sailCode ?? sailProp ?? null;
  const globalMarketDimension = useGlobalMarketDimension();

  const [sailCode, setSailCode] = useState(sailFromParams);
  const [breakdown, setBreakdown] = useState(params.breakdown || globalMarketDimension || 'market_group');
  const [metric, setMetric] = useState(params.metric || 'guests');

  useEffect(() => {
    if (sailFromParams) setSailCode(sailFromParams);
  }, [sailFromParams]);

  useEffect(() => {
    if (params.breakdown) return;
    setBreakdown(globalMarketDimension);
  }, [globalMarketDimension, params.breakdown]);

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
    const extractFromPersisted = () => {
      const persistedCandidates = ['talia:persisted:lastEvent', 'talia:test:lastEvent'];
      for (const key of persistedCandidates) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const code = resolveSailFromDetail(parsed?.detail);
          if (code) return code;
        } catch {
          // ignore
        }
      }
      return resolveSailFromDetail(window?.lastSailSelectEvent?.detail) || null;
    };
    const restored = extractFromPersisted();
    if (restored) setSailCode(restored);
  }, [sailFromParams, sailCode]);

  const { data, budget, loading, error, refetch } = useBookingProfileDimensional(sailCode, {
    breakdown,
    includeComparison,
    previousYearSailCode,
    includeBudget,
    panelInstanceId,
    panelComponentId: panelComponentId || 'booking-profile',
  });

  // Initial load only — keep prior chart mounted so ReportShell can grey-out on sail change.
  if (loading && !data) {
    return <LoadingSpinner message="Loading booking profile..." fullScreen={false} />;
  }

  if (error && !data) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to load booking profile"
        onRetry={refetch}
      />
    );
  }

  if (!sailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Please select a sailing to view booking profile</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="focus-panel-empty">
        <p>No booking data available for {sailCode}</p>
        <div className="focus-panel-empty__action">
          <button type="button" className="talia-btn talia-btn--primary" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <BookingProfilePresenter
      data={data}
      budget={budget}
      sailCode={sailCode}
      theme={theme}
      onRefresh={refetch}
      includeComparison={includeComparison}
      breakdown={breakdown}
      metric={metric}
      onBreakdownChange={setBreakdown}
      onMetricChange={setMetric}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default BookingProfileContainer;
