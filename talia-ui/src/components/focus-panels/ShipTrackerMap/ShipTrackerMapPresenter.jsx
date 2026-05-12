import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import {
  LEAFLET_ENGLISH_TILE_ATTRIBUTION,
  LEAFLET_ENGLISH_TILE_URL,
  LeafletResizeObserver,
} from '../../shared/maps/LeafletMapDefaults';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import { formatDateTime as formatDateTimeValue, formatDayMon } from '../../../lib/dateFormat';

const DEFAULT_CENTER = [36.8, 25.9];
const SHIP_COLORS = ['#0d47a1', '#b71c1c'];
const SHIP_FILTER_OUR = '__OUR_SHIPS__';
const SHIP_FILTER_ALL = 'ALL';
const PORT_DISPLAY_NAMES = {
  DUB: 'Dubai',
  ABD: 'Abu Dhabi',
  DOH: 'Doha',
  KUS: 'Kusadasi',
  RHO: 'Rhodes',
  PIR: 'Piraeus',
  ATH: 'Athens'
};

const formatDate = (value) => {
  return formatDayMon(value, 'N/A');
};

const formatDateTime = (value) => {
  return formatDateTimeValue(value, 'N/A');
};

const formatDayYearShort = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const routeLabel = (route) => {
  const fromRaw = route?.from?.label || route?.fromPort;
  const toRaw = route?.to?.label || route?.toPort;
  const from = PORT_DISPLAY_NAMES[String(fromRaw || '').toUpperCase()] || fromRaw || 'Unknown';
  const to = PORT_DISPLAY_NAMES[String(toRaw || '').toUpperCase()] || toRaw || 'Unknown';
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

const shipLocationUpdatedText = (ship) => {
  const liveTimestamp = ship?.livePosition?.timestamp;
  if (liveTimestamp) {
    return `Last known location: ${formatDayYearShort(liveTimestamp)}`;
  }
  return 'Last known location: N/A';
};

const getAisRecency = (ship) => {
  const isLive = !!ship?.livePosition?.isLive;
  if (!isLive) return { level: 'none', text: 'No AIS' };

  const freshnessSeconds = Number(ship?.livePosition?.freshnessSeconds);
  if (Number.isFinite(freshnessSeconds)) {
    if (freshnessSeconds <= 15 * 60) return { level: 'fresh', text: 'AIS fresh' };
    if (freshnessSeconds <= 60 * 60) return { level: 'recent', text: 'AIS recent' };
    return { level: 'stale', text: 'AIS stale' };
  }

  const timestamp = ship?.livePosition?.timestamp;
  const tsMs = timestamp ? new Date(timestamp).getTime() : NaN;
  if (Number.isFinite(tsMs)) {
    const ageSeconds = Math.max(0, (Date.now() - tsMs) / 1000);
    if (ageSeconds <= 15 * 60) return { level: 'fresh', text: 'AIS fresh' };
    if (ageSeconds <= 60 * 60) return { level: 'recent', text: 'AIS recent' };
    return { level: 'stale', text: 'AIS stale' };
  }

  return { level: 'recent', text: 'AIS' };
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
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!points.length) return;
    const signature = points
      .map((point) => `${Number(point[0]).toFixed(3)},${Number(point[1]).toFixed(3)}`)
      .join('|');
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

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

const getRouteEndpoints = (route) => {
  const from = route?.from || route?.fromCoord || null;
  const to = route?.to || route?.toCoord || null;
  return { from, to };
};

const getArrowForPath = (path, color) => {
  if (!Array.isArray(path) || path.length < 2) return null;
  const ratio = 0.96;
  const targetIndex = Math.max(1, Math.min(path.length - 1, Math.round((path.length - 1) * ratio)));
  const prevPoint = path[targetIndex - 1];
  const point = path[targetIndex];
  if (!prevPoint || !point) return null;
  const [prevLat, prevLon] = prevPoint;
  const [lat, lon] = point;
  if (![prevLat, prevLon, lat, lon].every(Number.isFinite)) return null;

  const latDiff = lat - prevLat;
  const lonDiff = lon - prevLon;
  if (Math.abs(latDiff) < 0.000001 && Math.abs(lonDiff) < 0.000001) return null;

  const angle = (Math.atan2(latDiff, lonDiff) * 180) / Math.PI;
  const icon = L.divIcon({
    className: 'ship-tracker-map__route-arrow-wrap',
    html: `<span class="ship-tracker-map__route-arrow" style="--route-color:${color}; transform: rotate(${angle}deg);">&#10148;</span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  return {
    center: [lat, lon],
    icon
  };
};

const ShipTrackerMapPresenter = ({
  ships,
  weatherByShip,
  routeWeatherByKey,
  weatherLoading,
  routeWeatherLoading,
  portNewsByPort,
  portNewsLoading,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  livePositionsError
}) => {
  const { expandedKey: viewMode, setExpandedKey: setViewMode } = useSubpanelExpansion(null);
  const [selectedShipCode, setSelectedShipCode] = useState(SHIP_FILTER_OUR);
  const [pastWindow, setPastWindow] = useState(3);
  const [futureWindow, setFutureWindow] = useState(3);
  const [routeDisplayMode, setRouteDisplayMode] = useState('overlay');
  const [singleRouteIndex, setSingleRouteIndex] = useState(0);
  const preExpandedSectionsRef = useRef(null);
  const [sections, setSections] = useState({
    map: true,
    news: true,
    details: true
  });
  const celestyalShips = useMemo(
    () => ships.filter((ship) => String(ship.fleetGroup || '').toLowerCase() === 'celestyal'),
    [ships]
  );
  const otherShips = useMemo(
    () => ships.filter((ship) => String(ship.fleetGroup || '').toLowerCase() !== 'celestyal'),
    [ships]
  );

  const visibleShips = useMemo(() => {
    if (selectedShipCode === SHIP_FILTER_ALL) return ships;
    if (selectedShipCode === SHIP_FILTER_OUR) return celestyalShips.length ? celestyalShips : ships;
    return ships.filter((ship) => ship.shipCode === selectedShipCode);
  }, [ships, celestyalShips, selectedShipCode]);

  useEffect(() => {
    if (selectedShipCode === SHIP_FILTER_ALL || selectedShipCode === SHIP_FILTER_OUR) return;
    const exists = ships.some((ship) => ship.shipCode === selectedShipCode);
    if (!exists) {
      setSelectedShipCode(SHIP_FILTER_OUR);
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

  const windowedRoutesByShip = useMemo(() => (
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

  const timelineRouteEntries = useMemo(() => {
    const entries = [];
    visibleShips.forEach((ship, shipIndex) => {
      const routes = windowedRoutesByShip[ship.shipCode] || [];
      routes.forEach((route) => {
        const startTime = route?.startDate ? new Date(route.startDate).getTime() : Number.POSITIVE_INFINITY;
        entries.push({ shipCode: ship.shipCode, shipIndex, route, startTime });
      });
    });
    return entries.sort((a, b) => a.startTime - b.startTime);
  }, [visibleShips, windowedRoutesByShip]);

  useEffect(() => {
    if (!timelineRouteEntries.length) {
      setSingleRouteIndex(0);
      return;
    }
    setSingleRouteIndex((prev) => Math.max(0, Math.min(prev, timelineRouteEntries.length - 1)));
  }, [timelineRouteEntries]);

  const displayedRoutesByShip = useMemo(() => {
    if (routeDisplayMode !== 'single') {
      return windowedRoutesByShip;
    }
    const selectedEntry = timelineRouteEntries[singleRouteIndex] || null;
    return Object.fromEntries(
      visibleShips.map((ship) => [
        ship.shipCode,
        selectedEntry && selectedEntry.shipCode === ship.shipCode ? [selectedEntry.route] : []
      ])
    );
  }, [routeDisplayMode, windowedRoutesByShip, timelineRouteEntries, singleRouteIndex, visibleShips]);

  const mapPoints = useMemo(() => {
    const points = [];

    visibleShips.forEach((ship) => {
      const currentLat = ship.currentLocation?.lat;
      const currentLon = ship.currentLocation?.lon;
      if (Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
        points.push([currentLat, currentLon]);
      }
    });

    if (routeDisplayMode === 'single') {
      const selectedEntry = timelineRouteEntries[singleRouteIndex];
      const { from, to } = getRouteEndpoints(selectedEntry?.route);
      if (Number.isFinite(from?.lat) && Number.isFinite(from?.lon)) points.push([from.lat, from.lon]);
      if (Number.isFinite(to?.lat) && Number.isFinite(to?.lon)) points.push([to.lat, to.lon]);
      return points;
    }

    visibleShips.forEach((ship) => {
      const activeRoute = windowedRoutesByShip[ship.shipCode]?.find((route) => route?.status === 'active') || null;
      const routesToFit = activeRoute ? [activeRoute] : (windowedRoutesByShip[ship.shipCode] || []).slice(-1);
      routesToFit.forEach((route) => {
        const { from, to } = getRouteEndpoints(route);
        if (Number.isFinite(from?.lat) && Number.isFinite(from?.lon)) points.push([from.lat, from.lon]);
        if (Number.isFinite(to?.lat) && Number.isFinite(to?.lon)) points.push([to.lat, to.lon]);
      });
    });

    return points;
  }, [visibleShips, routeDisplayMode, timelineRouteEntries, singleRouteIndex, windowedRoutesByShip]);

  const visiblePorts = useMemo(() => (
    Array.from(new Set(
      visibleShips.flatMap((ship) => (
        (ship.mapRoutes || []).flatMap((route) => [route.fromPort, route.toPort]).filter(Boolean)
      ))
    )).slice(0, 8)
  ), [visibleShips]);

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setSpecialViewMode = (nextMode) => {
    setViewMode((prevMode) => {
      if (prevMode === nextMode) {
        if (preExpandedSectionsRef.current) {
          setSections(preExpandedSectionsRef.current);
          preExpandedSectionsRef.current = null;
        }
        return null;
      }
      if (!prevMode) {
        preExpandedSectionsRef.current = sections;
      }
      setSections((current) => ({ ...current, map: true, news: false, details: false }));
      return nextMode;
    });
  };

  const isExpanded = viewMode === 'full';
  const isNewsView = viewMode === 'news';
  const isMapFocusedView = Boolean(viewMode);

  const renderNewsContent = (compact = false) => (
    portNewsLoading ? (
      <div className="ship-tracker-map__news-empty">Loading local port news...</div>
    ) : (
      <div className={compact ? 'ship-tracker-map__news-grid ship-tracker-map__news-grid--compact' : 'ship-tracker-map__news-grid'}>
        {visiblePorts.map((port) => {
          const items = portNewsByPort?.[port] || [];
          const compactItems = compact ? items.slice(0, 2) : items;
          return (
            <article key={port} className="ship-tracker-map__news-port">
              <div className="ship-tracker-map__news-port-title">
                {PORT_DISPLAY_NAMES[String(port).toUpperCase()] || port}
              </div>
              <ul className="ship-tracker-map__news-list">
                {compactItems.length ? compactItems.map((item) => (
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
    )
  );

  return (
    <div className="ship-tracker-map talia-report">
      <div className="ship-tracker-map__header talia-report__header">
        <div>
          <h2 className="ship-tracker-map__title talia-report__title">Live Ship Route Map</h2>
          <p className="ship-tracker-map__subtitle talia-report__subtitle">
            Current position, weather, occupancy, and route history for both ships
          </p>
        </div>
      </div>

      <div className="ship-tracker-map__filters talia-report-filters">
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
            <option value={SHIP_FILTER_OUR}>Celestyal ships</option>
            <option value={SHIP_FILTER_ALL}>All tracked ships</option>
            {celestyalShips.length > 0 && (
              <optgroup label="Celestyal ships">
                {celestyalShips.map((ship) => (
                  <option key={ship.shipCode} value={ship.shipCode}>
                    {ship.shipName}
                  </option>
                ))}
              </optgroup>
            )}
            {otherShips.length > 0 && (
              <optgroup label="Other ships (Gulf & Med)">
                {otherShips.map((ship) => (
                  <option key={ship.shipCode} value={ship.shipCode}>
                    {ship.shipName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button className="talia-btn talia-btn--small" onClick={onToggleAutoRefresh}>
            {autoRefreshEnabled ? 'Auto: ON' : 'Auto: OFF'}
          </button>
          <div className="ship-tracker-map__compact-controls">
            <label htmlFor="ship-route-display-mode" className="ship-tracker-map__timeline-label">Mode</label>
            <select
              id="ship-route-display-mode"
              className="ship-tracker-map__route-mode"
              value={routeDisplayMode}
              onChange={(event) => setRouteDisplayMode(event.target.value)}
            >
              <option value="overlay">Overlay</option>
              <option value="single">Single route</option>
            </select>
            <label htmlFor="ship-route-window-past" className="ship-tracker-map__timeline-label">Past</label>
            <input
              id="ship-route-window-past"
              className="ship-tracker-map__timeline-slider ship-tracker-map__timeline-slider--compact"
              type="range"
              min="1"
              max={maxWindows.past}
              step="1"
              value={Math.min(pastWindow, maxWindows.past)}
              onChange={(event) => setPastWindow(Number(event.target.value))}
            />
            <span className="ship-tracker-map__timeline-value">{Math.min(pastWindow, maxWindows.past)}</span>
            <label htmlFor="ship-route-window-future" className="ship-tracker-map__timeline-label">Future</label>
            <input
              id="ship-route-window-future"
              className="ship-tracker-map__timeline-slider ship-tracker-map__timeline-slider--compact"
              type="range"
              min="1"
              max={maxWindows.future}
              step="1"
              value={Math.min(futureWindow, maxWindows.future)}
              onChange={(event) => setFutureWindow(Number(event.target.value))}
            />
            <span className="ship-tracker-map__timeline-value">{Math.min(futureWindow, maxWindows.future)}</span>
            {routeDisplayMode === 'single' && (
              <>
                <label htmlFor="ship-route-single-index" className="ship-tracker-map__timeline-label">Route</label>
                <input
                  id="ship-route-single-index"
                  className="ship-tracker-map__timeline-slider ship-tracker-map__timeline-slider--compact"
                  type="range"
                  min="0"
                  max={Math.max(0, timelineRouteEntries.length - 1)}
                  step="1"
                  value={Math.min(singleRouteIndex, Math.max(0, timelineRouteEntries.length - 1))}
                  onChange={(event) => setSingleRouteIndex(Number(event.target.value))}
                />
                <span className="ship-tracker-map__timeline-value">
                  {timelineRouteEntries.length ? `${singleRouteIndex + 1}/${timelineRouteEntries.length}` : '0/0'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ship-tracker-map__note talia-callout" role="note">
        AIS stream status is reported in <strong>Data Management → Instance &amp; connections</strong>.
        If a ship has no MMSI, use public sources like MarineTraffic, VesselFinder, or MyShipTracking,
        then update the <code>ship_tracking_target</code> table (Talia config) so AIS data can attach to that ship.
      </div>

      {livePositionsError && (
        <div className="ship-tracker-map__note ship-tracker-map__note--error" role="alert">
          {livePositionsError.message || 'AIS feed unavailable.'}
        </div>
      )}
      <div className="ship-tracker-map__section-header">
        <h4 className="ship-tracker-map__section-heading">Map</h4>
        <button className="ship-tracker-map__collapse-btn" onClick={() => toggleSection('map')}>
          {sections.map ? '▾' : '▸'}
        </button>
      </div>

      {sections.map && <div
        className={`ship-tracker-map__map-layout ${isNewsView ? 'ship-tracker-map__map-layout--news' : ''}`}
      >
        <div className={`ship-tracker-map__map-wrap ${isExpanded ? 'ship-tracker-map__map-wrap--expanded' : ''} ${isNewsView ? 'ship-tracker-map__map-wrap--news' : ''}`}>
          <div className="ship-tracker-map__map-view-actions">
            <button
              className="ship-tracker-map__expand-btn"
              onClick={(event) => {
                event.stopPropagation();
                setSpecialViewMode('full');
              }}
              title={isExpanded ? 'Exit full view' : 'Expand full view'}
            >
              {isExpanded ? '✕ Close' : '⤢ Full view'}
            </button>
            <button
              className={`ship-tracker-map__expand-btn ${isNewsView ? 'ship-tracker-map__expand-btn--active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setSpecialViewMode('news');
              }}
              title={isNewsView ? 'Exit news view' : 'Show news split view'}
            >
              {isNewsView ? '✕ Close' : '📰 News view'}
            </button>
          </div>

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
                  <span className="ship-tracker-map__weather-updated">{shipLocationUpdatedText(ship)}</span>
                </div>
              );
            })}
          </div>

          <MapContainer center={mapCenter} zoom={5} className="ship-tracker-map__leaflet" zoomControl={false}>
            <LeafletResizeObserver />
            <FitMapToShips points={mapPoints} />
            <ZoomControl position="bottomright" />
            <TileLayer
              attribution={LEAFLET_ENGLISH_TILE_ATTRIBUTION}
              url={LEAFLET_ENGLISH_TILE_URL}
            />

          {visibleShips.map((ship, shipIndex) => {
            const color = SHIP_COLORS[shipIndex % SHIP_COLORS.length];
            const displayedRoutes = displayedRoutesByShip[ship.shipCode] || [];
            const shipWeather = weatherByShip[ship.shipCode];
            const aisRecency = getAisRecency(ship);
            return (
              <React.Fragment key={ship.shipCode}>
                {displayedRoutes.map((route, routeIndex) => {
                  const { from, to } = getRouteEndpoints(route);
                  if (!from || !to) return null;
                  const curvedPath = greatCirclePath(from, to);
                  const linePath = curvedPath.length ? curvedPath : [[from.lat, from.lon], [to.lat, to.lon]];
                  const arrow = getArrowForPath(linePath, color);
                  return (
                    <React.Fragment key={`${ship.shipCode}-route-${routeIndex}`}>
                      <Polyline
                        positions={linePath}
                        pathOptions={getRouteStyle(route.status, color)}
                      />
                      {arrow && (
                        <Marker position={arrow.center} icon={arrow.icon} interactive={false} />
                      )}
                      <CircleMarker
                        center={[to.lat, to.lon]}
                        radius={4}
                        pathOptions={{ color: '#ffffff', weight: 1, fillColor: color, fillOpacity: 0.95 }}
                      />
                    </React.Fragment>
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
                        <strong>{ship.shipCode}</strong>
                        <span className="ship-tracker-map__marker-ais">
                          <span
                            className={`ship-tracker-map__traffic-light ship-tracker-map__traffic-light--${aisRecency.level}`}
                            aria-hidden="true"
                          />
                          {aisRecency.text}
                        </span>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )}
              </React.Fragment>
            );
          })}
          </MapContainer>
        </div>
        {isNewsView && (
          <aside className="ship-tracker-map__news-split">
            <div className="ship-tracker-map__news-split-title">Live Port News</div>
            <div className="ship-tracker-map__news ship-tracker-map__news--compact">
              {renderNewsContent(true)}
            </div>
          </aside>
        )}
      </div>}

      {!isMapFocusedView && (
        <>
          <div className="ship-tracker-map__section-header">
            <h4 className="ship-tracker-map__section-heading">Live Port News</h4>
            <button className="ship-tracker-map__collapse-btn" onClick={() => toggleSection('news')}>
              {sections.news ? '▾' : '▸'}
            </button>
          </div>
          {sections.news && <div className="ship-tracker-map__news">{renderNewsContent(false)}</div>}

          <div className="ship-tracker-map__section-header">
            <h4 className="ship-tracker-map__section-heading">Ship Details</h4>
            <button className="ship-tracker-map__collapse-btn" onClick={() => toggleSection('details')}>
              {sections.details ? '▾' : '▸'}
            </button>
          </div>
          {sections.details && <div className="ship-tracker-map__cards">
            {visibleShips.map((ship, index) => {
              const weather = weatherByShip[ship.shipCode];
              return (
                <article key={ship.shipCode} className={`ship-tracker-map__card ship-tracker-map__card--${index + 1}`}>
                  <header className="ship-tracker-map__card-header">
                    <h3 className="ship-tracker-map__card-title">{ship.shipName}</h3>
                    <span className="ship-tracker-map__chip">{ship.shipCode}</span>
                  </header>

                  <div className="ship-tracker-map__meta">
                    <span><strong>Current location:</strong> {ship.currentLocation?.label || 'AIS unavailable'}</span>
                    <span><strong>Position source:</strong> {ship.livePosition?.isLive ? 'AIS live' : 'No AIS live signal'}</span>
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
          </div>}
        </>
      )}
    </div>
  );
};

export default ShipTrackerMapPresenter;
