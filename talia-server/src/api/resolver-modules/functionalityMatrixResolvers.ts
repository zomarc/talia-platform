/**
 * Functionality Matrix — ADMIN+/SUPER_USER.
 * Tables: functionality_matrix_item, functionality_matrix_note, functionality_matrix_link.
 * Requirements Log rows are assigned by link; they are not stored on the matrix.
 */

import { supabase } from '../../services/supabase.js';

const PHASES = new Set(['0', 'mvp', '1', '2', '3']);
const RANKS = new Set(['L', 'M', 'H']);

const normalizeRole = (role: any) => {
  const value = String(role || '').toUpperCase();
  return value === 'SUPERUSER' ? 'SUPER_USER' : value;
};

const requireAdmin = (context: any) => {
  const role = normalizeRole(context?.user?.role || context?.role);
  if (role !== 'ADMIN' && role !== 'SUPER_USER') {
    throw new Error('Only Admin or Super User can access the Functionality Matrix');
  }
};

const currentUserKey = (context: any) =>
  context?.user?.id != null && context.user.id !== '' ? String(context.user.id) : null;

const normalizeOptional = (value: any) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const requireText = (value: any, label: string) => {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
};

const normalizeRank = (value: any, fallback: string) => {
  const rank = String(value || fallback).trim().toUpperCase();
  if (!RANKS.has(rank)) throw new Error(`Invalid rank: ${value}`);
  return rank;
};

const normalizePhase = (value: any) => {
  const phase = String(value || '0').trim().toLowerCase();
  if (!PHASES.has(phase)) throw new Error(`Invalid phase: ${value}`);
  return phase;
};

const normalizeReference = (value: any) => {
  const code = String(value || '').trim().toUpperCase();
  if (!/^R\d+$/.test(code)) throw new Error('Reference must look like R001');
  const number = code.slice(1).replace(/^0+(?=\d)/, '');
  return `R${number.padStart(3, '0')}`;
};

const mapNote = (row: any) => ({
  id: row.id,
  body: row.body,
  createdAt: row.created_at,
  createdBy: row.created_by ?? null,
});

const mapLink = (row: any, requirement: any) => ({
  requirementItemId: row.requirement_item_id,
  title: requirement?.title ?? null,
  section: requirement?.section ?? null,
  status: requirement?.status ?? null,
});

const mapItem = (row: any, notes: any[], links: any[]) => ({
  id: row.id,
  referenceCode: row.reference_code,
  element: row.element,
  functionName: row.function_name,
  shortName: row.short_name,
  name: row.name,
  concept: row.concept ?? null,
  rationale: row.rationale ?? null,
  technicalRequirement: row.technical_requirement ?? null,
  complexity: row.complexity,
  size: row.size_rank,
  phase: row.phase,
  sortOrder: row.sort_order ?? 0,
  notes,
  links,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? null,
});

const loadBundle = async (onlyId?: string | null) => {
  let itemQuery = supabase
    .from('functionality_matrix_item')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('reference_code', { ascending: true });
  if (onlyId) itemQuery = itemQuery.eq('id', onlyId);

  const { data: itemRows, error: itemError } = await itemQuery;
  if (itemError) throw new Error(itemError.message);
  const items = itemRows || [];
  if (items.length === 0) return [];

  const ids = items.map((row) => row.id);
  const { data: noteRows, error: noteError } = await supabase
    .from('functionality_matrix_note')
    .select('*')
    .in('matrix_item_id', ids)
    .order('created_at', { ascending: true });
  if (noteError) throw new Error(noteError.message);

  const { data: linkRows, error: linkError } = await supabase
    .from('functionality_matrix_link')
    .select('matrix_item_id, requirement_item_id, created_at')
    .in('matrix_item_id', ids);
  if (linkError) throw new Error(linkError.message);

  const requirementIds = [...new Set((linkRows || []).map((row) => row.requirement_item_id).filter(Boolean))];
  let requirements: any[] = [];
  if (requirementIds.length) {
    const { data, error } = await supabase
      .from('talia_requirement_item')
      .select('id, title, section, status')
      .in('id', requirementIds);
    if (error) throw new Error(error.message);
    requirements = data || [];
  }
  const requirementById = new Map(requirements.map((row) => [row.id, row]));

  const notesByItem = new Map<string, any[]>();
  (noteRows || []).forEach((row) => {
    const list = notesByItem.get(row.matrix_item_id) || [];
    list.push(mapNote(row));
    notesByItem.set(row.matrix_item_id, list);
  });

  const linksByItem = new Map<string, any[]>();
  (linkRows || []).forEach((row) => {
    const list = linksByItem.get(row.matrix_item_id) || [];
    list.push(mapLink(row, requirementById.get(row.requirement_item_id)));
    linksByItem.set(row.matrix_item_id, list);
  });

  return items.map((row) => mapItem(row, notesByItem.get(row.id) || [], linksByItem.get(row.id) || []));
};

