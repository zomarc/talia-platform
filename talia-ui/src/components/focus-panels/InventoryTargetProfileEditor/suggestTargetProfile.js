/**
 * Build a suggested target-profile draft from a densified LF series
 * (model prior preferred, else REAL). Also helpers to minimise / smooth waypoints.
 */

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

const lfNearWeek = (byWeek, week) => {
  if (byWeek.has(week)) return round1(byWeek.get(week).lfPct);
  let best = null;
  let bestDist = Infinity;
  byWeek.forEach((point, w) => {
    const dist = Math.abs(w - week);
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  });
  return best?.lfPct != null ? round1(best.lfPct) : null;
};

const voyageWeekNodes = (nodes = []) =>
  (nodes || [])
    .filter(
      (n) =>
        n?.dimensionLevel === 'voyage' &&
        n.weeksUntilSailing != null &&
        Number.isFinite(Number(n.lfPct))
    )
    .sort((a, b) => Number(b.weeksUntilSailing) - Number(a.weeksUntilSailing));

/**
 * Sample sparse week waypoints from a dense series (high → low weeks).
 */
export function sampleWeekWaypoints(series = [], step = 4) {
  const usable = (series || []).filter(
    (p) => p?.lfPct != null && Number.isFinite(Number(p.weeksUntilSailing))
  );
  if (!usable.length) return [];

  const byWeek = new Map();
  usable.forEach((p) => {
    byWeek.set(Number(p.weeksUntilSailing), p);
  });
  const maxW = Math.max(...byWeek.keys());
  const want = new Set([0]);
  if (maxW > 0) want.add(maxW);
  const stride = Math.max(1, Number(step) || 4);
  for (let w = stride; w < maxW; w += stride) want.add(w);

  return [...want]
    .sort((a, b) => b - a)
    .map((week, idx) => {
      const lfPct = lfNearWeek(byWeek, week);
      return {
        tempKey: `sug-w${week}`,
        dimensionLevel: 'voyage',
        dimensionKey: 'TOTAL',
        weeksUntilSailing: week,
        weekLabel: week === 0 ? 'Sail' : `W-${week}`,
        lfPct: lfPct ?? 0,
        pointOrder: idx,
      };
    })
    .filter((n) => n.lfPct != null);
}

/**
 * Keep endpoints + largest LF-step corners until maxPoints (default 6).
 * Nested non-voyage nodes are preserved unchanged.
 */
export function minimiseTargetWaypoints(nodes = [], { maxPoints = 6 } = {}) {
  const voyage = voyageWeekNodes(nodes);
  const other = (nodes || []).filter(
    (n) => !(n?.dimensionLevel === 'voyage' && n.weeksUntilSailing != null)
  );
  if (voyage.length <= maxPoints) return nodes;

  const first = voyage[0];
  const last = voyage[voyage.length - 1];
  const middle = voyage.slice(1, -1).map((n, i) => {
    const prev = voyage[i];
    const next = voyage[i + 2] || last;
    const step =
      Math.abs(Number(n.lfPct) - Number(prev.lfPct)) +
      Math.abs(Number(next.lfPct) - Number(n.lfPct));
    return { node: n, step };
  });
  middle.sort((a, b) => b.step - a.step);
  const keep = new Set([first.tempKey, last.tempKey]);
  middle.slice(0, Math.max(0, maxPoints - 2)).forEach((m) => keep.add(m.node.tempKey));

  const nextVoyage = voyage
    .filter((n) => keep.has(n.tempKey))
    .map((n, idx) => ({ ...n, pointOrder: idx }));

  return [...nextVoyage, ...other];
}

/**
 * Smooth voyage LF% with a 3-point moving average (endpoints fixed).
 * Nested non-voyage nodes unchanged.
 */
export function smoothTargetWaypoints(nodes = []) {
  const voyage = voyageWeekNodes(nodes);
  const other = (nodes || []).filter(
    (n) => !(n?.dimensionLevel === 'voyage' && n.weeksUntilSailing != null)
  );
  if (voyage.length < 3) return nodes;

  const smoothed = voyage.map((n, i) => {
    if (i === 0 || i === voyage.length - 1) return { ...n, lfPct: round1(n.lfPct) };
    const avg =
      (Number(voyage[i - 1].lfPct) + Number(n.lfPct) + Number(voyage[i + 1].lfPct)) / 3;
    return { ...n, lfPct: round1(avg) };
  });

  return [...smoothed, ...other];
}

/**
 * @param {{ modelSeries?: Array, realSeries?: Array, modelSailCode?: string|null, peerSource?: string|null }} input
 * @returns {object|null} draft ready for the Target Profile Editor
 */
export function buildSuggestedTargetDraft(input = {}) {
  const modelSeries = input.modelSeries || [];
  const realSeries = input.realSeries || [];
  const useModel = modelSeries.some((p) => p?.lfPct != null);
  const series = useModel ? modelSeries : realSeries;
  const nodes = sampleWeekWaypoints(series, 4);
  if (!nodes.length) return null;

  const source = useModel ? 'model' : 'real';
  const modelSailCode = input.modelSailCode || null;
  const endLf =
    nodes.find((n) => n.weeksUntilSailing === 0)?.lfPct ?? nodes[nodes.length - 1]?.lfPct;

  return {
    id: null,
    name:
      useModel && modelSailCode ? `Suggested · ${modelSailCode}` : 'Suggested target',
    perspective: 'commercial',
    description: useModel
      ? `Suggested from model prior${modelSailCode ? ` ${modelSailCode}` : ''}${
          input.peerSource ? ` (${input.peerSource})` : ''
        } · end LF ~${endLf}%`
      : `Suggested from current REAL booking curve · end LF ~${endLf}%`,
    isActive: true,
    nodes,
    suggestionMeta: {
      source,
      modelSailCode,
      peerSource: input.peerSource || null,
      endLfPct: endLf ?? null,
      pointCount: nodes.length,
    },
  };
}
