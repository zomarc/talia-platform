/**
 * Compatibility wrapper — prefer useSourceAvailability.
 */
import useSourceAvailability from './useSourceAvailability';
import { B2B_READ_ALIASES } from '../services/sourceAvailabilityService';

const useExternalSourceAvailability = (sourceNameOrAliases = B2B_READ_ALIASES) => (
  useSourceAvailability(sourceNameOrAliases)
);

export default useExternalSourceAvailability;
