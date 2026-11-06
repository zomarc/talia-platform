/**
 * Talia MR method — sources, step text, and the cases the report walks through.
 * Arithmetic lives in explainTaliaMaterialisation.
 */

import {
  explainTaliaMaterialisation,
  formatMrPctPrecise,
} from '../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

export const FEED_THROUGH_LABEL = '10 February 2025';

export const TALIA_MR_LEAD = 'Talia MR estimates how many requested group guests will be named. It starts from an even prior, then gives most of the weight to guests already named at that point in time. The source rate nudges the result by default (Views can turn that off). Expected guests are the request times this rate. Cancelled holds contribute 0 forward.';

export const TALIA_MR_SOURCES = [
  {
    id: 'reservation',
    scope: 'Current book',
    name: 'reservation',
    usedFor: 'Requested guests, named guests, status, and the source rate on the selected sailing',
    why: 'A sailing selection on the message bus (talia:sail.select) loads that sailing’s reservation rows. Requested guests are the contracted group face. Named guests are the ones already booked. The source rate is the average of group_probability, falling back to the reservation probability. If both are missing, the live book treats the source rate as 100%. A header probability is often stuck at 100, so the group probability is preferred, and a blank one is not read as zero.',
  },
  {
    id: 'revenue',
    scope: 'Current book',
    name: 'Ticket revenue on the reservation',
    usedFor: 'Not an input',
    why: 'Revenue can sit beside a group in Groups Explorer. Talia MR does not use it. The result is a guest rate, not a fare and not a euro loss.',
  },
  {
    id: 'groups',
    scope: 'Frozen extract',
    name: 'stg.SW_ETL_GROUPS',
    usedFor: 'Status, requested guests, named guests, and the stored probability on the worked examples',
    why: 'The illustrations are real groups from the Seaware extract. The extract stops on 10 February 2025. A future sailing in that file still carries the guests and the rate as they stood then.',
  },
  {
    id: 'header',
    scope: 'Frozen extract',
    name: 'stg.SW_ETL_GROUP_HEADER',
    usedFor: 'Each saved version of the source probability, and whether it was set by hand',
    why: 'The same source rate on several days is a rate that was kept, not a rate that was recalculated. Same-day duplicate rows are a load artifact, not extra visits.',
  },
  {
    id: 'ship',
    scope: 'Frozen extract',
    name: 'stg.SW_ETL_GROUP_SHIP_REQUEST',
    usedFor: 'Ship and sail for each current group',
    why: 'The group table has no ship column. One ship and sail is taken per current group.',
  },
  {
    id: 'load',
    scope: 'Frozen extract',
    name: 'stg.SW_ETL_EXTRACT_LOAD',
    usedFor: 'When the group extract was loaded',
    why: 'This marks the freeze date. Sailings after 10 February 2025 are not an outcome in that file.',
  },
  {
    id: 'alloc',
    scope: 'Frozen extract',
    name: 'stg.SW_ETL_SAIL_INVENTORY_DATA_ALLOC',
    usedFor: 'Not an input',
    why: 'Allocation probability is a different measure. Group allocations average about 83%, and FIT allocations are 100%. Neither number enters Talia MR.',
  },
  {
    id: 'addition',
    scope: 'Left unused',
    name: 'GROUP_ExpectedAddition',
    usedFor: 'Not an input',
    why: 'The warehouse field is a large decimal. It is not a guest count. Expected guests are requested guests times the rate.',
  },
];

export const TALIA_MR_ISSUES = [
  {
    id: 'not-a-copy',
    title: 'The source rate is not the answer',
    text: 'A quote stored at 100% with nobody named does not become a 100% Talia MR. Source nudge is on by default and moves the result by 15% of the gap when the gap is at least 5 points. Views → Use source rate nudge can turn it off.',
  },
  {
    id: 'as-of-only',
    title: 'No prior knowledge of the ending names',
    text: 'At each point in time, Talia MR uses named guests known then. When the header has no named count, a booked (BK) hold uses the requested size as booked evidence; quotes and offers stay at 0 named. The final named outcome is only for judging the path.',
  },
  {
    id: 'cancelled',
    title: 'Cancelled groups do not add forward expected guests',
    text: 'A cancelled hold scores 0 expected guests from that day forward. Cancelled groups stay visible on a single-group path, but sailing and window totals omit them.',
  },
  {
    id: 'blank-is-100',
    title: 'A missing live probability becomes 100%',
    text: 'On the current book, a group with no group_probability and no reservation probability is given a 100% source rate for comparison. That 100% only affects Talia MR when source nudge is on.',
  },
  {
    id: 'frozen',
    title: 'The worked examples are frozen',
    text: `Groups 28657 and 55576 come from the extract through ${FEED_THROUGH_LABEL}. They show the method. They are not a pull of this morning’s book. Select a sailing to run the same steps on current reservations.`,
  },
  {
    id: 'guests-not-money',
    title: 'The exposure is guests',
    text: 'This calculation does not produce a fare. Source expected minus Talia expected is a guest gap. Ticket revenue is not an input.',
  },
  {
    id: 'future-is-progress',
    title: 'Named guests mean different things before and after departure',
    text: 'Before departure, named guests are progress. The rate will move if more are named or if they drop off. After departure, named guests are the outcome the source rate can be judged against.',
  },
  {
    id: 'addition',
    title: 'GROUP_ExpectedAddition is not guests',
    text: 'Do not read that warehouse field as expected guests. Expected guests are requested guests times the rate.',
  },
];

