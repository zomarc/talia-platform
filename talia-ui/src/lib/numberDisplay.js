/**
 * Semantic number display for tables (presentation only).
 * Exact values stay in data / export / hover title.
 *
 * Kinds:
 * - money     → whole numbers in grid (2,251); exact on hover
 * - pct       → ≥1 decimal (89.9)
 * - count     → integers
 * - quantity  → up to 1 decimal, trim trailing zeros (guests)
 * - rate      → 2 decimals (unit rates)
 */

export const NUMBER_DISPLAY_KINDS = Object.freeze({
  money: 'money',
  pct: 'pct',
  count: 'count',
  quantity: 'quantity',
  rate: 'rate',
});

const KIND_DEFAULTS = Object.freeze({
  money: { displayMax: 0, exactMax: 2, exactMin: 2 },
  pct: { displayMax: 1, exactMax: 4, exactMin: 1 },
  count: { displayMax: 0, exactMax: 0, exactMin: 0 },
  quantity: { displayMax: 1, exactMax: 2, exactMin: 0 },
  rate: { displayMax: 2, exactMax: 4, exactMin: 2 },
});

const normalizeKind = (kind) => {
  const key = String(kind || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(KIND_DEFAULTS, key) ? key : null;
};

const toFiniteNumber = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const numeric = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatWithDigits = (numeric, { min = 0, max = 0, trim = false } = {}) => {
  let text = numeric.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
  if (trim && max > 0 && text.includes('.')) {
    text = text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  }
  return text;
};

/**
 * Compact grid display for a semantic kind.
 * @param {unknown} value
 * @param {string} kind
 * @returns {string}
 */
export const formatDisplayNumber = (value, kind) => {
  const displayKind = normalizeKind(kind);
  if (!displayKind) return value == null ? '' : String(value);
  const numeric = toFiniteNumber(value);
  if (numeric == null) return '';

  const cfg = KIND_DEFAULTS[displayKind];
  if (displayKind === 'quantity') {
    return formatWithDigits(numeric, { min: 0, max: cfg.displayMax, trim: true });
  }
  if (displayKind === 'count' || displayKind === 'money') {
    return formatWithDigits(Math.round(numeric), { min: 0, max: 0 });
  }
  return formatWithDigits(numeric, {
    min: displayKind === 'pct' ? Math.min(1, cfg.displayMax) : cfg.displayMax,
    max: cfg.displayMax,
  });
};

/**
 * Full underlying figure for hover / testing (not for dense grid cells).
 * @param {unknown} value
 * @param {string} kind
 * @returns {string}
 */
export const formatExactNumber = (value, kind) => {
  const displayKind = normalizeKind(kind);
  if (!displayKind) return value == null ? '' : String(value);
  const numeric = toFiniteNumber(value);
  if (numeric == null) return '';

  const cfg = KIND_DEFAULTS[displayKind];
  if (displayKind === 'count') {
    return formatWithDigits(Math.round(numeric), { min: 0, max: 0 });
  }
  if (displayKind === 'quantity') {
    return formatWithDigits(numeric, { min: 0, max: cfg.exactMax, trim: true });
  }
  return formatWithDigits(numeric, {
    min: cfg.exactMin,
    max: cfg.exactMax,
  });
};

/** Digits to use when formatting column-calc footers for a display kind. */
export const displayDecimalsForKind = (kind) => {
  const displayKind = normalizeKind(kind);
  if (!displayKind) return 2;
  return KIND_DEFAULTS[displayKind].displayMax;
};

const escapeHtmlAttr = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * Tabulator cell formatter: compact display + exact value in title when different.
 * @param {string} kind
 */
export const createNumberDisplayFormatter = (kind) => (cell) => {
  const raw = cell?.getValue?.();
  const display = formatDisplayNumber(raw, kind);
  if (!display) return '';
  const exact = formatExactNumber(raw, kind);
  if (!exact || exact === display) return display;
  return `<span title="${escapeHtmlAttr(exact)}">${escapeHtmlAttr(display)}</span>`;
};

/**
 * Tabulator bottomCalcFormatter using the same display kind as the column.
 * @param {string} kind
 */
export const createNumberDisplayTotalFormatter = (kind) => (cell) => {
  const raw = cell?.getValue?.();
  return formatDisplayNumber(raw, kind) || '';
};

export const isNumberDisplayKind = (kind) => Boolean(normalizeKind(kind));
