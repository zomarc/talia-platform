const DEFAULT_ENGINE_URL = process.env.TALIA_ENGINE_URL || 'http://127.0.0.1:4100';

export function engineUrl(): string {
  return String(DEFAULT_ENGINE_URL).replace(/\/$/, '');
}

async function engineFetch(pathname: string, init?: RequestInit, timeoutMs?: number) {
  const url = `${engineUrl()}${pathname}`;
  const ms = Number(
    timeoutMs
    ?? process.env.TALIA_ENGINE_TIMEOUT_MS
    ?? 20000
  );
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(ms),
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

export async function requestDriverAnalysis(input: {
  sailCodes?: string[];
  shipCode?: string;
  historicLimit?: number;
  forwardLimit?: number;
  persist?: boolean;
} = {}) {
  // World-state + Python can exceed the default 20s RM-agent timeout.
  const timeoutMs = Number(process.env.TALIA_ENGINE_DRIVER_TIMEOUT_MS || 120000);
  return engineFetch('/science/driver-analysis', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  }, timeoutMs);
}

export async function requestEvidencePromote(input: {
  evidenceId: string;
  artifact: Record<string, unknown>;
}) {
  return engineFetch('/science/evidence/promote', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}
