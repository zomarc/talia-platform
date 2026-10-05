/**
 * Seasonal Trading Pack — fleet dep-month commercial report.
 */

import React, { useState } from 'react';
import { useSeasonalTradingPack } from '../../../hooks/data/useSeasonalTradingPack';
import { useGlobalCommercialTargets } from '../../../hooks/useGlobalCommercialTargets';
import SeasonalTradingPackPresenter from './SeasonalTradingPackPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import {
  resolveRangePreset,
  RANGE_PRESETS,
} from './depMonthRange';

const DEFAULT_FILTERS = {
  rangePreset: RANGE_PRESETS.NEXT_3,
  marketGroup: '',
  fyLabel: '26/27',
};

const SeasonalTradingPackContainer = ({
  panelInstanceId,
  panelComponentId,
  params = {},
}) => {
  const initialRange = resolveRangePreset(
    params.rangePreset || DEFAULT_FILTERS.rangePreset,
    params.depMonthFrom,
    params.depMonthTo
  );

  const [depMonthFrom, setDepMonthFrom] = useState(initialRange.from);
  const [depMonthTo, setDepMonthTo] = useState(initialRange.to);
  const [rangePreset, setRangePreset] = useState(initialRange.preset);
  const [marketGroup, setMarketGroup] = useState(params.marketGroup || DEFAULT_FILTERS.marketGroup);
  const [fyLabel, setFyLabel] = useState(params.fyLabel || DEFAULT_FILTERS.fyLabel);
  const [metric, setMetric] = useState(params.metric === 'pax' ? 'pax' : 'rev');
  const commercialEnabled = useGlobalCommercialTargets();

  const applyRange = (preset, from, to) => {
    setRangePreset(preset);
    setDepMonthFrom(from);
    setDepMonthTo(to);
  };

  const handleRangePresetChange = (preset) => {
    const resolved = resolveRangePreset(preset, depMonthFrom, depMonthTo);
    applyRange(resolved.preset, resolved.from, resolved.to);
  };

  const handleDepMonthFromChange = (from) => {
    const to = depMonthTo < from ? from : depMonthTo;
    applyRange(RANGE_PRESETS.CUSTOM, from, to);
  };

  const handleDepMonthToChange = (to) => {
    const from = depMonthFrom > to ? to : depMonthFrom;
    applyRange(RANGE_PRESETS.CUSTOM, from, to);
  };

  const filters = {
    depMonthFrom,
    depMonthTo,
    fyLabel,
    ...(marketGroup ? { marketGroup } : {}),
    ...(commercialEnabled ? { includeCommercialTargets: true } : {}),
  };

  const { data, loading, error, refetch } = useSeasonalTradingPack(filters, {
    panelInstanceId,
    panelComponentId: panelComponentId || 'seasonal-trading-pack',
  });

  // Stay on spinner through cold-start retries; only error after attempts exhaust.
  if (loading && !data) {
    return (
      <LoadingSpinner
        message="Loading seasonal trading pack… large report may take longer on slower connections"
        fullScreen={false}
      />
    );
  }

  if (error && !data) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to load seasonal trading pack"
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return (
      <div className="focus-panel-empty">
        <p>No seasonal trading pack data for the selected range</p>
        <div className="focus-panel-empty__action">
          <button type="button" className="talia-btn talia-btn--primary" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <SeasonalTradingPackPresenter
      data={data}
      loading={loading}
      metric={metric}
      onMetricChange={setMetric}
      rangePreset={rangePreset}
      onRangePresetChange={handleRangePresetChange}
      depMonthFrom={depMonthFrom}
      depMonthTo={depMonthTo}
      onDepMonthFromChange={handleDepMonthFromChange}
      onDepMonthToChange={handleDepMonthToChange}
      marketGroup={marketGroup}
      onMarketGroupChange={setMarketGroup}
      fyLabel={fyLabel}
      onFyLabelChange={setFyLabel}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId || 'seasonal-trading-pack'}
    />
  );
};

export default SeasonalTradingPackContainer;
