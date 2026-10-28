/**
 * Risk register — ADMIN+/SUPER_USER.
 * Links point at Requirements Log rows and Functionality Matrix cells.
 */

import { supabase } from '../../services/supabase.js';
import {
  TARGET_MATRIX,
  TARGET_REQUIREMENT,
  assertTargetsExist,
  currentUserKey,
  labelMapFor,
  mapLink,
  requireProjectAdmin,
} from './projectRecordLinks.js';

const CATEGORIES = new Set(['supplier', 'people', 'process', 'benefits', 'technical', 'external']);
const STATUSES = new Set(['open', 'treating', 'accepted', 'closed', 'occurred']);
const RESPONSES = new Set(['avoid', 'reduce', 'transfer', 'accept']);
const PROXIMITIES = new Set(['immediate', 'phase', 'later']);
const LINK_KINDS = new Set([TARGET_REQUIREMENT, TARGET_MATRIX]);

const optionalText = (value: any) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const requireText = (value: any, label: string) => {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
};

const oneOf = (value: any, allowed: Set<string>, label: string, fallback: string) => {
  const text = String(value || fallback).trim().toLowerCase();
  if (!allowed.has(text)) throw new Error(`Invalid ${label}: ${value}`);
  return text;
};

const score = (value: any, label: string, { required }: { required: boolean }) => {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} is required`);
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) {
    throw new Error(`${label} must be from 1 to 5`);
  }
  return number;
};

const normalizeReference = (value: any) => {
  const code = String(value || '').trim().toUpperCase();
  if (!/^RK\d+$/.test(code)) throw new Error('Reference must look like RK001');
  const number = code.slice(2).replace(/^0+(?=\d)/, '');
  return `RK${number.padStart(3, '0')}`;
};

const nextReferenceCode = async () => {
  const { data, error } = await supabase.from('risk_register_item').select('reference_code');
  if (error) throw new Error(error.message);
  let max = 0;
  (data || []).forEach((row) => {
    const match = /^RK(\d+)$/i.exec(String(row.reference_code || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `RK${String(max + 1).padStart(3, '0')}`;
};

const mapItem = (row: any, links: any[]) => ({
  id: row.id,
  referenceCode: row.reference_code,
  title: row.title,
  statement: row.statement ?? null,
  category: row.category,
  likelihood: row.likelihood,
  impact: row.impact,
  residualLikelihood: row.residual_likelihood ?? null,
  residualImpact: row.residual_impact ?? null,
  proximity: row.proximity,
  status: row.status,
  response: row.response,
  treatment: row.treatment ?? null,
  owner: row.owner ?? null,
  reviewOn: row.review_on ?? null,
  sortOrder: row.sort_order ?? 0,
  links,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? null,
});

const loadBundle = async (onlyId?: string | null) => {
  let query = supabase
    .from('risk_register_item')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('reference_code', { ascending: true });
  if (onlyId) query = query.eq('id', onlyId);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  const items = rows || [];
  if (!items.length) return [];

  const ids = items.map((row) => row.id);
  const { data: linkRows, error: linkError } = await supabase
    .from('risk_register_link')
    .select('risk_id, target_kind, target_id')
    .in('risk_id', ids);
  if (linkError) throw new Error(linkError.message);

  const labels = await labelMapFor(linkRows || []);
  const byRisk = new Map<string, any[]>();
  (linkRows || []).forEach((row) => {
    const list = byRisk.get(row.risk_id) || [];
    list.push(mapLink(row, labels));
    byRisk.set(row.risk_id, list);
  });

  return items.map((row) => mapItem(row, byRisk.get(row.id) || []));
};

const loadOne = async (id: string) => {
  const rows = await loadBundle(id);
  if (!rows[0]) throw new Error('Risk not found');
  return rows[0];
};

const buildRow = async (input: any, { forInsert }: { forInsert: boolean }) => {
  const referenceCode = input?.referenceCode
    ? normalizeReference(input.referenceCode)
    : (forInsert ? await nextReferenceCode() : null);
  if (!referenceCode) throw new Error('Reference is required');

  const row: Record<string, any> = {
    reference_code: referenceCode,
    title: requireText(input?.title, 'Title'),
    statement: optionalText(input?.statement),
    category: oneOf(input?.category, CATEGORIES, 'category', 'technical'),
    likelihood: score(input?.likelihood, 'Likelihood', { required: true }),
    impact: score(input?.impact, 'Impact', { required: true }),
    residual_likelihood: score(input?.residualLikelihood, 'Residual likelihood', { required: false }),
    residual_impact: score(input?.residualImpact, 'Residual impact', { required: false }),
    proximity: oneOf(input?.proximity, PROXIMITIES, 'proximity', 'immediate'),
    status: oneOf(input?.status, STATUSES, 'status', 'open'),
    response: oneOf(input?.response, RESPONSES, 'response', 'reduce'),
    treatment: optionalText(input?.treatment),
    owner: optionalText(input?.owner),
    review_on: optionalText(input?.reviewOn),
  };

  if (input?.sortOrder != null && input.sortOrder !== '') {
    row.sort_order = Number(input.sortOrder) || 0;
  } else if (forInsert) {
    const { data, error } = await supabase
      .from('risk_register_item')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    row.sort_order = (Number(data?.[0]?.sort_order) || 0) + 1;
  }

  return row;
};

const replaceLinks = async (riskId: string, links: any[]) => {
  const cleaned = (links || []).map((link) => ({
    targetKind: String(link?.targetKind || '').trim(),
    targetId: String(link?.targetId || '').trim(),
  }));
  const unique = new Map<string, { targetKind: string, targetId: string }>();
  cleaned.forEach((link) => unique.set(`${link.targetKind}:${link.targetId}`, link));
  const next = [...unique.values()];
  await assertTargetsExist(next, LINK_KINDS);

  const { error: deleteError } = await supabase.from('risk_register_link').delete().eq('risk_id', riskId);
  if (deleteError) throw new Error(deleteError.message);
  if (!next.length) return;

  const { error } = await supabase.from('risk_register_link').insert(next.map((link) => ({
    risk_id: riskId,
    target_kind: link.targetKind,
    target_id: link.targetId,
  })));
  if (error) throw new Error(error.message);
};

export const riskRegisterQueryResolvers = {
  riskRegisterItems: async (_parent: any, _args: any, context: any) => {
    requireProjectAdmin(context);
    return loadBundle(null);
  },
};

export const riskRegisterMutationResolvers = {
  upsertRiskRegisterItem: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const input = args?.input || {};
    const id = input?.id ? String(input.id) : null;

    if (id) {
      const { data: existing, error: findError } = await supabase
        .from('risk_register_item')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!existing) throw new Error('Risk not found');
      const patch = await buildRow(input, { forInsert: false });
      const { error } = await supabase.from('risk_register_item').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
      if (Array.isArray(input.links)) await replaceLinks(id, input.links);
      return loadOne(id);
    }

    const insertRow = await buildRow(input, { forInsert: true });
    insertRow.created_by = currentUserKey(context);
    const { data, error } = await supabase
      .from('risk_register_item')
      .insert(insertRow)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    if (Array.isArray(input.links)) await replaceLinks(data.id, input.links);
    return loadOne(data.id);
  },

  deleteRiskRegisterItem: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('Risk id is required');
    const { error: docError } = await supabase
      .from('project_document_link')
      .delete()
      .eq('target_kind', 'risk')
      .eq('target_id', id);
    if (docError) throw new Error(docError.message);
    const { error } = await supabase.from('risk_register_item').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  setRiskRegisterLinks: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const id = String(args?.riskId || '');
    if (!id) throw new Error('Risk id is required');
    await replaceLinks(id, args?.links || []);
    return loadOne(id);
  },
};
