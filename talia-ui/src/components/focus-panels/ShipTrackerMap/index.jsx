import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import ShipTrackerMapPresenter from './ShipTrackerMapPresenter';

const DEFAULT_PORT_COORDINATES = {
  piraeus: { lat: 37.942, lon: 23.646, label: 'Piraeus' },
  athens: { lat: 37.9838, lon: 23.7275, label: 'Athens' },
  santorini: { lat: 36.3932, lon: 25.4615, label: 'Santorini' },
  mykonos: { lat: 37.4467, lon: 25.3289, label: 'Mykonos' },
  kusadasi: { lat: 37.8619, lon: 27.2578, label: 'Kusadasi' },
  patmos: { lat: 37.3084, lon: 26.5473, label: 'Patmos' },
  rhodes: { lat: 36.4341, lon: 28.2176, label: 'Rhodes' },
  heraklion: { lat: 35.3387, lon: 25.1442, label: 'Heraklion' },
  thessaloniki: { lat: 40.6401, lon: 22.9444, label: 'Thessaloniki' },
  izmir: { lat: 38.4237, lon: 27.1428, label: 'Izmir' },
  istanbul: { lat: 41.0082, lon: 28.9784, label: 'Istanbul' },
  limassol: { lat: 34.7071, lon: 33.0226, label: 'Limassol' },
  alexandria: { lat: 31.2001, lon: 29.9187, label: 'Alexandria' },
  // Common 3-letter itinerary codes seen in sail data
  dub: { lat: 25.2048, lon: 55.2708, label: 'Dubai' },
  abd: { lat: 24.4539, lon: 54.3773, label: 'Abu Dhabi' },
  doh: { lat: 25.2854, lon: 51.531, label: 'Doha' }
};

const SHIP_HOME_PORT = {
  DIS: DEFAULT_PORT_COORDINATES.piraeus,
  JRN: DEFAULT_PORT_COORDINATES.piraeus
};

const PUBLIC_FALLBACK_SHIPS = [
  {
    shipCode: 'DIS',
    shipName: 'Celestyal Discovery',
    currentLocation: { lat: 37.942, lon: 23.646, label: 'Piraeus (public fallback)' },
    scheduleLocation: { lat: 37.942, lon: 23.646, label: 'Piraeus (public fallback)' },
    mapRoutes: [],
    pastRoutes: [],
    futureRoutes: [],
    activeRoute: null,
    occupancy: { totalCabins: 0, occupiedCabins: 0, percentage: null },
    livePosition: null
  },
  {
    shipCode: 'JRN',
    shipName: 'Celestyal Journey',
    currentLocation: { lat: 36.4341, lon: 28.2176, label: 'Rhodes (public fallback)' },
    scheduleLocation: { lat: 36.4341, lon: 28.2176, label: 'Rhodes (public fallback)' },
    mapRoutes: [],
    pastRoutes: [],
    futureRoutes: [],
    activeRoute: null,
    occupancy: { totalCabins: 0, occupiedCabins: 0, percentage: null },
    livePosition: null
  }
];

const PREFERRED_SHIP_ORDER = ['DIS', 'JRN'];
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const GRAPHQL_URL = '/api/graphql';
const PORT_NEWS_QUERY_ALIASES = {
  DUB: 'Dubai',
  ABD: 'Abu Dhabi',
  DOH: 'Doha',
  KUS: 'Kusadasi',
  RHO: 'Rhodes',
  ATH: 'Athens',
  PIR: 'Piraeus'
};
const SHIP_CODE_ALIASES = {
  CD: 'DIS',
  CJ: 'JRN',
  DISCOVERY: 'DIS',
  JOURNEY: 'JRN'
};

const normalizeText = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase();
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateOnly = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toLookupTokens = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const collapsed = normalized.replace(/\s+/g, ' ');
  const compact = collapsed.replace(/[^a-z0-9]/g, '');
  return compact ? [collapsed, compact] : [collapsed];
};

