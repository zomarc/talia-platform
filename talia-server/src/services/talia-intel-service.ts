import { getExternalFeedContracts } from '../config/external-feed-contracts.js';

const WEEK_LABEL_REGEX = /^W-(\d+)$/i;

const toInt = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const normalizeWeekLabel = (raw: any) => {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.toLowerCase() === 'sail') return 'Sail';
  const match = value.match(WEEK_LABEL_REGEX);
  if (!match) return value;
  return `W-${Number(match[1])}`;
};

const weekSortValue = (label: string | null) => {
  if (!label) return -1;
  if (label === 'Sail') return 10_000;
  const match = label.match(WEEK_LABEL_REGEX);
  return match ? Number(match[1]) : -1;
};

const safeIso = (value: any) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const inferRepresentativePriorYearCode = async (supabaseDataService: any, sailCode: string, profile: any) => {
  if (!sailCode || !profile?.sailDate || !profile?.shipCode) return null;
  try {
    const currentDate = new Date(profile.sailDate);
    if (Number.isNaN(currentDate.getTime())) return null;
    const from = new Date(currentDate);
    from.setFullYear(from.getFullYear() - 1);
    from.setDate(from.getDate() - 14);
    const to = new Date(currentDate);
    to.setFullYear(to.getFullYear() - 1);
    to.setDate(to.getDate() + 14);

    const { data } = await supabaseDataService.client
      .from('master_sail')
      .select('sail_code,sail_days,sail_date_from,ship_code')
      .eq('ship_code', profile.shipCode)
      .gte('sail_date_from', from.toISOString().split('T')[0])
      .lte('sail_date_from', to.toISOString().split('T')[0])
      .order('sail_date_from', { ascending: true })
      .limit(20);

    const candidates = (data || []).filter((row: any) => toInt(row.sail_days, 0) === toInt(profile.daysUntilSailing > 0 ? null : null, 0) || true);
    return candidates[0]?.sail_code || null;
  } catch (error) {
    console.warn('[talia-intel] Could not infer representative prior-year sail:', error);
    return null;
  }
};

export const buildCurrentVsTarget = async (
  supabaseDataService: any,
  sailCode: string,
  options: { representativeSailCode?: string | null } = {}
) => {
  const profile = await supabaseDataService.getBookingProfileWithCurves(sailCode);
  const targetRows = await supabaseDataService.getBookingTargetsSupplied(sailCode);

  const targetByWeek = new Map<string, any>();
  (targetRows || []).forEach((row: any) => {
    const key = normalizeWeekLabel(row.weekLabel);
    if (key) targetByWeek.set(key, row);
  });

  let priorYearProfile = null;
  const representativeSailCode =
    options.representativeSailCode ||
    (await inferRepresentativePriorYearCode(supabaseDataService, sailCode, profile));
  if (representativeSailCode) {
    try {
      priorYearProfile = await supabaseDataService.getBookingProfileWithCurves(representativeSailCode);
    } catch (error) {
      console.warn('[talia-intel] Could not load representative prior-year profile:', error);
    }
  }
  const priorByWeek = new Map<string, any>();
  (priorYearProfile?.buildCurves || []).forEach((point: any) => {
    const key = normalizeWeekLabel(point.weekLabel);
    if (key) priorByWeek.set(key, point);
  });

  const rows = (profile?.buildCurves || [])
    .map((point: any) => {
      const weekLabel = normalizeWeekLabel(point.weekLabel);
      const target = weekLabel ? targetByWeek.get(weekLabel) : null;
      const prior = weekLabel ? priorByWeek.get(weekLabel) : null;
      const actualBookings = toInt(point.bookings);
      const targetBookings = target ? toInt(target.targetBookings) : null;
      const priorBookings = prior ? toInt(prior.bookings) : null;
      const gapToTarget = targetBookings == null ? null : actualBookings - targetBookings;
      return {
        weekLabel,
        weeksUntilSailing: toInt(point.weeksUntilSailing, 0),
        actualBookings,
        actualGuests: toInt(point.guests),
        targetBookings,
        targetGuests: target ? toInt(target.targetGuests, 0) : null,
        priorYearRepBookings: priorBookings,
        gapToTarget,
        gapPctToTarget:
          targetBookings && targetBookings !== 0 && gapToTarget != null
            ? Number(((gapToTarget / targetBookings) * 100).toFixed(2))
            : null
      };
    })
    .sort((a: any, b: any) => weekSortValue(b.weekLabel) - weekSortValue(a.weekLabel));

  const latest = rows.length ? rows[rows.length - 1] : null;
  return {
    sailCode,
    representativePriorYearSailCode: representativeSailCode,
    generatedAt: new Date().toISOString(),
    summary: {
      currentBookings: toInt(profile?.currentBookings),
      currentGuests: toInt(profile?.currentGuests),
      cancellationRate: Number(profile?.cancellationRate || 0),
      bookingVelocity: Number(profile?.bookingVelocity || 0),
      daysUntilSailing: toInt(profile?.daysUntilSailing, 0),
      latestGapToTarget: latest?.gapToTarget ?? null,
      latestGapPctToTarget: latest?.gapPctToTarget ?? null
    },
    rows
  };
};

