/**
 * Project documents — ADMIN+/SUPER_USER.
 * Markdown body plus image assets. Links point at a requirement, matrix cell, or risk.
 */

import { supabase } from '../../services/supabase.js';
import {
  TARGET_MATRIX,
  TARGET_REQUIREMENT,
  TARGET_RISK,
  assertTargetsExist,
  currentUserKey,
  labelMapFor,
  mapLink,
  requireProjectAdmin,
} from './projectRecordLinks.js';

const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_BYTES = 1_200_000;
const LINK_KINDS = new Set([TARGET_REQUIREMENT, TARGET_MATRIX, TARGET_RISK]);

const requireText = (value: any, label: string) => {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
};

/** Accept D001 or response children D006-1, D006-2, … */
const normalizeReference = (value: any) => {
  const code = String(value || '').trim().toUpperCase();
  const match = /^D(\d+)(?:-(\d+))?$/.exec(code);
  if (!match) throw new Error('Reference must look like D001 or D006-1');
  const baseNum = match[1].replace(/^0+(?=\d)/, '');
  const base = `D${baseNum.padStart(3, '0')}`;
  if (match[2] == null) return base;
  return `${base}-${Number(match[2])}`;
};

const nextReferenceCode = async () => {
  const { data, error } = await supabase.from('project_document').select('reference_code');
  if (error) throw new Error(error.message);
  let max = 0;
  (data || []).forEach((row) => {
    const match = /^D(\d+)$/i.exec(String(row.reference_code || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `D${String(max + 1).padStart(3, '0')}`;
};

const mapAsset = (row: any, includeContent: boolean) => ({
  id: row.id,
  documentId: row.document_id,
  filename: row.filename,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  contentBase64: includeContent ? row.content_base64 : null,
});

const mapDocument = (row: any, links: any[], assets: any[]) => ({
  id: row.id,
  referenceCode: row.reference_code,
  title: row.title,
  body: row.body ?? '',
  isStarred: Boolean(row.is_starred),
  links,
  assets: assets.map((asset) => mapAsset(asset, false)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? null,
});

const loadBundle = async (onlyId?: string | null, target?: { kind: string, id: string } | null) => {
  let documentIds: string[] | null = null;
  if (target?.kind && target?.id) {
    const { data, error } = await supabase
      .from('project_document_link')
      .select('document_id')
      .eq('target_kind', target.kind)
      .eq('target_id', target.id);
    if (error) throw new Error(error.message);
    documentIds = Array.from(
      new Set((data || []).map((row: { document_id: string }) => String(row.document_id))),
    );
    if (!documentIds.length) return [];
  }

  let query = supabase
    .from('project_document')
    .select('*')
    .order('reference_code', { ascending: true });
  if (onlyId) query = query.eq('id', onlyId);
  if (documentIds) query = query.in('id', documentIds);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  const documents = rows || [];
  if (!documents.length) return [];

  const ids = documents.map((row) => row.id);
  const { data: linkRows, error: linkError } = await supabase
    .from('project_document_link')
    .select('document_id, target_kind, target_id')
    .in('document_id', ids);
  if (linkError) throw new Error(linkError.message);

  const { data: assetRows, error: assetError } = await supabase
    .from('project_document_asset')
    .select('id, document_id, filename, mime_type, byte_size')
    .in('document_id', ids);
  if (assetError) throw new Error(assetError.message);

  const labels = await labelMapFor(linkRows || []);
  const linksByDoc = new Map<string, any[]>();
  (linkRows || []).forEach((row) => {
    const list = linksByDoc.get(row.document_id) || [];
    list.push(mapLink(row, labels));
    linksByDoc.set(row.document_id, list);
  });
  const assetsByDoc = new Map<string, any[]>();
  (assetRows || []).forEach((row) => {
    const list = assetsByDoc.get(row.document_id) || [];
    list.push(row);
    assetsByDoc.set(row.document_id, list);
  });

  return documents.map((row) => mapDocument(row, linksByDoc.get(row.id) || [], assetsByDoc.get(row.id) || []));
};

const loadOne = async (id: string) => {
  const rows = await loadBundle(id, null);
  if (!rows[0]) throw new Error('Document not found');
  return rows[0];
};

const replaceLinks = async (documentId: string, links: any[]) => {
  const cleaned = (links || []).map((link) => ({
    targetKind: String(link?.targetKind || '').trim(),
    targetId: String(link?.targetId || '').trim(),
  }));
  const unique = new Map<string, { targetKind: string, targetId: string }>();
  cleaned.forEach((link) => unique.set(`${link.targetKind}:${link.targetId}`, link));
  const next = [...unique.values()];
  await assertTargetsExist(next, LINK_KINDS);

  const { error: deleteError } = await supabase.from('project_document_link').delete().eq('document_id', documentId);
  if (deleteError) throw new Error(deleteError.message);
  if (!next.length) return;
  const { error } = await supabase.from('project_document_link').insert(next.map((link) => ({
    document_id: documentId,
    target_kind: link.targetKind,
    target_id: link.targetId,
  })));
  if (error) throw new Error(error.message);
};

const decodeImage = (raw: any) => {
  const text = String(raw || '').trim();
  const payload = text.includes(',') ? text.slice(text.indexOf(',') + 1) : text;
  const normalized = payload.replace(/\s/g, '');
  if (!normalized || !/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw new Error('Image content must be base64');
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) {
    throw new Error('Image must be under 1.2 MB');
  }
  return { contentBase64: normalized, byteSize: bytes.length };
};

export const projectDocumentQueryResolvers = {
  projectDocuments: async (_parent: any, _args: any, context: any) => {
    requireProjectAdmin(context);
    return loadBundle(null, null);
  },
  projectDocumentsFor: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const kind = String(args?.targetKind || '').trim();
    const id = String(args?.targetId || '').trim();
    if (!LINK_KINDS.has(kind) || !id) return [];
    return loadBundle(null, { kind, id });
  },
  projectDocumentAssets: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const ids = [...new Set((args?.ids || []).map((id: any) => String(id || '').trim()).filter(Boolean))].slice(0, 20);
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from('project_document_asset')
      .select('id, document_id, filename, mime_type, byte_size, content_base64')
      .in('id', ids);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapAsset(row, true));
  },
};

export const projectDocumentMutationResolvers = {
  upsertProjectDocument: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const input = args?.input || {};
    const id = input?.id ? String(input.id) : null;
    const referenceCode = input?.referenceCode
      ? normalizeReference(input.referenceCode)
      : (!id ? await nextReferenceCode() : null);

    const patch: Record<string, any> = {
      title: requireText(input?.title, 'Title'),
      body: input?.body == null ? '' : String(input.body),
    };
    if (referenceCode) patch.reference_code = referenceCode;
    if (input?.isStarred != null) patch.is_starred = Boolean(input.isStarred);

    if (id) {
      const { data: existing, error: findError } = await supabase
        .from('project_document')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!existing) throw new Error('Document not found');
      const { error } = await supabase.from('project_document').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
      if (Array.isArray(input.links)) await replaceLinks(id, input.links);
      return loadOne(id);
    }

    patch.created_by = currentUserKey(context);
    const { data, error } = await supabase
      .from('project_document')
      .insert(patch)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    if (Array.isArray(input.links)) await replaceLinks(data.id, input.links);
    return loadOne(data.id);
  },

  deleteProjectDocument: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('Document id is required');
    const { error } = await supabase.from('project_document').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  addProjectDocumentAsset: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const documentId = String(args?.documentId || '');
    const mimeType = String(args?.mimeType || '').trim().toLowerCase().replace('image/jpg', 'image/jpeg');
    if (!documentId) throw new Error('Document id is required');
    if (!MIME_TYPES.has(mimeType)) throw new Error('Use a PNG, JPEG, GIF, or WebP image');
    const image = decodeImage(args?.contentBase64);
    const filename = String(args?.filename || 'image').replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'image';

    const { data: existing, error: findError } = await supabase
      .from('project_document')
      .select('id')
      .eq('id', documentId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!existing) throw new Error('Document not found');

    const { data, error } = await supabase
      .from('project_document_asset')
      .insert({
        document_id: documentId,
        filename,
        mime_type: mimeType,
        byte_size: image.byteSize,
        content_base64: image.contentBase64,
      })
      .select('id, document_id, filename, mime_type, byte_size')
      .single();
    if (error) throw new Error(error.message);
    return {
      ...mapAsset(data, false),
      markdown: `![](asset:${data.id})`,
    };
  },

  deleteProjectDocumentAsset: async (_parent: any, args: any, context: any) => {
    requireProjectAdmin(context);
    const id = String(args?.id || '');
    if (!id) throw new Error('Image id is required');
    const { error } = await supabase.from('project_document_asset').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },
};
