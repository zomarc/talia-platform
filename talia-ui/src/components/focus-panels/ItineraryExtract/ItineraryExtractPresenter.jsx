import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const MapFitBounds = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !Array.isArray(points) || points.length === 0) return;
    const bounds = points.map((point) => [point.lat, point.lon]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 5);
      return;
    }
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }, [map, points]);

  return null;
};

const ItineraryExtractPresenter = ({
  data,
  shipFilter,
  durationFilter,
  shipOptions,
  durationOptions,
  onShipFilterChange,
  onDurationFilterChange,
  referenceSourceUrl,
}) => {
  const [selectedId, setSelectedId] = useState(data?.[0]?.id || null);
  const [failedImageIds, setFailedImageIds] = useState(() => new Set());

  useEffect(() => {
    if (!data || data.length === 0) return;
    const selectedStillVisible = data.some((item) => item.id === selectedId);
    if (!selectedStillVisible) {
      setSelectedId(data[0].id);
    }
  }, [data, selectedId]);

  useEffect(() => {
    const validIds = new Set((data || []).map((item) => item.id));
    setFailedImageIds((previous) => {
      const next = new Set();
      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [data]);

  const selectedItinerary = useMemo(
    () => data.find((item) => item.id === selectedId) || data[0] || null,
    [data, selectedId]
  );

  const selectedPoints = selectedItinerary?.routePoints || [];
  const polylinePoints = selectedPoints.map((point) => [point.lat, point.lon]);

  return (
    <div className="talia-report" role="region" aria-label="Itinerary extract">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Itinerary Extract</h2>
          <p className="talia-report__subtitle">Compact view of selected cruise itineraries by ship and duration.</p>
        </div>
      </header>

      <div className="talia-report-filters">
        <label className="talia-report-filters__group" htmlFor="itinerary-extract-ship">
          <span className="talia-report-filters__label">Ship</span>
          <select
            id="itinerary-extract-ship"
            className="talia-report-filters__input"
            value={shipFilter}
            onChange={(event) => onShipFilterChange(event.target.value)}
          >
            {shipOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All Ships' : option}
              </option>
            ))}
          </select>
        </label>

        <label className="talia-report-filters__group" htmlFor="itinerary-extract-duration">
          <span className="talia-report-filters__label">Duration</span>
          <select
            id="itinerary-extract-duration"
            className="talia-report-filters__input"
            value={durationFilter}
            onChange={(event) => onDurationFilterChange(event.target.value)}
          >
            {durationOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All Durations' : option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <main className="talia-report__content">
        <div className="itinerary-extract__layout">
          <div className="talia-list itinerary-extract__list" role="list">
          {data.map((item) => (
            <article
              className={`talia-card talia-list__item itinerary-extract__item ${item.id === selectedItinerary?.id ? 'itinerary-extract__item--active' : ''}`}
              role="listitem"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="talia-list__header">
                <h3 className="talia-list__title">{item.itineraryName}</h3>
                <span className="talia-pill talia-pill--neutral">
                  {typeof item.durationNights === 'number' ? `${item.durationNights}N` : String(item.durationNights || 'N/A')}
                </span>
              </div>
              {item.referenceSourceLabel ? (
                <div className="talia-meta">
                  <span className="talia-pill talia-pill--neutral">{item.referenceSourceLabel}</span>
                </div>
              ) : null}
              {item.referenceImage && !failedImageIds.has(item.id) ? (
                <img
                  src={item.referenceImage}
                  alt={`${item.itineraryName} reference artwork`}
                  className="itinerary-extract__image"
                  loading="lazy"
                  onError={() => {
                    setFailedImageIds((previous) => {
                      const next = new Set(previous);
                      next.add(item.id);
                      return next;
                    });
                  }}
                />
              ) : (
                <div className="itinerary-extract__image itinerary-extract__image--empty">
                  Source image not available for this itinerary.
                </div>
              )}
              <div className="talia-meta">
                <span>{item.ship}</span>
                <span>{`Departs: ${item.departurePort}`}</span>
                <span>{`Next: ${formatDate(item.nextDeparture)}`}</span>
              </div>
              <div className="talia-meta">
                <strong>Stops:</strong>
                {(item.stops || []).map((stop) => (
                  <span key={`${item.id}-${stop}`}>{stop}</span>
                ))}
                {(!item.stops || item.stops.length === 0) && <span>Not published</span>}
              </div>
            </article>
          ))}
          </div>

          <section className="itinerary-extract__map-card" aria-label="Itinerary route map">
            <div className="itinerary-extract__map-header">
              <h3 className="itinerary-extract__map-title">
                {selectedItinerary ? `${selectedItinerary.ship} - ${selectedItinerary.itineraryName}` : 'Route map'}
              </h3>
              <a
                href={selectedItinerary?.referenceUrl || referenceSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="itinerary-extract__source-link"
              >
                Open external reference
              </a>
            </div>
            <div className="itinerary-extract__map-wrap">
              <MapContainer center={[37.9838, 23.7275]} zoom={4} className="itinerary-extract__leaflet" zoomControl>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapFitBounds points={selectedPoints} />
                {polylinePoints.length > 1 && (
                  <Polyline positions={polylinePoints} color="#4da3ff" weight={3} opacity={0.85} />
                )}
                {selectedPoints.map((point, index) => (
                  <CircleMarker
                    key={`${selectedItinerary?.id || 'route'}-${point.label}-${index}`}
                    center={[point.lat, point.lon]}
                    radius={index === 0 ? 7 : 6}
                    pathOptions={{
                      color: index === 0 ? '#4caf50' : '#9ec6ff',
                      fillColor: index === 0 ? '#4caf50' : '#9ec6ff',
                      fillOpacity: 0.85,
                      weight: 1,
                    }}
                  >
                    <Tooltip>{`${index + 1}. ${point.name}`}</Tooltip>
                    <Popup>
                      <div>
                        <strong>{point.name}</strong>
                        <div>{point.label}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>
        </div>
      </main>

      <footer className="talia-report__footer">
        <span>{`${data.length} mapped itineraries`}</span>
        <span>Primary data: inventory_item/master_sail | External links: Celestyal public pages</span>
      </footer>
    </div>
  );
};

export default ItineraryExtractPresenter;
