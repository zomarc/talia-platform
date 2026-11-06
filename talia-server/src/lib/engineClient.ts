const DEFAULT_ENGINE_URL = process.env.TALIA_ENGINE_URL || 'http://127.0.0.1:4100';

export function engineUrl(): string {
  return String(DEFAULT_ENGINE_URL).replace(/\/$/, '');
}

async function engineFetch(pathname: string, init?: RequestInit) {
  const url = `${engineUrl()}${pathname}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(Number(process.env.TALIA_ENGINE_TIMEOUT_MS || 20000)),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || `talia-engine HTTP ${response.status}`);
  }
  return body;
}

export async function fetchEngineHealth() {
  try {
    const body = await engineFetch('/health');
    return {
      online: true,
      url: engineUrl(),
      version: body?.version || null,
      python: body?.python || null,
      error: null,
    };
  } catch (error: any) {
    return {
      online: false,
      url: engineUrl(),
      version: null,
      python: null,
      error: error?.message || String(error),
    };
  }
}

export async function fetchEngineAgents() {
  const body = await engineFetch('/agents');
  return body?.agents || [];
}

export async function requestEngineRun(input: {
  sailCodes?: string[];
  agentIds?: string[];
  limit?: number;
}) {
  return engineFetch('/runs', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}
