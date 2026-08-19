/**
 * Competitor Benchmark — dwh.vw_Competitor_Benchmarking (RateGain).
 * Separate from Competitor Pricing (stg.COMPETITOR).
 * Competitor ship_code is not Celestyal inventory_item.ship_code; sail.select
 * scopes by departure month of the selected voyage.
 */

import React, { useMemo } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import PanelDataState from '../../shared/PanelDataState';
import CompetitorBenchmarkPresenter from './CompetitorBenchmarkPresenter';

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const monthBounds = (dateKey) => {
  if (!dateKey || dateKey.length < 7) return null;
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
};

const mapSailToBenchmarkFilters = (detail) => {
  const dateKey = toDateKey(
    detail?.row_data?.sail_date_from
    || detail?.sail_date_from
    || detail?.canonical_scope?.sail_date_from
    || null
  );
  const bounds = monthBounds(dateKey);
  if (!bounds) return null;
  return {
    is_latest_snapshot: 'Y',
    departure_date_from: bounds.from,
    departure_date_to: bounds.to,
  };
};

const CompetitorBenchmarkContainer = ({ panelInstanceId, panelComponentId }) => {
  const {
    data,
    loading,
    error,
    context: sailContext,
    refetch,
  } = useTableDataWithContext({
    tableName: 'competitor_benchmark',
    eventName: SAIL_SELECT_EVENT,
    panelInstanceId,
    panelComponentId,
    contextMapper: mapSailToBenchmarkFilters,
    fetchWithoutContext: false,
    limit: 20000,
  });

  const sailDateFrom = toDateKey(
    sailContext?.row_data?.sail_date_from
    || sailContext?.sail_date_from
    || sailContext?.canonical_scope?.sail_date_from
    || null
  );
  const durationDays = Number(
    sailContext?.row_data?.sail_days
    || sailContext?.canonical_scope?.sail_days
    || sailContext?.duration
    || 0
  ) || null;

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (!durationDays) return list;
    return list.filter((row) => {
      const duration = Number(row?.cruise_duration);
      if (!Number.isFinite(duration)) return true;
      return Math.abs(duration - durationDays) <= 2;
    });
  }, [data, durationDays]);

  const hasSailSelection = Boolean(sailContext);

  return (
    <PanelDataState
      loading={loading && !data}
      loadingMessage="Loading competitor benchmark..."
      error={error}
      errorTitle="Failed to load competitor benchmark"
      empty={false}
    >
      <CompetitorBenchmarkPresenter
        rows={rows}
        hasSailSelection={hasSailSelection}
        scopeLoading={Boolean(loading && hasSailSelection)}
        sailDateFrom={sailDateFrom}
        durationDays={durationDays}
        rowCount={Array.isArray(data) ? data.length : 0}
        onRetry={refetch}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default CompetitorBenchmarkContainer;
