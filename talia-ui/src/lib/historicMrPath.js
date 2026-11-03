/**
 * Planning value for the historic MR path. Guests stay the measure until a rate is typed.
 */

export const PLANNING_ASSUMPTION = 'A planning value is source expected guests minus named guests, times a euro amount you type. It is not a fare from the book. Leave it blank and the report stays in guests.';

export const planningValue = (sourceExpected, named, eurosPerGuest) => {
  const rate = Number(String(eurosPerGuest ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const guestGap = Math.round(Number(sourceExpected) || 0) - Math.round(Number(named) || 0);
  return {
    guestGap,
    eurosPerGuest: rate,
    euros: Math.round(guestGap * rate),
  };
};
