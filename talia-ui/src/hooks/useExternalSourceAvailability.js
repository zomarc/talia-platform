import { useEffect, useState } from 'react';
import externalSourceAvailability, {
  initExternalSourceAvailability,
} from '../services/externalSourceAvailabilityService';

/**
 * Subscribe to shared external-source YES/NO availability.
 * @param {string|string[]} sourceNameOrAliases
 */
const useExternalSourceAvailability = (sourceNameOrAliases) => {
  const [status, setStatus] = useState(() => {
    const resolved = externalSourceAvailability.resolveSourceName(
      Array.isArray(sourceNameOrAliases) ? sourceNameOrAliases : [sourceNameOrAliases]
    ) || (Array.isArray(sourceNameOrAliases) ? sourceNameOrAliases[0] : sourceNameOrAliases);
    return externalSourceAvailability.getStatus(resolved);
  });

  const aliasKey = Array.isArray(sourceNameOrAliases)
    ? sourceNameOrAliases.join('|')
    : String(sourceNameOrAliases || '');

  useEffect(() => {
    initExternalSourceAvailability();
    const aliases = aliasKey.split('|').filter(Boolean);
    return externalSourceAvailability.subscribe(() => {
      const resolved = externalSourceAvailability.resolveSourceName(aliases) || aliases[0];
      setStatus(externalSourceAvailability.getStatus(resolved));
    });
  }, [aliasKey]);

  const available = status?.checked === true && status?.available === true;
  return {
    available,
    checked: status?.checked === true,
    status,
    message: available
      ? null
      : externalSourceAvailability.getUnavailableMessage(sourceNameOrAliases),
  };
};

export default useExternalSourceAvailability;
