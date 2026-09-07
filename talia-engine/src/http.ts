import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { engineSnapshot, runRmAgents } from './runtime/runner.js';
import { pythonStatus, runPythonAnalyze } from './python/runner.js';

const VERSION = '0.1.0';

const readJson = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const send = (res: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
};

export function createEngineServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://talia-engine.local');
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        const python = await pythonStatus();
        send(res, 200, {
          ok: true,
          service: 'talia-engine',
          version: VERSION,
          python,
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/agents') {
        send(res, 200, { agents: engineSnapshot().agents });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/runs') {
        send(res, 200, { runs: engineSnapshot().runs, last_run: engineSnapshot().last_run });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/python') {
        send(res, 200, await pythonStatus());
        return;
      }
      if (req.method === 'POST' && url.pathname === '/runs') {
        const body = await readJson(req);
        const result = await runRmAgents({
          sailCodes: Array.isArray(body.sailCodes) ? body.sailCodes : undefined,
          agentIds: Array.isArray(body.agentIds) ? body.agentIds : undefined,
          limit: body.limit,
          trigger: 'on_demand',
        });
        send(res, 200, {
          success: true,
          run: result.run,
          finding_count: result.findings.length,
          world: result.worldCounts,
        });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/python/analyze') {
        const body = await readJson(req);
        send(res, 200, await runPythonAnalyze({
          task: String(body.task || 'ping'),
          payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
        }));
        return;
      }
      send(res, 404, { error: 'not found' });
    } catch (error: any) {
      send(res, 500, { success: false, error: error?.message || String(error) });
    }
  });
}
