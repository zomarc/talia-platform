import { registerDefaultRmAgents } from './runtime/registry.js';
import { runRmAgents } from './runtime/runner.js';

const command = process.argv[2] || 'run';
const sailCodes = process.argv.slice(3).filter((arg) => !arg.startsWith('-'));

registerDefaultRmAgents();

if (command !== 'run') {
  console.error('Usage: npm run run -- [sail_code ...]');
  process.exit(1);
}

try {
  const result = await runRmAgents({
    sailCodes: sailCodes.length ? sailCodes : undefined,
    trigger: 'on_demand',
  });
  console.log(JSON.stringify({
    success: true,
    run: result.run,
    finding_count: result.findings.length,
    world: result.worldCounts,
  }, null, 2));
} catch (error: any) {
  console.error(error?.message || error);
  process.exit(1);
}
