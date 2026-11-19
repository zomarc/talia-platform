import queryTracker from './queryTracker';
import { GraphQLUtils } from '../../lib/apolloClient.js';

const getQueryText = (query) => {
  if (typeof query === 'string') return query;
  if (query?.loc?.source?.body) return query.loc.source.body;
  return 'query UnknownOperation { ... }';
};

const finalizeTracker = (completeQuery, result) => {
  if (typeof completeQuery !== 'function') return;
  completeQuery(result);
};

export const startTrackedGraphqlOperation = ({
  query,
  variables = {},
  component = 'Unknown',
  purpose = 'GraphQL operation',
  tableName = 'unknown'
}) => queryTracker.trackQuery({
  query: getQueryText(query),
  variables: {
    tableName,
    ...(variables || {})
  },
  component,
  purpose
});

const isTaliaGraphqlUrl = (url) => {
  const value = String(url || '').trim();
  if (!value || value.startsWith('/')) return true;
  try {
    if (typeof window === 'undefined' || !window.location?.origin) return false;
    return new URL(value, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

export const trackedFetchGraphql = async ({
  url = '/api/graphql',
  query,
  variables = {},
  component = 'Unknown',
  purpose = 'Fetch GraphQL operation',
  tableName = 'unknown',
  headers = {},
  signal = null,
  timeoutMs = null,
}) => {
  const completeQuery = startTrackedGraphqlOperation({
    query,
    variables,
    component,
    purpose,
    tableName
  });

  const controller = new AbortController();
  let timeoutId = null;
  let timedOut = false;
  const onExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  const onTimeoutAbort = () => {
    timedOut = true;
    onExternalAbort();
  };

  if (signal) {
    if (signal.aborted) {
      onExternalAbort();
    } else {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const parsedTimeout = Number(timeoutMs);
  if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) {
    timeoutId = setTimeout(onTimeoutAbort, parsedTimeout);
  }

  // External B2B hosts: skip Talia auth headers so we do not add extra CORS
  // preflight surface area on an already-unreachable endpoint.
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(isTaliaGraphqlUrl(url) ? GraphQLUtils.getRequestHeaders() : {}),
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({ query: getQueryText(query), variables }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || payload?.errors?.length) {
      throw new Error(payload?.errors?.[0]?.message || `HTTP ${response.status}`);
    }
    finalizeTracker(completeQuery, { data: payload?.data || null });
    return payload?.data || null;
  } catch (error) {
    const wasAborted = error?.name === 'AbortError' || controller.signal.aborted;
    const normalized = wasAborted
      ? new Error(
          timedOut && Number.isFinite(parsedTimeout) && parsedTimeout > 0
            ? `Timeout after ${parsedTimeout}ms`
            : 'Request cancelled'
        )
      : error;
    finalizeTracker(completeQuery, { error: normalized });
    throw normalized;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
};

export const trackedApolloQuery = async ({
  client,
  query,
  variables = {},
  component = 'Unknown',
  purpose = 'Apollo query operation',
  tableName = 'unknown',
  options = {}
}) => {
  const completeQuery = startTrackedGraphqlOperation({
    query,
    variables,
    component,
    purpose,
    tableName
  });
  try {
    const result = await client.query({
      query,
      variables,
      ...options
    });
    finalizeTracker(completeQuery, { data: result?.data || null });
    return result;
  } catch (error) {
    finalizeTracker(completeQuery, { error });
    throw error;
  }
};

export const trackedApolloMutate = async ({
  client,
  mutation,
  variables = {},
  component = 'Unknown',
  purpose = 'Apollo mutation operation',
  tableName = 'unknown',
  options = {}
}) => {
  const completeQuery = startTrackedGraphqlOperation({
    query: mutation,
    variables,
    component,
    purpose,
    tableName
  });
  try {
    const result = await client.mutate({
      mutation,
      variables,
      ...options
    });
    finalizeTracker(completeQuery, { data: result?.data || null });
    return result;
  } catch (error) {
    finalizeTracker(completeQuery, { error });
    throw error;
  }
};
