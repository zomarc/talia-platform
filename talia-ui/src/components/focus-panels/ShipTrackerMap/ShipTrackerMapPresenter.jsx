import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';

const DEFAULT_CENTER = [36.8, 25.9];
const SHIP_COLORS = ['#0d47a1', '#b71c1c'];

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const routeLabel = (route) => {
  const from = route?.fromPort || 'Unknown';
  const to = route?.toPort || 'Unknown';
  return `${from} -> ${to}`;
};

const routeWeatherText = (weather, loading) => {
  if (loading) return 'Wx loading...';
  if (!weather) return 'Wx N/A';
  const temp = Number.isFinite(Number(weather.temperature)) ? `${Math.round(Number(weather.temperature))}C` : 'N/A';
  const wind = Number.isFinite(Number(weather.windSpeed)) ? `${Math.round(Number(weather.windSpeed))}km/h` : 'N/A';
  return `${weather.label} ${temp} wind ${wind}`;
};

const shipWeatherText = (shipWeather, loading) => {
  if (loading) return 'Weather loading...';
  if (!shipWeather) return 'Weather feed unavailable';
  return `${shipWeather.label}, ${Math.round(shipWeather.temperature)}C wind ${Math.round(shipWeather.windSpeed)} km/h`;
};

const formatPublished = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const getRouteStyle = (status, color) => {
  if (status === 'past') {
    return { color, weight: 3, dashArray: '8,8', opacity: 0.45 };
  }
  if (status === 'future') {
    return { color, weight: 3, dashArray: '4,8', opacity: 0.75 };
  }
  return { color, weight: 4, opacity: 1 };
};

const toRadians = (value) => (value * Math.PI) / 180;
const toDegrees = (value) => (value * 180) / Math.PI;

const greatCirclePath = (from, to) => {
  const fromLat = Number(from?.lat);
  const fromLon = Number(from?.lon);
  const toLat = Number(to?.lat);
  const toLon = Number(to?.lon);
  if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) return [];

  const lat1 = toRadians(fromLat);
  const lon1 = toRadians(fromLon);
  const lat2 = toRadians(toLat);
  const lon2 = toRadians(toLon);

  // Angular distance between points
  const sinDLat = Math.sin((lat2 - lat1) / 2);
  const sinDLon = Math.sin((lon2 - lon1) / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const angular = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  if (!Number.isFinite(angular) || angular === 0) {
    return [[fromLat, fromLon], [toLat, toLon]];
  }

  // Use more points for longer legs for smoother curvature.
  const pointCount = Math.max(2, Math.min(28, Math.round(angular * 18)));
  const sinAngular = Math.sin(angular);
  const points = [];

  for (let i = 0; i <= pointCount; i += 1) {
    const t = i / pointCount;
    const aScale = Math.sin((1 - t) * angular) / sinAngular;
    const bScale = Math.sin(t * angular) / sinAngular;

    const x =
      aScale * Math.cos(lat1) * Math.cos(lon1) +
      bScale * Math.cos(lat2) * Math.cos(lon2);
    const y =
      aScale * Math.cos(lat1) * Math.sin(lon1) +
      bScale * Math.cos(lat2) * Math.sin(lon2);
    const z = aScale * Math.sin(lat1) + bScale * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([toDegrees(lat), toDegrees(lon)]);
  }

  return points;
};

const FitMapToShips = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (points.length === 1) {
      map.setView(points[0], 6, { animate: false });
      return;
    }

    map.fitBounds(points, {
      padding: [24, 24],
      maxZoom: 7,
      animate: false
    });
  }, [map, points]);

  return null;
};

const MapResizeOnLayout = ({ expanded }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 50);
    return () => clearTimeout(timer);
  }, [map, expanded]);
  return null;
};

const getRouteEndpoints = (route) => {
  const from = route?.from || route?.fromCoord || null;
  const to = route?.to || route?.toCoord || null;
  return { from, to };
};

