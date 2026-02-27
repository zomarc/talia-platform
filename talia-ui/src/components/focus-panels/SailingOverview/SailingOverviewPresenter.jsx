import React, { useMemo } from 'react';
import LoadingSpinner from '../../shared/LoadingSpinner';

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

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

const formatDateRange = (startDateValue, sailDays) => {
  const start = formatDate(startDateValue);
  if (!start) return null;
  const days = Number(sailDays);
  if (!Number.isFinite(days) || days <= 0) {
    return start;
  }
  const startDate = new Date(startDateValue);
  const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  const end = endDate.toLocaleDateString();
  return `${start} - ${end}`;
};

const formatCurrency = (value, currency) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Not available';
  const amount = Number(value);
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
    }
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
};

const extractSailingPrice = (sailing) => {
  if (!sailing) return { value: null, currency: null, source: null };
  const priceFields = [
    'current_price',
    'fare_per_person',
    'total_rate_pp',
    'totalRatePP',
    'price_min_inside',
    'price_min_outside',
    'price_min_deluxe',
    'price'
  ];

  let priceValue = null;
  for (const field of priceFields) {
    const candidate = getFieldValue(sailing, field);
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      priceValue = parsed;
      break;
    }
  }

  if (priceValue === null) {
    return { value: null, currency: null, source: null };
  }

  const currency = pickFirst(
    getFieldValue(sailing, 'currency_code'),
    getFieldValue(sailing, 'currency')
  );

  return {
    value: priceValue,
    currency: currency || null,
    source: 'sailing data'
  };
};

const extractCompetitorInfo = (sailing) => {
  if (!sailing) return { hasData: false };
  const name = pickFirst(
    getFieldValue(sailing, 'competitor_name'),
    getFieldValue(sailing, 'competitor'),
    getFieldValue(sailing, 'cruiseLine'),
    getFieldValue(sailing, 'cruise_line')
  );
  const rate = pickFirst(
    getFieldValue(sailing, 'competitor_price'),
    getFieldValue(sailing, 'competitor_rate'),
    getFieldValue(sailing, 'competitor_total_rate'),
    getFieldValue(sailing, 'competitor_pppd')
  );
  const currency = pickFirst(
    getFieldValue(sailing, 'competitor_currency'),
    getFieldValue(sailing, 'currency_code'),
    getFieldValue(sailing, 'currency')
  );

  return {
    hasData: Boolean(name || rate),
    name: name || null,
    rate: rate || null,
    currency: currency || null
  };
};

