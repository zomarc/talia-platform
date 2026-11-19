/**
 * Compatibility facade — prefer sourceAvailabilityService.
 * Keeps existing Direct* / Instance panel imports working.
 */

import sourceAvailability, {
  B2B_READ_ALIASES,
  B2B_WRITE_ALIASES,
  SOURCE_IDS,
  initSourceAvailability,
} from './sourceAvailabilityService';

export const EXTERNAL_B2B_READ_ALIASES = B2B_READ_ALIASES;
export const EXTERNAL_B2B_WRITE_ALIASES = B2B_WRITE_ALIASES;

export const initExternalSourceAvailability = () => initSourceAvailability();

export const getExternalSourceAvailability = () => sourceAvailability;

/** @deprecated use SOURCE_IDS.B2B_READ */
export const DIRECT_B2B_SOURCE_ID = SOURCE_IDS.B2B_READ;

export default sourceAvailability;
