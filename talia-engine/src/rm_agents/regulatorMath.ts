import { randomUUID } from 'node:crypto';
import { severityFromScore, type Finding } from '../contracts/finding.js';

export const REGULATOR_AGENT_ID = 'rm.regulator.performance_vs_target';

export type RegulatorSailInput = {
  sail_code: string;
  ship_code?: string | null;
  ship_name?: string | null;
  sail_date_from?: string | null;
  load_factor: number | null;
  target_load_factor: number | null;
  target_name?: string | null;
  occupied_cabins?: number | null;
  total_cabins?: number | null;
  days_to_sail: number | null;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function interpolateTargetLf(
  points: Array<{ weeks_until_sailing: number; lf_pct: number }>,
  daysToSail: number | null
): number | null {
  if (!points.length || daysToSail == null || !Number.isFinite(daysToSail)) return null;
  const weeks = Math.max(0, daysToSail / 7);
  const sorted = [...points].sort((a, b) => a.weeks_until_sailing - b.weeks_until_sailing);
  if (weeks <= sorted[0].weeks_until_sailing) return sorted[0].lf_pct / 100;
  if (weeks >= sorted[sorted.length - 1].weeks_until_sailing) {
    return sorted[sorted.length - 1].lf_pct / 100;
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (weeks >= lo.weeks_until_sailing && weeks <= hi.weeks_until_sailing) {
      const span = hi.weeks_until_sailing - lo.weeks_until_sailing || 1;
      const t = (weeks - lo.weeks_until_sailing) / span;
      return (lo.lf_pct + (hi.lf_pct - lo.lf_pct) * t) / 100;
    }
  }
  return sorted[sorted.length - 1].lf_pct / 100;
}

export function regulatorScore(gapSigned: number, daysToSail: number | null): number {
  const behind = Math.max(0, -gapSigned);
  const gapPart = clamp01(behind / 0.2);
  const days = daysToSail == null ? 90 : Math.max(0, daysToSail);
  const proximity = clamp01(1 - days / 180);
  if (behind <= 0) {
    return clamp01(0.08 + proximity * 0.12);
  }
  return clamp01(gapPart * 0.7 + proximity * 0.3);
}

export function chooseAction(gapSigned: number, daysToSail: number | null, hasTarget: boolean) {
  if (!hasTarget) {
    return {
      action_type: 'REVIEW_TARGET',
      params: { dimension: 'occupancy' },
      rationale: 'No voyage load-factor target is configured for this sailing.',
    };
  }
  const behind = -gapSigned;
  const days = daysToSail == null ? 999 : daysToSail;
  if (behind >= 0.15) {
    return {
      action_type: 'ESCALATE_SAILING',
      params: { dimension: 'occupancy', gap_signed: gapSigned },
      rationale: 'Load factor trails the selected target by 15pp or more.',
    };
  }
  if (behind >= 0.08 && days <= 60) {
    return {
      action_type: 'REVIEW_PRICING',
      params: { dimension: 'occupancy', gap_signed: gapSigned },
      rationale: 'Load factor and days-to-sail suggest a pricing review against the target band.',
    };
  }
  if (behind >= 0.05) {
    return {
      action_type: 'REVIEW_INVENTORY',
      params: { dimension: 'occupancy', gap_signed: gapSigned },
      rationale: 'Load factor is behind target; review inventory posture and remaining sellable stock.',
    };
  }
  return {
    action_type: 'REVIEW_TARGET',
    params: { dimension: 'occupancy', gap_signed: gapSigned },
    rationale: 'Performance is near or ahead of the target; confirm the target still matches the book.',
  };
}

export function evaluateRegulatorSails(
  sails: RegulatorSailInput[],
  asOf: Date
): Finding[] {
  return sails.map((sail) => {
    const hasTarget = sail.target_load_factor != null;
    const hasActual = sail.load_factor != null;
    const gapSigned = hasTarget && hasActual
      ? Number(sail.load_factor) - Number(sail.target_load_factor)
      : 0;
    const score = !hasActual
      ? 0.35
      : !hasTarget
        ? 0.4
        : regulatorScore(gapSigned, sail.days_to_sail);
    const action = !hasActual
      ? {
        action_type: 'REVIEW_INVENTORY',
        params: { dimension: 'occupancy' },
        rationale: 'No occupancy snapshot is available to compare with the target.',
      }
      : chooseAction(gapSigned, sail.days_to_sail, hasTarget);

    return {
      finding_id: randomUUID(),
      agent_id: REGULATOR_AGENT_ID,
      subject: {
        type: 'sailing',
        id: sail.sail_code,
        ship_code: sail.ship_code || null,
        ship_name: sail.ship_name || null,
        sail_date_from: sail.sail_date_from || null,
      },
      as_of: asOf.toISOString(),
      score,
      severity: severityFromScore(score),
      recommended_action: action,
      evidence: {
        load_factor: sail.load_factor,
        target_load_factor: sail.target_load_factor,
        target_name: sail.target_name || null,
        gap_signed: hasTarget && hasActual ? gapSigned : null,
        days_to_sail: sail.days_to_sail,
        occupied_cabins: sail.occupied_cabins ?? null,
        total_cabins: sail.total_cabins ?? null,
      },
      confidence: hasTarget && hasActual ? 0.7 : 0.4,
      status: 'open',
    };
  });
}
