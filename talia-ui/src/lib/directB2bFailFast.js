/**
 * Fail-fast / cooldown helpers for the external Celestyal B2B GraphQL API.
 * Kept free of fetch/Apollo imports so unit tests can run in plain Node.
 */

export const DIRECT_B2B_DEFAULT_ENDPOINT = 'https://thaliatest.b2b.celestyal.com:3000/graphql';
export const DIRECT_B2B_FAIL_FAST_MS = 3000;
export const DIRECT_B2B_DOWN_COOLDOWN_MS = 20000;

export const DIRECT_B2B_SOURCE_NAMES = [
  'celestyal_b2b_api_read',
  'celestyal_b2b_api',
];

let externalDownUntil = 0;

export const isDirectB2bDown = () => Date.now() < externalDownUntil;

export const getDirectB2bDownRemainingMs = () => Math.max(0, externalDownUntil - Date.now());

export const markDirectB2bDown = (cooldownMs = DIRECT_B2B_DOWN_COOLDOWN_MS) => {
  externalDownUntil = Date.now() + Math.max(0, Number(cooldownMs) || 0);
};

export const clearDirectB2bDown = () => {
  externalDownUntil = 0;
};

export const isDirectB2bUnavailableError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('timeout')
    || message.includes('aborted')
    || message.includes('network')
    || message.includes('failed to fetch')
    || message.includes('unavailable')
    || message.includes('load failed')
  );
};
