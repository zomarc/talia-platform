import type { RmAgent } from '../rm_agents/base.js';
import { regulatorAgent } from '../rm_agents/regulator.js';

const agents = new Map<string, RmAgent>();

export function registerRmAgent(agent: RmAgent): void {
  if (!agent?.id || !agent.evaluate) {
    throw new Error('RM Agent requires id and evaluate()');
  }
  agents.set(agent.id, agent);
}

export function getRmAgent(id: string): RmAgent | undefined {
  return agents.get(id);
}

export function listRmAgents(): RmAgent[] {
  return [...agents.values()];
}

export function registerDefaultRmAgents(): void {
  registerRmAgent(regulatorAgent);
}
