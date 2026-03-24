/**
 * Booking / guest counts must stay as plain integers (no float drift, no scientific axis).
 * Used by MODEL profile editor chart + table + persistence.
 */
export const MAX_MODEL_BOOKINGS = 25_000_000;
export const MAX_MODEL_GUESTS = 200_000_000;

export function safeBookingInt(value, max = MAX_MODEL_BOOKINGS) {
  if (value === '' || value == null) return 0;
  const n = typeof value === 'string' ? Number(String(value).replace(/,/g, '').trim()) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(max, Math.round(n));
}

export function formatBookingInt(n) {
  const v = safeBookingInt(n);
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