const ILLUSTRATIONS = [
  {
    id: '28657',
    title: 'Group 28657',
    sailing: 'CO · 28 Jun 2024 – 1 Jul 2024',
    status: 'Quote',
    sailed: true,
    note: 'Already sailed. Frozen extract. Source 100% on 1 Aug 2023, 3 Aug 2023, 18 Aug 2023 and 22 Jan 2024. None of those changes were manual.',
    input: {
      requestedPax: 40,
      reservedPax: 0,
      sourceMr: 1,
      hasNamedBooked: false,
      offerHeavy: true,
      distressedSailing: false,
    },
  },
  {
    id: '55576',
    title: 'Group 55576',
    sailing: 'CJ · 7 Dec 2026 – 14 Dec 2026',
    status: 'Open offer',
    sailed: false,
    note: 'Still to sail. Counts are the extract through 10 February 2025, last changed 3 January 2025. Source 60%, not manual. Eight of sixteen guests were already named.',
    input: {
      requestedPax: 16,
      reservedPax: 8,
      sourceMr: 0.6,
      hasNamedBooked: true,
      offerHeavy: false,
      distressedSailing: false,
    },
  },
];

const todayKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const caseIssues = (explanation, meta) => {
  const issues = [];
  const source = explanation.source_mr;
  const talia = explanation.talia_mr;
  const named = explanation.reserved;
  const requested = explanation.requested;

  if (source != null && (source - talia) >= 0.15) {
    issues.push({
      id: 'gap',
      tone: 'concern',
      title: 'Source rate sits well above Talia MR',
      text: `Source is ${formatMrPctPrecise(source)} and Talia MR is ${formatMrPctPrecise(talia)}. The source rate counts ${explanation.sourceExpected} guests. Talia counts ${explanation.taliaExpected}. The difference is ${explanation.sourceExpected - explanation.taliaExpected} guests on this group.`,
    });
  }
  if (talia <= 0.35 && requested >= 25) {
    issues.push({
      id: 'weak',
      tone: 'concern',
      title: 'Weak materialisation on a sizeable request',
      text: `${Math.round(requested)} guests are requested and Talia MR is ${formatMrPctPrecise(talia)}. The request is large enough that a low rate matters.`,
    });
  }
  if (meta.sailed && named === 0 && source != null && source >= 0.5) {
    issues.push({
      id: 'miss',
      tone: 'concern',
      title: 'This group has sailed with nobody named',
      text: 'The source rate counted guests who were not named. That gap is already an outcome, not a forecast.',
    });
  }
  if (!meta.sailed && named === 0 && source != null && source >= 0.9) {
    issues.push({
      id: 'open-quote',
      tone: 'concern',
      title: 'Future quote still at a high source rate',
      text: 'Nobody is named yet, so the high source rate is a forecast of the whole request. Names added before departure will move Talia MR up. Names that never arrive will leave the source rate high of the outcome.',
    });
  }
  if (!meta.sailed && named > 0) {
    issues.push({
      id: 'progress',
      tone: 'note',
      title: 'Named guests are progress',
      text: `${Math.round(named)} guests are named and the sailing has not departed. If the rest are named, the next calculation moves toward the full request. If they drop off, it moves down.`,
    });
  }
  return issues;
};

const buildCase = (meta, options = {}) => {
  const explanation = explainTaliaMaterialisation({
    ...meta.input,
    useSourceNudge: options.useSourceNudge !== false,
  });
  return {
    ...meta,
    explanation,
    issues: caseIssues(explanation, meta),
  };
};

export const buildIllustrationCases = (options = {}) => (
  ILLUSTRATIONS.map((item) => buildCase(item, options))
);

const dateLabel = (value) => {
  const key = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const date = new Date(`${key}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/**
 * @param {object} row Groups Explorer rollup
 * @param {{ sailCode?: string }} [context]
 */
export const caseFromGroupRow = (row, context = {}) => {
  const sailDate = String(row?.sail_date_from || '').slice(0, 10);
  const sailed = Boolean(sailDate) && sailDate <= todayKey();
  const sailCode = String(context.sailCode || row?.sail_code || '').trim();
  const when = dateLabel(sailDate);
  const sailing = [row?.ship_code, sailCode, when].filter(Boolean).join(' · ');
  return buildCase({
    // Prefer group_id so talia:group.select matches the worked case.
    id: String(row?.group_id || row?.group_key || ''),
    title: `Group ${row?.group_id || row?.group_key || ''}`,
    sailing: sailing || sailCode || 'Selected sailing',
    status: row?.status_mix || 'Group',
    sailed,
    kind: 'sailing',
    note: sailed
      ? 'Current reservation on a sailing that has departed. Named guests are the outcome.'
      : 'Current reservation on a sailing still to depart. Named guests are progress, not the outcome.',
    groupValueEur: Math.round(Number(row?.group_value_eur) || 0),
    input: {
      requestedPax: row?.requested_pax,
      reservedPax: row?.reserved_pax,
      sourceMr: row?.source_mr,
      hasNamedBooked: Boolean(row?.has_named_booked),
      offerHeavy: Boolean(row?.offer_heavy),
      distressedSailing: Boolean(row?.distressed_sailing),
    },
  }, { useSourceNudge: context.useSourceNudge !== false });
};

export const pickDefaultCaseId = (cases = []) => {
  if (!cases.length) return null;
  let best = cases[0];
  let bestGap = -Infinity;
  cases.forEach((item) => {
    const source = item.explanation?.source_mr;
    const gap = (source == null ? 0 : source) - (item.explanation?.talia_mr || 0);
    if (gap > bestGap) {
      bestGap = gap;
      best = item;
    }
  });
  return best.id;
};

export const activeCase = (cases, pickedId) => {
  const list = Array.isArray(cases) ? cases : [];
  return list.find((item) => item.id === pickedId) || list.find((item) => item.id === pickDefaultCaseId(list)) || null;
};
