/**
 * Reservation Current State — status filtering and display helpers.
 */

export const isCancelledStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'CX' || normalized === 'X';
};

export const isBookedStatus = (value) => !isCancelledStatus(value);

export const filterByReservationStatus = (rows, statusFilter = 'all') => {
  const list = Array.isArray(rows) ? rows : [];
  if (statusFilter === 'cancelled') {
    return list.filter((row) => isCancelledStatus(row?.res_status));
  }
  if (statusFilter === 'booked') {
    return list.filter((row) => isBookedStatus(row?.res_status));
  }
  return list;
};

export const buildShipSailTooltip = (row = {}) => {
  const parts = [];
  if (row.ship) parts.push(`Ship: ${row.ship}`);
  if (row.sail_code) parts.push(`Sail: ${row.sail_code}`);
  return parts.join(' · ');
};
