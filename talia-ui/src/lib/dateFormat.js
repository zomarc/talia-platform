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

/** Compact sail from–to range, e.g. "18–25 Jul 2026" or "18 Jul – 25 Aug 2026". */
export const formatSailDateRange = (fromValue, toValue, fallback = '') => {
  const fromDate = parseDateValue(fromValue);
  const toDate = parseDateValue(toValue);
  if (!fromDate && !toDate) return fallback;
  if (fromDate && !toDate) return formatDayMon(fromValue, fallback);
  if (!fromDate && toDate) return formatDayMon(toValue, fallback);

  const fromDay = fromDate.getDate();
  const toDay = toDate.getDate();
  const fromMonth = fromDate.toLocaleString('en-US', { month: 'short' });
  const toMonth = toDate.toLocaleString('en-US', { month: 'short' });
  const fromYear = fromDate.getFullYear();
  const toYear = toDate.getFullYear();

  if (fromYear === toYear && fromMonth === toMonth) {
    return `${fromDay}–${toDay} ${fromMonth} ${fromYear}`;
  }
  if (fromYear === toYear) {
    return `${fromDay} ${fromMonth} – ${toDay} ${toMonth} ${fromYear}`;
  }
  return `${fromDay} ${fromMonth} ${fromYear} – ${toDay} ${toMonth} ${toYear}`;
};