const nextReferenceCode = async () => {
  const { data, error } = await supabase
    .from('functionality_matrix_item')
    .select('reference_code');
  if (error) throw new Error(error.message);
  let max = 0;
  (data || []).forEach((row) => {
    const match = /^R(\d+)$/i.exec(String(row.reference_code || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `R${String(max + 1).padStart(3, '0')}`;
};

const nextSortOrder = async () => {
  const { data, error } = await supabase
    .from('functionality_matrix_item')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const current = Number(data?.[0]?.sort_order) || 0;
  return current + 1;
};

const buildRow = async (input: any, { forInsert }: { forInsert: boolean }) => {
  const referenceCode = input?.referenceCode
    ? normalizeReference(input.referenceCode)
    : (forInsert ? await nextReferenceCode() : null);
  if (!referenceCode) throw new Error('Reference is required');

  const row: Record<string, any> = {
    reference_code: referenceCode,
    element: requireText(input?.element, 'Element'),
    function_name: requireText(input?.functionName, 'Function'),
    short_name: requireText(input?.shortName, 'Short name'),
    name: requireText(input?.name, 'Requirement name'),
    concept: normalizeOptional(input?.concept),
    rationale: normalizeOptional(input?.rationale),
    technical_requirement: normalizeOptional(input?.technicalRequirement),
    complexity: normalizeRank(input?.complexity, 'M'),
    size_rank: normalizeRank(input?.size, 'M'),
    phase: normalizePhase(input?.phase),
  };

  if (input?.sortOrder != null && input.sortOrder !== '') {
    row.sort_order = Number(input.sortOrder) || 0;
  } else if (forInsert) {
    row.sort_order = await nextSortOrder();
  }

  return row;
};

const loadOne = async (id: string) => {
  const rows = await loadBundle(id);
  if (!rows[0]) throw new Error('Matrix requirement not found');
  return rows[0];
};

export const functionalityMatrixQueryResolvers = {
  functionalityMatrixItems: async (_parent: any, _args: any, context: any) => {
    requireAdmin(context);
    return loadBundle(null);
  },
};

export const functionalityMatrixMutationResolvers = {
  upsertFunctionalityMatrixItem: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const input = args?.input || {};
    const id = input?.id ? String(input.id) : null;
    const createdBy = currentUserKey(context);

    if (id) {
      const { data: existing, error: findError } = await supabase
        .from('functionality_matrix_item')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!existing) throw new Error('Matrix requirement not found');

      const patch = await buildRow(input, { forInsert: false });
      const { error } = await supabase
        .from('functionality_matrix_item')
        .update(patch)
        .eq('id', id);
      if (error) throw new Error(error.message);
      return loadOne(id);
    }

    const insertRow = await buildRow(input, { forInsert: true });
    insertRow.created_by = createdBy;
    const { data, error } = await supabase
      .from('functionality_matrix_item')
      .insert(insertRow)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return loadOne(data.id);
  },

  deleteFunctionalityMatrixItem: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('functionality_matrix_item').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  addFunctionalityMatrixNote: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const matrixItemId = String(args?.matrixItemId || '');
    const body = requireText(args?.body, 'Discussion');
    if (!matrixItemId) throw new Error('matrixItemId is required');
    const { data, error } = await supabase
      .from('functionality_matrix_note')
      .insert({
        matrix_item_id: matrixItemId,
        body,
        created_by: currentUserKey(context),
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapNote(data);
  },

  deleteFunctionalityMatrixNote: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('functionality_matrix_note').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  setFunctionalityMatrixLinks: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const matrixItemId = String(args?.matrixItemId || '');
    if (!matrixItemId) throw new Error('matrixItemId is required');
    const desired = [...new Set(
      (Array.isArray(args?.requirementItemIds) ? args.requirementItemIds : [])
        .map((value: any) => String(value || '').trim())
        .filter(Boolean),
    )];

    if (desired.length) {
      const { data: found, error: foundError } = await supabase
        .from('talia_requirement_item')
        .select('id')
        .in('id', desired);
      if (foundError) throw new Error(foundError.message);
      const foundIds = new Set((found || []).map((row) => row.id));
      const missing = desired.filter((id) => !foundIds.has(id));
      if (missing.length) throw new Error('One or more Requirements Log items were not found');
    }

    const { data: existing, error: existingError } = await supabase
      .from('functionality_matrix_link')
      .select('requirement_item_id')
      .eq('matrix_item_id', matrixItemId);
    if (existingError) throw new Error(existingError.message);

    const have = new Set((existing || []).map((row) => row.requirement_item_id));
    const desiredSet = new Set(desired);
    const toAdd = desired.filter((id) => !have.has(id));
    const toRemove = [...have].filter((id) => !desiredSet.has(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from('functionality_matrix_link')
        .delete()
        .eq('matrix_item_id', matrixItemId)
        .in('requirement_item_id', toRemove);
      if (error) throw new Error(error.message);
    }

    if (toAdd.length) {
      const { error } = await supabase
        .from('functionality_matrix_link')
        .insert(toAdd.map((requirementItemId) => ({
          matrix_item_id: matrixItemId,
          requirement_item_id: requirementItemId,
        })));
      if (error) throw new Error(error.message);
    }

    return loadOne(matrixItemId);
  },
};