const resolvePortCoordinates = (portValue) => {
  const tokens = toLookupTokens(portValue);
  for (const token of tokens) {
    if (DEFAULT_PORT_COORDINATES[token]) {
      return DEFAULT_PORT_COORDINATES[token];
    }
  }
  return null;
};

const shipKeyForRow = (row) => {
  const shipCode = normalizeText(row?.ship_code);
  if (shipCode) {
    const normalizedCode = shipCode.toUpperCase();
    return SHIP_CODE_ALIASES[normalizedCode] || normalizedCode;
  }
  const shipName = normalizeText(row?.ship_name || row?.ship);
  if (!shipName) return null;
  if (shipName.includes('discovery')) return SHIP_CODE_ALIASES.DISCOVERY;
  if (shipName.includes('journey')) return SHIP_CODE_ALIASES.JOURNEY;
  return shipName.toUpperCase();
};

const canonicalShipCode = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  return SHIP_CODE_ALIASES[upper] || upper;
};

const normalizedSailCode = (value) => {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();
  return str || null;
};

const deriveEndDate = (row, startDate) => {
  const explicitEnd = parseDate(row?.sail_date_to);
  if (explicitEnd) return explicitEnd;
  if (!startDate) return null;
  const days = asNumber(row?.sail_days);
  if (!days) return null;
  return new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
};

const interpolatePoint = (fromPoint, toPoint, startDate, endDate, nowDate) => {
  if (!fromPoint || !toPoint || !startDate || !endDate) return toPoint || fromPoint || null;
  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs <= 0) return toPoint;
  const elapsedMs = nowDate.getTime() - startDate.getTime();
  const ratio = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return {
    lat: fromPoint.lat + (toPoint.lat - fromPoint.lat) * ratio,
    lon: fromPoint.lon + (toPoint.lon - fromPoint.lon) * ratio,
    label: `At sea (${Math.round(ratio * 100)}%)`
  };
};

const fetchLiveShipPositions = async (shipCodes = []) => {
  const query = `
    query GetLiveShipPositions($shipCodes: [String!]) {
      liveShipPositions(shipCodes: $shipCodes) {
        shipCode
        shipName
        mmsi
        latitude
        longitude
        speedKnots
        course
        heading
        navStatus
        timestamp
        source
        freshnessSeconds
        isLive
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { shipCodes } })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload?.data?.liveShipPositions || [];
};

const fetchPortNews = async (port, limit = 3) => {
  const query = `
    query GetPortNews($port: String!, $limit: Int) {
      portNews(port: $port, limit: $limit) {
        id
        title
        url
        source
        publishedAt
        summary
        port
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { port, limit } })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload?.data?.portNews || [];
};

const portNewsQuery = (portValue) => {
  const upper = String(portValue || '').trim().toUpperCase();
  return PORT_NEWS_QUERY_ALIASES[upper] || String(portValue || '').trim();
};

const weatherCodeLabel = (code) => {
  const weatherMap = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Heavy showers',
    95: 'Thunderstorm'
  };
  return weatherMap[code] || 'Unknown';
};

const buildPaxBySailCode = (occupancyRows = []) => {
  const bySail = new Map();

  occupancyRows.forEach((row) => {
    const sailCode = normalizedSailCode(row?.sail_code);
    if (!sailCode) return;
    if (!bySail.has(sailCode)) bySail.set(sailCode, new Map());
    const byCategory = bySail.get(sailCode);
    const category = String(row?.cabin_category || 'unknown');
    const occupiedCabins = asNumber(row?.occupied_cabins);
    const cabinCapacity = Math.max(1, asNumber(row?.cabin_capacity));
    const current = byCategory.get(category);
    if (!current || occupiedCabins > current.occupiedCabins) {
      byCategory.set(category, { occupiedCabins, cabinCapacity });
    }
  });

  return Object.fromEntries(
    Array.from(bySail.entries()).map(([sailCode, byCategory]) => {
      const pax = Array.from(byCategory.values()).reduce(
        (sum, entry) => sum + entry.occupiedCabins * entry.cabinCapacity,
        0
      );
      return [sailCode, pax];
    })
  );
};

