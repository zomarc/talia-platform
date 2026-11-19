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
  const onExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort();
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
    timeoutId = setTimeout(onExternalAbort, parsedTimeout);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...GraphQLUtils.getRequestHeaders(),
        ...headers,
      },
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
    const abortedByTimeout = controller.signal.aborted && !(signal && signal.aborted);
    const normalized = (error?.name === 'AbortError' || controller.signal.aborted)
      ? new Error(
          abortedByTimeout && Number.isFinite(parsedTimeout) && parsedTimeout > 0
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
