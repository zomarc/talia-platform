/**
 * taliahub-gateway: minimal Worker fallback
 *
 * Behavior:
 * - If origin is reachable, proxy the response
 * - If origin is down (timeout/5xx/ngrok error), return holding page
 */

const HOLDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Talia Hub – Temporarily Unavailable</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #151528 50%, #1a1a2e 100%);
      color: #e8e8f0;
    }
    .card {
      width: min(520px, 92vw);
      padding: 28px 28px 24px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .logo {
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 11px;
      color: rgba(232, 232, 240, 0.55);
    }
    h1 {
      margin: 10px 0 8px;
      font-size: 20px;
      font-weight: 600;
      color: #e8e8f0;
    }
    .subtitle {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: rgba(232, 232, 240, 0.75);
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 16px 0 14px;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: rgba(232, 232, 240, 0.55);
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(91, 155, 213, 0.35);
      color: #5b9bd5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Talia</div>
    <h1>Temporarily Unavailable</h1>
    <p class="subtitle">We are preparing your workspace. Please try again shortly.</p>
    <div class="divider"></div>
    <div class="meta">
      <span class="badge">Status</span>
      <span>Offline</span>
    </div>
  </div>
</body>
</html>`;

// ngrok DNS target hostname (no scheme)
const NGROK_RESOLVE = '3gdvs2ekygjh8etb5.2yicxjompem9a7yrz.ngrok-cname.com';
// Laptop tunnels can spike under CF→ngrok latency; 8s was flipping clients to holding.
const ORIGIN_TIMEOUT_MS = 20000;
/** Hashed bundles are ~3–4MB; allow slow client paths without aborting origin fetch. */
const ASSET_ORIGIN_TIMEOUT_MS = 120000;

const isHashedAssetPath = (pathname) => (
  /^\/assets\/[^/]+\.(js|css|woff2?|png|jpe?g|svg|webp|gif|ico)$/i.test(pathname)
);

// Map public hostnames to the ngrok reserved domain Host header.
// Laptop discuss URL is https://dev.taliahub.com — same tunnel as apex (single reserved domain).
// Apex + aliases stay for staging / legacy bookmarks; Host is rewritten to taliahub.com for ngrok.
const HOST_MAP = {
  'taliahub.com': 'taliahub.com',
  'www.taliahub.com': 'taliahub.com',
  'dev.taliahub.com': 'taliahub.com',
  'celestyal.taliahub.com': 'taliahub.com',
};

function isNgrokError(res) {
  const code = res.headers.get('ngrok-error-code');
  return Boolean(code && code.startsWith('ERR_NGROK_'));
}

function holdingResponse() {
  return new Response(HOLDING_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-TaliaHub-Gateway': 'fallback',
    },
    status: 503,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originHost = HOST_MAP[url.hostname] || 'taliahub.com';
    const originUrl = new URL(url.toString());
    originUrl.hostname = originHost;
    const hashedAsset = isHashedAssetPath(url.pathname);
    const originTimeoutMs = hashedAsset ? ASSET_ORIGIN_TIMEOUT_MS : ORIGIN_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), originTimeoutMs);

    try {
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.set('ngrok-skip-browser-warning', 'true');

      const originRequest = new Request(originUrl.toString(), {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        cf: {
          resolveOverride: NGROK_RESOLVE,
          cacheTtl: hashedAsset ? 86400 : 0,
          cacheEverything: hashedAsset,
        },
      });

      const res = await fetch(originRequest, { signal: controller.signal });
      if (isNgrokError(res) || res.status >= 500) {
        return holdingResponse();
      }

      const responseHeaders = new Headers(res.headers);
      if (hashedAsset && res.status === 200) {
        responseHeaders.set('Cache-Control', 'public, max-age=86400, immutable');
      }
      responseHeaders.set('X-TaliaHub-Gateway', 'proxied');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    } catch (e) {
      return holdingResponse();
    } finally {
      clearTimeout(timeout);
    }
  },
};
