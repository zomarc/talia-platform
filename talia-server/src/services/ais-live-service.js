import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import WebSocket from 'ws';

const AIS_STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const RECONNECT_DELAY_MS = 15000;
const STALE_AFTER_MS = 5 * 60 * 1000;
// AISStream expects BoundingBoxes as [[ [latSW, lonSW], [latNE, lonNE] ], ...]
// (nested lat/lon pairs — NOT a flat [lon,lat,lon,lat] array).
const REGION_BOUNDING_BOXES = {
  med: [[[30.0, -6.0], [46.5, 36.5]]],   // Mediterranean
  gulf: [[[22.0, 46.0], [31.5, 60.0]]],  // Arabian/Persian Gulf
};

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

const normalizeRegionScope = (value) => String(value || '').trim().toLowerCase();

const normalizeShipName = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

const resolveBoundingBoxes = (scopes = []) => {
  const boxes = [];
  scopes.forEach((scope) => {
    const key = normalizeRegionScope(scope);
    const entries = REGION_BOUNDING_BOXES[key];
    if (entries) {
      entries.forEach((entry) => boxes.push(entry));
    }
  });
  return boxes;
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
    this.apiKeyOverride = null;
    this.envShipMmsiMap = {};
    this.dbShipMmsiMap = {};
    this.shipMmsiMap = {};
    this.mmsiToShipCode = {};
    this.mmsiNameIndex = new Map(); // populated from ShipStaticData messages
    this.ws = null;
    this.wsReady = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.lastKnownByShip = new Map();
    this.shipNameLookup = [];
    this.boundingBoxes = [];
    this.lastSubscriptionSignature = '';
    this.messageCount = 0;
    this.matchedMessageCount = 0;
    this.lastMessageAt = null;
    this.lastMatchedAt = null;
    this.lastError = null;
    this.lastConnectAt = null;
    this.lastDisconnectAt = null;
    this.lastCloseCode = null;
    this.lastCloseReason = null;
  }

  _rebuildMmsiIndexes() {
    this.shipMmsiMap = { ...this.envShipMmsiMap, ...this.dbShipMmsiMap };
    this.mmsiToShipCode = Object.fromEntries(
      Object.entries(this.shipMmsiMap).map(([shipCode, mmsi]) => [String(mmsi), shipCode])
    );
  }

  refreshConfig() {
    if (process.env.NODE_ENV === 'development') {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
      }
    }
    this.apiKey = process.env.AISSTREAM_API_KEY || '';
    if (this.apiKeyOverride !== null && this.apiKeyOverride !== undefined) {
      this.apiKey = this.apiKeyOverride;
    }
    this.envShipMmsiMap = parseShipMmsiMap();
    this._rebuildMmsiIndexes();
  }

  setApiKeyOverride(value) {
    this.apiKeyOverride = value ?? null;
  }

  isConfigured() {
    this.refreshConfig();
    const hasKey = Boolean(this.apiKey);
    const hasMmsi = Object.keys(this.shipMmsiMap).length > 0;
    const hasArea = Array.isArray(this.boundingBoxes) && this.boundingBoxes.length > 0;
    return hasKey && (hasMmsi || hasArea);
  }

  buildSubscription() {
    const mmsiList = Object.values(this.shipMmsiMap).filter(Boolean);
    const subscription = { APIKey: this.apiKey };
    if (this.boundingBoxes?.length) {
      // AISStream applies BoundingBoxes AND FiltersShipMMSI as an intersection.
      // When subscribing to areas we want the full firehose and do the MMSI /
      // name match client-side; otherwise moving ships outside the filter list
      // would be silenced.
      subscription.BoundingBoxes = this.boundingBoxes;
    } else if (mmsiList.length) {
      subscription.FiltersShipMMSI = mmsiList;
    }
    return subscription;
  }

  updateSubscriptionIfNeeded() {
    if (!this.wsReady || !this.ws) return;
    const subscription = this.buildSubscription();
    const signature = JSON.stringify(subscription);
    if (signature === this.lastSubscriptionSignature) return;
    this.lastSubscriptionSignature = signature;
    this.ws.send(signature);
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
      this.lastConnectAt = new Date().toISOString();
      this.lastError = null;
      this.lastCloseCode = null;
      this.lastCloseReason = null;

      const subscription = this.buildSubscription();
      const signature = JSON.stringify(subscription);
      this.lastSubscriptionSignature = signature;
      this.ws.send(signature);
      const mmsiCount = subscription.FiltersShipMMSI?.length || 0;
      const boxCount = subscription.BoundingBoxes?.length || 0;
      console.log(`[ais-live-service] Connected to AISStream for ${mmsiCount} MMSI targets, ${boxCount} area boxes`);
    });

    this.ws.on('message', (buffer) => {
      try {
        const payload = JSON.parse(buffer.toString());
        const message = payload?.Message;
        const metadata = payload?.MetaData || {};
        const nowIso = new Date().toISOString();

        // Any valid frame means the stream is alive — record it so the UI can
        // show "last message" independently of whether we matched a ship.
        this.messageCount += 1;
        this.lastMessageAt = toIsoString(metadata.time_utc) || nowIso;

        // Maintain an MMSI -> ShipName index from ShipStaticData, because
        // PositionReports rarely carry the ship name themselves.
        const metaMmsi = String(metadata.MMSI || '');
        const metaName = metadata.ShipName || metadata.shipName || metadata.NAME;
        if (metaMmsi && metaName) {
          this.mmsiNameIndex.set(metaMmsi, String(metaName).trim());
        }
        if (message?.ShipStaticData) {
          const staticMmsi = String(message.ShipStaticData.UserID || metaMmsi);
          const staticName = message.ShipStaticData.Name || message.ShipStaticData.CallSign;
          if (staticMmsi && staticName) {
            this.mmsiNameIndex.set(staticMmsi, String(staticName).trim());
          }
        }

        const position = message?.PositionReport
          || message?.StandardClassBPositionReport
          || message?.ExtendedClassBPositionReport
          || message?.BaseStationReport;
        if (!position) return;

        const mmsi = String(metadata.MMSI || position.UserID || '');
        const resolvedName = metaName || this.mmsiNameIndex.get(mmsi) || '';
        const normalizedName = normalizeShipName(resolvedName);
        const shipCode =
          (mmsi && this.mmsiToShipCode[mmsi]) ||
          this.shipNameLookup.find((entry) => (
            normalizedName &&
            (normalizedName.includes(entry.normalizedName) ||
              entry.normalizedName.includes(normalizedName))
          ))?.shipCode;
        if (!shipCode) return;

        const latitude = Number(position.Latitude);
        const longitude = Number(position.Longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const timestamp = toIsoString(metadata.time_utc) || nowIso;
        this.matchedMessageCount += 1;
        this.lastMatchedAt = timestamp;

        this.lastKnownByShip.set(shipCode, {
          shipCode,
          mmsi,
          latitude,
          longitude,
          speedKnots: Number.isFinite(Number(position.Sog)) ? Number(position.Sog) : null,
          course: Number.isFinite(Number(position.Cog)) ? Number(position.Cog) : null,
          heading: Number.isFinite(Number(position.TrueHeading)) ? Number(position.TrueHeading) : null,
          navStatus: resolvedName ? 'under_way' : 'unknown',
          timestamp
        });
      } catch (error) {
        console.warn('[ais-live-service] Failed to parse AIS message');
      }
    });

    this.ws.on('error', (error) => {
      this.wsReady = false;
      this.connecting = false;
      this.lastError = error?.message || String(error);
      this.lastDisconnectAt = new Date().toISOString();
      console.warn('[ais-live-service] WebSocket error:', error?.message || error);
      this.scheduleReconnect();
    });

    this.ws.on('close', (code, reason) => {
      this.wsReady = false;
      this.connecting = false;
      this.lastDisconnectAt = new Date().toISOString();
      this.lastCloseCode = Number.isFinite(code) ? code : null;
      this.lastCloseReason = reason ? reason.toString() : null;
      if (!this.lastError && this.lastCloseCode && this.lastCloseCode !== 1000) {
        this.lastError = `AIS websocket closed (${this.lastCloseCode})`;
      }
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
            mmsi: shipInput?.mmsi ? String(shipInput.mmsi) : null,
            regionScope: Array.isArray(shipInput?.regionScope) ? shipInput.regionScope : []
          };
        })
      : DEFAULT_SHIP_CONFIGS;

    this.shipNameLookup = shipConfigs
      .map((ship) => ({
        shipCode: ship.shipCode,
        normalizedName: normalizeShipName(ship.shipName)
      }))
      .filter((entry) => entry.normalizedName);

    // Always honour regionScope when present. This lets us track both the MMSIs
    // we know about and any other vessels that transit the same area (e.g. ships
    // in port with their AIS off, plus fleet neighbours).
    const scopesNeedingArea = new Set();
    shipConfigs.forEach((ship) => {
      (ship.regionScope || []).forEach((scope) => scopesNeedingArea.add(scope));
    });
    const boxes = resolveBoundingBoxes(Array.from(scopesNeedingArea));
    this.boundingBoxes = boxes.length ? boxes : [];

    // DB-sourced MMSIs live in a separate map so refreshConfig() (which resets
    // the env-only map) can't wipe them.
    this.dbShipMmsiMap = {};
    shipConfigs.forEach((ship) => {
      if (ship.mmsi && ship.shipCode) {
        this.dbShipMmsiMap[ship.shipCode] = ship.mmsi;
      }
    });
    this._rebuildMmsiIndexes();
    this.ensureConnected();
    this.updateSubscriptionIfNeeded();

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

  getStatus() {
    this.refreshConfig();
    const configured = this.isConfigured();
    const mmsiCount = Object.keys(this.shipMmsiMap || {}).length;
    const boxCount = Array.isArray(this.boundingBoxes) ? this.boundingBoxes.length : 0;

    return {
      configured,
      wsReady: this.wsReady,
      connecting: this.connecting,
      lastMessageAt: this.lastMessageAt,
      lastMatchedAt: this.lastMatchedAt,
      messageCount: this.messageCount,
      matchedMessageCount: this.matchedMessageCount,
      lastError: this.lastError,
      lastConnectAt: this.lastConnectAt,
      lastDisconnectAt: this.lastDisconnectAt,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason,
      mmsiCount,
      boxCount
    };
  }
}

export const aisLiveService = new AISLiveService();
