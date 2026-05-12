export const GLOBAL_DATE_RANGE_OPTIONS = [
  { key: 'all_available', label: 'All available' },
  { key: '+30d', label: '+30d' },
  { key: '+60d', label: '+60d' },
  { key: '+120d', label: '+120d' },
  { key: '+6m', label: '+6m' },
  { key: 'all_future', label: 'All future' },
  { key: '-30d', label: '-30d' },
  { key: '-60d', label: '-60d' },
  { key: '-120d', label: '-120d' },
  { key: '-6m', label: '-6m' },
  { key: 'all_past', label: 'All past' },
];

const LEGACY_RANGE_KEY_MAP = {
  all: 'all_available',
  '30d': '-30d',
  '60d': '-60d',
  '120d': '-120d',
  '6m': '-6m',
};

const toIsoDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const parseSignedRangeKey = (rangeKey) => {
  const raw = String(rangeKey || '').trim().toLowerCase();
  const match = raw.match(/^([+-])(\d+)([dm])$/);
  if (!match) return null;
  const amount = Number.parseInt(match[2], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    sign: match[1],
    amount,
    unit: match[3],
  };
};

export const normalizeGlobalDateRangeKey = (rangeKey) => {
  const raw = String(rangeKey || '').trim();
  const legacyMapped = LEGACY_RANGE_KEY_MAP[raw];
  const normalized = legacyMapped || raw;
  if (GLOBAL_DATE_RANGE_OPTIONS.some((option) => option.key === normalized)) {
    return normalized;
  }
  return 'all_available';
};

export const resolveGlobalDateRange = (rangeKey, nowInput = new Date()) => {
  const normalizedRangeKey = normalizeGlobalDateRangeKey(rangeKey);
  const now = nowInput instanceof Date ? new Date(nowInput) : new Date();

  if (normalizedRangeKey === 'all_available') {
    return {
      rangeKey: normalizedRangeKey,
      rangeMode: 'all',
      includeInProgress: false,
      dateFrom: '',
      dateTo: '',
    };
  }

  if (normalizedRangeKey === 'all_future') {
    return {
      rangeKey: normalizedRangeKey,
      rangeMode: 'future',
      includeInProgress: true,
      dateFrom: toIsoDate(now),
      dateTo: '',
    };
  }

  if (normalizedRangeKey === 'all_past') {
    return {
      rangeKey: normalizedRangeKey,
      rangeMode: 'past',
      includeInProgress: false,
      dateFrom: '',
      dateTo: toIsoDate(now),
    };
  }

  const parsed = parseSignedRangeKey(normalizedRangeKey) || parseSignedRangeKey('+30d');
  const dateFrom = new Date(now);
  const dateTo = new Date(now);

  if (parsed.sign === '+') {
    if (parsed.unit === 'm') dateTo.setMonth(dateTo.getMonth() + parsed.amount);
    else dateTo.setDate(dateTo.getDate() + parsed.amount);
  } else if (parsed.unit === 'm') {
    dateFrom.setMonth(dateFrom.getMonth() - parsed.amount);
  } else {
    dateFrom.setDate(dateFrom.getDate() - parsed.amount);
  }

  return {
    rangeKey: normalizedRangeKey,
    rangeMode: parsed.sign === '+' ? 'future' : 'past',
    includeInProgress: parsed.sign === '+',
    dateFrom: toIsoDate(dateFrom),
    dateTo: toIsoDate(dateTo),
  };
};
