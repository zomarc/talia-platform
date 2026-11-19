/**
 * Celestyal B2B GraphQL availability fetch.
 *
 * Reachability is owned by the framework sourceAvailabilityService.
 * Callers (and trackedFetchGraphql) must only refresh when canRefresh is YES.
 */

import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
} from './directB2bFailFast';
import sourceAvailability, {
  SOURCE_IDS,
} from '../services/sourceAvailabilityService';

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

export const fetchDirectB2bAvailability = async ({
  endpoint = DIRECT_B2B_DEFAULT_ENDPOINT,
  variables,
  component = 'DirectSourceRequest',
  purpose = 'Fetch external availability',
  signal = null,
  timeoutMs = DIRECT_B2B_FAIL_FAST_MS,
  sourceNames = DIRECT_B2B_SOURCE_NAMES,
} = {}) => {
  const resolvedName = sourceAvailability.resolveSourceId(sourceNames) || SOURCE_IDS.B2B_READ;
  const status = sourceAvailability.getStatus(resolvedName);
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
      requiredSources: [resolvedName],
    });
    sourceAvailability.reportSuccess(resolvedName, 'Reachable (query OK).');
    return data;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message === 'Request cancelled' || error?.code === 'SOURCE_UNAVAILABLE') {
      throw error;
    }
    const lower = message.toLowerCase();
    if (
      lower.includes('timeout')
      || lower.includes('failed to fetch')
      || lower.includes('network')
      || lower.includes('load failed')
    ) {
      sourceAvailability.reportFailure(
        resolvedName,
        lower.includes('timeout')
          ? 'External source unavailable (timed out)'
          : message
      );
    }
    throw error;
  }
};
