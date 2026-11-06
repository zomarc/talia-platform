/**
 * Project documents — reference codes and JSON export.
 * Image bytes stay in the database; the pack records the asset ids used in Markdown.
 */

import { assetIdsInMarkdown } from './markdownLite.js';

const LINK_GROUPS = [
  { id: 'requirement', label: 'Requirements' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'risk', label: 'Risks' },
  { id: 'unlinked', label: 'Unlinked' },
];

const byReference = (a, b) => String(a?.referenceCode || '').localeCompare(
  String(b?.referenceCode || ''),
  undefined,
  { numeric: true },
);

const byStarThenReference = (a, b) => {
  const starDelta = Number(Boolean(b?.isStarred)) - Number(Boolean(a?.isStarred));
  if (starDelta) return starDelta;
  return byReference(a, b);
};

/**
 * Tree for the repository: starred documents first, then a group per link kind,
 * then the linked record, then documents. A document linked to two records appears
 * under both. Unlinked documents sit on their own. Starred docs also stay in their
 * link groups (and sort first within each folder).
 */
export function buildDocumentTree(documents) {
  const buckets = new Map(LINK_GROUPS.map((group) => [group.id, new Map()]));
  const starred = [];

  (documents || []).forEach((document) => {
    if (document?.isStarred) starred.push(document);

    const links = (document?.links || []).filter((link) => buckets.has(link?.targetKind));
    if (!links.length) {
      const unlinked = buckets.get('unlinked');
      if (!unlinked.has('')) unlinked.set('', { id: 'unlinked', label: null, documents: [] });
      unlinked.get('').documents.push(document);
      return;
    }
    links.forEach((link) => {
      const bucket = buckets.get(link.targetKind);
      const key = String(link.targetId);
      if (!bucket.has(key)) {
        bucket.set(key, {
          id: `${link.targetKind}:${key}`,
          label: link.label || key,
          documents: [],
        });
      }
      bucket.get(key).documents.push(document);
    });
  });

  const linkGroups = LINK_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    folders: [...buckets.get(group.id).values()]
      .map((folder) => ({
        ...folder,
        documents: [...folder.documents].sort(byStarThenReference),
      }))
      .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''))),
  })).filter((group) => group.folders.some((folder) => folder.documents.length));

  if (!starred.length) return linkGroups;

  return [
    {
      id: 'starred',
      label: 'Starred',
      folders: [{
        id: 'starred',
        label: null,
        documents: [...starred].sort(byReference),
      }],
    },
    ...linkGroups,
  ];
}

export function nextDocumentReference(items) {
  let max = 0;
  (items || []).forEach((item) => {
    // Ignore response children (D006-1); only advance the primary D### sequence.
    const match = /^D(\d+)$/i.exec(String(item?.referenceCode || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `D${String(max + 1).padStart(3, '0')}`;
}

export function buildProjectDocumentExport(items) {
  return {
    ProjectDocumentExport: {
      version: 1,
      exportedAt: new Date().toISOString(),
      documents: (items || []).map((item) => ({
        referenceCode: item.referenceCode,
        title: item.title,
        body: item.body || '',
        isStarred: Boolean(item.isStarred),
        assetIds: assetIdsInMarkdown(item.body),
        links: (item.links || []).map((link) => ({
          targetKind: link.targetKind,
          targetId: link.targetId != null ? String(link.targetId) : null,
          label: link.label || null,
        })),
      })),
    },
  };
}
