/**
 * Project plan layout. Phases follow the functionality matrix.
 * Milestones are the requirement target-version labels, with a target date.
 */

const DAY = 86400000;
const UNDATED_DAYS = 21;

export const PLAN_PHASES = ['0', 'mvp', '1', '2', '3'];

export const parsePlanDate = (value) => {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
};

export const formatPlanDate = (value) => {
  const time = parsePlanDate(value);
  if (time == null) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(time));
};

const bySort = (a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0)
  || String(a?.code || a?.name || '').localeCompare(String(b?.code || b?.name || ''));

/**
 * Each phase gets a share of the timeline and, when any date is set, a start and end.
 * Undated phases keep a visible width. Dated phases end on their target date.
 */
export function phaseSpans(phases, milestones = []) {
  const list = [...(phases || [])].sort(bySort);
  if (!list.length) return [];
  const dated = list
    .map((phase, index) => (parsePlanDate(phase.targetOn) != null ? index : -1))
    .filter((index) => index >= 0);

  if (!dated.length) {
    return list.map((phase) => ({
      ...phase,
      share: 1 / list.length,
      startMs: null,
      endMs: null,
    }));
  }

  const durations = list.map(() => 0);
  const first = dated[0];
  const last = dated[dated.length - 1];
  for (let index = 0; index < first; index += 1) durations[index] = UNDATED_DAYS;
  durations[first] = UNDATED_DAYS;

  for (let cursor = 1; cursor < dated.length; cursor += 1) {
    const index = dated[cursor];
    const previous = dated[cursor - 1];
    const gapStart = parsePlanDate(list[previous].targetOn);
    const gapEnd = parsePlanDate(list[index].targetOn);
    const slots = index - previous;
    let gapDays = Math.round((gapEnd - gapStart) / DAY);
    if (gapDays < slots * 7) gapDays = slots * 7;
    const each = gapDays / slots;
    for (let fill = previous + 1; fill <= index; fill += 1) durations[fill] = each;
  }
  for (let index = last + 1; index < list.length; index += 1) durations[index] = UNDATED_DAYS;
  if (dated.length > 1 && durations[dated[1]] > 0) durations[first] = durations[dated[1]];

  const startMs = new Array(list.length);
  const endMs = new Array(list.length);
  endMs[first] = parsePlanDate(list[first].targetOn);
  startMs[first] = endMs[first] - durations[first] * DAY;
  for (let index = first - 1; index >= 0; index -= 1) {
    endMs[index] = startMs[index + 1];
    startMs[index] = endMs[index] - durations[index] * DAY;
  }
  for (let index = first + 1; index < list.length; index += 1) {
    startMs[index] = endMs[index - 1];
    endMs[index] = startMs[index] + durations[index] * DAY;
  }

  const total = durations.reduce((sum, days) => sum + days, 0) || 1;
  return list.map((phase, index) => {
    let start = startMs[index];
    const end = endMs[index];
    (milestones || []).forEach((milestone) => {
      if (milestone?.phaseCode !== phase.code) return;
      const time = parsePlanDate(milestone.targetOn);
      if (time != null && start != null && time < start) start = time;
    });
    return {
      ...phase,
      share: durations[index] / total,
      startMs: start,
      endMs: end,
    };
  });
}

/** 0–1 position of a milestone inside its phase. Null when either date is missing. */
export function milestoneOffset(milestone, span) {
  const time = parsePlanDate(milestone?.targetOn);
  if (time == null || span?.startMs == null || span?.endMs == null || span.endMs === span.startMs) return null;
  const ratio = (time - span.startMs) / (span.endMs - span.startMs);
  return Math.min(1, Math.max(0, ratio));
}

const sameName = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();

const linkHits = (links, ids, kind) => (links || []).some((link) => link.targetKind === kind && ids.has(link.targetId));

/**
 * Records tied to a phase, or to one milestone when milestoneName is set.
 * Matrix cells come from the phase. Requirements come from the milestone name
 * and from matrix assignments. Risks and documents come from those links.
 */
export function linkedElements({
  phaseCode,
  milestoneName = null,
  milestones = [],
  matrixItems = [],
  requirements = [],
  risks = [],
  documents = [],
}) {
  const phaseMilestones = (milestones || []).filter((item) => item.phaseCode === phaseCode);
  const names = milestoneName
    ? [milestoneName]
    : phaseMilestones.map((item) => item.name);
  const namedRequirements = (requirements || []).filter((item) => names.some((name) => sameName(item.targetVersion, name)));

  const matrixInPhase = (matrixItems || []).filter((item) => String(item.phase) === String(phaseCode));
  let matrix = matrixInPhase;
  let requirementRows = namedRequirements;

  const namedIds = new Set(namedRequirements.map((item) => item.id));
  if (milestoneName) {
    matrix = (matrixItems || []).filter((item) => (item.links || []).some((link) => namedIds.has(link.requirementItemId)));
  } else {
    const assigned = new Set();
    matrixInPhase.forEach((item) => {
      (item.links || []).forEach((link) => {
        if (link.requirementItemId) assigned.add(link.requirementItemId);
      });
    });
    const seen = new Set(requirementRows.map((item) => item.id));
    (requirements || []).forEach((item) => {
      if (assigned.has(item.id) && !seen.has(item.id)) requirementRows.push(item);
    });
    const seenMatrix = new Set(matrix.map((item) => item.id));
    (matrixItems || []).forEach((item) => {
      const linkedHere = (item.links || []).some((link) => namedIds.has(link.requirementItemId));
      if (linkedHere && !seenMatrix.has(item.id)) {
        seenMatrix.add(item.id);
        matrix.push(item);
      }
    });
  }

  const matrixIds = new Set(matrix.map((item) => item.id));
  const requirementIds = new Set(requirementRows.map((item) => item.id));
  const relatedRisks = (risks || []).filter((item) => (
    linkHits(item.links, requirementIds, 'requirement') || linkHits(item.links, matrixIds, 'matrix')
  ));
  const riskIds = new Set(relatedRisks.map((item) => item.id));
  const relatedDocuments = (documents || []).filter((item) => (
    linkHits(item.links, requirementIds, 'requirement')
    || linkHits(item.links, matrixIds, 'matrix')
    || linkHits(item.links, riskIds, 'risk')
  ));

  return {
    milestones: milestoneName
      ? phaseMilestones.filter((item) => sameName(item.name, milestoneName))
      : phaseMilestones,
    matrix,
    requirements: requirementRows,
    risks: relatedRisks,
    documents: relatedDocuments,
  };
}
