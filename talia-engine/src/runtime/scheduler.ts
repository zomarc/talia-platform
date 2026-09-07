import { runRmAgents } from './runner.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  const ms = Number(process.env.ENGINE_RUN_INTERVAL_MS || 0);
  if (!Number.isFinite(ms) || ms < 30_000) return;
  if (timer) return;
  timer = setInterval(() => {
    runRmAgents({ trigger: 'schedule' }).catch((error) => {
      console.error('[talia-engine] scheduled run failed:', error?.message || error);
    });
  }, ms);
  timer.unref?.();
  console.log(`[talia-engine] scheduler every ${ms}ms`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
