import { createEngineServer } from './http.js';
import { registerDefaultRmAgents } from './runtime/registry.js';
import { runRmAgents } from './runtime/runner.js';
import { startScheduler } from './runtime/scheduler.js';

const port = Number(process.env.ENGINE_PORT || 4100);

registerDefaultRmAgents();
const server = createEngineServer();

server.listen(port, '0.0.0.0', () => {
  console.log(`[talia-engine] Agent Runtime listening on :${port}`);
  startScheduler();
  if (process.env.ENGINE_RUN_ON_START !== '0') {
    runRmAgents({ trigger: 'startup', limit: Number(process.env.ENGINE_STARTUP_LIMIT || 24) })
      .then((result) => {
        console.log(`[talia-engine] startup run ${result.run.run_id} findings=${result.findings.length}`);
      })
      .catch((error) => {
        console.error('[talia-engine] startup run failed:', error?.message || error);
      });
  }
});