const buildItinerarySegmentsBySailCode = (occupancyRows = []) => {
  const bySail = new Map();

  occupancyRows.forEach((row) => {
    const sailCode = normalizedSailCode(row?.sail_code);
    const portCode = row?.port_code || null;
    if (!sailCode || !portCode) return;
    const coord = resolvePortCoordinates(portCode);
    if (!coord) return;

    if (!bySail.has(sailCode)) bySail.set(sailCode, []);
    bySail.get(sailCode).push({
      sailCode,
      portCode,
      coord,
      night: Number.isFinite(Number(row?.sail_itinerary_night)) ? Number(row.sail_itinerary_night) : null,
      date: parseDate(row?.sail_itinerary_date) || parseDate(row?.sail_date_from) || null
    });
  });

  return Object.fromEntries(
    Array.from(bySail.entries()).map(([sailCode, stopsRaw]) => {
      const uniqueStops = Array.from(
        stopsRaw.reduce((acc, stop) => {
          const key = `${stop.night ?? 'n'}|${toDateOnly(stop.date) || 'd'}|${stop.portCode}`;
          if (!acc.has(key)) acc.set(key, stop);
          return acc;
        }, new Map()).values()
      ).sort((a, b) => {
        if (a.night !== null && b.night !== null) return a.night - b.night;
        const aTime = a.date ? a.date.getTime() : 0;
        const bTime = b.date ? b.date.getTime() : 0;
        return aTime - bTime;
      });

      const segments = [];
      for (let i = 0; i < uniqueStops.length - 1; i += 1) {
        const from = uniqueStops[i];
        const to = uniqueStops[i + 1];
        if (!from?.coord || !to?.coord) continue;
        if (from.portCode === to.portCode) continue;
        segments.push({
          sailCode,
          from: from.coord,
          to: to.coord,
          fromPort: from.portCode,
          toPort: to.portCode,
          startDate: from.date,
          endDate: to.date
        });
      }
      return [sailCode, segments];
    })
  );
};

