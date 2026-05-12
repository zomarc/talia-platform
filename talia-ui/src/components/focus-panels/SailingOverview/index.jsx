import React, { useEffect, useMemo, useRef, useState } from 'react';
import SailingOverviewPresenter from './SailingOverviewPresenter';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getFieldValue, pickFirst } from '../../shared/utils/dataAccess';

const GRAPHQL_URL = '/api/graphql';
const PUBLISHED_RATES_TABLE = 'published_rates_current_state';
const PUBLISHED_RATES_LIMIT = 500;
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const getSailCode = (sailing) => pickFirst(
  getFieldValue(sailing, 'sail_code'),
  getFieldValue(sailing, 'Sail_Code')
);

const normalizeEventDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') {
    return { sail_code: detail };
  }
  return detail;
};

const getPersistedSailEventDetail = () => {
  const criteriaSailing = window?.__taliaGlobalCriteria?.selectedSailing;
  const criteriaDetail = normalizeEventDetail(
    criteriaSailing?.detail || criteriaSailing || window?.__taliaGlobalCriteria?.selectedSailCode || null
  );
  if (criteriaDetail) return criteriaDetail;

  const runtimeDetail = window?.lastSailSelectEvent?.detail;
  if (runtimeDetail) return normalizeEventDetail(runtimeDetail);

  try {
    const raw = window?.localStorage?.getItem?.('talia:persisted:lastEvent');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const isSail =
      parsed.name === SAIL_SELECT_EVENT ||
      parsed.type === SAIL_SELECT_EVENT ||
      parsed.source === 'sail';
    if (!isSail) return null;
    return normalizeEventDetail(parsed.detail);
  } catch {
    return null;
  }
};

const fetchPublishedRates = async (sailCode) => {
  const query = `
    query GetPublishedRates($tableName: String!, $limit: Int, $filters: TableDataFilters) {
      tableData(tableName: $tableName, limit: $limit, filters: $filters)
    }
  `;

  const variables = {
    tableName: PUBLISHED_RATES_TABLE,
    limit: PUBLISHED_RATES_LIMIT,
    filters: { sail_code: sailCode }
  };

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result.data?.tableData || [];
};

const rowCurrencyCode = (row) =>
  String(pickFirst(getFieldValue(row, 'currency_code'), getFieldValue(row, 'currency')) || '')
    .trim()
    .toUpperCase();

const extractPriceSummary = (rows, preferredCurrencyCode) => {
  if (!rows || rows.length === 0) {
    return { value: null, currency: null, source: null, lookedUpAt: null, rowsCount: 0 };
  }

  const pref = String(preferredCurrencyCode || '').trim().toUpperCase();

  const scored = rows
    .map((row) => {
      const raw = pickFirst(
        getFieldValue(row, 'fare_per_person'),
        getFieldValue(row, 'total_rate_pp'),
        getFieldValue(row, 'totalRatePP'),
        getFieldValue(row, 'price'),
        getFieldValue(row, 'current_price')
      );
      const parsed = Number(raw);
      const value = Number.isFinite(parsed) ? parsed : null;
      const currency = rowCurrencyCode(row) || null;
      return { row, value, currency };
    })
    .filter((entry) => entry.value !== null);

  if (scored.length === 0) {
    return { value: null, currency: null, source: null, lookedUpAt: null, rowsCount: rows.length };
  }

  let pool = scored;
  if (pref && scored.some((entry) => entry.currency === pref)) {
    pool = scored.filter((entry) => entry.currency === pref);
  }

  const best = pool.reduce((acc, cur) => (cur.value < acc.value ? cur : acc));
  const currency = best.currency || pref || null;

  const lookups = pool
    .map((entry) => pickFirst(
      getFieldValue(entry.row, 'updated_at'),
      getFieldValue(entry.row, 'last_updated'),
      getFieldValue(entry.row, 'modified_at'),
      getFieldValue(entry.row, 'effective_date')
    ))
    .map((value) => {
      const timestamp = Date.parse(String(value || ''));
      return Number.isFinite(timestamp) ? timestamp : null;
    })
    .filter((value) => value !== null);

  return {
    value: best.value,
    currency: currency || null,
    source: 'published rates',
    lookedUpAt: lookups.length ? new Date(Math.max(...lookups)).toISOString() : null,
    rowsCount: rows.length
  };
};

