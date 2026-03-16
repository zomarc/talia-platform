import React, { useEffect, useMemo, useState } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import PanelDataState from '../../shared/PanelDataState';
import ItineraryExtractPresenter from './ItineraryExtractPresenter';
import {
  extractSailCodeFromEvent,
  SAIL_CLEAR_EVENT,
  SAIL_SELECT_EVENT,
} from '../../../lib/eventBus';

const REFERENCE_SOURCE_URL = 'https://celestyal.com/gb/search';
const PUBLIC_CATALOG_ENDPOINT = '/api/public-itinerary-catalog?limit=120';
const PUBLIC_IMAGE_POOL_ENDPOINT = '/api/public-image-pool?limit=20';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const DOT_SAIL_SELECT_EVENT = 'talia.sail.select';
const DEFAULT_REFERENCE_IMAGE = null;

const PORT_COORDINATES = {
  // Common port codes from internal data
  pir: { lat: 37.942, lon: 23.646, label: 'PIR' },
  kus: { lat: 37.8619, lon: 27.2578, label: 'KUS' },
  lav: { lat: 37.715, lon: 24.056, label: 'LAV' },
  the: { lat: 37.4467, lon: 25.3289, label: 'THE' },
  abd: { lat: 24.4539, lon: 54.3773, label: 'ABD' },
  doh: { lat: 25.2854, lon: 51.531, label: 'DOH' },
  shr: { lat: 27.9158, lon: 34.33, label: 'SHR' },
  jed: { lat: 21.4858, lon: 39.1925, label: 'JED' },
  saf: { lat: 26.7498, lon: 33.9389, label: 'SAF' },
  mrm: { lat: 36.855, lon: 28.274, label: 'MRM' },
  ani: { lat: 36.4709, lon: 25.3769, label: 'ANI' },
  lms: { lat: 34.675, lon: 33.033, label: 'LMS' },
  sga: { lat: 29.9668, lon: 32.5498, label: 'SGA' },
  dub: { lat: 25.276987, lon: 55.296249, label: 'DUB' },
  dxb: { lat: 25.2048, lon: 55.2708, label: 'DXB' },
  her: { lat: 35.3387, lon: 25.1442, label: 'HER' },

  athens: { lat: 37.9838, lon: 23.7275, label: 'Athens' },
  piraeus: { lat: 37.942, lon: 23.646, label: 'Piraeus' },
  mykonos: { lat: 37.4467, lon: 25.3289, label: 'Mykonos' },
  kusadasi: { lat: 37.8619, lon: 27.2578, label: 'Kusadasi' },
  patmos: { lat: 37.3084, lon: 26.5473, label: 'Patmos' },
  thessaloniki: { lat: 40.6401, lon: 22.9444, label: 'Thessaloniki' },
  crete: { lat: 35.3387, lon: 25.1442, label: 'Crete' },
  santorini: { lat: 36.3932, lon: 25.4615, label: 'Santorini' },
  milos: { lat: 36.6956, lon: 24.4823, label: 'Milos' },
  kotor: { lat: 42.4247, lon: 18.7712, label: 'Kotor' },
  split: { lat: 43.5081, lon: 16.4402, label: 'Split' },
  venice: { lat: 45.4408, lon: 12.3155, label: 'Venice' },
  katakolo: { lat: 37.6488, lon: 21.3185, label: 'Katakolo' },
  kefalonia: { lat: 38.1754, lon: 20.5694, label: 'Kefalonia' },
  rhodes: { lat: 36.4341, lon: 28.2176, label: 'Rhodes' },
  portsaid: { lat: 31.2653, lon: 32.3019, label: 'Port Said' },
  ashdod: { lat: 31.8014, lon: 34.6435, label: 'Ashdod' },
  haifa: { lat: 32.794, lon: 34.9896, label: 'Haifa' },
  limassol: { lat: 34.7071, lon: 33.0226, label: 'Limassol' },
};

const toPortKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')
  .replace(/[^a-z0-9]/g, '');

const resolvePortCoordinate = (portName) => {
  const key = toPortKey(portName);
  if (PORT_COORDINATES[key]) return PORT_COORDINATES[key];

  // Fallback aliases for common internal values.
  const aliases = {
    ath: 'athens',
    piraeusport: 'piraeus',
    kusadasiport: 'kusadasi',
    thessalonikiport: 'thessaloniki',
  };
  const aliasKey = aliases[key];
  return aliasKey ? PORT_COORDINATES[aliasKey] || null : null;
};

