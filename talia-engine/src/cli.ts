import { registerDefaultRmAgents } from './runtime/registry.js';
import { runRmAgents } from './runtime/runner.js';
import { runDriverAnalysis } from './science/driverAnalysis.js';

const command = process.argv[2] || 'run';
const sailCodes = process.argv.slice(3).filter((arg) => !arg.startsWith('-'));

registerDefaultRmAgents();

if (command === 'driver-analysis' || command === 'science') {
  try {
    const result = await runDriverAnalysis({
      sailCodes: sailCodes.length ? sailCodes : undefined,
      trigger: 'on_demand',
    });
    console.log(JSON.stringify({
      success: true,
      run: result.run,
      artifact_count: result.artifacts.length,
      portfolio_revenue_value: result.portfolio_revenue_value,
      citations: result.citations,
    }, null, 2));
  } catch (error: any) {
    console.error(error?.message || error);
    process.exit(1);
  }
  process.exit(0);
}

if (command !== 'run') {
  console.error('Usage: npm run run -- [sail_code ...]');
  console.error('       npm run run -- driver-analysis [sail_code ...]');
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
