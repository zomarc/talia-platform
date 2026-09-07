import type { EvaluationContext, RmAgent } from './base.js';
import {
  REGULATOR_AGENT_ID,
  evaluateRegulatorSails,
  interpolateTargetLf,
  type RegulatorSailInput,
} from './regulatorMath.js';

const daysBetween = (asOf: Date, sailDate: string | null): number | null => {
  if (!sailDate) return null;
  const start = Date.parse(`${String(sailDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start)) return null;
  return Math.round((start - Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())) / 86400000);
};

export const regulatorAgent: RmAgent = {
  id: REGULATOR_AGENT_ID,
  name: 'Regulator — performance vs target',
  evaluate: (ctx: EvaluationContext) => {
    const world = ctx.world || {};
    const sails = Array.isArray(world.sails) ? world.sails : [];
    const occupancyBySail = world.occupancyBySail && typeof world.occupancyBySail === 'object'
      ? world.occupancyBySail as Record<string, { load_factor: number; occupied_cabins: number; total_cabins: number }>
      : {};
    const targetsBySail = world.targetsBySail && typeof world.targetsBySail === 'object'
      ? world.targetsBySail as Record<string, { name?: string; points: Array<{ weeks_until_sailing: number; lf_pct: number }> }>
      : {};

    const requested = ctx.subjects === 'all-configured'
      ? sails
      : sails.filter((sail: any) => ctx.subjects.some((subject) => subject.id === String(sail.sail_code || '')));

    const inputs: RegulatorSailInput[] = requested.map((sail: any) => {
      const sailCode = String(sail.sail_code || '');
      const days = daysBetween(ctx.as_of, sail.sail_date_from || null);
      const occ = occupancyBySail[sailCode] || null;
      const target = targetsBySail[sailCode] || null;
      return {
        sail_code: sailCode,
        ship_code: sail.ship_code || null,
        ship_name: sail.ship_name || null,
        sail_date_from: sail.sail_date_from || null,
        load_factor: occ?.load_factor ?? null,
        target_load_factor: interpolateTargetLf(target?.points || [], days),
        target_name: target?.name || null,
        occupied_cabins: occ?.occupied_cabins ?? null,
        total_cabins: occ?.total_cabins ?? null,
        days_to_sail: days,
      };
    }).filter((row) => row.sail_code);

    return evaluateRegulatorSails(inputs, ctx.as_of);
  },
};
