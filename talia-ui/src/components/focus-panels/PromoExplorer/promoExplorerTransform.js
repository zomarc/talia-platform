/**
 * Promo Explorer — roll published rate lines into promo-centric rows + heuristics.
 */

const asNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizePromoName = (value) => {
  const text = String(value || '').trim();
  return text || 'No Promo';
};

const daysBetween = (fromIso, toIso) => {
  if (!fromIso || !toIso) return null;
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

/**
 * @param {object[]} rateRows published_rates_current_state lines
 * @param {{
 *   selectedSailCode?: string|null,
 *   targetLfPct?: number|null,
 *   actualLfPct?: number|null,
 *   todayIso?: string,
 * }} [options]
 */
export const buildPromoExplorerRows = (rateRows = [], options = {}) => {
  const selectedSailCode = String(options.selectedSailCode || '').trim();
  const todayIso = options.todayIso || new Date().toISOString().slice(0, 10);
  const buckets = new Map();

  (rateRows || []).forEach((row) => {
    const promoName = normalizePromoName(row.promo_name || row.PROMO_NAME);
    const sailCode = String(row.sail_code || row.SAIL_CODE || '').trim();
    if (!sailCode) return;
    const key = promoName;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        promo_name: promoName,
        promo_type: String(row.promo_type || row.PROMO_TYPE || '').trim(),
        rate_types: new Set(),
        sail_codes: new Set(),
        cabin_categories: new Set(),
        fares: [],
        discounts: [],
        departure_dates: [],
        line_count: 0,
        on_selected_sail: false,
      };
      buckets.set(key, bucket);
    }

    bucket.line_count += 1;
    bucket.sail_codes.add(sailCode);
    if (selectedSailCode && sailCode === selectedSailCode) bucket.on_selected_sail = true;
    const rateType = String(row.rate_type || row.RATE_TYPE || '').trim();
    if (rateType) bucket.rate_types.add(rateType);
    const cabin = String(row.cabin_category || row.CABIN_CATEGORY || '').trim();
    if (cabin) bucket.cabin_categories.add(cabin);
    const fare = asNum(row.fare_per_person ?? row.FARE_PER_PERSON);
    if (fare != null) bucket.fares.push(fare);
    const discount = asNum(row.discount ?? row.DISCOUNT);
    if (discount != null) bucket.discounts.push(discount);
    const dep = row.departure_date || row.DEPARTURE_DATE;
    if (dep) bucket.departure_dates.push(String(dep).slice(0, 10));
    if (!bucket.promo_type) {
      bucket.promo_type = String(row.promo_type || row.PROMO_TYPE || '').trim();
    }
  });

  // Baseline fare for selected sail: median of "No Promo" or highest band without promo name.
  const baselineFares = [];
  (rateRows || []).forEach((row) => {
    const sailCode = String(row.sail_code || row.SAIL_CODE || '').trim();
    if (selectedSailCode && sailCode !== selectedSailCode) return;
    const promoName = normalizePromoName(row.promo_name || row.PROMO_NAME);
    if (promoName !== 'No Promo') return;
    const fare = asNum(row.fare_per_person ?? row.FARE_PER_PERSON);
    if (fare != null) baselineFares.push(fare);
  });
  baselineFares.sort((a, b) => a - b);
  const baseline = baselineFares.length
    ? baselineFares[Math.floor(baselineFares.length / 2)]
    : null;

  const actualLf = asNum(options.actualLfPct);
  const targetLf = asNum(options.targetLfPct);
  const aheadOfTarget = actualLf != null && targetLf != null && actualLf >= targetLf;

  const rows = [];
  buckets.forEach((bucket) => {
    const isNoPromo = bucket.promo_name === 'No Promo';
    const minFare = bucket.fares.length ? Math.min(...bucket.fares) : null;
    const maxFare = bucket.fares.length ? Math.max(...bucket.fares) : null;
    const maxDiscount = bucket.discounts.length ? Math.max(...bucket.discounts) : null;
    const relatedSails = [...bucket.sail_codes].sort();
    const activeOnSail = Boolean(selectedSailCode && bucket.on_selected_sail);

    const flags = [];
    if (!isNoPromo && baseline != null && minFare != null && minFare < baseline * 0.75) {
      flags.push('deep_discount');
    }
    if (!isNoPromo && bucket.cabin_categories.size >= 1 && bucket.rate_types.size >= 3) {
      flags.push('stacked_bands');
    }
    const nearestDep = bucket.departure_dates.sort()[0] || null;
    const dts = daysBetween(todayIso, nearestDep);
    if (!isNoPromo && aheadOfTarget && dts != null && dts <= 45 && activeOnSail) {
      flags.push('late_while_ahead');
    }

    const status = isNoPromo
      ? 'Baseline'
      : activeOnSail
        ? (flags.length ? 'Flagged' : 'Active')
        : 'Related';

    // "Worked before" v1: promo appears on multiple sails in the window.
    const workedBefore = !isNoPromo && relatedSails.length >= 2;

    rows.push({
      promo_key: bucket.promo_name,
      promo_name: bucket.promo_name,
      promo_type: bucket.promo_type || '—',
      rate_types: [...bucket.rate_types].join(', '),
      cabin_categories: [...bucket.cabin_categories].sort().join(', '),
      cabin_count: bucket.cabin_categories.size,
      sail_count: relatedSails.length,
      related_sails: relatedSails,
      line_count: bucket.line_count,
      min_fare: minFare,
      max_fare: maxFare,
      max_discount: maxDiscount,
      baseline_fare: baseline,
      status,
      active_on_sail: activeOnSail,
      worked_before: workedBefore,
      detrimental: flags.length > 0,
      flags,
      flag_reason: flags.map((flag) => {
        if (flag === 'deep_discount') return 'Fare well below non-promo baseline';
        if (flag === 'stacked_bands') return 'Many rate bands under one promo';
        if (flag === 'late_while_ahead') return 'Active late while LF ahead of target';
        return flag;
      }).join(' · '),
      days_to_sail: dts,
    });
  });

  return rows
    .filter((row) => row.promo_name !== 'No Promo' || row.active_on_sail)
    .sort((a, b) => {
      if (a.detrimental !== b.detrimental) return a.detrimental ? -1 : 1;
      if (a.active_on_sail !== b.active_on_sail) return a.active_on_sail ? -1 : 1;
      return String(a.promo_name).localeCompare(String(b.promo_name));
    });
};

export const buildPromoExplorerSnapshot = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const active = list.filter((row) => row.active_on_sail && row.promo_name !== 'No Promo');
  const flagged = list.filter((row) => row.detrimental);
  const worked = list.filter((row) => row.worked_before);
  return {
    promo_count: list.filter((row) => row.promo_name !== 'No Promo').length,
    active_count: active.length,
    flagged_count: flagged.length,
    worked_before_count: worked.length,
  };
};

export default {
  buildPromoExplorerRows,
  buildPromoExplorerSnapshot,
};
