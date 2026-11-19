import { useEffect, useMemo, useState } from 'react';
import sourceAvailability, {
  DEFAULT_REQUIRED_SOURCES,
  initSourceAvailability,
} from '../services/sourceAvailabilityService';

/**
 * Framework hook: is the required source set allowed to refresh?
 * @param {string|string[]} [sourceIds]
 */
const useSourceAvailability = (sourceIds = DEFAULT_REQUIRED_SOURCES) => {
  const aliasKey = useMemo(
    () => (Array.isArray(sourceIds) ? sourceIds.join('|') : String(sourceIds || '')),
    [sourceIds]
  );

  const [statuses, setStatuses] = useState(() => sourceAvailability.getAllStatuses());

  useEffect(() => {
    initSourceAvailability();
    return sourceAvailability.subscribe((next) => {
      setStatuses(next);
    });
  }, []);

  const ids = aliasKey.split('|').filter(Boolean);
  const available = sourceAvailability.canRefresh(ids);
  const message = available ? null : sourceAvailability.getUnavailableMessage(ids);
  const primaryId = sourceAvailability.resolveSourceId(ids) || ids[0] || null;
  const status = statuses.find((entry) => entry.id === primaryId) || sourceAvailability.getStatus(primaryId);

  return {
    available,
    checked: status?.checked === true,
    status,
    statuses,
    message,
    sourceIds: ids,
  };
};

export default useSourceAvailability;
