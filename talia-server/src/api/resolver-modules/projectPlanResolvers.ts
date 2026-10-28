/**
 * Project plan — phases and milestones. ADMIN+.
 * Milestone names are the same labels as requirement target_version.
 */

import { supabase } from '../../services/supabase.js';
import { requireProjectAdmin } from './projectRecordLinks.js';

const PHASES = new Set(['0', 'mvp', '1', '2', '3']);

const optionalDate = (value: any) => {
  if (value == null || value === '') return null;
  const text = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Dates use YYYY-MM-DD');
  return text;
};

const phaseCode = (value: any) => {
  if (value == null || value === '') return null;
  const code = String(value).trim();
  if (!PHASES.has(code)) throw new Error('Phase must be Dev, MVP, 1, 2, or 3');
  return code;
};

const mapPhase = (row: any) => ({
  code: row.code,
  label: row.label,
  targetOn: row.target_on ?? null,
  sortOrder: row.sort_order ?? 0,
});

const mapMilestone = (row: any) => ({
  id: row.id,
  name: row.name,
  phaseCode: row.phase_code ?? null,
  targetOn: row.target_on ?? null,
  sortOrder: row.sort_order ?? 0,
});

async function ensureMilestonesFromRequirements() {
  const { data: requirements, error: requirementError } = await supabase
    .from('talia_requirement_item')
    .select('target_version');
  if (requirementError) throw new Error(requirementError.message);

  const { data: existing, error: existingError } = await supabase
    .from('project_milestone')
    .select('name');
  if (existingError) throw new Error(existingError.message);

  const known = new Set((existing || []).map((row) => String(row.name || '').trim().toLowerCase()));
  const missing: { name: string }[] = [];
  (requirements || []).forEach((row) => {
    const name = String(row.target_version || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (known.has(key)) return;
    known.add(key);
    missing.push({ name });
  });
  if (!missing.length) return;

  const { error } = await supabase.from('project_milestone').insert(missing);
  if (error) throw new Error(error.message);
}

async function loadCalendar() {
  await ensureMilestonesFromRequirements();
  const [phases, milestones] = await Promise.all([
    supabase.from('project_phase').select('*').order('sort_order'),
    supabase.from('project_milestone').select('*').order('sort_order').order('name'),
  ]);
  if (phases.error) throw new Error(phases.error.message);
  if (milestones.error) throw new Error(milestones.error.message);
  return {
    phases: (phases.data || []).map(mapPhase),
    milestones: (milestones.data || []).map(mapMilestone),
  };
}

export const projectPlanQueryResolvers = {
  projectPlanCalendar: async (_parent: any, _args: any, context: any) => {
    requireProjectAdmin(context);
    return loadCalendar();
  },
};

export const projectPlanMutationResolvers = {
  saveProjectPlan: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const input = args?.input || {};
    const code = phaseCode(input.phaseCode);
    if (!code) throw new Error('A phase is required');
    const targetOn = optionalDate(input.targetOn);

    const phaseUpdate = await supabase
      .from('project_phase')
      .update({ target_on: targetOn })
      .eq('code', code);
    if (phaseUpdate.error) throw new Error(phaseUpdate.error.message);

    const rows = Array.isArray(input.milestones) ? input.milestones : [];
    for (const row of rows) {
      const name = String(row?.name || '').trim();
      if (!name) throw new Error('A milestone needs a name');
      const payload = {
        name,
        phase_code: phaseCode(row?.phaseCode),
        target_on: optionalDate(row?.targetOn),
        sort_order: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
      };
      if (row?.id) {
        const updated = await supabase.from('project_milestone').update(payload).eq('id', row.id);
        if (updated.error) throw new Error(updated.error.message);
      } else {
        const inserted = await supabase.from('project_milestone').insert(payload);
        if (inserted.error) throw new Error(inserted.error.message);
      }
    }

    return loadCalendar();
  },
};
