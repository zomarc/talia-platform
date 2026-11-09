/**
 * Point-in-time accuracy metrics for MR model paths vs named outcome.
 *
 * Outcome is final named guests — never fed into the model at earlier DTDs.
 */

export const DEFAULT_ACCURACY_TOLERANCE = Object.freeze({
  minGuests: 5,
  pctOfOutcome: 0.1,
});

/**
 * Absolute guest gap at one checkpoint.
 * @param {number} expected
 * @param {number} outcomeNamed
 */
export function absGapAtDtd(expected, outcomeNamed) {
  const e = Number(expected);
  const o = Number(outcomeNamed);
  if (!Number.isFinite(e) || !Number.isFinite(o)) return null;
  return Math.abs(e - o);
}

/**
 * Signed bias: expected − outcome (positive = over-prediction).
 */
export function signedBiasAtDtd(expected, outcomeNamed) {
  const e = Number(expected);
  const o = Number(outcomeNamed);
  if (!Number.isFinite(e) || !Number.isFinite(o)) return null;
  return e - o;
}

/**
 * Mean absolute gap across checkpoints (lower = better path).
 * @param {Array<{ expected?: number, expectedGuests?: number, outcomeNamed?: number }>} points
 */
export function pathError(points = []) {
  const gaps = (points || [])
    .map((p) => absGapAtDtd(p.expected ?? p.expectedGuests, p.outcomeNamed))
    .filter((g) => g != null);
  if (!gaps.length) return null;
  return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}

/**
 * Largest DTD where abs gap ≤ tolerance (earliest accurate prediction).
 * @param {Array<{ dtd: number, expected?: number, expectedGuests?: number, outcomeNamed?: number }>} points
 * @param {{ minGuests?: number, pctOfOutcome?: number }} [tolerance]
 */
export function earliestAccurateDtd(points = [], tolerance = DEFAULT_ACCURACY_TOLERANCE) {
  const minGuests = Number.isFinite(Number(tolerance.minGuests))
    ? Number(tolerance.minGuests)
    : DEFAULT_ACCURACY_TOLERANCE.minGuests;
  const pct = Number.isFinite(Number(tolerance.pctOfOutcome))
    ? Number(tolerance.pctOfOutcome)
    : DEFAULT_ACCURACY_TOLERANCE.pctOfOutcome;

  let earliest = null;
  for (const p of points || []) {
    const dtd = Number(p.dtd);
    const outcome = Number(p.outcomeNamed);
    const expected = Number(p.expected ?? p.expectedGuests);
    if (!Number.isFinite(dtd) || !Number.isFinite(outcome) || !Number.isFinite(expected)) continue;
    const tol = Math.max(minGuests, Math.abs(outcome) * pct);
    const gap = Math.abs(expected - outcome);
    if (gap > tol) continue;
    if (earliest == null || dtd > earliest) earliest = dtd;
  }
  return earliest;
}

/**
 * Gap helpers at common checkpoints (90 / 30 / 0).
 */
function gapAtExactDtd(points, dtd) {
  const match = (points || []).find((p) => Number(p.dtd) === dtd);
  if (!match) return null;
  return absGapAtDtd(match.expected ?? match.expectedGuests, match.outcomeNamed);
}

/**
 * Per-model accuracy summary for one group's DTD path.
 * @param {string} modelId
 * @param {Array<{ dtd: number, expected?: number, expectedGuests?: number, outcomeNamed?: number }>} points
 * @param {{ minGuests?: number, pctOfOutcome?: number }} [tolerance]
 */
export function summarizeModelAccuracy(modelId, points = [], tolerance = DEFAULT_ACCURACY_TOLERANCE) {
  return {
    modelId,
    pathError: pathError(points),
    earliestAccurateDtd: earliestAccurateDtd(points, tolerance),
    gapAt90: gapAtExactDtd(points, 90),
    gapAt30: gapAtExactDtd(points, 30),
    gapAt0: gapAtExactDtd(points, 0),
    signedBiasAt0: (() => {
      const match = (points || []).find((p) => Number(p.dtd) === 0);
      if (!match) return null;
      return signedBiasAtDtd(match.expected ?? match.expectedGuests, match.outcomeNamed);
    })(),
  };
}

/**
 * Leaderboard rows sorted by path error (then earliest accurate DTD descending).
 * @param {Array<{ modelId: string, points: Array }>} modelSeries
 * @param {{ minGuests?: number, pctOfOutcome?: number }} [tolerance]
 */
export function buildAccuracyLeaderboard(modelSeries = [], tolerance = DEFAULT_ACCURACY_TOLERANCE) {
  const rows = (modelSeries || []).map((entry) =>
    summarizeModelAccuracy(entry.modelId, entry.points, tolerance)
  );
  return rows.sort((a, b) => {
    const ae = a.pathError;
    const be = b.pathError;
    if (ae == null && be == null) return String(a.modelId).localeCompare(String(b.modelId));
    if (ae == null) return 1;
    if (be == null) return -1;
    if (ae !== be) return ae - be;
    const ad = a.earliestAccurateDtd;
    const bd = b.earliestAccurateDtd;
    if (ad == null && bd == null) return String(a.modelId).localeCompare(String(b.modelId));
    if (ad == null) return 1;
    if (bd == null) return -1;
    return bd - ad;
  });
}