const buildRoutePoints = (row) => {
  const points = [row.departurePort, ...row.stops]
    .map((name) => {
      const resolved = resolvePortCoordinate(name);
      if (!resolved) return null;
      return { ...resolved, name };
    })
    .filter(Boolean);
  if (points.length > 0) return points;

  // Keep map informative even when no route ports are mappable.
  return [{ ...PORT_COORDINATES.athens, name: row.departurePort || 'Athens' }];
};

const toKey = (value) => String(value || '').trim().toLowerCase();
const toProxiedImageUrl = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw;
  return `/api/public-image?url=${encodeURIComponent(raw)}`;
};

const toMatchText = (value) => (
  toKey(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(cruise|from|to|and|the|with|night|nights)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const toTokenSet = (value) => new Set(
  toMatchText(value)
    .split(' ')
    .filter((token) => token && token.length >= 3)
);

const extractDurationNightsFromText = (value) => {
  const match = String(value || '').match(/(\d{1,2})\s*night/i);
  return match ? Number(match[1]) : null;
};

const hashString = (value) => {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const scorePublicCatalogMatch = ({ itineraryName, durationNights, ship }, entry) => {
  const internalTokens = toTokenSet(itineraryName);
  const externalTokens = toTokenSet(entry?.title || '');
  if (internalTokens.size === 0 || externalTokens.size === 0) return -1;

  let overlap = 0;
  internalTokens.forEach((token) => {
    if (externalTokens.has(token)) overlap += 1;
  });
  if (overlap === 0) return -1;

  let score = overlap;
  const externalDuration = Number(entry?.durationNights ?? extractDurationNightsFromText(entry?.title));
  const internalDuration = Number(durationNights || 0);
  if (internalDuration > 0 && externalDuration > 0 && internalDuration === externalDuration) {
    score += 3;
  }

  const internalText = toMatchText(itineraryName);
  const externalText = toMatchText(entry?.title || '');
  if (internalText && externalText && (externalText.includes(internalText) || internalText.includes(externalText))) {
    score += 2;
  }

  const shipText = toMatchText(ship);
  const entryText = `${toMatchText(entry?.title || '')} ${toMatchText(entry?.description || '')}`;
  if (shipText.includes('journey') && entryText.includes('journey')) score += 1;
  if (shipText.includes('discovery') && entryText.includes('discovery')) score += 1;
  if (shipText.includes('olympia') && entryText.includes('olympia')) score += 1;

  return score;
};

const resolvePublicInfo = ({
  itineraryName,
  durationNights,
  ship,
  publicCatalog,
  publicImagePool,
}) => {
  const catalog = Array.isArray(publicCatalog) ? publicCatalog : [];
  if (catalog.length === 0) {
    const pool = Array.isArray(publicImagePool) ? publicImagePool : [];
    if (pool.length === 0) {
      return {
        referenceUrl: null,
        referenceImage: DEFAULT_REFERENCE_IMAGE,
        externalMapped: false,
        referenceSourceLabel: null,
      };
    }
    const fallbackIndex = hashString(`${itineraryName}|${ship}|${durationNights}`) % pool.length;
    const fallback = pool[fallbackIndex];
    return {
      referenceUrl: fallback?.sourcePage || null,
      referenceImage: toProxiedImageUrl(fallback?.imageUrl || DEFAULT_REFERENCE_IMAGE),
      externalMapped: false,
      referenceSourceLabel: fallback?.sourceLabel || 'Public reference',
    };
  }

  let best = null;
  let bestScore = -1;
  catalog.forEach((entry) => {
    const score = scorePublicCatalogMatch({ itineraryName, durationNights, ship }, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  if (!best || bestScore < 2) {
    return {
      referenceUrl: null,
      referenceImage: DEFAULT_REFERENCE_IMAGE,
      externalMapped: false,
      referenceSourceLabel: null,
    };
  }

  return {
    referenceUrl: best.url || null,
    referenceImage: toProxiedImageUrl(best.image || DEFAULT_REFERENCE_IMAGE),
    externalMapped: true,
    referenceSourceLabel: 'Celestyal public itinerary',
  };
};

const parseInventoryMetadata = (row) => {
  const metadata = row?.metadata;
  if (!metadata || typeof metadata !== 'object') return {};
  return metadata;
};

const asDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toDayNumber = (value) => {
  const dateOnly = asDateOnly(value);
  if (!dateOnly) return null;
  const timestamp = Date.parse(`${dateOnly}T00:00:00Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86400000) : null;
};

const withinDays = (leftValue, rightValue, maxDays) => {
  const left = toDayNumber(leftValue);
  const right = toDayNumber(rightValue);
  if (left == null || right == null) return false;
  return Math.abs(left - right) <= maxDays;
};

const locationKey = (value) => toKey(value).replace(/\d+/g, '');

const toLocationSet = (...values) => {
  const set = new Set();
  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const key = locationKey(entry);
        if (key) set.add(key);
      });
      return;
    }
    const key = locationKey(value);
    if (key) set.add(key);
  });
  return set;
};

const hasLocationOverlap = (leftSet, rightSet) => {
  if (!leftSet || leftSet.size === 0) return true;
  if (!rightSet || rightSet.size === 0) return false;
  for (const key of leftSet) {
    if (rightSet.has(key)) return true;
    for (const rightKey of rightSet) {
      if (key.includes(rightKey) || rightKey.includes(key)) return true;
    }
  }
  return false;
};

const sortByDeparture = (a, b) => {
  const aDate = a.nextDeparture || '9999-12-31';
  const bDate = b.nextDeparture || '9999-12-31';
  return aDate.localeCompare(bDate);
};

const isUnknownItinerary = (name) => toKey(name) === 'unknown';

const ItineraryExtractContainer = ({ panelInstanceId, panelComponentId }) => {
  const [shipFilter, setShipFilter] = useState('ALL');
  const [durationFilter, setDurationFilter] = useState('ALL');
  const [publicCatalog, setPublicCatalog] = useState([]);
  const [publicImagePool, setPublicImagePool] = useState([]);
  const [viewScope, setViewScope] = useState(() => window.__taliaViewScope === 'wide' ? 'wide' : 'local');
  const [selectionContext, setSelectionContext] = useState(() => window.lastSailSelectEvent?.detail || null);

  const extractReferenceSailCodeFromEvent = (detail) => (
    detail?.reference_sail_code ||
    detail?.referenceSailCode ||
    detail?.row_data?.reference_sail_code ||
    null
  );

  useEffect(() => {
    const handleSailSelect = (event) => {
      setSelectionContext(event?.detail || null);
    };
    const handleSailClear = () => {
      setSelectionContext(null);
    };
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(DOT_SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(DOT_SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, []);

  useEffect(() => {
    const handleScopeChange = (event) => {
      const nextScope = event?.detail?.scope === 'wide' ? 'wide' : 'local';
      setViewScope(nextScope);
    };
    window.addEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleScopeChange);
    return () => window.removeEventListener(DASHBOARD_VIEW_SCOPE_EVENT, handleScopeChange);
  }, []);

  useEffect(() => {
    let active = true;
    const loadPublicCatalog = async () => {
      try {
        const response = await fetch(PUBLIC_CATALOG_ENDPOINT);
        if (!response.ok) return;
        const payload = await response.json();
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const normalized = items.map((entry) => ({
          url: String(entry?.url || '').trim(),
          title: String(entry?.title || '').trim(),
          description: String(entry?.description || '').trim(),
          image: String(entry?.image || '').trim(),
          durationNights: Number(entry?.durationNights || 0) || extractDurationNightsFromText(entry?.title),
        }))
          .filter((entry) => entry.url && entry.title && entry.image);
        setPublicCatalog(normalized);
      } catch {
        if (active) setPublicCatalog([]);
      }
    };
    loadPublicCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadImagePool = async () => {
      try {
        const response = await fetch(PUBLIC_IMAGE_POOL_ENDPOINT);
        if (!response.ok) return;
        const payload = await response.json();
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const normalized = items
          .map((entry) => ({
            sourcePage: String(entry?.sourcePage || '').trim(),
            sourceLabel: String(entry?.sourceLabel || '').trim(),
            imageUrl: String(entry?.imageUrl || '').trim(),
          }))
          .filter((entry) => entry.sourcePage && entry.imageUrl);
        setPublicImagePool(normalized);
      } catch {
        if (active) setPublicImagePool([]);
      }
    };
    loadImagePool();
    return () => {
      active = false;
    };
  }, []);

  const {
    data: inventoryRows,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useTableDataWithContext({
    tableName: 'inventory_item',
    eventName: null,
    contextMapper: null,
    limit: 2500,
  });

  const {
    data: sailingRows,
    loading: sailingLoading,
    error: sailingError,
    refetch: refetchSailings,
  } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null,
    contextMapper: null,
    limit: 5000,
  });

  const selectedSailCode = useMemo(() => (
    selectionContext?.sail_code ||
    selectionContext?.Sail_Code ||
    selectionContext?.row_data?.sail_code ||
    (typeof selectionContext === 'string' ? selectionContext : null)
  ), [selectionContext]);
  const selectedReferenceSailCode = useMemo(() => (
    selectionContext?.reference_sail_code ||
    selectionContext?.referenceSailCode ||
    selectionContext?.row_data?.reference_sail_code ||
    selectedSailCode ||
    null
  ), [selectionContext, selectedSailCode]);

  const itineraryRows = useMemo(() => {
    const sailingByCode = new Map((sailingRows || []).map((row) => [String(row?.sail_code || ''), row]));
    const grouped = new Map();
    const selectedSail = String(selectedSailCode || '').trim();
    const selectedReference = String(selectedReferenceSailCode || selectedSail || '').trim();
    const selectedSailRow = selectedSail ? sailingByCode.get(selectedSail) : null;
    const selectedDate = asDateOnly(
      selectionContext?.sail_date_from ||
      selectionContext?.sailDateFrom ||
      selectionContext?.row_data?.sail_date_from ||
      selectedSailRow?.sail_date_from
    );
    const selectedLocations = toLocationSet(
      selectionContext?.geog_area_code,
      selectionContext?.destination,
      selectionContext?.port_from,
      selectionContext?.port_to,
      selectionContext?.row_data?.geog_area_code,
      selectionContext?.row_data?.destination,
      selectionContext?.row_data?.port_from,
      selectionContext?.row_data?.port_to,
      selectedSailRow?.geog_area_code,
      selectedSailRow?.port_from,
      selectedSailRow?.port_to
    );

    const resolveRowScope = (row) => {
      const metadata = parseInventoryMetadata(row);
      const rowSailCode = String(row?.sail_code || '').trim();
      const rowReferenceCode = String(row?.reference_sail_code || '').trim();
      const rowSail = rowSailCode ? sailingByCode.get(rowSailCode) : null;
      const rowDate = asDateOnly(
        row?.sail_date_from ||
        metadata?.sail_date_from ||
        metadata?.departure_date ||
        rowSail?.sail_date_from
      );

      const rowLocations = toLocationSet(
        row?.geog_area_code,
        row?.destination,
        row?.port_from,
        row?.port_to,
        metadata?.geog_area_code,
        metadata?.destination,
        metadata?.port_from,
        metadata?.port_to,
        rowSail?.geog_area_code,
        rowSail?.port_from,
        rowSail?.port_to
      );

      const directMatch = (
        (selectedSail && rowSailCode === selectedSail) ||
        (selectedSail && rowReferenceCode === selectedSail) ||
        (selectedReference && rowReferenceCode === selectedReference)
      );
      if (!selectedSail && !selectedReference && !selectedDate && selectedLocations.size === 0) {
        return { pass: true, directMatch, rowDate, rowLocations };
      }
      if (directMatch) return { pass: true, directMatch, rowDate, rowLocations };

      if (viewScope === 'wide') {
        const datePass = selectedDate ? withinDays(rowDate, selectedDate, 5) : true;
        const locationPass = hasLocationOverlap(selectedLocations, rowLocations);
        return { pass: datePass && locationPass, directMatch, rowDate, rowLocations };
      }

      // Local: closer relevance than wide (near date + closer location).
      const datePass = selectedDate ? withinDays(rowDate, selectedDate, 1) : true;
      const locationPass = hasLocationOverlap(selectedLocations, rowLocations);
      return { pass: datePass && locationPass, directMatch, rowDate, rowLocations };
    };

    let scopedInventoryRows = (inventoryRows || []).filter((row) => resolveRowScope(row).pass);
    const hasSelection = Boolean(selectedSail || selectedReference || selectedDate || selectedLocations.size > 0);
    if (hasSelection && scopedInventoryRows.length === 0) {
      // Fallback broadening to avoid false "no data" states when source rows are sparse.
      const broadenedRows = (inventoryRows || []).filter((row) => {
        const { directMatch, rowDate, rowLocations } = resolveRowScope(row);
        if (directMatch) return true;
        if (viewScope === 'wide') {
          if (selectedDate && withinDays(rowDate, selectedDate, 14)) return true;
          return hasLocationOverlap(selectedLocations, rowLocations);
        }
        // Local fallback still stays close: location match OR very near date.
        if (selectedDate && withinDays(rowDate, selectedDate, 2)) return true;
        return hasLocationOverlap(selectedLocations, rowLocations);
      });
      scopedInventoryRows = broadenedRows.length > 0 ? broadenedRows : (inventoryRows || []);
    }

    scopedInventoryRows.forEach((row) => {
      const groupCode = String(row?.reference_sail_code || row?.sail_code || '').trim();
      if (!groupCode) return;
      if (!grouped.has(groupCode)) {
        grouped.set(groupCode, {
          code: groupCode,
          rows: [],
        });
      }
      grouped.get(groupCode).rows.push(row);
    });

    const mapped = Array.from(grouped.values()).map((group) => {
      const first = group.rows[0];
      const metadata = parseInventoryMetadata(first);
      const candidateSailCode = String(first?.sail_code || group.code);
      const sail = sailingByCode.get(candidateSailCode) || sailingByCode.get(group.code) || null;

      const itineraryName = sail?.package_name || metadata.package_name || group.code;
      const durationNights = Number(sail?.sail_days || metadata.sail_days || 0) || null;
      const departurePort = sail?.port_from || metadata.port_from || 'Athens (Piraeus)';
      const stopPort = sail?.port_to || metadata.port_to || null;
      const stops = stopPort ? [stopPort] : [];
      const nextDeparture = asDateOnly(sail?.sail_date_from || metadata.sail_date_from || metadata.departure_date);
      const shipName = first?.ship_name || first?.ship_code || 'Unknown Ship';

      const publicInfo = resolvePublicInfo({
        itineraryName,
        durationNights,
        ship: shipName,
        publicCatalog,
        publicImagePool,
      });

      return {
        id: `itinerary-${group.code}`,
        sailCode: group.code,
        ship: shipName,
        itineraryName,
        durationNights: durationNights || 'N/A',
        departurePort,
        stops,
        nextDeparture,
        routePoints: buildRoutePoints({
          departurePort,
          stops,
        }),
        referenceUrl: publicInfo.referenceUrl,
        referenceImage: publicInfo.referenceImage,
        externalMapped: Boolean(publicInfo.externalMapped),
        referenceSourceLabel: publicInfo.referenceSourceLabel || null,
      };
    });

    // External image/link data is informational only.
    // Keep internal rows visible even when public mapping is missing.
    const publicRows = mapped.filter((row) => !isUnknownItinerary(row.itineraryName));

    // Deduplicate to a compact public card set.
    const deduped = new Map();
    publicRows.forEach((row) => {
      const key = `${toKey(row.ship)}|${toKey(row.itineraryName)}|${row.durationNights}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, row);
        return;
      }
      if ((row.nextDeparture || '9999-12-31') < (existing.nextDeparture || '9999-12-31')) {
        deduped.set(key, row);
      }
    });

    return Array.from(deduped.values()).sort(sortByDeparture);
  }, [inventoryRows, publicCatalog, publicImagePool, sailingRows, selectedReferenceSailCode, selectedSailCode, selectionContext, viewScope]);

  const shipOptions = useMemo(() => (
    ['ALL', ...Array.from(new Set(itineraryRows.map((row) => row.ship))).sort()]
  ), [itineraryRows]);

  const durationOptions = useMemo(() => (
    ['ALL', ...Array.from(new Set(itineraryRows.map((row) => `${row.durationNights}N`))).sort((a, b) => Number(a) - Number(b))]
  ), [itineraryRows]);

  const data = useMemo(() => (
    itineraryRows.filter((row) => {
      const matchesShip = shipFilter === 'ALL' || row.ship === shipFilter;
      const matchesDuration = durationFilter === 'ALL' || `${row.durationNights}N` === durationFilter;
      return matchesShip && matchesDuration;
    })
  ), [durationFilter, itineraryRows, shipFilter]);

  const loading = inventoryLoading || sailingLoading;
  const error = inventoryError || sailingError || null;
  const handleRetry = () => {
    refetchInventory();
    refetchSailings();
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading itinerary extract from inventory..."
      error={error}
      errorTitle="Failed to load itinerary extract"
      empty={!data || data.length === 0}
      emptyMessage={
        selectedSailCode
          ? `No itinerary extract rows found for sail code: ${selectedSailCode}`
          : 'No itineraries match the selected filters.'
      }
      onRetry={handleRetry}
    >
      <ItineraryExtractPresenter
        data={data}
        shipFilter={shipFilter}
        durationFilter={durationFilter}
        shipOptions={shipOptions}
        durationOptions={durationOptions}
        onShipFilterChange={setShipFilter}
        onDurationFilterChange={setDurationFilter}
        referenceSourceUrl={REFERENCE_SOURCE_URL}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default ItineraryExtractContainer;
