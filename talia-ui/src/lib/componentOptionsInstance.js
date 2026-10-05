const plainRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

/**
 * Views for one dock panel. A saved instance map wins; otherwise the
 * component-level views (older profiles) apply so new panels keep the last default.
 */
export const resolveStoredComponentViews = (entry, instanceId) => {
  const shared = plainRecord(entry?.views);
  const id = String(instanceId || '');
  if (!id) return shared;
  const own = plainRecord(entry?.instances?.[id]?.views);
  if (Object.keys(own).length > 0) return own;
  return shared;
};

/**
 * Merge componentOptions patches without dropping sibling components or
 * sibling panel-instance view maps.
 */
export const mergeComponentOptionsMaps = (current, patch) => {
  const base = plainRecord(current);
  const incoming = plainRecord(patch);
  const out = { ...base };
  Object.keys(incoming).forEach((id) => {
    const prevEntry = plainRecord(base[id]);
    const nextEntry = plainRecord(incoming[id]);
    const mergedEntry = { ...prevEntry, ...nextEntry };
    if (Object.prototype.hasOwnProperty.call(nextEntry, 'instances')) {
      mergedEntry.instances = {
        ...plainRecord(prevEntry.instances),
        ...plainRecord(nextEntry.instances),
      };
    }
    out[id] = mergedEntry;
  });
  return out;
};
