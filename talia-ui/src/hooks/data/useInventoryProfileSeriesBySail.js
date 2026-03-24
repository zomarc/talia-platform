import { useCallback, useEffect, useMemo, useState } from 'react';
import inventoryProfileSeriesService from '../../services/data/inventoryProfileSeriesService';

const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const byPointOrder = (a, b) => (a.pointOrder || 0) - (b.pointOrder || 0);

export const useInventoryProfileSeriesBySail = (sailCode) => {
  const [inventoryItem, setInventoryItem] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!sailCode) {
      setInventoryItem(null);
      setSeries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const item = await inventoryProfileSeriesService.findInventoryItemBySailCode(sailCode);
      setInventoryItem(item || null);
      if (!item?.id) {
        setSeries([]);
        return;
      }
      const rows = await inventoryProfileSeriesService.fetchSeriesForInventoryItem(item.id);
      setSeries(rows || []);
    } catch (err) {
      setError(err);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [sailCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleCriteriaChange = () => {
      fetchData();
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleCriteriaChange);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleCriteriaChange);
  }, [fetchData]);

  const byKind = useMemo(() => {
    const next = {
      REAL: null,
      TARGET: null,
      BUDGET: null,
      MODEL: [],
    };
    (series || []).forEach((entry) => {
      if (entry?.kind === 'MODEL') {
        next.MODEL.push({ ...entry, points: [...(entry.points || [])].sort(byPointOrder) });
      } else if (entry?.kind && !next[entry.kind]) {
        next[entry.kind] = { ...entry, points: [...(entry.points || [])].sort(byPointOrder) };
      }
    });
    return next;
  }, [series]);

  const upsertModelSeries = useCallback(async ({ modelKey, modelLabel, points }) => {
    if (!inventoryItem?.id) {
      throw new Error('No mapped inventory item for selected sail code');
    }
    await inventoryProfileSeriesService.upsertModelSeries({
      inventoryItemId: inventoryItem.id,
      modelKey,
      modelLabel,
      points,
    });
    await fetchData();
  }, [inventoryItem, fetchData]);

  return {
    inventoryItem,
    series,
    byKind,
    loading,
    error,
    refetch: fetchData,
    upsertModelSeries,
  };
};

export default useInventoryProfileSeriesBySail;