const computeShipSummaries = (masterSailRows, occupancyRows, inventoryItems = []) => {
  const paxBySailCode = buildPaxBySailCode(occupancyRows);
  const itineraryBySailCode = buildItinerarySegmentsBySailCode(occupancyRows);
  const inventoryByShip = new Map();
  (inventoryItems || []).forEach((item) => {
    const shipCode = canonicalShipCode(item?.ship_code || item?.shipCode);
    if (!shipCode) return;
    if (!inventoryByShip.has(shipCode)) {
      inventoryByShip.set(shipCode, {
        shipName: item?.ship_name || item?.shipName || null,
        sailCodes: new Set(),
        masterSailIds: new Set()
      });
    }
    const summary = inventoryByShip.get(shipCode);
    const sailCode = normalizedSailCode(item?.sail_code || item?.sailCode);
    if (sailCode) {
      summary.sailCodes.add(sailCode);
    }
    const masterSailId = item?.master_sail_id ?? item?.masterSailId;
    if (masterSailId != null && masterSailId !== '') {
      summary.masterSailIds.add(String(masterSailId));
    }
    if (!summary.shipName && (item?.ship_name || item?.shipName)) {
      summary.shipName = item?.ship_name || item?.shipName;
    }
  });

  const grouped = new Map();
  masterSailRows.forEach((row) => {
    const key = shipKeyForRow(row);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  const rankedShips = Array.from(grouped.keys()).sort((a, b) => {
    const orderA = PREFERRED_SHIP_ORDER.indexOf(a);
    const orderB = PREFERRED_SHIP_ORDER.indexOf(b);
    if (orderA >= 0 && orderB >= 0) return orderA - orderB;
    if (orderA >= 0) return -1;
    if (orderB >= 0) return 1;
    return grouped.get(b).length - grouped.get(a).length;
  });

  const inventoryShipCodes = Array.from(inventoryByShip.keys());
  const rankedInventoryShips = inventoryShipCodes.sort((a, b) => {
    const orderA = PREFERRED_SHIP_ORDER.indexOf(a);
    const orderB = PREFERRED_SHIP_ORDER.indexOf(b);
    if (orderA >= 0 && orderB >= 0) return orderA - orderB;
    if (orderA >= 0) return -1;
    if (orderB >= 0) return 1;
    return a.localeCompare(b);
  });
  const selectedShipKeys = (rankedInventoryShips.length ? rankedInventoryShips : rankedShips).slice(0, 2);
  const now = new Date();

  return selectedShipKeys.map((shipCode) => {
    const inventorySummary = inventoryByShip.get(shipCode);
    const shipRows = (grouped.get(shipCode) || []).filter((row) => {
      if (!inventorySummary) return true;
      const sailCode = normalizedSailCode(row?.sail_code);
      const rowId = row?.id != null ? String(row.id) : null;
      const hasSailFilter = inventorySummary.sailCodes.size > 0;
      const hasMasterIdFilter = inventorySummary.masterSailIds.size > 0;
      if (!hasSailFilter && !hasMasterIdFilter) return true;
      if (hasSailFilter && sailCode && inventorySummary.sailCodes.has(sailCode)) return true;
      if (hasMasterIdFilter && rowId && inventorySummary.masterSailIds.has(rowId)) return true;
      return false;
    });
    const normalizedRows = shipRows
      .map((row) => {
        const startDate = parseDate(row?.sail_date_from);
        const endDate = deriveEndDate(row, startDate);
        const fromCoord = resolvePortCoordinates(row?.port_from || row?.port_code);
        const toCoord = resolvePortCoordinates(row?.port_to || row?.port_code);
        return {
          shipCode,
          shipName: row?.ship_name || (shipCode === 'DIS' ? 'Celestyal Discovery' : shipCode === 'JRN' ? 'Celestyal Journey' : shipCode),
          sailCode: row?.sail_code || null,
          routeKey: `${shipCode}|${normalizedSailCode(row?.sail_code) || ''}|${toDateOnly(startDate) || ''}`,
          estimatedPax: paxBySailCode[normalizedSailCode(row?.sail_code) || ''] ?? null,
          itinerarySegments: itineraryBySailCode[normalizedSailCode(row?.sail_code) || ''] || [],
          startDate,
          endDate,
          fromPort: row?.port_from || row?.port_code || null,
          toPort: row?.port_to || row?.port_code || null,
          fromCoord,
          toCoord
        };
      })
      .filter((row) => row.startDate || row.endDate)
      .sort((a, b) => {
        const aTime = a.startDate ? a.startDate.getTime() : 0;
        const bTime = b.startDate ? b.startDate.getTime() : 0;
        return aTime - bTime;
      });

    const statusForWindow = (startDate, endDate) => {
      if (endDate && endDate < now) return 'past';
      if (startDate && startDate > now) return 'future';
      return 'active';
    };

    const mapRoutes = normalizedRows
      .flatMap((route) => {
        const segmentBase = {
          sailCode: route.sailCode,
          estimatedPax: route.estimatedPax
        };

        if (Array.isArray(route.itinerarySegments) && route.itinerarySegments.length) {
          return route.itinerarySegments.map((segment, segmentIndex) => ({
            ...segmentBase,
            routeKey: `${route.routeKey}|seg-${segmentIndex}|${segment.fromPort}-${segment.toPort}`,
            from: segment.from,
            to: segment.to,
            fromPort: segment.fromPort,
            toPort: segment.toPort,
            startDate: segment.startDate || route.startDate,
            endDate: segment.endDate || route.endDate,
            status: statusForWindow(segment.startDate || route.startDate, segment.endDate || route.endDate)
          }));
        }

        if (!route.fromCoord || !route.toCoord) return [];
        return [{
          ...segmentBase,
          routeKey: route.routeKey,
          from: route.fromCoord,
          to: route.toCoord,
          fromPort: route.fromPort,
          toPort: route.toPort,
          startDate: route.startDate,
          endDate: route.endDate,
          status: statusForWindow(route.startDate, route.endDate)
        }];
      })
      .filter((route) => route.from && route.to)
      .filter((route, idx, arr) => arr.findIndex((r) => r.routeKey === route.routeKey) === idx);

    const activeRoute = normalizedRows.find((route) => {
      if (!route.startDate || !route.endDate) return false;
      return route.startDate <= now && now <= route.endDate;
    });
    const pastRoutes = normalizedRows.filter((route) => route.endDate && route.endDate < now);
    const futureRoutes = normalizedRows.filter((route) => route.startDate && route.startDate > now);
    const nextRoute = futureRoutes[0] || null;
    const previousRoute = pastRoutes[pastRoutes.length - 1] || null;

    const fallbackPort = SHIP_HOME_PORT[shipCode] || DEFAULT_PORT_COORDINATES.piraeus;
    const scheduleLocation = activeRoute
      ? interpolatePoint(activeRoute.fromCoord || fallbackPort, activeRoute.toCoord || fallbackPort, activeRoute.startDate, activeRoute.endDate, now)
      : nextRoute?.fromCoord || previousRoute?.toCoord || fallbackPort;

    const occupancyForShip = occupancyRows.filter((row) => {
      if (inventorySummary?.sailCodes?.size) {
        const sailCode = normalizedSailCode(row?.sail_code);
        return Boolean(sailCode) && inventorySummary.sailCodes.has(sailCode);
      }
      return shipKeyForRow(row) === shipCode;
    });
    const latestSailDateValue = occupancyForShip.reduce((latest, row) => {
      const current = row?.sail_date_from;
      if (!current) return latest;
      if (!latest) return current;
      return String(current) > String(latest) ? current : latest;
    }, null);
    const latestOccupancyRows = latestSailDateValue
      ? occupancyForShip.filter((row) => row?.sail_date_from === latestSailDateValue)
      : occupancyForShip;
    const totalCabins = latestOccupancyRows.reduce((sum, row) => sum + asNumber(row?.total_cabins), 0);
    const occupiedCabins = latestOccupancyRows.reduce((sum, row) => sum + asNumber(row?.occupied_cabins), 0);
    const occupancyPct = totalCabins > 0 ? Math.round((occupiedCabins / totalCabins) * 100) : null;

    return {
      shipCode,
      shipName: inventorySummary?.shipName || normalizedRows[0]?.shipName || shipCode,
      currentLocation: scheduleLocation,
      scheduleLocation,
      activeRoute,
      pastRoutes: mapRoutes.filter((route) => route.status === 'past').slice(-6),
      futureRoutes: mapRoutes.filter((route) => route.status === 'future').slice(0, 6),
      mapRoutes,
      occupancy: {
        totalCabins,
        occupiedCabins,
        percentage: occupancyPct
      }
    };
  });
};

const ShipTrackerMapContainer = () => {
  const { data: sailings, loading: sailingsLoading, error: sailingsError, refetch: refetchSailings } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    contextMapper: () => null,
    limit: 5000
  });

  const { data: occupancyRows, loading: occupancyLoading, error: occupancyError, refetch: refetchOccupancy } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: null,
    contextMapper: () => null,
    limit: 12000
  });

  const {
    data: inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    eventName: null,
    contextMapper: () => null,
    limit: 12000
  });

  const shipSummaries = useMemo(
    () => computeShipSummaries(sailings || [], occupancyRows || [], inventoryItems || []),
    [sailings, occupancyRows, inventoryItems]
  );
  const [livePositionsByShip, setLivePositionsByShip] = useState({});
  const [livePositionsError, setLivePositionsError] = useState(null);
  const [livePositionsLoading, setLivePositionsLoading] = useState(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadLivePositions = async () => {
      if (!shipSummaries.length) {
        if (!cancelled) {
          setLivePositionsByShip({});
          setLivePositionsError(null);
        }
        return;
      }
      setLivePositionsLoading(true);
      try {
        const rows = await fetchLiveShipPositions(shipSummaries.map((ship) => ship.shipCode));
        if (cancelled) return;
        setLivePositionsByShip(
          Object.fromEntries(rows.map((row) => [row.shipCode, row]))
        );
        setLivePositionsError(null);
      } catch (error) {
        if (cancelled) return;
        setLivePositionsByShip({});
        setLivePositionsError(error);
      } finally {
        if (!cancelled) {
          setLivePositionsLoading(false);
        }
      }
    };

    loadLivePositions();
    const interval = setInterval(loadLivePositions, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shipSummaries, liveRefreshTick]);

  const [weatherByShip, setWeatherByShip] = useState({});
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [routeWeatherByKey, setRouteWeatherByKey] = useState({});
  const [routeWeatherLoading, setRouteWeatherLoading] = useState(false);
  const [portNewsByPort, setPortNewsByPort] = useState({});
  const [portNewsLoading, setPortNewsLoading] = useState(false);

  const shipsWithLiveLocation = useMemo(() => (
    shipSummaries.map((ship) => {
      const livePosition = livePositionsByShip[ship.shipCode];
      const hasLive = livePosition?.isLive && Number.isFinite(livePosition.latitude) && Number.isFinite(livePosition.longitude);
      return {
        ...ship,
        currentLocation: hasLive
          ? {
              lat: Number(livePosition.latitude),
              lon: Number(livePosition.longitude),
              label: 'AIS live position'
            }
          : ship.scheduleLocation,
        livePosition: livePosition || null
      };
    })
  ), [shipSummaries, livePositionsByShip]);
  const displayShips = shipsWithLiveLocation.length > 0 ? shipsWithLiveLocation : PUBLIC_FALLBACK_SHIPS;

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      if (!displayShips.length) {
        setWeatherByShip({});
        return;
      }

      setWeatherLoading(true);
      try {
        const weatherEntries = await Promise.all(
          displayShips.map(async (ship) => {
            const lat = ship.currentLocation?.lat;
            const lon = ship.currentLocation?.lon;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              return [ship.shipCode, null];
            }
            const url = `${WEATHER_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,wind_speed_10m,weather_code&timezone=auto`;
            const response = await fetch(url);
            if (!response.ok) {
              return [ship.shipCode, null];
            }
            const payload = await response.json();
            const current = payload?.current;
            if (!current) {
              return [ship.shipCode, null];
            }
            return [ship.shipCode, {
              temperature: current.temperature_2m,
              windSpeed: current.wind_speed_10m,
              code: current.weather_code,
              label: weatherCodeLabel(current.weather_code)
            }];
          })
        );

        if (!cancelled) {
          setWeatherByShip(Object.fromEntries(weatherEntries));
        }
      } catch {
        if (!cancelled) {
          setWeatherByShip({});
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    };

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [displayShips]);

  useEffect(() => {
    let cancelled = false;

    const loadPortNews = async () => {
      const ports = Array.from(new Set(
        displayShips.flatMap((ship) => (
          (ship.mapRoutes || []).flatMap((route) => [route.fromPort, route.toPort]).filter(Boolean)
        ))
      )).slice(0, 8);

      if (!ports.length) {
        setPortNewsByPort({});
        return;
      }

      setPortNewsLoading(true);
      try {
        const entries = await Promise.all(
          ports.map(async (port) => {
            const news = await fetchPortNews(portNewsQuery(port), 3);
            return [port, news];
          })
        );
        if (!cancelled) {
          setPortNewsByPort(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setPortNewsByPort({});
        }
      } finally {
        if (!cancelled) {
          setPortNewsLoading(false);
        }
      }
    };

    loadPortNews();
    return () => {
      cancelled = true;
    };
  }, [displayShips]);

  useEffect(() => {
    let cancelled = false;

    const loadRouteWeather = async () => {
      const routeRequests = [];
      const seen = new Set();

      displayShips.forEach((ship) => {
        (ship.mapRoutes || []).forEach((route) => {
          const key = route.routeKey || `${ship.shipCode}|${route.sailCode || ''}|${toDateOnly(route.startDate) || ''}|${route.fromPort || ''}|${route.toPort || ''}`;
          if (!key || seen.has(key)) return;
          const anchor = route.to || route.from;
          const weatherDate = toDateOnly(route.startDate) || toDateOnly(route.endDate);
          if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon) || !weatherDate) return;
          seen.add(key);
          routeRequests.push({ key, lat: anchor.lat, lon: anchor.lon, date: weatherDate });
        });
      });

      if (!routeRequests.length) {
        setRouteWeatherByKey({});
        return;
      }

      setRouteWeatherLoading(true);
      try {
        const today = toDateOnly(new Date());
        const weatherEntries = await Promise.all(
          routeRequests.map(async (request) => {
            const endpoint = request.date < today ? WEATHER_ARCHIVE_URL : WEATHER_URL;
            const url = `${endpoint}?latitude=${request.lat.toFixed(4)}&longitude=${request.lon.toFixed(4)}&daily=weather_code,temperature_2m_max,wind_speed_10m_max&timezone=auto&start_date=${request.date}&end_date=${request.date}`;
            const response = await fetch(url);
            if (!response.ok) return [request.key, null];
            const payload = await response.json();
            const daily = payload?.daily;
            const code = Array.isArray(daily?.weather_code) ? daily.weather_code[0] : null;
            const temp = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
            const wind = Array.isArray(daily?.wind_speed_10m_max) ? daily.wind_speed_10m_max[0] : null;
            if (code === null || temp === null) return [request.key, null];
            return [request.key, {
              date: request.date,
              code,
              label: weatherCodeLabel(code),
              temperature: temp,
              windSpeed: wind
            }];
          })
        );

        if (!cancelled) {
          setRouteWeatherByKey(Object.fromEntries(weatherEntries));
        }
      } catch {
        if (!cancelled) {
          setRouteWeatherByKey({});
        }
      } finally {
        if (!cancelled) {
          setRouteWeatherLoading(false);
        }
      }
    };

    loadRouteWeather();
    return () => {
      cancelled = true;
    };
  }, [displayShips]);

  const loading = sailingsLoading || occupancyLoading || inventoryLoading;
  const error = sailingsError || occupancyError || inventoryError;

  const handleRefresh = () => {
    refetchSailings();
    refetchOccupancy();
    refetchInventory();
    setLiveRefreshTick((tick) => tick + 1);
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading ship locations..."
      error={error}
      errorTitle="Failed to load ship tracker data"
      empty={!displayShips || displayShips.length === 0}
      emptyMessage="No ship route data available"
      onRetry={handleRefresh}
    >
      <ShipTrackerMapPresenter
        ships={displayShips}
        weatherByShip={weatherByShip}
        routeWeatherByKey={routeWeatherByKey}
        weatherLoading={weatherLoading || livePositionsLoading}
        routeWeatherLoading={routeWeatherLoading}
        portNewsByPort={portNewsByPort}
        portNewsLoading={portNewsLoading}
        livePositionsError={livePositionsError}
        onRefresh={handleRefresh}
      />
    </PanelDataState>
  );
};

export default ShipTrackerMapContainer;
