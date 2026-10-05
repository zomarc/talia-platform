/**
 * Cruise, Celestyal, airport, and region flags for port_city.
 * Street addresses are kept only for primary Celestyal ports.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cruiseLocodes = new Set(
  JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'cruise-port-locodes.json'), 'utf8'))
    .map((code) => String(code).toUpperCase())
);

/** Embark and regular call ports. Addresses are sourced, not guessed. */
export const CELESTYAL_PORTS = {
  TRKUS: {
    label: 'Kusadasi, Turkey',
    address: 'Kusadasi - Aydin 09400, Ege Ports Guvercinada Caddesi No:2',
  },
  GRPIR: {
    label: 'Piraeus, Greece',
    address: '10 Akti Miaouli, 185 38 Piraeus, Greece',
  },
  GRLAV: {
    label: 'Lavrio, Greece',
    address: 'Passenger terminal, Akti Papandreou Andrea, Lavrio Port, 19500 Lavrio, Greece',
  },
  AEAUH: {
    label: 'Abu Dhabi, United Arab Emirates',
    address: 'Abu Dhabi Cruise Terminal, Zayed Port, Abu Dhabi',
  },
  AEDXB: {
    label: 'Dubai, United Arab Emirates',
    address: 'Mina Rashid Cruise Terminal, Port Rashid, P.O. Box 17000, Dubai',
  },
  QADOH: { label: 'Doha, Qatar' },
  PTLIS: { label: 'Lisbon, Portugal' },
  ESTAR: { label: 'Tarragona, Spain' },
  GRHER: {
    label: 'Heraklion, Greece',
    address: 'Cruise Passenger Terminal, Pier IV-V, Port of Heraklion, 71110 Heraklion, Greece',
  },
  GRJMK: {
    label: 'Mykonos, Greece',
    address: 'Mykonos New Port, Tourlos. If the ship anchors, the tender lands at the Old Port.',
  },
  GRJTR: {
    displayName: 'Santorini',
    label: 'Santorini, Greece',
    address: 'Tender to the Old Port (Skala), below Fira. Athinios is the ferry harbour, not the usual cruise landing.',
  },
  EGSSH: { label: 'Sharm El Sheikh, Egypt' },
  EGSGA: { label: 'Safaga, Egypt' },
  SAJED: { label: 'Jeddah, Saudi Arabia' },
  CYLMS: {
    label: 'Limassol, Cyprus',
    address: 'Cruise terminal, North Quay, Port of Limassol, 3840 Limassol, Cyprus',
  },
  TRIST: {
    label: 'Istanbul, Turkey',
    address: 'Galataport, Meclis-i Mebusan Caddesi No. 8, 34433 Beyoglu, Istanbul',
  },
  TRMRM: { label: 'Marmaris, Turkey' },
  GRRHO: {
    label: 'Rhodes, Greece',
    address: 'Tourist Port of Rhodes, 85100 Rhodes, Greece',
  },
  GRCFU: {
    label: 'Corfu, Greece',
    address: 'Corfu New Port passenger terminal, Ethnikis Antistaseos, 49100 Kerkyra, Greece',
  },
  GRKAK: {
    label: 'Katakolon, Greece',
    address: 'Cruise quay, Port of Katakolon, 27067 Katakolon, Greece',
  },
  GRPMS: {
    displayName: 'Patmos',
    label: 'Patmos, Greece',
    address: 'Tender to Skala harbour, Patmos.',
  },
  GRMLO: {
    label: 'Milos, Greece',
    address: 'Port of Adamas, Milos.',
  },
};

export const PORT_REGIONS = [
  'Mediterranean',
  'Arabian & Red Sea',
  'United States',
  'Caribbean',
  'Northern Europe',
  'Rest of World',
];

/** UN/LOCODE function mask: position 4 is Airport. */
export const isAirportCode = (functionCode) => String(functionCode || '').charAt(3) === '4';

const inBox = (lat, lon, south, north, west, east) => (
  lat >= south && lat <= north && lon >= west && lon <= east
);

/**
 * Commercial areas for the port list. Mediterranean includes the Adriatic,
 * Aegean, and Black Sea. Arabian & Red Sea is split from Egypt's north coast
 * so Sharm and the Gulf are not filed under the Mediterranean.
 */
export const regionFor = ({ latitude, longitude, countryCode, country_code: countryCodeSnake } = {}) => {
  const cc = String(countryCode || countryCodeSnake || '').trim().toUpperCase();
  if (cc === 'US') return 'United States';
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Rest of World';
  const westOfBiscay = lon < -2 && lat > 42;
  const mediterranean = !westOfBiscay && (
    inBox(lat, lon, 30, 46.5, -10, 20)
    || inBox(lat, lon, 30, 42, 20, 36.5)
    || inBox(lat, lon, 40.5, 47.5, 27, 42)
  );
  if (mediterranean) return 'Mediterranean';
  if (inBox(lat, lon, 12, 30, 32, 45) || inBox(lat, lon, 22, 31.5, 47, 60)) {
    return 'Arabian & Red Sea';
  }
  if (inBox(lat, lon, 9, 27, -90, -59)) return 'Caribbean';
  if (lat >= 49 && lon >= -15 && lon <= 32) return 'Northern Europe';
  return 'Rest of World';
};

const profileScore = (row) => (
  (row.port_address ? 4 : 0)
  + (row.latitude != null ? 2 : 0)
  + (row.port_name ? 1 : 0)
);

/** Warehouse repeats the same UN/LOCODE. Keep one row per location code. */
export function dedupePortCityRows(rows) {
  const byLocation = new Map();
  rows.forEach((row) => {
    const key = String(row.country_location || '').trim().toUpperCase();
    if (!key) return;
    const existing = byLocation.get(key);
    if (!existing || profileScore(row) > profileScore(existing)) byLocation.set(key, row);
  });
  return [...byLocation.values()];
}

export function applyPortCityProfile(rows) {
  const profiled = rows.map((row) => {
    const loc = String(row.country_location || '').trim().toUpperCase();
    const celestyal = CELESTYAL_PORTS[loc] || null;
    return {
      ...row,
      wpi: row.wpi || null,
      is_cruise: cruiseLocodes.has(loc) || Boolean(celestyal),
      is_airport: isAirportCode(row.function_code),
      is_celestyal: Boolean(celestyal),
      region: regionFor(row),
      port_address: celestyal?.address || null,
      address_label: celestyal?.label || null,
      port_name: row.port_name || celestyal?.displayName || null,
    };
  });
  return dedupePortCityRows(profiled);
}
