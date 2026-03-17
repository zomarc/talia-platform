import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { typeDefs } from './api/schema.js';
import { resolvers } from './api/resolvers.js';
import { syncEventEmitter } from './services/sync-event-emitter.js';

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // Enable GraphQL Playground in development
    introspection: true
  });

  await server.start();

  // GraphQL Express app (port 4000)
  // Enables response compression for large GraphQL payloads.
  const graphqlApp = express();
  graphqlApp.use(cors({
    origin: '*',
    credentials: true
  }));
  graphqlApp.use(compression({ threshold: 1024 }));
  const graphqlJsonMiddleware = express.json({ limit: '10mb' });
  const graphqlHandler = expressMiddleware(server, {
    context: async () => ({
      user: {
        id: '1',
        role: 'ADMIN',
        email: 'admin@celestyal.com'
      }
    })
  });
  // Support both paths:
  // - /graphql for existing Vite proxy rewrite
  // - /api/graphql for direct external routing
  graphqlApp.use('/graphql', graphqlJsonMiddleware, graphqlHandler);
  graphqlApp.use('/api/graphql', graphqlJsonMiddleware, graphqlHandler);

  const GRAPHQL_PORT = 4000;
  graphqlApp.listen(GRAPHQL_PORT, () => {
    console.log(`🚀  Talia GraphQL Server ready at: http://localhost:${GRAPHQL_PORT}/api/graphql`);
    console.log(`🎮  GraphQL Playground: http://localhost:${GRAPHQL_PORT}/api/graphql`);
  });

  // Create Express app for SSE endpoint (on same port via proxy or separate port)
  // For now, use port 4001 to avoid conflicts
  const app = express();
  
  // CORS middleware
  app.use(cors({
    origin: '*',
    credentials: true
  }));
  app.use(compression({ threshold: 1024 }));

  app.use(express.json());

  const PUBLIC_ITINERARY_CATALOG_TTL_MS = 12 * 60 * 60 * 1000;
  let publicItineraryCatalogCache: {
    expiresAt: number;
    items: Array<{
      url: string;
      title: string;
      description: string;
      image: string;
      durationNights: number | null;
      slug: string;
    }>;
  } | null = null;

  // Public image proxy for external itinerary reference assets.
  // Keeps browser image loads same-origin and avoids cross-origin embed blocks.
  app.get('/api/public-image', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url query parameter' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid url query parameter' });
      return;
    }

    const allowedHosts = new Set([
      'celestyal.com',
      'www.celestyal.com',
      'tui.co.uk',
      'www.tui.co.uk',
      'virginvoyages.com',
      'www.virginvoyages.com',
      'virginvoyages.imgix.net',
      'royalcaribbean.com',
      'www.royalcaribbean.com',
      'assets.dm.rccl.com',
      'celebritycruises.com',
      'www.celebritycruises.com',
    ]);
    const host = parsedUrl.hostname.toLowerCase();
    const isAllowedHost = allowedHosts.has(host) || host.endsWith('.celestyal.com');
    if (!isAllowedHost) {
      res.status(403).json({ error: 'Host not allowed' });
      return;
    }

    try {
      const upstream = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Talia-Image-Proxy/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const body = Buffer.from(await upstream.arrayBuffer());

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).send(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(502).json({ error: `Failed to fetch upstream image: ${message}` });
    }
  });

  app.get('/api/public-itinerary-catalog', async (req, res) => {
    const now = Date.now();
    if (publicItineraryCatalogCache && publicItineraryCatalogCache.expiresAt > now) {
      res.status(200).json({ cached: true, items: publicItineraryCatalogCache.items });
      return;
    }

    const maxPages = Math.max(10, Math.min(200, Number(req.query.limit || 120)));
    const getMeta = (html: string, key: string, attr: 'property' | 'name') => {
      const pattern = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
      const match = html.match(pattern);
      return match?.[1]
        ? match[1]
          .replace(/&amp;/g, '&')
          .replace(/&#x26;/gi, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, '\'')
          .trim()
        : '';
    };
    const getDurationNights = (value: string) => {
      const match = value.match(/(\d{1,2})\s*night/i);
      return match ? Number(match[1]) : null;
    };
    const getSlug = (urlValue: string) => {
      try {
        const pathname = new URL(urlValue).pathname;
        const parts = pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '';
      } catch {
        return '';
      }
    };

    try {
      const sitemapResponse = await fetch('https://celestyal.com/sitemap.xml', {
        headers: { 'User-Agent': 'Talia-Public-Itinerary-Catalog/1.0' },
      });
      if (!sitemapResponse.ok) {
        res.status(502).json({ error: `Failed to fetch sitemap: ${sitemapResponse.status}` });
        return;
      }
      const sitemapXml = await sitemapResponse.text();
      const locMatches = Array.from(sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)).map((match) => match[1]);
      const itineraryUrls = Array.from(new Set(
        locMatches
          .map((urlValue) => (urlValue || '').trim())
          .filter((urlValue) =>
            /https:\/\/celestyal\.com\/gb\/our-cruises\/[^/?#]+$/i.test(urlValue)
          )
      )).slice(0, maxPages);

      const items: Array<{
        url: string;
        title: string;
        description: string;
        image: string;
        durationNights: number | null;
        slug: string;
      }> = [];

      for (const urlValue of itineraryUrls) {
        try {
          const pageResponse = await fetch(urlValue, {
            headers: { 'User-Agent': 'Talia-Public-Itinerary-Catalog/1.0' },
            signal: AbortSignal.timeout(12000),
          });
          if (!pageResponse.ok) continue;
          const pageHtml = await pageResponse.text();
          const title = getMeta(pageHtml, 'og:title', 'property');
          const description = getMeta(pageHtml, 'og:description', 'property')
            || getMeta(pageHtml, 'description', 'name');
          const image = getMeta(pageHtml, 'og:image', 'property')
            || getMeta(pageHtml, 'twitter:image', 'name');
          if (!title || !image) continue;

          items.push({
            url: urlValue,
            title,
            description,
            image,
            durationNights: getDurationNights(title),
            slug: getSlug(urlValue),
          });
        } catch {
          // skip pages that timeout/fail
        }
      }

      publicItineraryCatalogCache = {
        expiresAt: now + PUBLIC_ITINERARY_CATALOG_TTL_MS,
        items,
      };

      res.status(200).json({ cached: false, items });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(502).json({ error: `Failed to build itinerary catalog: ${message}` });
    }
  });

  app.get('/api/public-image-pool', async (req, res) => {
    const maxPages = Math.max(3, Math.min(40, Number(req.query.limit || 20)));
    const sources = [
      { page: 'https://www.tui.co.uk/cruise/deals/next-summer', label: 'TUI Cruise Deals' },
      { page: 'https://www.virginvoyages.com/cruise-deals', label: 'Virgin Voyages Deals' },
      { page: 'https://www.royalcaribbean.com/gbr/en/cruise-deals', label: 'Royal Caribbean Deals' },
      { page: 'https://www.celebritycruises.com/cruise-deals', label: 'Celebrity Cruises Deals' },
    ];

    const decodeMeta = (value: string) => value
      .replace(/&amp;/g, '&')
      .replace(/&#x26;/gi, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .trim();
    const extractMeta = (html: string, key: string, attr: 'property' | 'name') => {
      const pattern = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
      const match = html.match(pattern);
      return match?.[1] ? decodeMeta(match[1]) : '';
    };
    const normalizeImage = (value: string) => {
      const raw = (value || '').trim();
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('//')) return `https:${raw}`;
      return '';
    };
    const isUsefulImage = (value: string) => {
      const v = value.toLowerCase();
      return v.includes('.jpg') || v.includes('.jpeg') || v.includes('.png') || v.includes('.webp');
    };

    const items: Array<{ sourcePage: string; sourceLabel: string; imageUrl: string; title: string }> = [];
    for (const source of sources.slice(0, maxPages)) {
      try {
        const pageResponse = await fetch(source.page, {
          headers: { 'User-Agent': 'Talia-Public-Image-Pool/1.0' },
          signal: AbortSignal.timeout(12000),
        });
        if (!pageResponse.ok) continue;
        const html = await pageResponse.text();

        const ogImage = normalizeImage(extractMeta(html, 'og:image', 'property'));
        const twitterImage = normalizeImage(extractMeta(html, 'twitter:image', 'name'));
        const ogTitle = extractMeta(html, 'og:title', 'property');
        const title = ogTitle || source.label;
        const candidates = Array.from(new Set([ogImage, twitterImage].filter(Boolean)));

        candidates.forEach((imageUrl) => {
          if (!isUsefulImage(imageUrl)) return;
          items.push({
            sourcePage: source.page,
            sourceLabel: source.label,
            imageUrl,
            title,
          });
        });
      } catch {
        // best-effort only
      }
    }

    const deduped = Array.from(new Map(items.map((item) => [item.imageUrl, item])).values());
    res.status(200).json({ items: deduped });
  });

  // SSE endpoint for sync events
  app.get('/api/sync/stream/:tableName', (req, res) => {
    const { tableName } = req.params;
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', tableName, timestamp: new Date().toISOString() })}\n\n`);

    // Subscribe to sync events for this table
    const eventHandler = (event) => {
      // DEBUG: Log all events to see what's being received
      console.log(`[SSE DEBUG] Event received for tableName=${tableName}:`, {
        eventTableName: event.tableName,
        eventType: event.type,
        matches: event.tableName === tableName
      });
      
      if (event.tableName === tableName) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } else {
        console.log(`[SSE DEBUG] Event tableName mismatch: expected ${tableName}, got ${event.tableName}`);
      }
    };

    syncEventEmitter.subscribe(tableName, eventHandler);

    // Handle client disconnect
    req.on('close', () => {
      syncEventEmitter.off(`sync-${tableName}`, eventHandler);
      res.end();
    });

    // Keep connection alive with periodic ping
    const keepAliveInterval = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 30000); // Every 30 seconds

    req.on('close', () => {
      clearInterval(keepAliveInterval);
    });
  });

  // SSE endpoint for btop terminal
  // Executes btop on the host via docker exec (requires docker socket access)
  app.get('/api/btop/stream', (req, res) => {
    // Get terminal dimensions from query params, default to 120x30
    const cols = parseInt(req.query.cols as string) || 120;
    const rows = parseInt(req.query.rows as string) || 30;
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Import child_process
    import('child_process').then(({ spawn }) => {
      // Try to execute btop via docker exec on host
      // This assumes docker socket is accessible or we're in a privileged container
      // Alternative: Use docker exec to run in a container with btop installed
      // For now, try to execute directly - if btop is installed in container
      let btopProcess;

      // Check if we're in Docker (check for /.dockerenv)
      import('fs').then((fs) => {
        const isDocker = fs.existsSync('/.dockerenv');
        
        if (isDocker) {
          // In Docker: Use docker run to execute btop with host process access
          // This runs btop in a container with access to host's process tree
          console.log('Running btop via docker (Dockerized environment)...');
          
          // Run btop in alpine container with host PID namespace to see host processes
          // Use -t flag to allocate a TTY (btop requires it), but don't use -i (interactive)
          // stdin is ignored, so we don't need -i
          // Use stty to set terminal size before running btop (btop needs actual terminal dimensions)
          const colsStr = cols.toString();
          const rowsStr = rows.toString();
          btopProcess = spawn('docker', [
            'run', '--rm', '-t',
            '--pid', 'host',
            '--network', 'host',
            '--env', 'TERM=xterm-256color',
            '--env', 'LANG=en_US.UTF-8',
            '--env', 'LC_ALL=en_US.UTF-8',
            '--env', `COLUMNS=${colsStr}`,
            '--env', `LINES=${rowsStr}`,
            'alpine:latest',
            'sh', '-c', `apk add --no-cache btop > /dev/null 2>&1 && stty rows ${rowsStr} cols ${colsStr} 2>/dev/null && export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 COLUMNS=${colsStr} LINES=${rowsStr} && exec btop --force-utf`
          ], {
            env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', COLUMNS: colsStr, LINES: rowsStr },
            stdio: ['ignore', 'pipe', 'pipe']
          });
        } else {
          // Not in Docker (local dev): Execute btop using script to create a pseudo-TTY
          // btop requires a TTY, so we use 'script' to create one
          console.log('Running btop directly (local environment)...');
          // macOS script command format: script [-q] file command
          // -q: quiet mode (suppress start/stop messages)
          // The output file is required but we capture stdout/stderr via pipes
          // Use stty to set terminal size before running btop (btop needs actual terminal dimensions)
          const colsStr = cols.toString();
          const rowsStr = rows.toString();
          btopProcess = spawn('script', [
            '-q',
            '/dev/null',
            'sh', '-c', `stty rows ${rowsStr} cols ${colsStr} 2>/dev/null; export COLUMNS=${colsStr} LINES=${rowsStr} TERM=xterm-256color LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 && exec btop --force-utf`
          ], {
            env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', COLUMNS: colsStr, LINES: rowsStr },
            stdio: ['ignore', 'pipe', 'pipe']
          });
        }

        // Stream stdout to client
        btopProcess.stdout.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        // Stream stderr to client
        btopProcess.stderr.on('data', (data) => {
          const errorText = data.toString();
          res.write(`data: ${JSON.stringify({ type: 'output', data: errorText })}\n\n`);
        });

        btopProcess.on('error', (error) => {
          console.error('btop process error:', error);
          // If btop not found, provide helpful message
          if (error.message.includes('ENOENT') || error.message.includes('spawn')) {
            const errorMsg = isDocker 
              ? 'btop not found. In Dockerized environments, btop runs via docker run with host access.'
              : 'btop not found. Please install btop on your local machine.';
            res.write(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          }
        });

        btopProcess.on('close', (code) => {
          res.write(`data: ${JSON.stringify({ type: 'closed', code })}\n\n`);
          res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
          if (btopProcess) {
            btopProcess.kill();
          }
          res.end();
        });
      }).catch((fsError) => {
        // Fallback: try executing btop directly
        const btopProcess = spawn('btop', [], {
          env: { ...process.env, TERM: 'xterm-256color' },
          stdio: ['ignore', 'pipe', 'pipe']
        });

        btopProcess.stdout.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        btopProcess.stderr.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        btopProcess.on('error', (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        });

        req.on('close', () => {
          btopProcess.kill();
          res.end();
        });
      });
    }).catch((error) => {
      console.error('Error setting up btop stream:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });
  });

  // Start Express server for SSE on port 4001
  const SSE_PORT = 4001;
  app.listen(SSE_PORT, () => {
    console.log(`📡  SSE Stream endpoint: http://localhost:${SSE_PORT}/api/sync/stream/:tableName`);
    console.log(`📚  Enhanced with Focus Management & Role-based Access`);
    console.log(`🔐  Current user: admin@celestyal.com (ADMIN)`);
    console.log(`🔄  Running in watch mode - changes will auto-reload`);
  });
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
