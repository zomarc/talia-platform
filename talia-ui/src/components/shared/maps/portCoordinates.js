export const PORT_COORDINATES = {
  pir: { lat: 37.942, lon: 23.646, label: 'PIR', displayName: 'Piraeus' },
  kus: { lat: 37.8619, lon: 27.2578, label: 'KUS', displayName: 'Kusadasi' },
  lav: { lat: 37.715, lon: 24.056, label: 'LAV', displayName: 'Lavrion' },
  the: { lat: 37.4467, lon: 25.3289, label: 'THE', displayName: 'Mykonos' },
  abd: { lat: 24.4539, lon: 54.3773, label: 'ABD', displayName: 'Abu Dhabi' },
  doh: { lat: 25.2854, lon: 51.531, label: 'DOH', displayName: 'Doha' },
  shr: { lat: 27.9158, lon: 34.33, label: 'SHR', displayName: 'Sharm El Sheikh' },
  jed: { lat: 21.4858, lon: 39.1925, label: 'JED', displayName: 'Jeddah' },
  saf: { lat: 26.7498, lon: 33.9389, label: 'SAF', displayName: 'Safaga' },
  mrm: { lat: 36.855, lon: 28.274, label: 'MRM', displayName: 'Marmaris' },
  ani: { lat: 36.4709, lon: 25.3769, label: 'ANI', displayName: 'Santorini' },
  lms: { lat: 34.675, lon: 33.033, label: 'LMS', displayName: 'Limassol' },
  sga: { lat: 29.9668, lon: 32.5498, label: 'SGA', displayName: 'Suez' },
  dub: { lat: 25.276987, lon: 55.296249, label: 'DUB', displayName: 'Dubai' },
  dxb: { lat: 25.2048, lon: 55.2708, label: 'DXB', displayName: 'Dubai' },
  her: { lat: 35.3387, lon: 25.1442, label: 'HER', displayName: 'Heraklion' },
  athens: { lat: 37.9838, lon: 23.7275, label: 'Athens', displayName: 'Athens' },
  piraeus: { lat: 37.942, lon: 23.646, label: 'Piraeus', displayName: 'Piraeus' },
  mykonos: { lat: 37.4467, lon: 25.3289, label: 'Mykonos', displayName: 'Mykonos' },
  kusadasi: { lat: 37.8619, lon: 27.2578, label: 'Kusadasi', displayName: 'Kusadasi' },
  patmos: { lat: 37.3084, lon: 26.5473, label: 'Patmos', displayName: 'Patmos' },
  thessaloniki: { lat: 40.6401, lon: 22.9444, label: 'Thessaloniki', displayName: 'Thessaloniki' },
  crete: { lat: 35.3387, lon: 25.1442, label: 'Crete', displayName: 'Crete' },
  santorini: { lat: 36.3932, lon: 25.4615, label: 'Santorini', displayName: 'Santorini' },
  milos: { lat: 36.6956, lon: 24.4823, label: 'Milos', displayName: 'Milos' },
  kotor: { lat: 42.4247, lon: 18.7712, label: 'Kotor', displayName: 'Kotor' },
  split: { lat: 43.5081, lon: 16.4402, label: 'Split', displayName: 'Split' },
  venice: { lat: 45.4408, lon: 12.3155, label: 'Venice', displayName: 'Venice' },
  katakolo: { lat: 37.6488, lon: 21.3185, label: 'Katakolo', displayName: 'Katakolo' },
  kefalonia: { lat: 38.1754, lon: 20.5694, label: 'Kefalonia', displayName: 'Kefalonia' },
  rhodes: { lat: 36.4341, lon: 28.2176, label: 'Rhodes', displayName: 'Rhodes' },
  portsaid: { lat: 31.2653, lon: 32.3019, label: 'Port Said', displayName: 'Port Said' },
  ashdod: { lat: 31.8014, lon: 34.6435, label: 'Ashdod', displayName: 'Ashdod' },
  haifa: { lat: 32.794, lon: 34.9896, label: 'Haifa', displayName: 'Haifa' },
  limassol: { lat: 34.7071, lon: 33.0226, label: 'Limassol', displayName: 'Limassol' },
  izmir: { lat: 38.4237, lon: 27.1428, label: 'Izmir', displayName: 'Izmir' },
  istanbul: { lat: 41.0082, lon: 28.9784, label: 'Istanbul', displayName: 'Istanbul' },
  alexandria: { lat: 31.2001, lon: 29.9187, label: 'Alexandria', displayName: 'Alexandria' },
  dubai: { lat: 25.2048, lon: 55.2708, label: 'Dubai', displayName: 'Dubai' },
  doha: { lat: 25.2854, lon: 51.531, label: 'Doha', displayName: 'Doha' },
  abudhabi: { lat: 24.4539, lon: 54.3773, label: 'Abu Dhabi', displayName: 'Abu Dhabi' },
  heraklion: { lat: 35.3387, lon: 25.1442, label: 'Heraklion', displayName: 'Heraklion' },
};

const PORT_ALIASES = {
  ath: 'athens',
  piraeusport: 'piraeus',
  kusadasiport: 'kusadasi',
  thessalonikiport: 'thessaloniki',
};

export const normalizePortKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')
  .replace(/[^a-z0-9]/g, '');

export const resolvePortCoordinate = (value) => {
  const key = normalizePortKey(value);
  if (!key) return null;
  if (PORT_COORDINATES[key]) return PORT_COORDINATES[key];
  const aliasKey = PORT_ALIASES[key];
  return aliasKey ? PORT_COORDINATES[aliasKey] || null : null;
};

