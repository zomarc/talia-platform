export const pickFirst = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

export const getFieldValue = (record, key) => {
  if (!record) return null;
  if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  const upperKey = key.toUpperCase();
  if (record[upperKey] !== undefined && record[upperKey] !== null && record[upperKey] !== '') return record[upperKey];
  const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
  if (record[camelKey] !== undefined && record[camelKey] !== null && record[camelKey] !== '') return record[camelKey];
  return null;
};

