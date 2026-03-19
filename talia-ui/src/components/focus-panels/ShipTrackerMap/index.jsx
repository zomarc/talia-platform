import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import ShipTrackerMapPresenter from './ShipTrackerMapPresenter';
import { PORT_COORDINATES, resolvePortCoordinate } from '../../shared/maps/portCoordinates';

const SHIP_HOME_PORT = {
  DIS: PORT_COORDINATES.piraeus,
  JRN: PORT_COORDINATES.piraeus
};

const PREFERRED_SHIP_ORDER = ['DIS', 'JRN'];
const GRAPHQL_URL = '/api/graphql';
const LIVE_REFRESH_MS = 120000;
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

const normalizeFleetGroup = (value) => {
  const normalized = normalizeText(value);
  return normalized === 'celestyal' ? 'celestyal' : 'other';
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

const resolvePortCoordinates = (portValue) => {
  return resolvePortCoordinate(portValue);
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

const fetchWeatherAt = async (latitude, longitude, date = null) => {
  const query = `
    query GetWeatherAt($latitude: Float!, $longitude: Float!, $date: String) {
      weatherAt(latitude: $latitude, longitude: $longitude, date: $date) {
        label
        code
        temperature
        windSpeed
        date
      }
    }
  `;

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { latitude, longitude, date } })
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload?.data?.weatherAt || null;
};

const withTimeout = async (promiseFactory, timeoutMs = 8000) => {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promiseFactory(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

const computeShipSummaries = (masterSailRows, occupancyRows, inventoryItems = [], shipCatalogRows = []) => {
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

  const catalogByShip = new Map(
    (shipCatalogRows || [])
      .filter((row) => row?.enabled !== false)
      .map((row) => {
        const code = canonicalShipCode(row?.ship_code);
        if (!code) return null;
        return [code, row];
      })
      .filter(Boolean)
  );
  const rankedCatalogShips = Array.from(catalogByShip.keys()).sort((a, b) => {
    const aOrder = Number(catalogByShip.get(a)?.display_order ?? 100);
    const bOrder = Number(catalogByShip.get(b)?.display_order ?? 100);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
  const selectedShipKeys = rankedCatalogShips;
  const now = new Date();

  return selectedShipKeys.map((shipCode) => {
    const catalogShip = catalogByShip.get(shipCode) || null;
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

    const catalogHomeLat = Number(catalogShip?.home_latitude);
    const catalogHomeLon = Number(catalogShip?.home_longitude);
    const catalogHome =
      Number.isFinite(catalogHomeLat) && Number.isFinite(catalogHomeLon)
        ? {
            lat: catalogHomeLat,
            lon: catalogHomeLon,
            label: catalogShip?.home_port_label || `${catalogShip?.ship_name || shipCode} (catalog)`
          }
        : null;
    const fallbackPort = catalogHome || SHIP_HOME_PORT[shipCode] || PORT_COORDINATES.piraeus;
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
      shipName: catalogShip?.ship_name || inventorySummary?.shipName || normalizedRows[0]?.shipName || shipCode,
      operatorName: catalogShip?.operator_name || (shipCode === 'DIS' || shipCode === 'JRN' ? 'Celestyal' : 'Other'),
      fleetGroup: normalizeFleetGroup(catalogShip?.fleet_group || (shipCode === 'DIS' || shipCode === 'JRN' ? 'celestyal' : 'other')),
      regionScope: Array.isArray(catalogShip?.region_scope) ? catalogShip.region_scope : [],
      currentLocation: null,
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

const ShipTrackerMapContainer = ({ panelInstanceId, panelComponentId }) => {
  const { data: sailings, loading: sailingsLoading, error: sailingsError, refetch: refetchSailings } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 5000
  });

  const { data: occupancyRows, loading: occupancyLoading, error: occupancyError, refetch: refetchOccupancy } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: null,
    panelInstanceId,
    panelComponentId,
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
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 12000
  });

  const {
    data: shipCatalogRows,
    loading: shipCatalogLoading,
    error: shipCatalogError,
    refetch: refetchShipCatalog
  } = useTableDataWithContext({
    tableName: 'ship_tracking_target',
    eventName: null,
    panelInstanceId,
    panelComponentId,
    contextMapper: () => null,
    limit: 500
  });

  const shipSummaries = useMemo(
    () => computeShipSummaries(sailings || [], occupancyRows || [], inventoryItems || [], shipCatalogRows || []),
    [sailings, occupancyRows, inventoryItems, shipCatalogRows]
  );
  const [livePositionsByShip, setLivePositionsByShip] = useState({});
  const [livePositionsError, setLivePositionsError] = useState(null);
  const [livePositionsLoading, setLivePositionsLoading] = useState(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

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
    if (!autoRefreshEnabled) {
      return () => {
        cancelled = true;
      };
    }
    const interval = setInterval(loadLivePositions, LIVE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shipSummaries, liveRefreshTick, autoRefreshEnabled]);

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
          : null,
        livePosition: livePosition || null
      };
    })
  ), [shipSummaries, livePositionsByShip]);
  const displayShips = shipsWithLiveLocation;

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
            const weather = await withTimeout(() => fetchWeatherAt(Number(lat), Number(lon), null), 7000);
            return [ship.shipCode, weather];
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
  }, [
    displayShips
      .map((ship) => `${ship.shipCode}:${Number(ship.currentLocation?.lat || 0).toFixed(3)}:${Number(ship.currentLocation?.lon || 0).toFixed(3)}`)
      .sort()
      .join('|')
  ]);

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
  }, [
    displayShips
      .flatMap((ship) => (ship.mapRoutes || []).flatMap((route) => [route.fromPort, route.toPort]).filter(Boolean))
      .sort()
      .join('|')
  ]);

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
        const weatherEntries = await Promise.all(
          routeRequests.map(async (request) => {
            const weather = await withTimeout(
              () => fetchWeatherAt(Number(request.lat), Number(request.lon), request.date),
              7000
            );
            return [request.key, weather];
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
  }, [
    displayShips
      .flatMap((ship) => (ship.mapRoutes || []).map((route) => route.routeKey || ''))
      .sort()
      .join('|')
  ]);

  const loading = sailingsLoading || occupancyLoading || inventoryLoading || shipCatalogLoading;
  const error = sailingsError || occupancyError || inventoryError || null;
  if (shipCatalogError) {
    console.warn('[ShipTrackerMap] ship_tracking_target unavailable:', shipCatalogError?.message || shipCatalogError);
  }

  const handleRefresh = () => {
    refetchSailings();
    refetchOccupancy();
    refetchInventory();
    refetchShipCatalog();
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
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={() => setAutoRefreshEnabled((prev) => !prev)}
        livePositionsError={livePositionsError}
        onRefresh={handleRefresh}
      />
    </PanelDataState>
  );
};

export default ShipTrackerMapContainer;
