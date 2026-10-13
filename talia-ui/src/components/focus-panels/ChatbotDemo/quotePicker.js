/** Split a local quote file into lines. Blank lines and # comments are skipped. */

export const parseQuotes = (text) => String(text || '')
  .split(/\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

export const randomQuote = (quotes, { random = Math.random, avoid = '' } = {}) => {
  const list = Array.isArray(quotes) ? quotes.filter(Boolean) : [];
  if (!list.length) return '';
  const pool = list.length > 1 ? list.filter((line) => line !== avoid) : list;
  const source = pool.length ? pool : list;
  const index = Math.min(source.length - 1, Math.floor(random() * source.length));
  return source[index];
};
