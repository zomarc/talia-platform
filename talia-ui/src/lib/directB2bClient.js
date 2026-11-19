/**
 * Fail-fast client for the external Celestyal B2B GraphQL availability API.
 *
 * Browser TCP to an unreachable host can hang for a long time. Callers must
 * abort (via timeoutMs / AbortSignal) so query tracking and UI loading clear.
 */

import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
  clearDirectB2bDown,
  getDirectB2bDownRemainingMs,
  isDirectB2bDown,
  isDirectB2bUnavailableError,
  markDirectB2bDown,
} from './directB2bFailFast';

export {
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_DOWN_COOLDOWN_MS,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
  clearDirectB2bDown,
  getDirectB2bDownRemainingMs,
  isDirectB2bDown,
  isDirectB2bUnavailableError,
  markDirectB2bDown,
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
 * Query external B2B availability with a hard abort timeout and short cooldown
 * after hard failures so sail.select storms do not keep the UI spinning.
 */
export const fetchDirectB2bAvailability = async ({
  endpoint = DIRECT_B2B_DEFAULT_ENDPOINT,
  variables,
  component = 'DirectSourceRequest',
  purpose = 'Fetch external availability',
  signal = null,
  timeoutMs = DIRECT_B2B_FAIL_FAST_MS,
} = {}) => {
  if (isDirectB2bDown()) {
    const remainingMs = getDirectB2bDownRemainingMs();
    throw new Error(
      `External source unavailable (retry in ${Math.ceil(remainingMs / 1000)}s)`
    );
  }

  try {
    const data = await trackedFetchGraphql({
      url: endpoint || DIRECT_B2B_DEFAULT_ENDPOINT,
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
    clearDirectB2bDown();
    return data;
  } catch (error) {
    if (isDirectB2bUnavailableError(error)) {
      markDirectB2bDown();
    }
    throw error;
  }
};
