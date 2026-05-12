/**
 * Custom hook for fetching data match/completeness data.
 * Applies dashboard global criteria (selected sailing + date window)
 * unless explicitly overridden by local Data Match filters.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackedFetchGraphql } from '../../services/data/trackedGraphql';
import { REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';

const GRAPHQL_URL = '/api/graphql';
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const normalizeText = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const getGlobalCriteriaSnapshot = () => {
  if (typeof window === 'undefined') {
    return { dateFrom: null, dateTo: null };
  }
  const criteria = window.__taliaGlobalCriteria || null;
  return {
    dateFrom: normalizeText(criteria?.dateFrom || null),
    dateTo: normalizeText(criteria?.dateTo || null)
  };
};

const getCleanFilters = (filters = {}, globalCriteria = {}) => {
  const localShipCode = normalizeText(filters.ship_code);
  const localSailCode = normalizeText(filters.sail_code);
  const localDateFrom = normalizeText(filters.date_from);
  const localDateTo = normalizeText(filters.date_to);

  const merged = {
    ship_code: localShipCode,
    sail_code: localSailCode,
    date_from: localDateFrom || globalCriteria.dateFrom || null,
    date_to: localDateTo || globalCriteria.dateTo || null
  };

  const clean = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value != null)
  );
  return clean;
};

export const useDataMatch = (filters = {}, options = {}) => {
  const { panelInstanceId = null, panelComponentId = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalCriteria, setGlobalCriteria] = useState(() => getGlobalCriteriaSnapshot());

  const effectiveFilters = useMemo(
    () => getCleanFilters(filters, globalCriteria),
    [filters, globalCriteria]
  );
  const effectiveFiltersKey = useMemo(
    () => JSON.stringify(effectiveFilters),
    [effectiveFilters]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = `
        query GetDataMatch($filters: DataMatchFilters) {
          dataMatch(filters: $filters) {
            rows {
              ship_code
              departure_date
              sail_code
              tableMatches {
                tableName
                matchingCount
                missingCount
              }
            }
            tables
          }
        }
      `;

      const variables = {
        filters: Object.keys(effectiveFilters).length > 0 ? effectiveFilters : undefined
      };
      const payload = await trackedFetchGraphql({
        url: GRAPHQL_URL,
        query,
        variables,
        tableName: 'data_match',
        component: 'Data Match',
        purpose: 'Fetch data match from talia graphql'
      });
      setData(payload?.dataMatch || null);
    } catch (err) {
      console.error('[useDataMatch] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData, effectiveFiltersKey]);

  useEffect(() => {
    const handleGlobalCriteriaChange = () => {
      setGlobalCriteria(getGlobalCriteriaSnapshot());
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
  }, []);

  useEffect(() => {
    const handleRefresh = (event) => {
      const detail = event?.detail || {};
      const targetPanel = detail.panelId;
      const targetInstance = detail.panelInstanceId;
      const targetComponent = detail.panelComponent;
      const scope = detail.scope;
      const isGlobal = scope === 'all' || (!targetPanel && !targetInstance && !targetComponent);
      const isMatch = (
        (panelComponentId && (targetPanel === panelComponentId || targetComponent === panelComponentId)) ||
        (panelInstanceId && targetInstance === panelInstanceId)
      );
      if (!isGlobal && !isMatch) return;
      setGlobalCriteria(getGlobalCriteriaSnapshot());
      fetchData();
    };
    window.addEventListener(REPORT_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, handleRefresh);
  }, [fetchData, panelComponentId, panelInstanceId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    effectiveFilters
  };
};

