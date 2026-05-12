import { configService } from './config-service.js';
import { aisLiveService } from './ais-live-service.js';

const STALE_AFTER_MS = 10 * 60 * 1000;
const INTEGRATIONS_CATEGORY = 'integrations';
const AIS_PROVIDER_SETTING_KEY = 'ais_provider_keys';
const CONFIG_CACHE_MS = 30 * 1000;
const PROVIDER_REFRESH_MS = {
  aishub: 60 * 1000,
  vesselfinder: 30 * 1000,
  marinetraffic: 30 * 1000,
};

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

const parseProviderError = (provider, body) => {
  if (!body) return null;
  try {
    const json = typeof body === 'string' ? JSON.parse(body) : body;
    if (Array.isArray(json?.errors) && json.errors.length) {
      const first = json.errors[0];
      const detail = first?.detail || first?.message || 'unknown error';
      const code = first?.code ? ` [${first.code}]` : '';
      return `${provider}: ${detail}${code}`;
    }
    if (json?.ERROR || json?.error) {
      return `${provider}: ${json.ERROR || json.error}`;
    }
  } catch {
    const snippet = String(body).slice(0, 160);
    if (snippet) return `${provider}: ${snippet}`;
  }
  return null;
};

const fetchJson = async (provider, url, timeoutMs = 8000) => {
  const res = await withTimeout(() => fetch(url), timeoutMs);
  const text = await res.text();
  if (!res.ok) {
    const parsed = parseProviderError(provider, text);
    throw new Error(parsed || `${provider}: HTTP ${res.status}`);
  }
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${provider}: invalid JSON response`);
  }
  const apiError = parseProviderError(provider, payload);
  if (apiError) throw new Error(apiError);
  return payload;
};

const freshnessSecondsFrom = (timestampIso) => {
  if (!timestampIso) return null;
  const ts = new Date(timestampIso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
};

const isLiveFrom = (freshnessSeconds) => (
  Number.isFinite(freshnessSeconds) && freshnessSeconds * 1000 <= STALE_AFTER_MS
);

const buildShipIndexes = (shipConfigs = []) => {
  const byCode = new Map();
  const byMmsi = new Map();
  const byImo = new Map();
  shipConfigs.forEach((ship) => {
    if (!ship?.shipCode) return;
    byCode.set(ship.shipCode, ship);
    if (ship.mmsi) byMmsi.set(String(ship.mmsi), ship.shipCode);
    if (ship.imoNumber) byImo.set(String(ship.imoNumber), ship.shipCode);
  });
  return { byCode, byMmsi, byImo };
};

const normalizePosition = (provider, ship, fields) => {
  const timestampIso = toIso(fields.timestamp);
  const freshnessSeconds = freshnessSecondsFrom(timestampIso);
  const live = isLiveFrom(freshnessSeconds);
  return {
    shipCode: ship.shipCode,
    shipName: fields.shipName || ship.shipName,
    mmsi: fields.mmsi || ship.mmsi || null,
    latitude: numberOrNull(fields.latitude),
    longitude: numberOrNull(fields.longitude),
    speedKnots: numberOrNull(fields.speedKnots),
    course: numberOrNull(fields.course),
    heading: numberOrNull(fields.heading),
    navStatus: fields.navStatus || 'unknown',
    timestamp: timestampIso,
    source: provider,
    freshnessSeconds,
    isLive: live,
  };
};

class ShipPositionService {
  constructor() {
    this.state = {
      aishub: {},
      vesselfinder: {},
      marinetraffic: {},
    };
    this.cachedConfig = null;
    this.cachedConfigAt = 0;
  }

  async getProviderConfig() {
    const now = Date.now();
    if (this.cachedConfig && now - this.cachedConfigAt < CONFIG_CACHE_MS) {
      return this.cachedConfig;
    }
    const raw = await configService.getSetting(INTEGRATIONS_CATEGORY, AIS_PROVIDER_SETTING_KEY);
    const config = raw && typeof raw === 'object' ? raw : {};
    this.cachedConfig = config;
    this.cachedConfigAt = now;
    return config;
  }

  invalidateCache() {
    this.cachedConfig = null;
    this.cachedConfigAt = 0;
    this.state.aishub = {};
    this.state.vesselfinder = {};
    this.state.marinetraffic = {};
  }

  async getProviderTargets({ connectAisStream = true } = {}) {
    const config = await this.getProviderConfig();
    const aisstreamApiKey = config.aisstreamApiKey || process.env.AISSTREAM_API_KEY || '';
    const aishubUsername = config.aishubUsername || process.env.AISHUB_USERNAME || '';
    const vesselfinderApiKey = config.vesselfinderApiKey || process.env.VESSELFINDER_API_KEY || '';
    const marinetrafficApiKey = config.marinetrafficApiKey || process.env.MARINETRAFFIC_API_KEY || '';

    aisLiveService.setApiKeyOverride(config.aisstreamApiKey || null);
    if (connectAisStream) {
      aisLiveService.ensureConnected();
    }
    const aisStatus = aisLiveService.getStatus();
    const aishubStatus = this.state.aishub;
    const vesselfinderStatus = this.state.vesselfinder;
    const marinetrafficStatus = this.state.marinetraffic;

    const aisDetail = (() => {
      if (!aisStatus.configured) {
        return 'AISSTREAM_API_KEY missing or no MMSI/region scope configured.';
      }
      if (aisStatus.lastError) {
        return `AIS websocket error: ${aisStatus.lastError}`;
      }
      if (aisStatus.lastCloseCode && !aisStatus.wsReady) {
        const reason = aisStatus.lastCloseReason ? ` (${aisStatus.lastCloseReason})` : '';
        return `AIS websocket closed ${aisStatus.lastCloseCode}${reason}`;
      }
      if (aisStatus.wsReady) {
        const msgCount = aisStatus.messageCount || 0;
        const matched = aisStatus.matchedMessageCount || 0;
        const sub = `${aisStatus.mmsiCount} MMSI, ${aisStatus.boxCount} region boxes`;
        if (matched > 0) {
          return `${msgCount} msgs received, ${matched} matched; last match ${aisStatus.lastMatchedAt} (${sub}).`;
        }
        if (msgCount > 0) {
          return `${msgCount} msgs received, 0 matched our ships yet (${sub}); last msg ${aisStatus.lastMessageAt}.`;
        }
        return `Connected; awaiting AIS messages (${sub}).`;
      }
      if (aisStatus.connecting) {
        return 'Connecting to AISStream...';
      }
      return 'AIS websocket not connected.';
    })();

    return [
      {
        id: 'ais_stream',
        label: 'AIS stream (public)',
        role: 'Live vessel positions (AISStream)',
        address: 'wss://stream.aisstream.io/v0/stream',
        skipped: !aisStatus.configured,
        online: aisStatus.configured ? aisStatus.wsReady : false,
        detail: aisDetail,
      },
      this._buildProviderTarget(
        'aishub',
        'AISHub AIS',
        'Contributor AIS feed (AISHub)',
        'https://data.aishub.net/ws.php',
        Boolean(aishubUsername),
        aishubStatus
      ),
      this._buildProviderTarget(
        'vesselfinder',
        'VesselFinder AIS',
        'Commercial AIS API (VesselFinder)',
        'https://api.vesselfinder.com/vessels',
        Boolean(vesselfinderApiKey),
        vesselfinderStatus
      ),
      this._buildProviderTarget(
        'marinetraffic',
        'MarineTraffic AIS',
        'Commercial AIS API (MarineTraffic)',
        'https://services.marinetraffic.com/api/exportvessel',
        Boolean(marinetrafficApiKey),
        marinetrafficStatus
      ),
    ];
  }

  _buildProviderTarget(id, label, role, address, configured, state) {
    if (!configured) {
      return {
        id,
        label,
        role,
        address,
        skipped: true,
        online: false,
        detail: 'Not configured.',
      };
    }
    if (state?.lastError) {
      return {
        id,
        label,
        role,
        address,
        skipped: false,
        online: false,
        detail: state.lastError,
      };
    }
    if (state?.lastSuccessAt) {
      return {
        id,
        label,
        role,
        address,
        skipped: false,
        online: true,
        detail: `Last success: ${state.lastSuccessAt}`,
      };
    }
    return {
      id,
      label,
      role,
      address,
      skipped: false,
      online: true,
      detail: 'Configured; no requests yet.',
    };
  }

  async getLiveShipPositions(shipConfigs = []) {
    const safeConfigs = Array.isArray(shipConfigs) ? shipConfigs : [];
    const config = await this.getProviderConfig();
    aisLiveService.setApiKeyOverride(config.aisstreamApiKey || null);
    aisLiveService.ensureConnected();
    const aisPositions = aisLiveService.getLiveShipPositions(safeConfigs);
    const positionsByCode = new Map(
      aisPositions.map((position) => [position.shipCode, position])
    );

    const missing = safeConfigs.filter((ship) => {
      const existing = positionsByCode.get(ship.shipCode);
      if (!existing) return true;
      return !Number.isFinite(existing.latitude) || !Number.isFinite(existing.longitude);
    });

    let remaining = missing;
    if (remaining.length) {
      remaining = await this._fillFromProvider('aishub', remaining, positionsByCode, config);
    }
    if (remaining.length) {
      remaining = await this._fillFromProvider('vesselfinder', remaining, positionsByCode, config);
    }
    if (remaining.length) {
      remaining = await this._fillFromProvider('marinetraffic', remaining, positionsByCode, config);
    }

    return safeConfigs.map((ship) => {
      const existing = positionsByCode.get(ship.shipCode);
      if (existing) return existing;
      return {
        shipCode: ship.shipCode,
        shipName: ship.shipName,
        mmsi: ship.mmsi || null,
        latitude: null,
        longitude: null,
        speedKnots: null,
        course: null,
        heading: null,
        navStatus: 'no_signal',
        timestamp: null,
        source: 'unavailable',
        freshnessSeconds: null,
        isLive: false,
      };
    });
  }

  async _fillFromProvider(provider, ships, positionsByCode, config) {
    if (!ships.length) return ships;
    const now = Date.now();
    const state = this.state[provider] || {};
    const refreshMs = PROVIDER_REFRESH_MS[provider] || 30000;
    if (state.lastAttemptAt && now - state.lastAttemptAt < refreshMs) {
      return ships;
    }
    this.state[provider] = { ...state, lastAttemptAt: now, lastError: null };
    try {
      const results = await this._fetchFromProvider(provider, ships, config);
      this.state[provider] = {
        ...this.state[provider],
        lastSuccessAt: new Date().toISOString(),
        lastResultCount: results.length,
      };
      results.forEach((position) => {
        positionsByCode.set(position.shipCode, position);
      });
      return ships.filter((ship) => {
        const pos = positionsByCode.get(ship.shipCode);
        return !pos || !Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude);
      });
    } catch (error) {
      this.state[provider] = {
        ...this.state[provider],
        lastError: error?.message || String(error),
      };
      return ships;
    }
  }

  async _fetchFromProvider(provider, ships, config) {
    if (provider === 'aishub') {
      return this._fetchFromAishub(ships, config);
    }
    if (provider === 'vesselfinder') {
      return this._fetchFromVesselFinder(ships, config);
    }
    if (provider === 'marinetraffic') {
      return this._fetchFromMarineTraffic(ships, config);
    }
    return [];
  }

  async _fetchFromAishub(ships, config) {
    const username = config?.aishubUsername || process.env.AISHUB_USERNAME;
    if (!username) return [];
    const mmsiList = ships.map((ship) => ship.mmsi).filter(Boolean).map(String);
    const imoList = ships.map((ship) => ship.imoNumber).filter(Boolean).map(String);
    if (!mmsiList.length && !imoList.length) return [];

    const params = new URLSearchParams({
      username,
      format: '1',
      output: 'json',
      compress: '0',
      interval: '60',
    });
    if (mmsiList.length) params.set('mmsi', mmsiList.join(','));
    if (imoList.length) params.set('imo', imoList.join(','));
    const url = `https://data.aishub.net/ws.php?${params.toString()}`;

    const payload = await fetchJson('aishub', url, 8000);
    if (Array.isArray(payload) && payload[0]?.ERROR) {
      throw new Error(`aishub: ${payload[0].ERROR_MESSAGE || 'request rejected'}`);
    }
    const rows = Array.isArray(payload) ? payload[1] : payload?.data || [];
    const { byMmsi, byImo, byCode } = buildShipIndexes(ships);
    return (rows || [])
      .map((row) => {
        const mmsi = row?.MMSI ? String(row.MMSI) : null;
        const imo = row?.IMO ? String(row.IMO) : null;
        const shipCode = (mmsi && byMmsi.get(mmsi)) || (imo && byImo.get(imo));
        if (!shipCode) return null;
        const ship = byCode.get(shipCode);
        return normalizePosition('aishub', ship, {
          shipName: row?.NAME,
          mmsi,
          latitude: row?.LATITUDE,
          longitude: row?.LONGITUDE,
          speedKnots: row?.SOG,
          course: row?.COG,
          heading: row?.HEADING,
          navStatus: row?.NAVSTAT,
          timestamp: row?.TIME,
        });
      })
      .filter(Boolean);
  }

  async _fetchFromVesselFinder(ships, config) {
    const apiKey = config?.vesselfinderApiKey || process.env.VESSELFINDER_API_KEY;
    if (!apiKey) return [];
    const mmsiList = ships.map((ship) => ship.mmsi).filter(Boolean).map(String);
    const imoList = ships.map((ship) => ship.imoNumber).filter(Boolean).map(String);
    if (!mmsiList.length && !imoList.length) return [];

    const { byMmsi, byImo, byCode } = buildShipIndexes(ships);
    const mapRow = (source) => {
      const mmsi = source?.MMSI ? String(source.MMSI) : null;
      const imo = source?.IMO ? String(source.IMO) : null;
      const shipCode = (mmsi && byMmsi.get(mmsi)) || (imo && byImo.get(imo));
      if (!shipCode) return null;
      const ship = byCode.get(shipCode);
      return normalizePosition('vesselfinder', ship, {
        shipName: source?.NAME,
        mmsi,
        latitude: source?.LATITUDE ?? source?.LAT,
        longitude: source?.LONGITUDE ?? source?.LON,
        speedKnots: source?.SPEED ?? source?.SOG,
        course: source?.COURSE ?? source?.COG,
        heading: source?.HEADING,
        navStatus: source?.NAVSTAT ?? source?.STATUS,
        timestamp: source?.TIMESTAMP ?? source?.TIME,
      });
    };

    // Fleet API (preferred when the key is a fleet-key) — returns all registered
    // vessels in one call; we match by MMSI/IMO locally.
    const fleetUrl = `https://api.vesselfinder.com/vesselslist?userkey=${encodeURIComponent(apiKey)}`;
    try {
      const payload = await fetchJson('vesselfinder', fleetUrl, 8000);
      const rows = Array.isArray(payload) ? payload : [];
      const positions = rows
        .map((row) => row?.AIS || row)
        .filter(Boolean)
        .map(mapRow)
        .filter(Boolean);
      if (positions.length) return positions;
    } catch (fleetError) {
      const msg = fleetError?.message || '';
      const isKeyError = /invalid\s*userkey|userkey|not\s*allowed|forbidden/i.test(msg);
      if (!isKeyError) throw fleetError;
      // fall through to per-vessel endpoint for non-fleet keys
    }

    // Per-vessel endpoint (Vessels API) — used when the key is not a fleet-key.
    const params = new URLSearchParams({ userkey: apiKey, format: 'json' });
    if (mmsiList.length) params.set('mmsi', mmsiList.join(','));
    if (imoList.length) params.set('imo', imoList.join(','));
    const perVesselUrl = `https://api.vesselfinder.com/vessels?${params.toString()}`;
    const payload = await fetchJson('vesselfinder', perVesselUrl, 8000);
    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map((row) => row?.AIS || row)
      .filter(Boolean)
      .map(mapRow)
      .filter(Boolean);
  }

  async _fetchFromMarineTraffic(ships, config) {
    const apiKey = config?.marinetrafficApiKey || process.env.MARINETRAFFIC_API_KEY;
    if (!apiKey) return [];

    const { byMmsi, byImo, byCode } = buildShipIndexes(ships);
    const requests = ships.map(async (ship) => {
      const params = new URLSearchParams({ v: '6', protocol: 'jsono' });
      if (ship.mmsi) params.set('mmsi', String(ship.mmsi));
      else if (ship.imoNumber) params.set('imo', String(ship.imoNumber));
      else return null;

      const url = `https://services.marinetraffic.com/api/exportvessel/${apiKey}?${params.toString()}`;
      const payload = await fetchJson('marinetraffic', url, 8000);
      const row = Array.isArray(payload) ? payload[0] : null;
      if (!row) return null;
      const mmsi = row?.MMSI ? String(row.MMSI) : null;
      const imo = row?.IMO ? String(row.IMO) : null;
      const shipCode = (mmsi && byMmsi.get(mmsi)) || (imo && byImo.get(imo));
      if (!shipCode) return null;
      const shipEntry = byCode.get(shipCode);
      return normalizePosition('marinetraffic', shipEntry, {
        shipName: row?.SHIPNAME,
        mmsi,
        latitude: row?.LAT,
        longitude: row?.LON,
        speedKnots: row?.SPEED,
        course: row?.COURSE,
        heading: row?.HEADING,
        navStatus: row?.STATUS,
        timestamp: row?.TIMESTAMP,
      });
    });

    const settled = await Promise.allSettled(requests);
    const rows = [];
    const errors = [];
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value) rows.push(result.value);
      } else {
        errors.push(result.reason?.message || String(result.reason));
      }
    });
    if (!rows.length && errors.length) {
      throw new Error(errors[0]);
    }
    return rows;
  }
}

export const shipPositionService = new ShipPositionService();