const SailingOverviewContainer = () => {
  const { defaultDisplayCurrency } = useTheme();
  const [eventDetail, setEventDetail] = useState(null);
  const [publishedRatesRows, setPublishedRatesRows] = useState([]);
  const [priceInfo, setPriceInfo] = useState({
    loading: false,
    error: null,
    value: null,
    currency: null,
    source: null,
    lookedUpAt: null,
    rowsCount: 0
  });
  const activeFetchRef = useRef(0);
  const lastGlobalCriteriaChangeRef = useRef(0);

  useEffect(() => {
    const handleSelect = (event) => {
      setEventDetail(normalizeEventDetail(event?.detail));
    };

    const handleClear = () => {
      const elapsedSinceGlobalCriteriaMs = Date.now() - lastGlobalCriteriaChangeRef.current;
      if (elapsedSinceGlobalCriteriaMs >= 0 && elapsedSinceGlobalCriteriaMs < 1500) {
        const persisted = getPersistedSailEventDetail();
        if (persisted) {
          setEventDetail(persisted);
          return;
        }
      }
      setEventDetail(null);
    };

    const handleGlobalCriteriaChange = () => {
      lastGlobalCriteriaChangeRef.current = Date.now();
      // Selection can be transiently cleared by table refresh side-effects.
      // Re-hydrate from persisted sail selection if available.
      window.setTimeout(() => {
        setEventDetail((prev) => {
          const currentSailCode = getSailCode(prev?.row_data || prev);
          if (currentSailCode) return prev;
          const persisted = getPersistedSailEventDetail();
          return persisted || prev;
        });
      }, 0);
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);

    const persisted = getPersistedSailEventDetail();
    if (persisted) {
      setEventDetail(persisted);
    }

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
      window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
    };
  }, []);

  const sailing = useMemo(() => eventDetail?.row_data || eventDetail || null, [eventDetail]);
  const sailCode = useMemo(() => getSailCode(sailing), [sailing]);

  useEffect(() => {
    let cancelled = false;
    const fetchId = activeFetchRef.current + 1;
    activeFetchRef.current = fetchId;

    if (!sailCode) {
      setPublishedRatesRows([]);
      setPriceInfo({
        loading: false,
        error: null,
        value: null,
        currency: null,
        source: null,
        lookedUpAt: null,
        rowsCount: 0
      });
      return () => {
        cancelled = true;
      };
    }

    const loadPrice = async () => {
      setPriceInfo((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const rows = await fetchPublishedRates(sailCode);
        if (cancelled || activeFetchRef.current !== fetchId) return;
        setPublishedRatesRows(rows);
        const summary = extractPriceSummary(rows, defaultDisplayCurrency);
        setPriceInfo({
          loading: false,
          error: null,
          ...summary
        });
      } catch (error) {
        if (cancelled || activeFetchRef.current !== fetchId) return;
        setPriceInfo({
          loading: false,
          error,
          value: null,
          currency: null,
          source: null,
          lookedUpAt: null,
          rowsCount: 0
        });
        setPublishedRatesRows([]);
      }
    };

    loadPrice();

    return () => {
      cancelled = true;
    };
  }, [sailCode]);

  useEffect(() => {
    if (!sailCode) return;
    if (!Array.isArray(publishedRatesRows) || publishedRatesRows.length === 0) return;
    setPriceInfo((prev) => {
      if (prev.loading) return prev;
      const summary = extractPriceSummary(publishedRatesRows, defaultDisplayCurrency);
      return {
        ...prev,
        error: null,
        ...summary
      };
    });
  }, [publishedRatesRows, defaultDisplayCurrency, sailCode]);

  return (
    <SailingOverviewPresenter
      sailing={sailing}
      eventDetail={eventDetail}
      priceInfo={priceInfo}
    />
  );
};

export default SailingOverviewContainer;
