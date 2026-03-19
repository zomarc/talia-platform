const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatDayMon = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`;
};

export const formatMonYear = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${date.getFullYear()}`;
};

export const formatDateTime = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  return date.toLocaleString('en-US');
};

