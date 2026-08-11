/**
 * Seasonal Trading Pack — fleet dep-month commercial pack (Pax + Rev matrices,
 * narrative callouts, trading performance).
 *
 * Sources:
 *   - reservation (+ EUR from Fact_Reservation)
 *   - budget (lkp.BUDGET)
 *   - ship_inventory_alloc (GROUP held / expected via probability)
 *
 * Deferred: Offered (OF status), RFC overlays, Fact_Reservation_History WoW/STLY.
 */

import { isFitPaxType, isGroupPaxType } from '../lib/paxType.js';

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const dd = dmy[1].padStart(2, '0');
      const mm = dmy[2].padStart(2, '0');
      return `${dmy[3]}-${mm}-${dd}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function monthKey(dateKey) {
  if (!dateKey || dateKey.length < 7) return null;
  return dateKey.slice(0, 7);
}

function addMonths(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function enumerateMonths(fromYm, toYm) {
  const months = [];
  let cur = fromYm;
  let guard = 0;
  while (cur <= toYm && guard < 48) {
    months.push(cur);
    cur = addMonths(cur, 1);
    guard += 1;
  }
  return months;
}

function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00Z`);
  const b = new Date(`${toKey}T00:00:00Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function round0(n) {
  return Math.round(Number(n) || 0);
}

function fmtMillions(n) {
  const v = Number(n) || 0;
  const m = v / 1e6;
  if (Math.abs(m) >= 10) return `${m.toFixed(1)}M`;
  if (Math.abs(m) >= 1) return `${m.toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return `${round0(v)}`;
}

function isCancelledStatus(status) {
  const s = String(status || '').toUpperCase();
  return s === 'CX' || s === 'CANCELLED' || s === 'CANCELED';
}

/** Confirmed booked only — OF/QT/WL are not booked (Offered row is separate / deferred). */
function isBookedStatus(status) {
  const s = String(status || '').toUpperCase();
  return s === 'BK' || s === 'BOOKED' || s === 'BKD';
}

function bookDateKey(res) {
  return toDateKey(res.original_init_date) || toDateKey(res.res_init_date);
}

function guestNights(res) {
  const guests = Number(res.guest_count) || 0;
  let nights = Number(res.sail_duration) || 0;
  if (!nights) {
    const from = toDateKey(res.sail_from_date);
    const to = toDateKey(res.sail_to_date);
    if (from && to) nights = Math.max(0, daysBetween(from, to));
  }
  return guests * nights;
}

function emptyMonthBucket() {
  return {
    bookedPax: 0,
    bookedRev: 0,
    budgetPax: 0,
    budgetRev: 0,
    offeredPax: null,
    offeredRev: null,
    heldPax: 0,
    heldRev: 0,
    expectedFinalPax: 0,
    expectedFinalRev: 0,
    groupsBudgetPax: 0,
    groupsBudgetRev: 0,
    fitL4wPax: 0,
    fitL4wRev: 0,
    bookedGroupRev: 0,
    bookedGroupPax: 0,
  };
}

async function fetchAllPages(client, table, select, applyFilters) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    let query = client.from(table).select(select).range(from, from + pageSize - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function loadMarketRollUpIndex(client) {
  const rows = await fetchAllPages(
    client,
    'market_roll_up',
    'agency_market, new_budget_roll_up, active_record_flag',
    (q) => q
  );
  const index = new Map();
  const groups = new Set();
  rows.forEach((row) => {
    if (row.active_record_flag != null && Number(row.active_record_flag) !== 1) return;
    const key = clean(row.agency_market)?.toUpperCase();
    if (!key || index.has(key)) return;
    const group = clean(row.new_budget_roll_up) || key;
    index.set(key, group);
    groups.add(group);
  });
  return {
    index,
    groups: [...groups].sort((a, b) => a.localeCompare(b)),
  };
}

function resolveReservationMarketGroup(res, agencyMarketById, rollUpIndex) {
  const market = clean(res.agency_market)
    || agencyMarketById.get(String(res.agency_id))
    || null;
  if (!market) return 'UNKNOWN';
  return rollUpIndex.get(market.toUpperCase()) || market;
}

function parseBudgetDepMonth(row) {
  return monthKey(toDateKey(row.master_departure_date) || toDateKey(row.accounting_month));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   asOfDate?: string,
 *   depMonthFrom?: string,
 *   depMonthTo?: string,
 *   marketGroup?: string|null,
 *   fyLabel?: string,
 * }} [options]
 */
export async function getSeasonalTradingPack(client, options = {}) {
  const asOfDate = toDateKey(options.asOfDate) || toDateKey(new Date());
  const depMonthFrom = options.depMonthFrom || '2026-05';
  const depMonthTo = options.depMonthTo || '2027-03';
  const marketGroupFilter = clean(options.marketGroup);
  const fyLabel = options.fyLabel || '26/27';
  const months = enumerateMonths(depMonthFrom, depMonthTo);
  const monthSet = new Set(months);
  const rangeFrom = `${depMonthFrom}-01`;
  const rangeToExclusive = `${addMonths(depMonthTo, 1)}-01`;

  const prior7From = (() => {
    const d = new Date(`${asOfDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 14);
    return d.toISOString().slice(0, 10);
  })();
  const last7From = (() => {
    const d = new Date(`${asOfDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const l4wFrom = (() => {
    const d = new Date(`${asOfDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 28);
    return d.toISOString().slice(0, 10);
  })();

  const { index: marketRollUpIndex, groups: marketGroups } = await loadMarketRollUpIndex(client);

  const [reservations, budgetRows, allocRows, agencies] = await Promise.all([
    fetchAllPages(
      client,
      'reservation',
      'res_id, sail_code, sail_from_date, sail_to_date, sail_duration, guest_count, res_status, pax_type, original_init_date, res_init_date, gross_ticket_revenue_eur, net_ticket_revenue_eur, agency_market, agency_id',
      (q) => q
        .gte('sail_from_date', rangeFrom)
        .lt('sail_from_date', rangeToExclusive)
    ),
    fetchAllPages(
      client,
      'budget',
      'passenger_type, passengers, gross_ticket_revenue_eur, pppd_eur, master_departure_date, accounting_month, itinerary_type, master_voyage, market, new_market_roll_up, active_record_flag, fy',
      (q) => q.eq('active_record_flag', 1)
    ),
    fetchAllPages(
      client,
      'ship_inventory_alloc',
      'allocation_owner_type, occupancy, probability, sail_date_from, ship_code, inventory_request_type',
      (q) => q
        .ilike('allocation_owner_type', 'GROUP')
        .gte('sail_date_from', rangeFrom)
        .lt('sail_date_from', rangeToExclusive)
    ),
    fetchAllPages(client, 'agency', 'agency_id, market', (q) => q),
  ]);

  const agencyMarketById = new Map();
  agencies.forEach((row) => {
    if (row.agency_id == null) return;
    const market = clean(row.market);
    if (market) agencyMarketById.set(String(row.agency_id), market);
  });

  const buckets = new Map();
  months.forEach((m) => buckets.set(m, emptyMonthBucket()));

  const matchesMarketGroup = (group) => {
    if (!marketGroupFilter) return true;
    return String(group || '').toUpperCase() === marketGroupFilter.toUpperCase();
  };

  // Budget by dep month (same market-group scope as booked when filter is set)
  budgetRows.forEach((row) => {
    const budgetGroup = clean(row.new_market_roll_up) || clean(row.market) || 'UNKNOWN';
    if (!matchesMarketGroup(budgetGroup)) return;
    const ym = parseBudgetDepMonth(row);
    if (!ym || !monthSet.has(ym)) return;
    const b = buckets.get(ym);
    const pax = Number(row.passengers) || 0;
    const rev = Number(row.gross_ticket_revenue_eur) || 0;
    b.budgetPax += pax;
    b.budgetRev += rev;
    if (isGroupPaxType(row.passenger_type)) {
      b.groupsBudgetPax += pax;
      b.groupsBudgetRev += rev;
    }
  });

  // Held / expected from GROUP allocs — not market-scoped; omit when a market group is selected
  if (!marketGroupFilter) {
    allocRows.forEach((row) => {
      const ym = monthKey(toDateKey(row.sail_date_from));
      if (!ym || !monthSet.has(ym)) return;
      const b = buckets.get(ym);
      const occ = Number(row.occupancy) || 0;
      let prob = Number(row.probability);
      if (!Number.isFinite(prob)) prob = 100;
      if (prob > 1 && prob <= 100) {
        // percent
      } else if (prob >= 0 && prob <= 1) {
        prob *= 100;
      } else {
        prob = Math.max(0, Math.min(100, prob));
      }
      b.heldPax += occ;
      b.expectedFinalPax += occ * (prob / 100);
    });
  }

  // Booked reservations + FIT L4W + trading windows
  const trading = {
    last7: { pax: 0, rev: 0, nights: 0, fitPax: 0, fitRev: 0, fitNights: 0, bookings: 0 },
    prior7: { pax: 0, rev: 0, nights: 0, fitPax: 0, fitRev: 0, fitNights: 0, bookings: 0 },
    cancellationsLast7: 0,
    intakesLast7: 0,
    marketLast7: new Map(),
    marketPrior7: new Map(),
  };

  let bookedActive = 0;
  reservations.forEach((res) => {
    const resGroup = resolveReservationMarketGroup(res, agencyMarketById, marketRollUpIndex);
    if (!matchesMarketGroup(resGroup)) return;
    const ym = monthKey(toDateKey(res.sail_from_date));
    const cancelled = isCancelledStatus(res.res_status);
    const booked = isBookedStatus(res.res_status);
    const guests = Number(res.guest_count) || 0;
    const rev = Number(res.gross_ticket_revenue_eur);
    const revEur = Number.isFinite(rev) ? rev : (Number(res.net_ticket_revenue_eur) || 0);
    const bd = bookDateKey(res);
    const fit = isFitPaxType(res.pax_type);

    if (ym && monthSet.has(ym) && booked) {
      const b = buckets.get(ym);
      b.bookedPax += guests;
      b.bookedRev += revEur;
      bookedActive += 1;
      if (isGroupPaxType(res.pax_type)) {
        b.bookedGroupPax += guests;
        b.bookedGroupRev += revEur;
      }
      if (bd && bd >= l4wFrom && bd <= asOfDate && fit) {
        b.fitL4wPax += guests;
        b.fitL4wRev += revEur;
      }
    }

    if (!bd) return;
    const market = clean(res.agency_market)
      || agencyMarketById.get(String(res.agency_id))
      || 'UNKNOWN';
    if (bd > last7From && bd <= asOfDate) {
      if (cancelled) {
        trading.cancellationsLast7 += 1;
      } else {
        trading.intakesLast7 += 1;
        trading.last7.pax += guests;
        trading.last7.rev += revEur;
        trading.last7.nights += guestNights(res);
        trading.last7.bookings += 1;
        if (fit) {
          trading.last7.fitPax += guests;
          trading.last7.fitRev += revEur;
          trading.last7.fitNights += guestNights(res);
        }
        trading.marketLast7.set(market, (trading.marketLast7.get(market) || 0) + revEur);
      }
    } else if (bd > prior7From && bd <= last7From && !cancelled) {
      trading.prior7.pax += guests;
      trading.prior7.rev += revEur;
      trading.prior7.nights += guestNights(res);
      trading.prior7.bookings += 1;
      if (fit) {
        trading.prior7.fitPax += guests;
        trading.prior7.fitRev += revEur;
        trading.prior7.fitNights += guestNights(res);
      }
      trading.marketPrior7.set(market, (trading.marketPrior7.get(market) || 0) + revEur);
    }
  });

  // Estimate held rev from group booked or budget G rev/pax
  months.forEach((ym) => {
    const b = buckets.get(ym);
    const groupRevPerPax =
      b.bookedGroupPax > 0
        ? b.bookedGroupRev / b.bookedGroupPax
        : (b.groupsBudgetPax > 0 ? b.groupsBudgetRev / b.groupsBudgetPax : 0);
    b.heldRev = b.heldPax * groupRevPerPax;
    b.expectedFinalRev = b.expectedFinalPax * groupRevPerPax;
  });

  const buildMatrix = (metric) => {
    const isPax = metric === 'pax';
    const rows = [
      {
        key: 'booked',
        label: 'Booked (F,G&A)',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax ? round0(b.bookedPax) : round2(b.bookedRev);
        }),
      },
      {
        key: 'budget',
        label: isPax ? 'Budget Pax' : 'Budget',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax ? round0(b.budgetPax) : round2(b.budgetRev);
        }),
      },
      {
        key: 'to_build',
        label: 'To Build',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax
            ? round0(b.budgetPax - b.bookedPax)
            : round2(b.budgetRev - b.bookedRev);
        }),
      },
      {
        key: 'offered',
        label: 'Offered Groups and Allotments (No MR)',
        values: months.map(() => null),
        pending: true,
        pendingReason: 'OF status source not wired yet',
      },
      {
        key: 'held',
        label: 'Held Groups and Allotments (MR)',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax ? round0(b.heldPax) : round2(b.heldRev);
        }),
      },
      {
        key: 'expected_final',
        label: 'Expected Final Groups and Allotments',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax ? round0(b.expectedFinalPax) : round2(b.expectedFinalRev);
        }),
      },
      {
        key: 'groups_budget',
        label: 'Groups and Allotments Budgeted',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax ? round0(b.groupsBudgetPax) : round2(b.groupsBudgetRev);
        }),
      },
      {
        key: 'to_build_after_held',
        label: 'To build following materialisation of Held',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax
            ? round0(b.budgetPax - b.bookedPax - b.expectedFinalPax)
            : round2(b.budgetRev - b.bookedRev - b.expectedFinalRev);
        }),
      },
      {
        key: 'l4w_fit',
        label: 'L4W average weekly run rate of FIT',
        values: months.map((m) => {
          const b = buckets.get(m);
          return isPax
            ? round2(b.fitL4wPax / 4)
            : round2(b.fitL4wRev / 4);
        }),
      },
      {
        key: 'weeks_to_fulfil',
        label: isPax ? '# weeks to fulfil to build' : '# weeks to fulfil',
        values: months.map((m) => {
          const b = buckets.get(m);
          const toBuild = isPax
            ? b.budgetPax - b.bookedPax
            : b.budgetRev - b.bookedRev;
          const rate = isPax ? b.fitL4wPax / 4 : b.fitL4wRev / 4;
          if (!Number.isFinite(rate) || Math.abs(rate) < 1e-6) return null;
          return round0(toBuild / rate);
        }),
      },
    ];

    rows.forEach((row) => {
      if (row.key === 'offered') {
        row.total = null;
        return;
      }
      if (row.key === 'weeks_to_fulfil' || row.key === 'l4w_fit') {
        const vals = row.values.filter((v) => v != null && Number.isFinite(v));
        row.total = vals.length
          ? (row.key === 'l4w_fit' ? round2(vals.reduce((a, c) => a + c, 0)) : null)
          : null;
        return;
      }
      row.total = round2(row.values.reduce((a, c) => a + (Number(c) || 0), 0));
      if (isPax && row.key !== 'l4w_fit') row.total = round0(row.total);
    });

    // Concern flags: pace too slow / weeks to fulfil beyond a year
    const toBuildRow = rows.find((r) => r.key === 'to_build');
    const weeksRow = rows.find((r) => r.key === 'weeks_to_fulfil');
    const l4wRow = rows.find((r) => r.key === 'l4w_fit');
    const WEEKS_CONCERN = 52;

    rows.forEach((row) => {
      row.concern = months.map((_, idx) => {
        const toBuild = Number(toBuildRow?.values?.[idx]);
        const weeks = weeksRow?.values?.[idx];
        const rate = l4wRow?.values?.[idx];
        if (row.key === 'weeks_to_fulfil') {
          if (weeks != null && Number(weeks) > WEEKS_CONCERN) return true;
          // No FIT pace but still to build → effectively unfulfillable
          return Number.isFinite(toBuild) && toBuild > 0
            && (weeks == null || !Number.isFinite(Number(weeks)));
        }
        if (row.key === 'l4w_fit') {
          return Number.isFinite(toBuild) && toBuild > 0
            && (rate == null || !Number.isFinite(Number(rate)) || Number(rate) === 0);
        }
        if (row.key === 'to_build' || row.key === 'to_build_after_held') {
          const v = row.values?.[idx];
          return v != null && Number(v) > 0
            && weeks != null && Number(weeks) > WEEKS_CONCERN;
        }
        return false;
      });
      row.totalConcern = Array.isArray(row.concern) && row.concern.some(Boolean);
    });

    return {
      metric,
      months,
      monthLabels: months.map((m) => {
        const [y, mo] = m.split('-');
        return `01/${mo}/${y}`;
      }),
      rows,
    };
  };

  const paxMatrix = buildMatrix('pax');
  const revMatrix = buildMatrix('rev');

  const sumRow = (matrix, key) => {
    const row = matrix.rows.find((r) => r.key === key);
    return row?.total ?? 0;
  };

  const bookedRevTotal = sumRow(revMatrix, 'booked');
  const budgetRevTotal = sumRow(revMatrix, 'budget');
  const heldRevTotal = sumRow(revMatrix, 'held');
  const toBuildRev = sumRow(revMatrix, 'to_build');
  const fitL4wRevTotal = sumRow(revMatrix, 'l4w_fit');
  const weeksOfFitPace =
    fitL4wRevTotal > 0 ? round2(Math.max(0, toBuildRev) / fitL4wRevTotal) : null;

  const pctOfBudget =
    budgetRevTotal > 0 ? round2((bookedRevTotal / budgetRevTotal) * 100) : null;
  const reservedInclHeldPct =
    budgetRevTotal > 0
      ? round2(((bookedRevTotal + heldRevTotal) / budgetRevTotal) * 100)
      : null;

  const pppd = (slice) => (
    slice.nights > 0 ? round2(slice.rev / slice.nights) : null
  );
  const pctChange = (cur, prev) => {
    if (prev == null || !Number.isFinite(prev) || prev === 0) return null;
    return round2(((cur - prev) / Math.abs(prev)) * 100);
  };

  const last7Pppd = pppd(trading.last7);
  const prior7Pppd = pppd(trading.prior7);
  const fitLast7Pppd = pppd({
    rev: trading.last7.fitRev,
    nights: trading.last7.fitNights,
  });

  const marketMix = [...trading.marketLast7.entries()]
    .map(([market, rev]) => {
      const prior = trading.marketPrior7.get(market) || 0;
      return {
        market,
        last7Rev: round2(rev),
        prior7Rev: round2(prior),
        wowPct: pctChange(rev, prior),
      };
    })
    .sort((a, b) => b.last7Rev - a.last7Rev)
    .slice(0, 12);

  const cancelRate =
    trading.intakesLast7 + trading.cancellationsLast7 > 0
      ? round2(
        (trading.cancellationsLast7
          / (trading.intakesLast7 + trading.cancellationsLast7)) * 100
      )
      : null;

  // Optional market-group filter scopes booked + budget; held is fleet-only.

  const monthNarratives = months
    .map((ym) => {
      const b = buckets.get(ym);
      const overUnder = b.bookedRev - b.budgetRev;
      const toBuildAfter = b.budgetRev - b.bookedRev - b.expectedFinalRev;
      return {
        month: ym,
        overUnderRev: round2(overUnder),
        bookedRev: round2(b.bookedRev),
        budgetRev: round2(b.budgetRev),
        heldRev: round2(b.heldRev),
        toBuildAfterHeldRev: round2(toBuildAfter),
        fitL4wRev: round2(b.fitL4wRev / 4),
      };
    })
    .filter((m) => m.budgetRev > 0 || m.bookedRev > 0);

  const bullets = [];
  const scopeLabel = marketGroupFilter ? `Market group ${marketGroupFilter}` : 'Fleet';
  bullets.push(
    `${scopeLabel} booked €${fmtMillions(bookedRevTotal)}`
    + (marketGroupFilter
      ? ''
      : ` with another €${fmtMillions(heldRevTotal)} held groups & allotments`)
    + `, against a budget of €${fmtMillions(budgetRevTotal)}`
    + (toBuildRev > 0
      ? ` (€${fmtMillions(toBuildRev)} to go${weeksOfFitPace != null ? ` — about ${weeksOfFitPace} weeks of recent FIT pace` : ''}).`
      : ` (${fmtMillions(Math.abs(toBuildRev))} over budget).`)
  );

  if (marketGroupFilter) {
    bullets.push(
      `Held (MR) is omitted while filtering by market group (allocations are not market-scoped).`
    );
  }

  monthNarratives.forEach((m) => {
    const label = m.month;
    if (m.overUnderRev > 50000) {
      bullets.push(
        `${label} is set to overachieve by €${fmtMillions(m.overUnderRev)} vs budget.`
      );
    } else if (m.overUnderRev < -50000 && m.toBuildAfterHeldRev < 0) {
      bullets.push(
        `${label} overperformance vs budget of €${fmtMillions(Math.abs(m.overUnderRev))} with €${fmtMillions(m.heldRev)} held to convert.`
      );
    } else if (m.toBuildAfterHeldRev > 100000) {
      bullets.push(
        `${label}: €${fmtMillions(m.toBuildAfterHeldRev)} remains to build after held materialisation; L4W FIT pace €${fmtMillions(m.fitL4wRev)}/wk.`
      );
    }
  });

  bullets.push(
    `RFC / 3+9 finance overlay is deferred until that source is available in Talia.`
  );

  const tradingBullets = [];
  tradingBullets.push(
    `Last week booked €${fmtMillions(trading.last7.rev)} gross ticket revenue`
    + (pctChange(trading.last7.rev, trading.prior7.rev) != null
      ? ` (${pctChange(trading.last7.rev, trading.prior7.rev) > 0 ? '+' : ''}${pctChange(trading.last7.rev, trading.prior7.rev)}% vs prior 7 days)`
      : '')
    + `, ${round0(trading.last7.pax).toLocaleString()} passengers`
    + (last7Pppd != null ? `, PPPD of €${last7Pppd}` : '')
    + '.'
  );
  tradingBullets.push(
    `FIT booked €${fmtMillions(trading.last7.fitRev)} across ${round0(trading.last7.fitPax).toLocaleString()} passengers`
    + (fitLast7Pppd != null ? ` at PPPD of €${fitLast7Pppd}` : '')
    + '.'
  );
  tradingBullets.push(
    `Cumulative booked position for ${fyLabel} is currently at €${fmtMillions(bookedRevTotal)}`
    + (pctOfBudget != null ? ` (${pctOfBudget}% of full year budget of €${fmtMillions(budgetRevTotal)})` : '')
    + (reservedInclHeldPct != null
      ? `; including held, ${reservedInclHeldPct}% of full year budget.`
      : '.')
  );
  if (cancelRate != null) {
    tradingBullets.push(
      `Gross intakes ${trading.intakesLast7.toLocaleString()} for the week with cancellations at ${trading.cancellationsLast7.toLocaleString()} (cancel rate ${cancelRate}%).`
    );
  }
  tradingBullets.push(
    `Offered Groups and Allotments (No MR) pending OF status source.`
  );

  return {
    asOfDate,
    fyLabel,
    depMonthFrom,
    depMonthTo,
    marketGroup: marketGroupFilter || null,
    marketGroups,
    currency: 'EUR',
    revenueBasis: 'gross_ticket_revenue_eur',
    monthKeys: months,
    narrative: {
      bullets,
      facts: {
        bookedRevTotal: round2(bookedRevTotal),
        budgetRevTotal: round2(budgetRevTotal),
        heldRevTotal: round2(heldRevTotal),
        toBuildRev: round2(toBuildRev),
        weeksOfFitPace,
        pctOfBudget,
        reservedInclHeldPct,
        monthNarratives,
        reservationRows: reservations.length,
        budgetRows: budgetRows.length,
        bookedActiveReservations: bookedActive,
      },
    },
    paxMatrix,
    revMatrix,
    trading: {
      bullets: tradingBullets,
      last7: {
        rev: round2(trading.last7.rev),
        pax: round0(trading.last7.pax),
        bookings: trading.last7.bookings,
        pppd: last7Pppd,
        fitRev: round2(trading.last7.fitRev),
        fitPax: round0(trading.last7.fitPax),
        fitPppd: fitLast7Pppd,
      },
      prior7: {
        rev: round2(trading.prior7.rev),
        pax: round0(trading.prior7.pax),
        bookings: trading.prior7.bookings,
        pppd: prior7Pppd,
        fitRev: round2(trading.prior7.fitRev),
        fitPax: round0(trading.prior7.fitPax),
      },
      wow: {
        revPct: pctChange(trading.last7.rev, trading.prior7.rev),
        paxPct: pctChange(trading.last7.pax, trading.prior7.pax),
        pppdPct: pctChange(last7Pppd, prior7Pppd),
      },
      cumulative: {
        bookedRev: round2(bookedRevTotal),
        budgetRev: round2(budgetRevTotal),
        pctOfBudget,
        reservedInclHeldPct,
      },
      cancellations: {
        intakes: trading.intakesLast7,
        cancellations: trading.cancellationsLast7,
        cancelRatePct: cancelRate,
      },
      marketMix,
    },
    methodology: [
      'Booked = BK status only (gross_ticket_revenue_eur); OF/QT excluded until Offered row is wired.',
      'Budget from lkp.BUDGET by master_departure_date month.',
      'Market group filter uses agency.market → market_roll_up.new_budget_roll_up for reservations, and budget.new_market_roll_up for budget.',
      'Held (MR) from ship_inventory_alloc GROUP occupancy (fleet only — omitted when a market group is selected).',
      'Held revenue estimated from group booked (or budget G) rev/pax for the month.',
      'Offered (No MR) deferred until OF status source is available.',
      'RFC / 3+9 finance overlay deferred.',
      'True Monday WoW/STLY requires Fact_Reservation_History sync (phase 2).',
    ],
  };
}