const ShipTrackerMapPresenter = ({
  ships,
  weatherByShip,
  routeWeatherByKey,
  weatherLoading,
  routeWeatherLoading,
  portNewsByPort,
  portNewsLoading,
  livePositionsError,
  onRefresh
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedShipCode, setSelectedShipCode] = useState('ALL');
  const [pastWindow, setPastWindow] = useState(3);
  const [futureWindow, setFutureWindow] = useState(3);
  const visibleShips = useMemo(
    () => (selectedShipCode === 'ALL' ? ships : ships.filter((ship) => ship.shipCode === selectedShipCode)),
    [ships, selectedShipCode]
  );

  useEffect(() => {
    if (selectedShipCode === 'ALL') return;
    const exists = ships.some((ship) => ship.shipCode === selectedShipCode);
    if (!exists) {
      setSelectedShipCode('ALL');
    }
  }, [ships, selectedShipCode]);

  const maxWindows = useMemo(() => {
    const counts = visibleShips.reduce((acc, ship) => {
      const pastCount = Array.isArray(ship.pastRoutes) ? ship.pastRoutes.length : 0;
      const futureCount = Array.isArray(ship.futureRoutes) ? ship.futureRoutes.length : 0;
      return {
        past: Math.max(acc.past, pastCount),
        future: Math.max(acc.future, futureCount)
      };
    }, { past: 0, future: 0 });
    return {
      past: Math.max(1, Math.min(12, counts.past || 1)),
      future: Math.max(1, Math.min(12, counts.future || 1))
    };
  }, [visibleShips]);

  const mapCenter = useMemo(() => {
    const points = visibleShips
      .map((ship) => [ship.currentLocation?.lat, ship.currentLocation?.lon])
      .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
    if (!points.length) return DEFAULT_CENTER;
    const avgLat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const avgLon = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return [avgLat, avgLon];
  }, [visibleShips]);

  const mapPoints = useMemo(() => {
    const points = [];

    visibleShips.forEach((ship) => {
      const currentLat = ship.currentLocation?.lat;
      const currentLon = ship.currentLocation?.lon;
      if (Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
        points.push([currentLat, currentLon]);
      }

      const windowedRoutes = [
        ...(ship.pastRoutes || []).slice(-pastWindow),
        ...(ship.activeRoute ? [ship.activeRoute] : []),
        ...(ship.futureRoutes || []).slice(0, futureWindow)
      ];

      windowedRoutes.forEach((route) => {
        const { from, to } = getRouteEndpoints(route);
        if (Number.isFinite(from?.lat) && Number.isFinite(from?.lon)) {
          points.push([from.lat, from.lon]);
        }
        if (Number.isFinite(to?.lat) && Number.isFinite(to?.lon)) {
          points.push([to.lat, to.lon]);
        }
      });
    });

    return points;
  }, [visibleShips, pastWindow, futureWindow]);

  const displayedRoutesByShip = useMemo(() => (
    Object.fromEntries(
      visibleShips.map((ship) => [
        ship.shipCode,
        [
          ...(ship.pastRoutes || []).slice(-pastWindow),
          ...(ship.activeRoute ? [ship.activeRoute] : []),
          ...(ship.futureRoutes || []).slice(0, futureWindow)
        ]
      ])
    )
  ), [visibleShips, pastWindow, futureWindow]);

  const visiblePorts = useMemo(() => (
    Array.from(new Set(
      visibleShips.flatMap((ship) => (
        (ship.mapRoutes || []).flatMap((route) => [route.fromPort, route.toPort]).filter(Boolean)
      ))
    )).slice(0, 8)
  ), [visibleShips]);

  return (
    <div className="ship-tracker-map">
      <div className="ship-tracker-map__header">
        <div>
          <h2 className="ship-tracker-map__title">Live Ship Route Map</h2>
          <p className="ship-tracker-map__subtitle">
            Current position, weather, occupancy, and route history for both ships
          </p>
        </div>
        <div className="ship-tracker-map__header-actions">
          <label className="ship-tracker-map__ship-filter-label" htmlFor="ship-tracker-ship-select">
            Ship
          </label>
          <select
            id="ship-tracker-ship-select"
            className="ship-tracker-map__ship-filter"
            value={selectedShipCode}
            onChange={(event) => setSelectedShipCode(event.target.value)}
          >
            <option value="ALL">All ships</option>
            {ships.map((ship) => (
              <option key={ship.shipCode} value={ship.shipCode}>
                {ship.shipName}
              </option>
            ))}
          </select>
          <button className="talia-btn talia-btn--small" onClick={onRefresh}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {livePositionsError && (
        <div className="ship-tracker-map__note">
          AIS feed unavailable. Showing schedule/public fallback positions.
        </div>
      )}
      <div className="ship-tracker-map__timeline">
        <div className="ship-tracker-map__timeline-row">
          <label htmlFor="ship-route-window-past" className="ship-tracker-map__timeline-label">
            Past history
          </label>
          <input
            id="ship-route-window-past"
            className="ship-tracker-map__timeline-slider"
            type="range"
            min="1"
            max={maxWindows.past}
            step="1"
            value={Math.min(pastWindow, maxWindows.past)}
            onChange={(event) => setPastWindow(Number(event.target.value))}
          />
          <span className="ship-tracker-map__timeline-value">
            {Math.min(pastWindow, maxWindows.past)} legs
          </span>
        </div>
        <div className="ship-tracker-map__timeline-row">
          <label htmlFor="ship-route-window-future" className="ship-tracker-map__timeline-label">
            Future itinerary
          </label>
          <input
            id="ship-route-window-future"
            className="ship-tracker-map__timeline-slider"
            type="range"
            min="1"
            max={maxWindows.future}
            step="1"
            value={Math.min(futureWindow, maxWindows.future)}
            onChange={(event) => setFutureWindow(Number(event.target.value))}
          />
          <span className="ship-tracker-map__timeline-value">
            {Math.min(futureWindow, maxWindows.future)} legs
          </span>
        </div>
      </div>

      <div
        className={`ship-tracker-map__map-wrap ${isExpanded ? 'ship-tracker-map__map-wrap--expanded' : ''}`}
        onClick={() => {
          if (!isExpanded) setIsExpanded(true);
        }}
      >
        <button
          className="ship-tracker-map__expand-btn"
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          title={isExpanded ? 'Exit full view' : 'Expand full view'}
        >
          {isExpanded ? '✕ Close' : '⤢ Full view'}
        </button>

        <div className="ship-tracker-map__map-overlay">
          {visibleShips.map((ship) => {
            const weather = weatherByShip[ship.shipCode];
            return (
              <div key={ship.shipCode} className="ship-tracker-map__weather-chip">
                <strong>{ship.shipName}</strong>
                <span>
                  {weatherLoading
                    ? 'Weather loading...'
                    : weather
                      ? `${weather.label}, ${Math.round(weather.temperature)}C, wind ${Math.round(weather.windSpeed)} km/h`
                      : 'Weather N/A'}
                </span>
              </div>
            );
          })}
        </div>

        <MapContainer center={mapCenter} zoom={5} className="ship-tracker-map__leaflet">
          <MapResizeOnLayout expanded={isExpanded} />
          <FitMapToShips points={mapPoints} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visibleShips.map((ship, shipIndex) => {
            const color = SHIP_COLORS[shipIndex % SHIP_COLORS.length];
            const displayedRoutes = displayedRoutesByShip[ship.shipCode] || [];
            const shipWeather = weatherByShip[ship.shipCode];
            return (
              <React.Fragment key={ship.shipCode}>
                {displayedRoutes.map((route, routeIndex) => {
                  const { from, to } = getRouteEndpoints(route);
                  if (!from || !to) return null;
                  const curvedPath = greatCirclePath(from, to);
                  return (
                    <Polyline
                      key={`${ship.shipCode}-route-${routeIndex}`}
                      positions={curvedPath.length ? curvedPath : [[from.lat, from.lon], [to.lat, to.lon]]}
                      pathOptions={getRouteStyle(route.status, color)}
                    />
                  );
                })}

                {Number.isFinite(ship.currentLocation?.lat) && Number.isFinite(ship.currentLocation?.lon) && (
                  <CircleMarker
                    center={[ship.currentLocation.lat, ship.currentLocation.lon]}
                    radius={9}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 0.95 }}
                  >
                    <Popup>
                      <div className="ship-tracker-map__popup">
                        <strong>{ship.shipName}</strong>
                        <div>{ship.shipCode}</div>
                        <div>{ship.currentLocation.label || 'AIS position'}</div>
                        <div>
                          {shipWeatherText(shipWeather, weatherLoading)}
                        </div>
                      </div>
                    </Popup>
                    <Tooltip direction="top" offset={[0, -10]} permanent>
                      <div className="ship-tracker-map__marker-weather">
                        <strong>{ship.shipCode}</strong> {shipWeatherText(shipWeather, weatherLoading)}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      <div className="ship-tracker-map__news">
        <h4 className="ship-tracker-map__news-title">Live Port News</h4>
        {portNewsLoading ? (
          <div className="ship-tracker-map__news-empty">Loading local port news...</div>
        ) : (
          <div className="ship-tracker-map__news-grid">
            {visiblePorts.map((port) => {
              const items = portNewsByPort?.[port] || [];
              return (
                <article key={port} className="ship-tracker-map__news-port">
                  <div className="ship-tracker-map__news-port-title">{port}</div>
                  <ul className="ship-tracker-map__news-list">
                    {items.length ? items.map((item) => (
                      <li key={item.id} className="ship-tracker-map__news-item">
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                        <span>{item.source}{item.publishedAt ? ` · ${formatPublished(item.publishedAt)}` : ''}</span>
                      </li>
                    )) : <li className="ship-tracker-map__news-empty">No recent items</li>}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="ship-tracker-map__cards">
        {visibleShips.map((ship, index) => {
          const weather = weatherByShip[ship.shipCode];
          return (
            <article key={ship.shipCode} className={`ship-tracker-map__card ship-tracker-map__card--${index + 1}`}>
              <header className="ship-tracker-map__card-header">
                <h3 className="ship-tracker-map__card-title">{ship.shipName}</h3>
                <span className="ship-tracker-map__chip">{ship.shipCode}</span>
              </header>

              <div className="ship-tracker-map__meta">
                <span><strong>Current location:</strong> {ship.currentLocation?.label || 'At sea'}</span>
                <span><strong>Position source:</strong> {ship.livePosition?.isLive ? 'AIS live' : 'Schedule estimate'}</span>
                <span>
                  <strong>Occupancy:</strong>{' '}
                  {ship.occupancy?.percentage !== null && ship.occupancy?.percentage !== undefined
                    ? `${ship.occupancy.percentage}% (${ship.occupancy.occupiedCabins}/${ship.occupancy.totalCabins})`
                    : 'N/A'}
                </span>
                <span>
                  <strong>Weather:</strong>{' '}
                  {weatherLoading
                    ? 'Loading...'
                    : weather
                      ? `${weather.label}, ${Math.round(weather.temperature)}C, wind ${Math.round(weather.windSpeed)} km/h`
                      : 'N/A'}
                </span>
                {ship.livePosition?.timestamp && (
                  <span><strong>AIS update:</strong> {formatDateTime(ship.livePosition.timestamp)}</span>
                )}
              </div>

              <div className="ship-tracker-map__route-sections">
                <div>
                  <h4 className="ship-tracker-map__section-title">Past routes</h4>
                  <ul className="ship-tracker-map__route-list">
                    {ship.pastRoutes.length ? ship.pastRoutes.slice(-pastWindow).map((route, routeIndex) => {
                      const routeWeather = routeWeatherByKey?.[route.routeKey];
                      const paxText = Number.isFinite(Number(route.estimatedPax)) ? `Pax ${Math.round(Number(route.estimatedPax))}` : 'Pax N/A';
                      return (
                      <li key={`past-${routeIndex}`} className="ship-tracker-map__route-item">
                        <span>{routeLabel(route)}</span>
                        <span>{`${formatDate(route.startDate)} · ${paxText} · ${routeWeatherText(routeWeather, routeWeatherLoading)}`}</span>
                      </li>
                      );
                    }) : <li className="ship-tracker-map__route-item ship-tracker-map__route-item--empty">No past routes</li>}
                  </ul>
                </div>

                <div>
                  <h4 className="ship-tracker-map__section-title">Future routes</h4>
                  <ul className="ship-tracker-map__route-list">
                    {ship.futureRoutes.length ? ship.futureRoutes.slice(0, futureWindow).map((route, routeIndex) => {
                      const routeWeather = routeWeatherByKey?.[route.routeKey];
                      const paxText = Number.isFinite(Number(route.estimatedPax)) ? `Pax ${Math.round(Number(route.estimatedPax))}` : 'Pax N/A';
                      return (
                      <li key={`future-${routeIndex}`} className="ship-tracker-map__route-item">
                        <span>{routeLabel(route)}</span>
                        <span>{`${formatDate(route.startDate)} · ${paxText} · ${routeWeatherText(routeWeather, routeWeatherLoading)}`}</span>
                      </li>
                      );
                    }) : <li className="ship-tracker-map__route-item ship-tracker-map__route-item--empty">No future routes</li>}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default ShipTrackerMapPresenter;
