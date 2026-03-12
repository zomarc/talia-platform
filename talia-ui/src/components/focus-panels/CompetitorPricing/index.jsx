/**
 * Competitor Pricing Container Component
 * Displays competitor pricing data with scatter plots and detailed table
 */

import React from 'react';
import { useCompetitorPricing } from '../../../hooks/data/useCompetitorPricing';
import CompetitorPricingPresenter from './CompetitorPricingPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const DOT_SAIL_SELECT_EVENT = 'talia.sail.select';
const GRAPHQL_URL = '/api/graphql';
const REPORT_PANEL_ID = 'competitor-pricing';
const REPORT_CONTEXT_EVENT = 'talia:report.contextChanged';

const DEFAULT_FILTERS = {
  currency: 'EUR',
  duration: null,
  destination: null,
  cabinType: 'ALL',
  departureMonth: null,
  isLatest: true,
  cruiseLine: null,
  market: null,
  primaryCruiseLine: null,
  secondaryCruiseLine: 'ALL'
};

const normalizeString = (value) => String(value || '').trim().toLowerCase();

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractSelectionFromEvent = (detail) => {
  const row = detail?.row_data || detail || {};
  return {
    sailCode: row?.sail_code || row?.Sail_Code || detail?.sail_code || '',
    referenceSailCode: row?.reference_sail_code || row?.referenceSailCode || detail?.reference_sail_code || '',
    shipCode: row?.ship_code || row?.ship || detail?.ship_code || '',
    duration: row?.sail_days || row?.duration || detail?.duration || null,
    destination: row?.geog_area_code || row?.destination || row?.port_to || detail?.destination || null
  };
};

const pickMetadataValue = (metadata, keys = []) => {
  if (!metadata || typeof metadata !== 'object') return null;
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      return metadata[key];
    }
  }
  return null;
};

const mapClosestDuration = (requestedDuration, data) => {
  const target = toNumber(requestedDuration);
  if (target === null) return null;
  const options = [...new Set((data || []).map((row) => toNumber(row.duration)).filter((value) => value !== null))];
  if (options.length === 0) return null;

  const exact = options.find((option) => option === target);
  if (exact !== undefined) return exact;

  return options.reduce((closest, current) => {
    if (closest === null) return current;
    return Math.abs(current - target) < Math.abs(closest - target) ? current : closest;
  }, null);
};

const mapClosestDestination = (requestedDestination, data) => {
  const target = normalizeString(requestedDestination);
  if (!target) return null;

  const options = [...new Set((data || []).map((row) => row.destination).filter(Boolean))];
  if (options.length === 0) return null;

  const exact = options.find((option) => normalizeString(option) === target);
  if (exact) return exact;

  const contains = options.find((option) => {
    const normalized = normalizeString(option);
    return normalized.includes(target) || target.includes(normalized);
  });
  if (contains) return contains;

  return options[0] || null;
};

const fetchInventoryItems = async ({ sailCode, referenceSailCode, shipCode }) => {
  const query = `
    query GetInventoryItems($filters: InventoryItemFilters) {
      inventoryItems(filters: $filters) {
        id
        sailCode
        referenceSailCode
        shipCode
        metadata
      }
    }
  `;

  const attempts = [
    { sailCode: sailCode || undefined, shipCode: shipCode || undefined, limit: 50 },
    { referenceSailCode: referenceSailCode || sailCode || undefined, shipCode: shipCode || undefined, limit: 50 },
    { sailCode: sailCode || undefined, limit: 50 },
    { referenceSailCode: referenceSailCode || sailCode || undefined, limit: 50 }
  ];

  for (const filters of attempts) {
    const hasFilter = Object.values(filters).some((value) => value !== undefined);
    if (!hasFilter) continue;
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { filters } })
    });
    const payload = await response.json();
    if (!response.ok || payload?.errors?.length) {
      throw new Error(payload?.errors?.[0]?.message || `HTTP ${response.status}`);
    }
    const rows = payload?.data?.inventoryItems || [];
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
};

