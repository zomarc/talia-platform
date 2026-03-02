import WebSocket from 'ws';

const AIS_STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const RECONNECT_DELAY_MS = 15000;
const STALE_AFTER_MS = 5 * 60 * 1000;

const DEFAULT_SHIP_CONFIGS = [
  { shipCode: 'DIS', shipName: 'Celestyal Discovery' },
  { shipCode: 'JRN', shipName: 'Celestyal Journey' }
];

const SHIP_CODE_ALIASES = {
  CD: 'DIS',
  CJ: 'JRN',
  DISCOVERY: 'DIS',
  JOURNEY: 'JRN'
};

const parseShipMmsiMap = () => {
  const jsonMap = process.env.AIS_SHIP_MMSI_MAP;
  if (jsonMap) {
    try {
      const parsed = JSON.parse(jsonMap);
      return Object.fromEntries(
        Object.entries(parsed).map(([shipCode, mmsi]) => [String(shipCode).toUpperCase(), String(mmsi)])
      );
    } catch (error) {
      console.warn('[ais-live-service] Invalid AIS_SHIP_MMSI_MAP JSON');
    }
  }

  const mapping = {};
  if (process.env.AIS_MMSI_DISCOVERY) mapping.DIS = String(process.env.AIS_MMSI_DISCOVERY);
  if (process.env.AIS_MMSI_JOURNEY) mapping.JRN = String(process.env.AIS_MMSI_JOURNEY);
  return mapping;
};

const toIsoString = (value) => {
  try {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
  } catch {
    return null;
  }
};

class AISLiveService {
  constructor() {
    this.apiKey = '';
    this.shipMmsiMap = {};
    this.mmsiToShipCode = {};
    this.ws = null;
    this.wsReady = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.lastKnownByShip = new Map();
  }

  refreshConfig() {
    this.apiKey = process.env.AISSTREAM_API_KEY || '';
    this.shipMmsiMap = parseShipMmsiMap();
    this.mmsiToShipCode = Object.fromEntries(
      Object.entries(this.shipMmsiMap).map(([shipCode, mmsi]) => [String(mmsi), shipCode])
    );
  }

  isConfigured() {
    this.refreshConfig();
    const hasKey = Boolean(this.apiKey);
    const hasMmsi = Object.keys(this.shipMmsiMap).length > 0;
    return hasKey && hasMmsi;
  }

  ensureConnected() {
    this.refreshConfig();
    if (!this.isConfigured()) return;
    if (this.wsReady || this.connecting) return;

    this.connecting = true;
    this.ws = new WebSocket(AIS_STREAM_URL);

    this.ws.on('open', () => {
      this.connecting = false;
      this.wsReady = true;

      const mmsiList = Object.values(this.shipMmsiMap).filter(Boolean);
      const subscription = {
        APIKey: this.apiKey,
        FiltersShipMMSI: mmsiList
      };
      this.ws.send(JSON.stringify(subscription));
      console.log(`[ais-live-service] Connected to AISStream for ${mmsiList.length} MMSI targets`);
    });

    this.ws.on('message', (buffer) => {
      try {
        const payload = JSON.parse(buffer.toString());
        const message = payload?.Message;
        const position = message?.PositionReport || message?.StandardClassBPositionReport || message?.BaseStationReport;
        const metadata = payload?.MetaData || {};
        if (!position) return;

        const mmsi = String(metadata.MMSI || position.UserID || '');
        if (!mmsi) return;
        const shipCode = this.mmsiToShipCode[mmsi];
        if (!shipCode) return;

        const latitude = Number(position.Latitude);
        const longitude = Number(position.Longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const timestamp = toIsoString(metadata.time_utc) || new Date().toISOString();

        this.lastKnownByShip.set(shipCode, {
          shipCode,
          mmsi,
          latitude,
          longitude,
          speedKnots: Number.isFinite(Number(position.Sog)) ? Number(position.Sog) : null,
          course: Number.isFinite(Number(position.Cog)) ? Number(position.Cog) : null,
          heading: Number.isFinite(Number(position.TrueHeading)) ? Number(position.TrueHeading) : null,
          navStatus: metadata?.ShipName ? 'under_way' : 'unknown',
          timestamp
        });
      } catch (error) {
        console.warn('[ais-live-service] Failed to parse AIS message');
      }
    });

    this.ws.on('error', (error) => {
      this.wsReady = false;
      this.connecting = false;
      console.warn('[ais-live-service] WebSocket error:', error?.message || error);
      this.scheduleReconnect();
    });

    this.ws.on('close', () => {
      this.wsReady = false;
      this.connecting = false;
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, RECONNECT_DELAY_MS);
  }

  getLiveShipPositions(requestedShipCodes = []) {
    this.refreshConfig();

    const normalizeShipCode = (value) => {
      const upper = String(value || '').toUpperCase();
      return SHIP_CODE_ALIASES[upper] || upper;
    };

    const nowMs = Date.now();
    const shipConfigs = requestedShipCodes.length
      ? requestedShipCodes.map((shipInput) => {
          const inputCode = typeof shipInput === 'string' ? shipInput : shipInput?.shipCode;
          const canonicalCode = normalizeShipCode(inputCode);
          return {
            shipCode: canonicalCode,
            shipName:
              shipInput?.shipName ||
              (canonicalCode === 'DIS'
                ? 'Celestyal Discovery'
                : canonicalCode === 'JRN'
                  ? 'Celestyal Journey'
                  : canonicalCode),
            mmsi: shipInput?.mmsi ? String(shipInput.mmsi) : null
          };
        })
      : DEFAULT_SHIP_CONFIGS;

    // Merge MMSI overrides (e.g. inventory_item canonical mapping) before connecting.
    shipConfigs.forEach((ship) => {
      if (ship.mmsi && ship.shipCode) {
        this.shipMmsiMap[ship.shipCode] = ship.mmsi;
      }
    });
    this.mmsiToShipCode = Object.fromEntries(
      Object.entries(this.shipMmsiMap).map(([shipCode, mmsi]) => [String(mmsi), shipCode])
    );
    this.ensureConnected();

    return shipConfigs.map((ship) => {
      const shipCode = normalizeShipCode(ship.shipCode);
      const known = this.lastKnownByShip.get(shipCode);
      if (!known) {
        return {
          shipCode,
          shipName: ship.shipName,
          mmsi: this.shipMmsiMap[shipCode] || null,
          latitude: null,
          longitude: null,
          speedKnots: null,
          course: null,
          heading: null,
          navStatus: 'no_signal',
          timestamp: null,
          source: this.isConfigured() ? 'aisstream' : 'not_configured',
          freshnessSeconds: null,
          isLive: false
        };
      }

      const updatedMs = new Date(known.timestamp).getTime();
      const freshnessSeconds = Number.isFinite(updatedMs)
        ? Math.max(0, Math.floor((nowMs - updatedMs) / 1000))
        : null;
      const isFresh = freshnessSeconds !== null && freshnessSeconds * 1000 <= STALE_AFTER_MS;

      return {
        shipCode,
        shipName: ship.shipName,
        mmsi: known.mmsi,
        latitude: known.latitude,
        longitude: known.longitude,
        speedKnots: known.speedKnots,
        course: known.course,
        heading: known.heading,
        navStatus: known.navStatus,
        timestamp: known.timestamp,
        source: 'aisstream',
        freshnessSeconds,
        isLive: isFresh
      };
    });
  }
}

export const aisLiveService = new AISLiveService();
