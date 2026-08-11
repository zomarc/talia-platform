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

/** Day + month + year, e.g. "23 Jul 2026". Prefer for multi-year data surfaces. */
export const formatDayMonYear = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month} ${date.getFullYear()}`;
};

/** Day + month + 2-digit year, e.g. "23 Jul 26". Compact for explorer grids. */
export const formatDayMonYy = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const yy = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${yy}`;
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

/** Compact absolute datetime, e.g. "23 Jul 2026, 16:51". */
export const formatCompactDateTime = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

/** Relative time, e.g. "just now", "12 mins ago", "3 days ago". */
export const formatRelativeTime = (value, fallback = '') => {
  const date = parseDateValue(value);
  if (!date) return fallback;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return fallback;
  if (seconds < 0) return formatCompactDateTime(value, fallback);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

/** Compact sail from–to range, e.g. "18–25 Jul 2026" or "18 Jul – 25 Aug 2026". */
export const formatSailDateRange = (fromValue, toValue, fallback = '') => {
  const fromDate = parseDateValue(fromValue);
  const toDate = parseDateValue(toValue);
  if (!fromDate && !toDate) return fallback;
  if (fromDate && !toDate) return formatDayMonYear(fromValue, fallback);
  if (!fromDate && toDate) return formatDayMonYear(toValue, fallback);

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

