/**
 * Parse UN/LOCODE compact coordinates (DDMMH DDDMMH) and label each
 * location with the nearest Dim_Port_City row whose function is Port.
 *
 * Synapse stores Port_Name as varchar and replaced accented letters with "?".
 * unlocode-display-names.json is the official UNECE name for those codes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let officialNames = null;

const loadOfficialNames = () => {
  if (officialNames) return officialNames;
  const file = join(dirname(fileURLToPath(import.meta.url)), 'unlocode-display-names.json');
  officialNames = JSON.parse(readFileSync(file, 'utf8'));
  return officialNames;
};

export function restoreDisplayName(row, lookup = null) {
  const names = lookup || loadOfficialNames();
  const key = String(row?.country_location || '').trim().toUpperCase();
  const official = key ? names[key] : null;
  const current = String(row.port_name || '');
  const ascii = String(row.name_wo_diacritics || '');
  if (official && (current.includes('?') || (ascii && current === ascii))) {
    return { ...row, port_name: official };
  }

  let portName = current;
  if (!row.location_code && COUNTRY_LABELS[key] && portName.includes('?')) {
    portName = COUNTRY_LABELS[key];
  } else if (portName.includes('?') && ascii && !ascii.includes('?')) {
    portName = WELL_KNOWN[ascii] || ascii;
  } else if (portName.endsWith('?') && ascii === portName) {
    portName = portName.slice(0, -1);
  }

  if (portName === current) return row;
  return { ...row, port_name: portName };
}

const COUNTRY_LABELS = {
  AX: 'Åland Islands',
  BL: 'Saint Barthélemy',
  CI: "Côte d'Ivoire",
  CW: 'Curaçao',
  RE: 'Réunion',
  TR: 'Türkiye',
};

const WELL_KNOWN = {
  'Three Rivers = Trois-Rivieres': 'Three Rivers = Trois-Rivières',
  'Geneva = Geneve': 'Geneva = Genève',
  'Cologne = Koln': 'Cologne = Köln',
  'Munich = Munchen': 'Munich = München',
  'Frankfurt-Hochst': 'Frankfurt-Höchst',
  'Arhus = Aarhus': 'Århus = Aarhus',
  'Copenhagen = Kobenhavn': 'Copenhagen = København',
  'Pointe-a-Pitre': 'Pointe-à-Pitre',
  'Athens = Athinai': 'Athens = Athínai',
  'Gothenburg = Goteborg': 'Gothenburg = Göteborg',
  Buk: 'Bük',
};

const NM_PER_DEGREE_LAT = 60;

export function parseLatitudeLongitude(raw) {
  const text = String(raw || '').trim().toUpperCase();
  const match = text.match(/^(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])$/);
  if (!match) return null;
  const latDeg = Number(match[1]);
  const latMin = Number(match[2]);
  const lonDeg = Number(match[4]);
  const lonMin = Number(match[5]);
  if (latMin >= 60 || lonMin >= 60 || latDeg > 90 || lonDeg > 180) return null;
  let latitude = latDeg + latMin / 60;
  let longitude = lonDeg + lonMin / 60;
  if (match[3] === 'S') latitude = -latitude;
  if (match[6] === 'W') longitude = -longitude;
  return {
    latitude: Math.round(latitude * 1e6) / 1e6,
    longitude: Math.round(longitude * 1e6) / 1e6,
  };
}

export function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const earthNm = 3440.065;
  return 2 * earthNm * Math.asin(Math.min(1, Math.sqrt(a)));
}

const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

const cellKey = (latCell, lonCell) => `${latCell}:${wrapLon(lonCell)}`;

const minNmOutsideSquare = (lat, lon, latCell, lonCell, radius) => {
  const latGap = Math.min(lat - (latCell - radius), (latCell + radius + 1) - lat);
  const west = lon - wrapLon(lonCell - radius);
  const east = wrapLon(lonCell + radius + 1) - lon;
  const lonGap = Math.min(Math.abs(west), Math.abs(east));
  const lonNm = lonGap * NM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const latNm = latGap * NM_PER_DEGREE_LAT;
  return Math.max(0, Math.min(latNm, lonNm));
};

let ngaPorts = null;

const loadNgaPorts = () => {
  if (ngaPorts) return ngaPorts;
  const file = join(dirname(fileURLToPath(import.meta.url)), 'nga-wpi-ports.json');
  ngaPorts = JSON.parse(readFileSync(file, 'utf8'));
  return ngaPorts;
};

/**
 * Names come from the NGA World Port Index (Pub 150), not the warehouse.
 * A location code that NGA lists uses that Main Port Name. Every coordinate
 * is also labeled with the geographically nearest NGA port.
 */
