import React, { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getFieldValue, pickFirst } from '../../shared/utils/dataAccess';
import { formatDayMon } from '../../../lib/dateFormat';
import {
  LEAFLET_ENGLISH_TILE_ATTRIBUTION,
  LEAFLET_ENGLISH_TILE_URL,
  LeafletResizeObserver,
} from '../../shared/maps/LeafletMapDefaults';
import { PORT_COORDINATES, resolvePortCoordinate } from '../../shared/maps/portCoordinates';

const formatDate = (value) => {
  if (!value) return null;
  return formatDayMon(value, null);
};

const parseStops = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/[>,|/;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const MapFitBounds = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !Array.isArray(points) || points.length === 0) return;
    const bounds = points.map((point) => [point.lat, point.lon]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 5, { animate: false });
      return;
    }
    map.fitBounds(bounds, { padding: [16, 16], maxZoom: 6, animate: false });
  }, [map, points]);

  return null;
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
  const end = formatDayMon(endDate, null);
  return `${start} – ${end}`;
};

const formatCurrency = (value, currency) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const amount = Number(value);
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
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
  const { defaultDisplayCurrency } = useTheme();
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

  const route =
    portFrom && portTo
      ? `${portFrom} → ${portTo}`
      : pickFirst(portFrom, portTo);
  const dateRange = formatDateRange(sailDateFrom, sailDays);

  const fallbackPrice = useMemo(() => extractSailingPrice(sailing), [sailing]);
  const competitorInfo = useMemo(() => extractCompetitorInfo(sailing), [sailing]);
  const stopCandidates = parseStops(
    pickFirst(
      getFieldValue(sailing, 'itinerary_stops'),
      getFieldValue(sailing, 'stops'),
      getFieldValue(sailing, 'ports')
    )
  );
  const routePoints = useMemo(() => {
    const candidateNames = [portFrom, ...stopCandidates, portTo].filter(Boolean);
    const points = candidateNames
      .map((name) => {
        const resolved = resolvePortCoordinate(name);
        if (!resolved) return null;
        return { ...resolved, name: resolved.displayName || resolved.label };
      })
      .filter(Boolean);
    if (points.length > 0) return points;
    return [{ ...PORT_COORDINATES.athens, name: 'Athens' }];
  }, [portFrom, portTo, stopCandidates]);
  const polylinePoints = routePoints.map((point) => [point.lat, point.lon]);

  const resolvedPriceValue = priceInfo?.value ?? fallbackPrice.value;
  const resolvedPriceCurrency = pickFirst(
    priceInfo?.currency,
    fallbackPrice.currency,
    defaultDisplayCurrency
  );
  const resolvedPriceSource = priceInfo?.value
    ? priceInfo?.source
    : fallbackPrice.value
      ? fallbackPrice.source
      : null;
  const priceLineParts = [
    resolvedPriceSource,
    priceInfo?.rowsCount != null ? `${priceInfo.rowsCount} rates` : null,
    priceInfo?.lookedUpAt ? formatDate(priceInfo.lookedUpAt) : null
  ].filter(Boolean);

  const primaryParts = [sailCode, sailId, shipName].filter(Boolean);
  const routeParts = [route, dateRange, sailDays ? `${sailDays}d` : null].filter(Boolean);
  const codesLine = [packageType, geogArea].filter(Boolean).join(' · ');

  const priceText =
    resolvedPriceValue != null && !priceInfo?.loading
      ? formatCurrency(resolvedPriceValue, resolvedPriceCurrency)
      : null;

  const competitorRateText =
    competitorInfo.hasData && competitorInfo.rate
      ? formatCurrency(
          competitorInfo.rate,
          pickFirst(competitorInfo.currency, defaultDisplayCurrency)
        )
      : null;

  const srSummary = sailing
    ? [
        sailCode && `Sail code ${sailCode}`,
        sailId && `Sail id ${sailId}`,
        shipName && `Ship ${shipName}`,
        route && `Route ${route.replace(' → ', ' to ')}`,
        dateRange && `Dates ${dateRange}`,
        sailDays && `Duration ${sailDays} days`,
        packageName && `Package ${packageName}`,
        packageType && `Package type ${packageType}`,
        geogArea && `Area ${geogArea}`,
        relatedSailing && `Related sailing ${relatedSailing}`,
        priceText && `Current price ${priceText}`,
        resolvedPriceSource && `Price source ${resolvedPriceSource}`,
        competitorInfo.hasData
          ? `Competitor ${[competitorInfo.name, competitorRateText].filter(Boolean).join(' ')}`
          : null
      ]
        .filter(Boolean)
        .join('. ')
    : '';

  return (
    <div
      className="talia-report sailing-overview"
      role="region"
      aria-labelledby="sailing-overview-title"
    >
      <header className="talia-report__header sailing-overview__header">
        <h2 id="sailing-overview-title" className="talia-report__title">
          Sailing overview
        </h2>
      </header>

      <main className="talia-report__content sailing-overview__content">
        {!sailing ? (
          <div className="talia-empty sailing-overview__empty" role="status">
            <p className="talia-empty__message">Select a sailing.</p>
          </div>
        ) : (
          <div className="sailing-overview__compact">
            <span className="talia-sr-only">{srSummary}</span>

            <div className="sailing-overview__summary">
              {primaryParts.length > 0 && (
                <div className="sailing-overview__line sailing-overview__line--primary">
                  {primaryParts.map((part, i) => (
                    <React.Fragment key={`p-${i}-${String(part)}`}>
                      {i > 0 && <span className="sailing-overview__dot" aria-hidden="true">·</span>}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {routeParts.length > 0 && (
                <div className="sailing-overview__line sailing-overview__line--route">
                  {routeParts.map((part, i) => (
                    <React.Fragment key={`r-${i}-${String(part)}`}>
                      {i > 0 && <span className="sailing-overview__dot" aria-hidden="true">·</span>}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {packageName ? (
                <div className="sailing-overview__line sailing-overview__line--package" title={packageName}>
                  {packageName}
                </div>
              ) : null}

              {codesLine ? (
                <div className="sailing-overview__line sailing-overview__line--codes">{codesLine}</div>
              ) : null}

              {relatedSailing ? (
                <div className="sailing-overview__line sailing-overview__line--related">
                  <span aria-hidden="true">↳</span> {relatedSailing}
                </div>
              ) : null}

              <div
                className="sailing-overview__price-block"
                aria-busy={priceInfo?.loading ? true : undefined}
              >
                {priceInfo?.loading ? (
                  <span className="sailing-overview__price sailing-overview__price--pending">…</span>
                ) : priceText ? (
                  <span className="sailing-overview__price">{priceText}</span>
                ) : null}
                {priceLineParts.length > 0 && !priceInfo?.loading ? (
                  <span className="sailing-overview__price-meta">{priceLineParts.join(' · ')}</span>
                ) : null}
              </div>

              {priceInfo?.error ? (
                <div className="sailing-overview__note" role="status">
                  Price lookup failed; sailing fare may still apply.
                </div>
              ) : null}

              {competitorInfo.hasData ? (
                <div className="sailing-overview__line sailing-overview__line--competitor">
                  {competitorInfo.name || 'Competitor'}
                  {competitorRateText ? (
                    <>
                      <span className="sailing-overview__dot" aria-hidden="true">·</span>
                      {competitorRateText}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="sailing-overview__map-wrap">
              <MapContainer center={[37.9838, 23.7275]} zoom={4} className="sailing-overview__leaflet" zoomControl>
                <LeafletResizeObserver />
                <TileLayer
                  attribution={LEAFLET_ENGLISH_TILE_ATTRIBUTION}
                  url={LEAFLET_ENGLISH_TILE_URL}
                />
                <MapFitBounds points={routePoints} />
                {polylinePoints.length > 1 && (
                  <Polyline positions={polylinePoints} color="#4da3ff" weight={3} opacity={0.85} />
                )}
                {routePoints.map((point, index) => (
                  <CircleMarker
                    key={`${point.label}-${index}`}
                    center={[point.lat, point.lon]}
                    radius={index === 0 ? 7 : 6}
                    pathOptions={{
                      color: index === 0 ? '#4caf50' : '#9ec6ff',
                      fillColor: index === 0 ? '#4caf50' : '#9ec6ff',
                      fillOpacity: 0.9,
                      weight: 1,
                    }}
                  >
                    <Tooltip>{`${index + 1}. ${point.name}`}</Tooltip>
                    <Popup>
                      <div>
                        <strong>{point.name}</strong>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SailingOverviewPresenter;
