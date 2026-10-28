/**
 * Labels for links between risks, documents, requirements, and matrix cells.
 */

import { supabase } from '../../services/supabase.js';

export const TARGET_REQUIREMENT = 'requirement';
export const TARGET_MATRIX = 'matrix';
export const TARGET_RISK = 'risk';

const normalizeRole = (role: any) => {
  const value = String(role || '').toUpperCase();
  return value === 'SUPERUSER' ? 'SUPER_USER' : value;
};

export const requireProjectAdmin = (context: any) => {
  const role = normalizeRole(context?.user?.role || context?.role);
  if (role !== 'ADMIN' && role !== 'SUPER_USER') {
    throw new Error('Only Admin or Super User can access project records');
  }
};

export const currentUserKey = (context: any) =>
  context?.user?.id != null && context.user.id !== '' ? String(context.user.id) : null;

const idsOf = (links: any[], kind: string) =>
  [...new Set(links.filter((link) => link.target_kind === kind).map((link) => link.target_id))];

export async function labelMapFor(links: any[]) {
  const map = new Map<string, string>();
  const requirementIds = idsOf(links, TARGET_REQUIREMENT);
  const matrixIds = idsOf(links, TARGET_MATRIX);
  const riskIds = idsOf(links, TARGET_RISK);

  if (requirementIds.length) {
    const { data, error } = await supabase
      .from('talia_requirement_item')
      .select('id, title')
      .in('id', requirementIds);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => map.set(`${TARGET_REQUIREMENT}:${row.id}`, row.title));
  }

  if (matrixIds.length) {
    const { data, error } = await supabase
      .from('functionality_matrix_item')
      .select('id, reference_code, short_name')
      .in('id', matrixIds);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      map.set(`${TARGET_MATRIX}:${row.id}`, `${row.reference_code} ${row.short_name}`.trim());
    });
  }

  if (riskIds.length) {
    const { data, error } = await supabase
      .from('risk_register_item')
      .select('id, reference_code, title')
      .in('id', riskIds);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      map.set(`${TARGET_RISK}:${row.id}`, `${row.reference_code} ${row.title}`.trim());
    });
  }

  return map;
}

export const mapLink = (row: any, labels: Map<string, string>) => ({
  targetKind: row.target_kind,
  targetId: row.target_id,
  label: labels.get(`${row.target_kind}:${row.target_id}`) || null,
});

const tableFor = (kind: string) => {
  if (kind === TARGET_REQUIREMENT) return 'talia_requirement_item';
  if (kind === TARGET_MATRIX) return 'functionality_matrix_item';
  if (kind === TARGET_RISK) return 'risk_register_item';
  return null;
};

export async function assertTargetsExist(links: Array<{ targetKind: string, targetId: string }>, allowed: Set<string>) {
  const grouped = new Map<string, string[]>();
  links.forEach((link) => {
    const kind = String(link.targetKind || '').trim();
    const id = String(link.targetId || '').trim();
    if (!allowed.has(kind)) throw new Error(`Cannot link to ${kind || 'that record'}`);
    if (!id) throw new Error('Link target is required');
    const list = grouped.get(kind) || [];
    list.push(id);
    grouped.set(kind, list);
  });

  for (const [kind, ids] of grouped) {
    const table = tableFor(kind);
    if (!table) throw new Error(`Cannot link to ${kind}`);
    const unique = [...new Set(ids)];
    const { data, error } = await supabase.from(table).select('id').in('id', unique);
    if (error) throw new Error(error.message);
    if ((data || []).length !== unique.length) {
      throw new Error(`One or more ${kind} records were not found`);
    }
  }
}
