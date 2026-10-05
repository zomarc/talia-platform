/**
 * Requirements Log — ADMIN+/SUPER_USER GraphQL resolvers.
 * Table: public.talia_requirement_item
 */

import { supabase } from '../../services/supabase.js';

const SECTIONS = new Set(['deliverable', 'external', 'question']);
const STATUSES = new Set(['backlog', 'in_progress', 'done', 'cancelled']);
const PRIORITIES = new Set(['p0', 'p1', 'p2']);
const AREAS = new Set(['ui', 'data', 'engine', 'docs', 'ops']);
const SOURCES = new Set(['manual', 'plaud', 'cursor']);

const normalizeRole = (role: any) => {
  const r = String(role || '').toUpperCase();
  return r === 'SUPERUSER' ? 'SUPER_USER' : r;
};

const requireAdmin = (context: any) => {
  const role = normalizeRole(context?.user?.role || context?.role);
  if (role !== 'ADMIN' && role !== 'SUPER_USER') {
    throw new Error('Only Admin or Super User can access the Requirements Log');
  }
};

const currentUserKey = (context: any) =>
  context?.user?.id != null && context.user.id !== '' ? String(context.user.id) : null;

const mapItem = (row: any) => ({
  id: row.id,
  section: row.section,
  title: row.title,
  detail: row.detail ?? null,
  status: row.status,
  priority: row.priority,
  area: row.area ?? null,
  targetVersion: row.target_version ?? null,
  taliaVersion: row.talia_version ?? null,
  owner: row.owner ?? null,
  source: row.source,
  sourceRef: row.source_ref ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? null,
});

const normalizeOptional = (value: any) => {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
};

const validateEnum = (value: string, allowed: Set<string>, label: string) => {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
};

const buildRowFromInput = (input: any, { forInsert, createdBy }: { forInsert: boolean; createdBy?: string | null }) => {
  const section = String(input?.section || '').trim();
  validateEnum(section, SECTIONS, 'section');

  const title = String(input?.title || '').trim();
  if (!title) throw new Error('title is required');

  const status = String(input?.status || 'backlog').trim();
  validateEnum(status, STATUSES, 'status');

  const priority = String(input?.priority || 'p1').trim();
  validateEnum(priority, PRIORITIES, 'priority');

  const areaRaw = normalizeOptional(input?.area);
  if (areaRaw) validateEnum(areaRaw, AREAS, 'area');

  const source = String(input?.source || (forInsert ? 'manual' : 'manual')).trim();
  validateEnum(source, SOURCES, 'source');

  const targetVersion = normalizeOptional(input?.targetVersion);
  const taliaVersion = normalizeOptional(input?.taliaVersion);

  const row: Record<string, any> = {
    section,
    title,
    detail: normalizeOptional(input?.detail),
    status,
    priority,
    area: areaRaw,
    target_version: targetVersion,
    talia_version: taliaVersion,
    owner: normalizeOptional(input?.owner),
    source,
    source_ref: normalizeOptional(input?.sourceRef),
  };

  if (forInsert) {
    if (input?.id) row.id = String(input.id);
    row.created_by = createdBy ?? null;
  }

  return row;
};

const upsertOne = async (input: any, context: any) => {
  const id = input?.id ? String(input.id) : null;
  const createdBy = currentUserKey(context);

  if (id) {
    const { data: existing, error: findError } = await supabase
      .from('talia_requirement_item')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existing) {
      const patch = buildRowFromInput(input, { forInsert: false });
      // Preserve source on update unless explicitly provided
      if (input?.source == null) delete patch.source;
      if (input?.sourceRef === undefined) delete patch.source_ref;

      const { data, error } = await supabase
        .from('talia_requirement_item')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapItem(data);
    }
  }

  const insertRow = buildRowFromInput(input, { forInsert: true, createdBy });
  const { data, error } = await supabase
    .from('talia_requirement_item')
    .insert(insertRow)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapItem(data);
};

export const requirementQueryResolvers = {
  requirementItems: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const filters = args?.filters || {};
    const limit = Math.min(Math.max(Number(filters.limit) || 500, 1), 2000);

    let query = supabase
      .from('talia_requirement_item')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (filters.section) query = query.eq('section', String(filters.section));
    if (filters.status) query = query.eq('status', String(filters.status));
    else if (filters.includeDone !== true) {
      query = query.not('status', 'in', '(done,cancelled)');
    }
    if (filters.targetVersion) query = query.eq('target_version', String(filters.targetVersion));
    if (filters.taliaVersion) query = query.eq('talia_version', String(filters.taliaVersion));
    if (filters.owner) query = query.ilike('owner', `%${String(filters.owner)}%`);
    if (filters.priority) query = query.eq('priority', String(filters.priority));
    if (filters.area) query = query.eq('area', String(filters.area));
    if (filters.source) query = query.eq('source', String(filters.source));

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(mapItem);
  },
};

export const requirementMutationResolvers = {
  upsertRequirementItem: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    return upsertOne(args?.input || {}, context);
  },

  upsertRequirementItems: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const inputs = Array.isArray(args?.inputs) ? args.inputs : [];
    if (inputs.length === 0) return [];
    if (inputs.length > 200) throw new Error('upsertRequirementItems accepts at most 200 items');
    const results = [];
    for (const input of inputs) {
      results.push(await upsertOne(input || {}, context));
    }
    return results;
  },

  deleteRequirementItem: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('id is required');
    const { error } = await supabase.from('talia_requirement_item').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  setRequirementItemStatus: async (_parent: any, args: any, context: any) => {
    requireAdmin(context);
    const id = String(args?.id || '');
    const status = String(args?.status || '').trim();
    if (!id) throw new Error('id is required');
    validateEnum(status, STATUSES, 'status');
    const { data, error } = await supabase
      .from('talia_requirement_item')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapItem(data);
  },
};
