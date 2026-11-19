/**
 * Celestyal B2B GraphQL availability fetch.
 *
 * Reachability is owned by externalSourceAvailabilityService.
 * Callers must check isAvailable() first and skip refresh when NO.
 */

import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
} from './directB2bFailFast';
import externalSourceAvailability from '../services/externalSourceAvailabilityService';

export {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_DOWN_COOLDOWN_MS,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
} from './directB2bFailFast';

export const DIRECT_B2B_AVAILABILITY_QUERY = `query Availability($effectiveDate: DateTime!, $startDateFrom: Date!, $startDateTo: Date!) {
  availableVoyages(
    params: {
      effectiveDate: $effectiveDate
      startDateRange: { from: $startDateFrom, to: $startDateTo }
    }
  ) {
    sail {
      from {
        dateTime
        sailRefIdent
      }
      to {
        dateTime
        sailRefIdent
      }
    }
    pkg {
      code
      name
      sailDays
      sailIdent
    }
    availableCategories {
      cabinCategory {
        code
      }
      availabilityResult
      canBookNestedCabins
      canBookCabins
      availability {
        totalCabins
        availableCabins
        totalAvailableAbsolute
        totalAvailableWeighted
      }
    }
  }
}`;

/**
 * Fetch availability only when the shared probe says YES.
 * Hard abort timeout remains as a safety net.
 */
export const fetchDirectB2bAvailability = async ({
  endpoint = DIRECT_B2B_DEFAULT_ENDPOINT,
  variables,
  component = 'DirectSourceRequest',
  purpose = 'Fetch external availability',
  signal = null,
  timeoutMs = DIRECT_B2B_FAIL_FAST_MS,
  sourceNames = DIRECT_B2B_SOURCE_NAMES,
} = {}) => {
  const resolvedName = externalSourceAvailability.resolveSourceName(sourceNames)
    || sourceNames?.[0]
    || 'celestyal_b2b_api_read';

  if (!externalSourceAvailability.isAvailable(sourceNames)) {
    throw new Error(externalSourceAvailability.getUnavailableMessage(sourceNames));
  }

  const status = externalSourceAvailability.getStatus(resolvedName);
  const url = endpoint || status.endpoint || DIRECT_B2B_DEFAULT_ENDPOINT;

  try {
    const data = await trackedFetchGraphql({
      url,
      query: DIRECT_B2B_AVAILABILITY_QUERY,
      variables: {
        effectiveDate: variables?.effectiveDate,
        startDateFrom: variables?.startDateFrom,
        startDateTo: variables?.startDateTo,
      },
      component,
      purpose,
      tableName: 'availableVoyages',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal,
      timeoutMs,
    });
    externalSourceAvailability.reportSuccess(resolvedName, 'Reachable (query OK).');
    return data;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message === 'Request cancelled') {
      throw error;
    }
    const lower = message.toLowerCase();
    if (
      lower.includes('timeout')
      || lower.includes('failed to fetch')
      || lower.includes('network')
      || lower.includes('load failed')
    ) {
      externalSourceAvailability.reportFailure(
        resolvedName,
        lower.includes('timeout')
          ? 'External source unavailable (timed out)'
          : message
      );
    }
    throw error;
  }
};