const SailingOverviewPresenter = ({ sailing, eventDetail, priceInfo }) => {
  const sailCode = pickFirst(
    getFieldValue(sailing, 'sail_code'),
    getFieldValue(eventDetail, 'sail_code')
  );
  const sailId = getFieldValue(sailing, 'sail_id');
  const shipName = getFieldValue(sailing, 'ship_name');
  const packageName = getFieldValue(sailing, 'package_name');
  const packageType = getFieldValue(sailing, 'package_type');
  const sailDays = getFieldValue(sailing, 'sail_days');
  const sailDateFrom = pickFirst(
    getFieldValue(sailing, 'sail_date_from'),
    getFieldValue(sailing, 'sail_date')
  );
  const portFrom = getFieldValue(sailing, 'port_from');
  const portTo = getFieldValue(sailing, 'port_to');
  const geogArea = getFieldValue(sailing, 'geog_area_code');
  const relatedSailing = pickFirst(
    getFieldValue(sailing, 'related_sail_code'),
    getFieldValue(sailing, 'related_sailing'),
    getFieldValue(sailing, 'parent_sail_code')
  );

  const route = portFrom && portTo ? `${portFrom} to ${portTo}` : pickFirst(portFrom, portTo);
  const dateRange = formatDateRange(sailDateFrom, sailDays);
  const lastUpdated = eventDetail?.timestamp ? new Date(eventDetail.timestamp).toLocaleString() : null;

  const fallbackPrice = useMemo(() => extractSailingPrice(sailing), [sailing]);
  const competitorInfo = useMemo(() => extractCompetitorInfo(sailing), [sailing]);

  const resolvedPriceValue = priceInfo?.value ?? fallbackPrice.value;
  const resolvedPriceCurrency = priceInfo?.currency ?? fallbackPrice.currency;
  const resolvedPriceSource = priceInfo?.value
    ? priceInfo?.source
    : fallbackPrice.value
      ? fallbackPrice.source
      : null;

  return (
    <div className="talia-report" role="region" aria-label="Sailing overview">
      <header className="talia-report__header">
        <div>
          <h2 className="talia-report__title">Sailing Overview</h2>
          <p className="talia-report__subtitle">Quick summary for the selected sailing event</p>
        </div>
        <div className="talia-event-meta__chips" aria-label="Selected sailing">
          <span className="talia-event-meta__chip">Sail: {sailCode || 'None'}</span>
          {shipName && (
            <span className="talia-event-meta__chip talia-event-meta__chip--secondary">
              {shipName}
            </span>
          )}
        </div>
      </header>

      <main className="talia-report__content">
        {!sailing ? (
          <div className="talia-empty" role="status">
            <span className="talia-empty__icon" aria-hidden="true">i</span>
            <h3 className="talia-empty__title">No sailing selected</h3>
            <p className="talia-empty__message">Select a sailing to see the overview panel.</p>
          </div>
        ) : (
          <div className="talia-grid talia-grid--2">
            <div className="talia-card">
              <div className="talia-card__header">
                <h3 className="talia-card__title">Sailing Details</h3>
              </div>
              <div className="talia-meta">
                <span><strong>Sail Code:</strong> {sailCode || 'Not available'}</span>
                <span><strong>Sail ID:</strong> {sailId || 'Not available'}</span>
                <span><strong>Route:</strong> {route || 'Not available'}</span>
                <span><strong>Dates:</strong> {dateRange || 'Not available'}</span>
                <span><strong>Duration:</strong> {sailDays ? `${sailDays} days` : 'Not available'}</span>
                <span><strong>Package:</strong> {packageName || 'Not available'}</span>
                <span><strong>Package Type:</strong> {packageType || 'Not available'}</span>
                <span><strong>Geographic Area:</strong> {geogArea || 'Not available'}</span>
                <span><strong>Related Sailing:</strong> {relatedSailing || 'Not available'}</span>
              </div>
            </div>

            <div className="talia-card">
              <div className="talia-card__header">
                <h3 className="talia-card__title">Pricing and Competition</h3>
              </div>

              {priceInfo?.loading ? (
                <LoadingSpinner message="Loading price..." fullScreen={false} size="small" />
              ) : (
                <div className="talia-metric">
                  <span className="talia-metric__label">Current Price</span>
                  <span className="talia-metric__value">
                    {formatCurrency(resolvedPriceValue, resolvedPriceCurrency)}
                  </span>
                  <span className="talia-metric__change">
                    {resolvedPriceSource ? `Source: ${resolvedPriceSource}` : 'Source: Not available'}
                  </span>
                </div>
              )}

              {priceInfo?.error && (
                <div className="talia-meta">
                  <span>Price lookup failed. Using available sailing data if present.</span>
                </div>
              )}

              <div className="talia-meta">
                <span><strong>Availability:</strong> Coming soon</span>
              </div>

              {competitorInfo.hasData ? (
                <div className="talia-meta">
                  <span><strong>Competitor:</strong> {competitorInfo.name || 'Competitor'}</span>
                  <span>
                    <strong>Competitor Rate:</strong>{' '}
                    {competitorInfo.rate
                      ? formatCurrency(competitorInfo.rate, competitorInfo.currency)
                      : 'Not available'}
                  </span>
                </div>
              ) : (
                <div className="talia-meta">
                  <span><strong>Competitor:</strong> Not available</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="talia-report__footer">
        <span>{sailCode ? `Sail ${sailCode}` : 'Waiting for selection'}</span>
        <span>{lastUpdated ? `Updated ${lastUpdated}` : 'No event timestamp'}</span>
      </footer>
    </div>
  );
};

export default SailingOverviewPresenter;