export const buildPricingInventoryRecommendations = async (
  supabaseDataService: any,
  sailCode: string,
  currentVsTargetPayload?: any
) => {
  const currentVsTarget = currentVsTargetPayload || (await buildCurrentVsTarget(supabaseDataService, sailCode));
  const summary = currentVsTarget?.summary || {};
  const gapPct = Number(summary.latestGapPctToTarget ?? 0);
  const daysOut = toInt(summary.daysUntilSailing, 0);

  let pricingAction = 'hold';
  let inventoryAction = 'monitor';
  const reasons: string[] = [];

  if (gapPct < -15 && daysOut <= 90) {
    pricingAction = 'lower';
    inventoryAction = 'open';
    reasons.push('Bookings are materially below target inside 90-day window.');
  } else if (gapPct > 12 && daysOut <= 90) {
    pricingAction = 'raise';
    inventoryAction = 'restrict';
    reasons.push('Bookings are pacing above target close to departure.');
  } else {
    reasons.push('Bookings are near target profile; maintain current settings.');
  }

  const cancellationRate = Number(summary.cancellationRate || 0);
  if (cancellationRate > 20) {
    reasons.push('Elevated cancellation rate suggests cautious inventory tightening.');
    if (pricingAction === 'raise') pricingAction = 'hold';
  }

  return {
    sailCode,
    generatedAt: new Date().toISOString(),
    actions: {
      pricing: pricingAction,
      inventory: inventoryAction
    },
    inputs: {
      gapPctToTarget: gapPct,
      daysUntilSailing: daysOut,
      cancellationRate
    },
    reasons
  };
};

const resolveFeedTimestamp = async (supabaseDataService: any, feedKey: string) => {
  if (feedKey === 'competitor_current_state') {
    const { data } = await supabaseDataService.client
      .from('competitor_current_state')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return safeIso(data?.snapshot_date);
  }
  if (feedKey === 'ship_position_logs') {
    const { data } = await supabaseDataService.client
      .from('ship_position_logs')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return safeIso(data?.captured_at);
  }
  if (feedKey === 'google_search_trends') {
    const { data } = await supabaseDataService.client
      .from('google_search_trends')
      .select('fetched_at,created_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return safeIso(data?.fetched_at || data?.created_at);
  }
  return null;
};

export const buildExternalFeedStatuses = async (supabaseDataService: any) => {
  const now = Date.now();
  const contracts = getExternalFeedContracts();
  const statuses = await Promise.all(
    contracts.map(async (contract) => {
      try {
        const latestAt = await resolveFeedTimestamp(supabaseDataService, contract.feedKey);
        const latestMs = latestAt ? Date.parse(latestAt) : NaN;
        const ageMinutes = Number.isFinite(latestMs)
          ? Math.max(0, Math.round((now - latestMs) / 60000))
          : null;
        const status =
          ageMinutes == null
            ? 'unknown'
            : ageMinutes > contract.staleAfterMinutes
              ? 'stale'
              : ageMinutes > contract.requiredFreshnessMinutes
                ? 'degraded'
                : 'healthy';
        return {
          feedKey: contract.feedKey,
          domain: contract.domain,
          latestAt,
          ageMinutes,
          status
        };
      } catch (error: any) {
        return {
          feedKey: contract.feedKey,
          domain: contract.domain,
          latestAt: null,
          ageMinutes: null,
          status: 'error',
          error: error?.message || String(error)
        };
      }
    })
  );
  return {
    generatedAt: new Date().toISOString(),
    statuses
  };
};
