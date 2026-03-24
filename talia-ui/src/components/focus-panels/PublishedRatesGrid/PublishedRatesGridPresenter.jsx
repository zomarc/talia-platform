/**
 * Published Rates Grid Presenter
 * Shows a promo-filtered grid with cabin types across columns and price history rows.
 */

import React from 'react';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import { formatDayMon } from '../../../lib/dateFormat';

const ALL_PROMOS = 'All Promos';
const ALL_RATE_TYPES = 'All Rate Types';
const ALL_CURRENCIES = 'All Currencies';

const formatDateLabel = (value) => {
  if (!value) return 'N/A';
  return formatDayMon(value, String(value));
};

const formatCurrency = (value, currency) => {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    if (currency) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    }
  } catch {
    // Ignore currency format errors and fall back to number.
  }
  return new Intl.NumberFormat('en-US').format(amount);
};

const RATE_TYPE_CLASS = {
  CUG: 'published-rates-grid__sparkline-path--cug',
  BAR: 'published-rates-grid__sparkline-path--bar',
  PROMO: 'published-rates-grid__sparkline-path--promo'
};

const getRateTypeClass = (rateType) => RATE_TYPE_CLASS[rateType] || 'published-rates-grid__sparkline-path--other';

const PublishedRatesGridPresenter = ({
  data,
  selectedSailCode,
  panelInstanceId,
  panelComponentId,
}) => {
  const { expandedKey, toggleExpandedKey } = useSubpanelExpansion(null);
  const [selectedPromo, setSelectedPromo] = React.useState(ALL_PROMOS);
  const [selectedRateType, setSelectedRateType] = React.useState(ALL_RATE_TYPES);
  const [selectedCurrency, setSelectedCurrency] = React.useState(ALL_CURRENCIES);
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'published-rates-grid',
  });
  const [selectedCabin, setSelectedCabin] = React.useState(null);

  React.useEffect(() => {
    if (!showDetails) setSelectedCabin(null);
  }, [showDetails]);

  const promoOptions = React.useMemo(() => {
    const promos = new Set();
    data.forEach((row) => {
      promos.add(row.PROMO_NAME_NORMALIZED || 'No Promo');
    });
    return [ALL_PROMOS, ...Array.from(promos).sort()];
  }, [data]);

  const rateTypeOptions = React.useMemo(() => {
    const rateTypes = new Set();
    data.forEach((row) => {
      if (row.RATE_TYPE) {
        rateTypes.add(row.RATE_TYPE);
      }
    });
    return [ALL_RATE_TYPES, ...Array.from(rateTypes).sort()];
  }, [data]);

  const currencyOptions = React.useMemo(() => {
    const currencies = new Set();
    data.forEach((row) => {
      if (row.CURRENCY_CODE) {
        currencies.add(row.CURRENCY_CODE);
      }
    });
    return [ALL_CURRENCIES, ...Array.from(currencies).sort()];
  }, [data]);

  React.useEffect(() => {
    if (!promoOptions.includes(selectedPromo)) {
      setSelectedPromo(promoOptions[0] || ALL_PROMOS);
    }
  }, [promoOptions, selectedPromo]);

  React.useEffect(() => {
    if (!rateTypeOptions.includes(selectedRateType)) {
      setSelectedRateType(rateTypeOptions[0] || ALL_RATE_TYPES);
    }
  }, [rateTypeOptions, selectedRateType]);

  React.useEffect(() => {
    if (!currencyOptions.includes(selectedCurrency)) {
      setSelectedCurrency(currencyOptions[0] || ALL_CURRENCIES);
    }
  }, [currencyOptions, selectedCurrency]);

  const filteredData = React.useMemo(() => {
    let rows = data;
    if (selectedPromo !== ALL_PROMOS) {
      rows = rows.filter((row) => row.PROMO_NAME_NORMALIZED === selectedPromo);
    }
    if (selectedRateType !== ALL_RATE_TYPES) {
      rows = rows.filter((row) => row.RATE_TYPE === selectedRateType);
    }
    if (selectedCurrency !== ALL_CURRENCIES) {
      rows = rows.filter((row) => row.CURRENCY_CODE === selectedCurrency);
    }
    return rows;
  }, [data, selectedPromo, selectedRateType, selectedCurrency]);

  const cabinCategories = React.useMemo(() => {
    const cabins = new Set();
    filteredData.forEach((row) => {
      if (row.CABIN_CATEGORY) {
        cabins.add(row.CABIN_CATEGORY);
      }
    });
    return Array.from(cabins).sort();
  }, [filteredData]);

  const snapshotRows = React.useMemo(() => {
    const bySnapshot = new Map();

    filteredData.forEach((row) => {
      const snapshot = row.SNAPSHOT_DATE ? String(row.SNAPSHOT_DATE).split('T')[0] : 'Unknown';
      if (!bySnapshot.has(snapshot)) {
        bySnapshot.set(snapshot, new Map());
      }
      const cabinMap = bySnapshot.get(snapshot);
      const cabinKey = row.CABIN_CATEGORY || 'Unknown';
      const existing = cabinMap.get(cabinKey);
      const value = row.FARE_PER_PERSON;
      if (!existing || (value != null && value < existing.value)) {
        cabinMap.set(cabinKey, {
          value,
          currency: row.CURRENCY_CODE,
          rateType: row.RATE_TYPE,
          promo: row.PROMO_NAME_NORMALIZED
        });
      }
    });

    const toTime = (value) => {
      const date = new Date(value);
      const time = date.getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    return Array.from(bySnapshot.entries())
      .map(([snapshot, cabinMap]) => ({ snapshot, cabinMap }))
      .sort((a, b) => toTime(b.snapshot) - toTime(a.snapshot));
  }, [filteredData]);

  const latestSnapshot = snapshotRows[0]?.snapshot || null;
  const latestPrices = snapshotRows[0]?.cabinMap || new Map();

  const fallbackPrices = React.useMemo(() => {
    const fallback = new Map();
    snapshotRows.forEach((row) => {
      cabinCategories.forEach((cabin) => {
        if (fallback.has(cabin)) return;
        const entry = row.cabinMap.get(cabin);
        if (entry) {
          fallback.set(cabin, { ...entry, snapshot: row.snapshot });
        }
      });
    });
    return fallback;
  }, [snapshotRows, cabinCategories]);

  const trendByCabinRateType = React.useMemo(() => {
    const byCabin = new Map();
    const toTime = (value) => {
      const date = new Date(value);
      const time = date.getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    filteredData.forEach((row) => {
      const cabin = row.CABIN_CATEGORY || 'Unknown';
      const rateType = row.RATE_TYPE || 'Other';
      const snapshot = row.SNAPSHOT_DATE ? String(row.SNAPSHOT_DATE).split('T')[0] : 'Unknown';
      const value = Number(row.FARE_PER_PERSON);
      if (!Number.isFinite(value)) return;
      if (!byCabin.has(cabin)) {
        byCabin.set(cabin, new Map());
      }
      const byRateType = byCabin.get(cabin);
      if (!byRateType.has(rateType)) {
        byRateType.set(rateType, new Map());
      }
      const bySnapshot = byRateType.get(rateType);
      const existing = bySnapshot.get(snapshot);
      if (existing == null || value < existing) {
        bySnapshot.set(snapshot, value);
      }
    });

    const trends = new Map();
    byCabin.forEach((byRateType, cabin) => {
      const rateTypeSeries = new Map();
      byRateType.forEach((bySnapshot, rateType) => {
        const points = Array.from(bySnapshot.entries())
          .map(([snapshot, value]) => ({ snapshot, value, time: toTime(snapshot) }))
          .sort((a, b) => a.time - b.time)
          .map(({ snapshot, value }) => ({ snapshot, value }));
        rateTypeSeries.set(rateType, points);
      });
      trends.set(cabin, rateTypeSeries);
    });

    return trends;
  }, [filteredData]);

  const renderSparkline = (seriesByRateType, visibleRateTypes) => {
    if (!seriesByRateType || seriesByRateType.size === 0) return null;
    const series = visibleRateTypes
      .map((rateType) => ({ rateType, points: seriesByRateType.get(rateType) || [] }))
      .filter((entry) => entry.points.length > 0);
    if (series.length === 0) return null;

    const width = 96;
    const height = 28;
    const padding = 3;
    const values = series.flatMap((entry) => entry.points.map((point) => point.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    return (
      <svg className="published-rates-grid__sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {series.map((entry) => {
          const step = entry.points.length === 1 ? 0 : (width - padding * 2) / (entry.points.length - 1);
          const coords = entry.points.map((point, index) => {
            const x = padding + index * step;
            const normalized = (point.value - min) / span;
            const y = height - padding - normalized * (height - padding * 2);
            return { x, y };
          });
          const path = coords
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
            .join(' ');
          const lastPoint = coords[coords.length - 1];
          return (
            <g key={entry.rateType}>
              <path d={path} className={`published-rates-grid__sparkline-path ${getRateTypeClass(entry.rateType)}`} />
              <circle cx={lastPoint.x} cy={lastPoint.y} r="2" className={`published-rates-grid__sparkline-dot ${getRateTypeClass(entry.rateType)}`} />
            </g>
          );
        })}
      </svg>
    );
  };

  const sailDetails = React.useMemo(() => {
    const row = filteredData[0];
    if (!row) return null;
    return {
      sailCode: row.SAIL_CODE || selectedSailCode,
      shipCode: row.SHIP_CODE,
      departureDate: row.DEPARTURE_DATE,
      sailDays: row.SAIL_DAYS,
      packageName: row.PACKAGE_NAME,
      region: row.REGION
    };
  }, [filteredData, selectedSailCode]);

  const selectedCabinRecords = React.useMemo(() => {
    if (!selectedCabin) return [];
    return filteredData
      .filter((row) => (row.CABIN_CATEGORY || 'Unknown') === selectedCabin)
      .sort((a, b) => {
        const aTime = new Date(a.SNAPSHOT_DATE || 0).getTime();
        const bTime = new Date(b.SNAPSHOT_DATE || 0).getTime();
        return bTime - aTime;
      });
  }, [filteredData, selectedCabin]);
  const isSectionVisible = (sectionKey) => !expandedKey || expandedKey === sectionKey;

  return (
    <div className={`talia-report published-rates-grid ${expandedKey ? 'published-rates-grid--focused' : ''}`}>
      <header className="talia-report__header published-rates-grid__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title published-rates-grid__title">Published Rates Grid</h2>
          <p className="talia-report__subtitle published-rates-grid__subtitle">
            Sail: {selectedSailCode || 'None'} • {snapshotRows.length} snapshots
          </p>
        </div>
      </header>

      <section className="published-rates-grid__filters talia-report-filters" aria-label="Published rates filters">
        <div className="published-rates-grid__controls">
          <label className="talia-report-filters__group" htmlFor="published-rates-promo">
            <span className="talia-report-filters__label">Promo</span>
            <select
              id="published-rates-promo"
              className="published-rates-grid__select talia-report-filters__input"
              value={selectedPromo}
              onChange={(event) => setSelectedPromo(event.target.value)}
            >
              {promoOptions.map((promo) => (
                <option key={promo} value={promo}>
                  {promo}
                </option>
              ))}
            </select>
          </label>
          <label className="talia-report-filters__group" htmlFor="published-rates-rate-type">
            <span className="talia-report-filters__label">Rate Type</span>
            <select
              id="published-rates-rate-type"
              className="published-rates-grid__select talia-report-filters__input"
              value={selectedRateType}
              onChange={(event) => setSelectedRateType(event.target.value)}
            >
              {rateTypeOptions.map((rateType) => (
                <option key={rateType} value={rateType}>
                  {rateType}
                </option>
              ))}
            </select>
          </label>
          <label className="talia-report-filters__group" htmlFor="published-rates-currency">
            <span className="talia-report-filters__label">Currency</span>
            <select
              id="published-rates-currency"
              className="published-rates-grid__select talia-report-filters__input"
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value)}
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="published-rates-grid__callout talia-callout" role="note" aria-label="Published rates guidance">
        Use filter selections to narrow promo, rate type, and currency. Toggle Callouts from the header eye menu or Appearance settings when you want a cleaner view.
      </section>

      {showDetails && sailDetails && (
        <section className="published-rates-grid__details">
          <div className="published-rates-grid__detail">
            <span className="published-rates-grid__detail-label">Ship</span>
            <span>{sailDetails.shipCode || 'N/A'}</span>
          </div>
          <div className="published-rates-grid__detail">
            <span className="published-rates-grid__detail-label">Departure</span>
            <span>{formatDateLabel(sailDetails.departureDate)}</span>
          </div>
          <div className="published-rates-grid__detail">
            <span className="published-rates-grid__detail-label">Sail Days</span>
            <span>{sailDetails.sailDays || 'N/A'}</span>
          </div>
          <div className="published-rates-grid__detail">
            <span className="published-rates-grid__detail-label">Package</span>
            <span>{sailDetails.packageName || 'N/A'}</span>
          </div>
          <div className="published-rates-grid__detail">
            <span className="published-rates-grid__detail-label">Region</span>
            <span>{sailDetails.region || 'N/A'}</span>
          </div>
        </section>
      )}

      {isSectionVisible('latest-prices') && (
      <section className={`published-rates-grid__current talia-card--expandable ${expandedKey === 'latest-prices' ? 'talia-card--expanded' : ''}`}>
        <SubpanelExpandButton
          className="talia-card__expand-toggle"
          expanded={expandedKey === 'latest-prices'}
          onToggle={() => toggleExpandedKey('latest-prices')}
          label="latest prices"
        />
        <div className="published-rates-grid__section-header">
          <div>
            <h3 className="published-rates-grid__section-title">Latest Prices</h3>
            <p className="published-rates-grid__section-subtitle">
              Snapshot: {latestSnapshot ? formatDateLabel(latestSnapshot) : 'N/A'} • Promo: {selectedPromo} • Rate: {selectedRateType} • Currency: {selectedCurrency}
            </p>
          </div>
          {selectedRateType === ALL_RATE_TYPES && (
            <div className="published-rates-grid__legend">
              {rateTypeOptions.filter((type) => type !== ALL_RATE_TYPES).map((type) => (
                <span key={type} className="published-rates-grid__legend-item">
                  <span className={`published-rates-grid__legend-dot ${getRateTypeClass(type)}`} />
                  {type}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="published-rates-grid__current-grid">
          {cabinCategories.map((cabin) => {
            const cell = latestPrices.get(cabin);
            const fallback = fallbackPrices.get(cabin);
            const displayCell = cell || fallback || null;
            const isFallback = !cell && fallback;
            const seriesByRateType = trendByCabinRateType.get(cabin) || new Map();
            const visibleRateTypes = selectedRateType === ALL_RATE_TYPES
              ? rateTypeOptions.filter((type) => type !== ALL_RATE_TYPES)
              : [selectedRateType];
            return (
              <button
                key={cabin}
                type="button"
                className={`published-rates-grid__current-card ${selectedCabin === cabin ? 'published-rates-grid__current-card--active' : ''}`}
                onClick={() => setSelectedCabin(cabin)}
              >
                <div className="published-rates-grid__current-label">{cabin}</div>
                <div className="published-rates-grid__current-value">
                  {displayCell ? formatCurrency(displayCell.value, displayCell.currency) : '—'}
                </div>
                <div className="published-rates-grid__current-meta">
                  {displayCell?.rateType || 'Rate N/A'}
                  {isFallback ? ' • Last available' : ''}
                </div>
                {renderSparkline(seriesByRateType, visibleRateTypes)}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {showDetails && selectedCabin && isSectionVisible('cabin-details') && (
        <section className={`published-rates-grid__details-panel talia-card--expandable ${expandedKey === 'cabin-details' ? 'talia-card--expanded' : ''}`}>
          <SubpanelExpandButton
            className="talia-card__expand-toggle"
            expanded={expandedKey === 'cabin-details'}
            onToggle={() => toggleExpandedKey('cabin-details')}
            label="cabin details"
          />
          <div className="published-rates-grid__details-header">
            <div>
              <h3 className="published-rates-grid__details-title">
                Details for {selectedCabin}
              </h3>
              <p className="published-rates-grid__details-subtitle">
                {selectedCabinRecords.length} records • Promo: {selectedPromo} • Rate: {selectedRateType} • Currency: {selectedCurrency}
              </p>
            </div>
            <button
              type="button"
              className="published-rates-grid__button"
              onClick={() => setSelectedCabin(null)}
            >
              Close
            </button>
          </div>
          <div className="published-rates-grid__details-table-wrap">
            <table className="published-rates-grid__details-table">
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Rate Type</th>
                  <th>Promo</th>
                  <th className="published-rates-grid__details-right">Price</th>
                  <th>Currency</th>
                  <th>Package</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                {selectedCabinRecords.map((row, idx) => (
                  <tr key={`${row.SNAPSHOT_DATE}-${row.RATE_TYPE}-${idx}`}>
                    <td>{formatDateLabel(row.SNAPSHOT_DATE)}</td>
                    <td>{row.RATE_TYPE || 'N/A'}</td>
                    <td>{row.PROMO_NAME_NORMALIZED || 'No Promo'}</td>
                    <td className="published-rates-grid__details-right">
                      {formatCurrency(row.FARE_PER_PERSON, row.CURRENCY_CODE)}
                    </td>
                    <td>{row.CURRENCY_CODE || 'N/A'}</td>
                    <td>{row.PACKAGE_NAME || 'N/A'}</td>
                    <td>{row.REGION || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showDetails && isSectionVisible('price-history') && (
        <section className={`published-rates-grid__history talia-card--expandable ${expandedKey === 'price-history' ? 'talia-card--expanded' : ''}`}>
          <SubpanelExpandButton
            className="talia-card__expand-toggle"
            expanded={expandedKey === 'price-history'}
            onToggle={() => toggleExpandedKey('price-history')}
            label="price history"
          />
          <div className="published-rates-grid__section-header">
            <div>
              <h3 className="published-rates-grid__section-title">Price History</h3>
              <p className="published-rates-grid__section-subtitle">
                {selectedPromo === ALL_PROMOS ? 'Lowest available per cabin' : `Promo: ${selectedPromo}`} • {selectedRateType} • {selectedCurrency}
              </p>
            </div>
          </div>
          <div className="published-rates-grid__table-wrap">
            <table className="published-rates-grid__table" role="grid">
              <thead>
                <tr>
                  <th className="published-rates-grid__th">Snapshot</th>
                  {cabinCategories.map((cabin) => (
                    <th key={cabin} className="published-rates-grid__th">
                      {cabin}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshotRows.map((row, index) => (
                  <tr
                    key={row.snapshot}
                    className={index === 0 ? 'published-rates-grid__row published-rates-grid__row--latest' : 'published-rates-grid__row'}
                  >
                    <td className="published-rates-grid__cell published-rates-grid__cell--sticky">
                      {formatDateLabel(row.snapshot)}
                    </td>
                    {cabinCategories.map((cabin) => {
                      const cell = row.cabinMap.get(cabin);
                      const title = cell
                        ? `Promo: ${cell.promo || 'N/A'} • Rate: ${cell.rateType || 'N/A'}`
                        : 'No data';
                      return (
                        <td key={cabin} className="published-rates-grid__cell" title={title}>
                          {cell ? formatCurrency(cell.value, cell.currency) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default PublishedRatesGridPresenter;