export function applyNgaNames(rows, ports = null) {
  const source = ports || loadNgaPorts();
  const gazetteer = source.map((port) => ({
    country_location: port.unlocode || `WPI${port.wpi}`,
    port_name: port.name,
    latitude: port.lat,
    longitude: port.lon,
    wpi: String(port.wpi),
    unlocode: port.unlocode || '',
  }));
  const byLocode = new Map(
    gazetteer.filter((port) => port.unlocode).map((port) => [port.unlocode, port])
  );
  const labeled = labelNearestPorts(rows, gazetteer);
  return labeled.map((row) => {
    const matched = byLocode.get(String(row.country_location || '').trim().toUpperCase());
    const nearEnough = row.nearest_distance_nm != null && row.nearest_distance_nm <= 5;
    const ngaName = matched?.port_name || (nearEnough ? row.nearest_port_name : null);
    return {
      ...row,
      port_name: ngaName,
      wpi: matched?.wpi || null,
      latitude: row.latitude ?? matched?.latitude ?? null,
      longitude: row.longitude ?? matched?.longitude ?? null,
    };
  });
}

/**
 * @param {Array<{ country_location: string, function_name?: string, latitude?: number|null, longitude?: number|null, port_name?: string, wpi?: string }>} rows
 * @param {Array|null} gazetteer Ports to search. Defaults to rows whose function is Port.
 */
export function labelNearestPorts(rows, gazetteer = null) {
  const ports = gazetteer || rows.filter((row) => (
    row.function_name === 'Port' && row.latitude != null && row.longitude != null
  ));
  const grid = new Map();
  ports.forEach((row) => {
    if (row.latitude == null || row.longitude == null) return;
    const latCell = Math.floor(row.latitude);
    const lonCell = Math.floor(wrapLon(row.longitude));
    const key = cellKey(latCell, lonCell);
    const bucket = grid.get(key);
    if (bucket) bucket.push(row);
    else grid.set(key, [row]);
  });

  return rows.map((row) => {
    if (row.latitude == null || row.longitude == null) {
      return {
        ...row,
        nearest_port_code: null,
        nearest_port_name: null,
        nearest_distance_nm: null,
      };
    }

    const latCell = Math.floor(row.latitude);
    const lonCell = Math.floor(wrapLon(row.longitude));
    let best = null;
    let bestD = Infinity;

    for (let radius = 0; radius <= 40; radius += 1) {
      for (let dLat = -radius; dLat <= radius; dLat += 1) {
        for (let dLon = -radius; dLon <= radius; dLon += 1) {
          if (radius > 0 && Math.abs(dLat) !== radius && Math.abs(dLon) !== radius) continue;
          const bucket = grid.get(cellKey(latCell + dLat, lonCell + dLon));
          if (!bucket) continue;
          bucket.forEach((port) => {
            const distance = haversineNm(row.latitude, row.longitude, port.latitude, port.longitude);
            const closer = distance < bestD - 1e-6;
            const sameSpotPrefersSelf = Math.abs(distance - bestD) <= 1e-6
              && port.country_location === row.country_location;
            if (closer || sameSpotPrefersSelf) {
              bestD = distance;
              best = port;
            }
          });
        }
      }
      if (best && bestD <= minNmOutsideSquare(row.latitude, row.longitude, latCell, lonCell, radius)) {
        break;
      }
    }

    return {
      ...row,
      nearest_port_code: best?.wpi || best?.country_location || null,
      nearest_port_name: best?.port_name || null,
      nearest_distance_nm: best ? Math.round(bestD * 10) / 10 : null,
    };
  });
}
