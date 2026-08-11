/**
 * Global departure-month criteria (orthogonal to relative Date range).
 * Month = calendar month of sailing departure (sail_date_from), matching MSE nested groups.
 */

export const ALL_DEPARTURE_MONTH_KEY = 'all';

/** Default horizon aligned with Synapse sail window. */
export const DEFAULT_DEPARTURE_MONTH_FROM = '2025-09';
export const DEFAULT_DEPARTURE_MONTH_TO = '2027-12';

const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

const pad2 = (n) => String(n).padStart(2, '0');

export const toDepartureMonthKey = (value) => {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (MONTH_KEY_RE.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 7);
  const date = value instanceof Date ? value : new Date(text);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
};

export const normalizeGlobalDepartureMonth = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'all_months') return ALL_DEPARTURE_MONTH_KEY;
  const key = toDepartureMonthKey(value);
  return key || ALL_DEPARTURE_MONTH_KEY;
};

export const formatDepartureMonthLabel = (monthKey, fallback = '') => {
  const key = toDepartureMonthKey(monthKey);
  if (!key) return fallback;
  const [, year, month] = key.match(MONTH_KEY_RE) || [];
  if (!year || !month) return fallback;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const mon = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${mon} ${String(year).slice(-2)}`;
};

/**
 * Calendar bounds for a departure month (UTC date-only strings).
 * @returns {{ dateFrom: string, dateTo: string } | null}
 */
export const resolveDepartureMonthBounds = (monthKey) => {
  const key = normalizeGlobalDepartureMonth(monthKey);
  if (key === ALL_DEPARTURE_MONTH_KEY) return null;
  const match = key.match(MONTH_KEY_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: `${year}-${pad2(month)}-01`,
    dateTo: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
};

/**
 * Build selectable months from fromKey..toKey inclusive (YYYY-MM).
 */
export const buildGlobalDepartureMonthOptions = ({
  fromKey = DEFAULT_DEPARTURE_MONTH_FROM,
  toKey = DEFAULT_DEPARTURE_MONTH_TO,
} = {}) => {
  const from = toDepartureMonthKey(fromKey) || DEFAULT_DEPARTURE_MONTH_FROM;
  const to = toDepartureMonthKey(toKey) || DEFAULT_DEPARTURE_MONTH_TO;
  const options = [{ key: ALL_DEPARTURE_MONTH_KEY, label: 'All months' }];

  let [y, m] = from.split('-').map(Number);
  const [toY, toM] = to.split('-').map(Number);
  while (y < toY || (y === toY && m <= toM)) {
    const key = `${y}-${pad2(m)}`;
    options.push({ key, label: formatDepartureMonthLabel(key, key) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return options;
};

export const GLOBAL_DEPARTURE_MONTH_OPTIONS = buildGlobalDepartureMonthOptions();

const monthOverlapsDateWindow = (monthKey, dateFrom, dateTo) => {
  const bounds = resolveDepartureMonthBounds(monthKey);
  if (!bounds) return true;
  if (dateFrom && bounds.dateTo < dateFrom) return false;
  if (dateTo && bounds.dateFrom > dateTo) return false;
  return true;
};

/**
 * Month options limited to the active global Date window ∩ sail horizon.
 * Always keeps "All months". Empty dateFrom/dateTo means open-ended on that side.
 *
 * @param {{ dateFrom?: string, dateTo?: string } | null} dateWindow
 * @param {Array<{ key: string, label: string }>} [allOptions]
 */
export const filterDepartureMonthOptionsForDateWindow = (
  dateWindow,
  allOptions = GLOBAL_DEPARTURE_MONTH_OPTIONS
) => {
  const dateFrom = typeof dateWindow?.dateFrom === 'string' && dateWindow.dateFrom
    ? dateWindow.dateFrom.slice(0, 10)
    : '';
  const dateTo = typeof dateWindow?.dateTo === 'string' && dateWindow.dateTo
    ? dateWindow.dateTo.slice(0, 10)
    : '';

  // No window bounds → full horizon list.
  if (!dateFrom && !dateTo) return allOptions;

  return allOptions.filter((option) => {
    if (option.key === ALL_DEPARTURE_MONTH_KEY) return true;
    return monthOverlapsDateWindow(option.key, dateFrom, dateTo);
  });
};

export const rowMatchesDepartureMonth = (row, monthKey) => {
  const key = normalizeGlobalDepartureMonth(monthKey);
  if (key === ALL_DEPARTURE_MONTH_KEY) return true;
  if (!row || typeof row !== 'object') return true;
  const candidates = [
    row.sail_date_from,
    row.sail_date,
    row.departure_date,
    row.master_voyage_departure_date,
    row.start_date,
  ];
  for (const value of candidates) {
    const rowMonth = toDepartureMonthKey(value);
    if (rowMonth) return rowMonth === key;
  }
  // No recognized departure date — do not drop non-date datasets.
  return true;
};
