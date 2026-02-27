import React, { useEffect, useMemo, useRef, useState } from 'react';
import SailingOverviewPresenter from './SailingOverviewPresenter';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const GRAPHQL_URL = '/api/graphql';
const PUBLISHED_RATES_TABLE = 'published_rates_current_state';
const PUBLISHED_RATES_LIMIT = 500;

const pickFirst = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

const getFieldValue = (record, key) => {
  if (!record) return null;
  if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  const upperKey = key.toUpperCase();
  if (record[upperKey] !== undefined && record[upperKey] !== null && record[upperKey] !== '') return record[upperKey];
  const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  if (record[camelKey] !== undefined && record[camelKey] !== null && record[camelKey] !== '') return record[camelKey];
  return null;
};

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

const extractPriceSummary = (rows) => {
  if (!rows || rows.length === 0) {
    return { value: null, currency: null, source: null };
  }

  const values = rows
    .map((row) => pickFirst(
      getFieldValue(row, 'fare_per_person'),
      getFieldValue(row, 'total_rate_pp'),
      getFieldValue(row, 'totalRatePP'),
      getFieldValue(row, 'price'),
      getFieldValue(row, 'current_price')
    ))
    .map((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value) => value !== null);

  if (values.length === 0) {
    return { value: null, currency: null, source: null };
  }

  const currency = pickFirst(
    getFieldValue(rows[0], 'currency_code'),
    getFieldValue(rows[0], 'currency')
  );

  return {
    value: Math.min(...values),
    currency: currency || null,
    source: 'published rates'
  };
};

const SailingOverviewContainer = () => {
  const [eventDetail, setEventDetail] = useState(null);
  const [priceInfo, setPriceInfo] = useState({
    loading: false,
    error: null,
    value: null,
    currency: null,
    source: null
  });
  const activeFetchRef = useRef(0);

  useEffect(() => {
    const handleSelect = (event) => {
      setEventDetail(normalizeEventDetail(event?.detail));
    };

    const handleClear = () => {
      setEventDetail(null);
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);

    if (window.lastSailSelectEvent?.detail) {
      setEventDetail(normalizeEventDetail(window.lastSailSelectEvent.detail));
    }

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, []);

  const sailing = useMemo(() => eventDetail?.row_data || eventDetail || null, [eventDetail]);
  const sailCode = useMemo(() => getSailCode(sailing), [sailing]);

  useEffect(() => {
    let cancelled = false;
    const fetchId = activeFetchRef.current + 1;
    activeFetchRef.current = fetchId;

    if (!sailCode) {
      setPriceInfo({
        loading: false,
        error: null,
        value: null,
        currency: null,
        source: null
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
        const summary = extractPriceSummary(rows);
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
          source: null
        });
      }
    };

    loadPrice();

    return () => {
      cancelled = true;
    };
  }, [sailCode]);

  return (
    <SailingOverviewPresenter
      sailing={sailing}
      eventDetail={eventDetail}
      priceInfo={priceInfo}
    />
  );
};

export default SailingOverviewContainer;