const CompetitorPricingContainer = ({ theme }) => {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [pendingContextFilter, setPendingContextFilter] = React.useState(null);

  const { data, loading, error, refetch } = useCompetitorPricing(filters);

  const publishReportContext = React.useCallback((nextContext) => {
    try {
      if (!window.__taliaReportContext) {
        window.__taliaReportContext = {};
      }
      const previous = window.__taliaReportContext[REPORT_PANEL_ID] || null;
      const resolvedContext = typeof nextContext === 'function'
        ? nextContext(previous)
        : nextContext;
      window.__taliaReportContext[REPORT_PANEL_ID] = resolvedContext;
      window.dispatchEvent(
        new CustomEvent(REPORT_CONTEXT_EVENT, {
          detail: { panelId: REPORT_PANEL_ID, context: resolvedContext }
        })
      );
    } catch (err) {
      console.warn('[CompetitorPricing] Failed to publish report context:', err);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const handleSailSelect = async (event) => {
      try {
        const selection = extractSelectionFromEvent(event?.detail);
        if (!selection.sailCode && !selection.referenceSailCode) return;
        setFilters((prev) => ({ ...prev, duration: null, destination: null }));

        const inventoryRows = await fetchInventoryItems(selection);
        if (!mounted) return;

        const matchedInventory = inventoryRows.find((row) => {
          if (selection.shipCode && row.shipCode) {
            return normalizeString(row.shipCode) === normalizeString(selection.shipCode);
          }
          return true;
        }) || inventoryRows[0];

        const metadata = matchedInventory?.metadata || {};
        const contextDuration = pickMetadataValue(metadata, ['duration', 'sail_days', 'sailDays']) ?? selection.duration;
        const contextDestination = pickMetadataValue(metadata, ['destination', 'geog_area_code', 'geogAreaCode', 'port_to']) ?? selection.destination;

        publishReportContext({
          sourceEvent: event?.type || SAIL_SELECT_EVENT,
          sailCode: selection.sailCode || null,
          referenceSailCode: selection.referenceSailCode || null,
          shipCode: selection.shipCode || null,
          duration: contextDuration ?? null,
          destination: contextDestination ?? null,
          inventoryItemId: matchedInventory?.id || null
        });

        setPendingContextFilter({
          duration: contextDuration,
          destination: contextDestination
        });
      } catch (contextError) {
        console.warn('[CompetitorPricing] Failed to resolve inventory context:', contextError);
      }
    };

    const handleSailClear = () => {
      setPendingContextFilter(null);
      setFilters((prev) => ({ ...prev, duration: null, destination: null }));
      publishReportContext(null);
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(DOT_SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);

    if (window.lastSailSelectEvent?.detail) {
      handleSailSelect({ detail: window.lastSailSelectEvent.detail });
    }

    return () => {
      mounted = false;
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(DOT_SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
      publishReportContext(null);
    };
  }, [publishReportContext]);

  React.useEffect(() => {
    if (!pendingContextFilter || !data?.length) return;

    const mappedDuration = mapClosestDuration(pendingContextFilter.duration, data);
    const mappedDestination = mapClosestDestination(pendingContextFilter.destination, data);

    setFilters((prev) => ({
      ...prev,
      duration: mappedDuration,
      destination: mappedDestination
    }));
    publishReportContext((prevContext) => {
      const baseContext = typeof prevContext === 'object' && prevContext ? prevContext : {};
      return {
        ...baseContext,
        mappedDuration,
        mappedDestination
      };
    });
    setPendingContextFilter(null);
  }, [pendingContextFilter, data, publishReportContext]);

  // Show blocking loading only on first load.
  if (loading && (!data || data.length === 0)) {
    return <LoadingSpinner message="Loading competitor pricing data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load competitor pricing data"
        onRetry={refetch}
      />
    );
  }

  // Render competitor pricing with data
  return (
    <CompetitorPricingPresenter 
      data={data || []}
      filters={filters}
      onFiltersChange={setFilters}
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default CompetitorPricingContainer;

