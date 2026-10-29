/**
 * Guest exposure of the source rate against Talia MR and named guests.
 * This extract has no fare, so the figures stay in guests.
 */

export const summariseExposure = (statuses = []) => {
  const sailed = (Array.isArray(statuses) ? statuses : []).filter((row) => (Number(row?.sailedGroups) || 0) > 0);
  const sum = (key) => sailed.reduce((total, row) => total + (Number(row?.[key]) || 0), 0);
  const source = sum('sailedSourceExpectedGuests');
  const talia = sum('sailedTaliaExpectedGuests');
  const named = sum('sailedNamedGuests');
  return {
    groups: sum('sailedGroups'),
    source,
    talia,
    named,
    sourceAboveTalia: source - talia,
    sourceAboveNamed: source - named,
  };
};
