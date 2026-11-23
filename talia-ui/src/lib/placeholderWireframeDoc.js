/**
 * Place Holder wireframe document — parse/serialize + block factories.
 * Persisted as JSON string on component option `wireframeDoc` (per dock instance).
 */

const BLOCK_TYPES = new Set(['table', 'cards', 'list', 'blank', 'chart']);
const CHART_KINDS = new Set(['bar', 'line']);

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const newId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

/** Pad/trim label arrays to `count`; keep user strings (may be empty). */
export const fitLabels = (raw, count) => {
  const n = Math.max(0, Number(count) || 0);
  const src = Array.isArray(raw) ? raw : [];
  return Array.from({ length: n }, (_, i) => String(src[i] ?? '').slice(0, 40));
};

export const labelAt = (labels, index, fallback) => {
  const raw = Array.isArray(labels) ? labels[index] : '';
  const trimmed = String(raw || '').trim();
  return trimmed || fallback;
};

const defaultTitle = (kind, chartKind) => {
  if (kind === 'chart') return chartKind === 'line' ? 'Line chart' : 'Bar chart';
  if (kind === 'blank') return 'Blank';
  if (kind === 'table') return 'Table';
  if (kind === 'cards') return 'Cards';
  if (kind === 'list') return 'List';
  return 'Block';
};

export const createWireframeBlock = (type = 'blank', overrides = {}) => {
  let kind = type;
  let chartKind = 'bar';
  if (type === 'chart-bar' || type === 'chart-line') {
    kind = 'chart';
    chartKind = type === 'chart-line' ? 'line' : 'bar';
  }
  if (!BLOCK_TYPES.has(kind)) kind = 'blank';
  if (overrides.chartKind && CHART_KINDS.has(overrides.chartKind)) {
    chartKind = overrides.chartKind;
  }

  const base = {
    id: newId(),
    type: kind,
    title: defaultTitle(kind, chartKind),
    note: '',
  };

  if (kind === 'table') {
    const cols = clampInt(overrides.cols, 1, 12, 4);
    const rows = clampInt(overrides.rows, 1, 24, 6);
    return {
      ...base,
      ...overrides,
      type: 'table',
      rows,
      cols,
      columnLabels: fitLabels(overrides.columnLabels, cols),
    };
  }
  if (kind === 'cards') {
    const cardCount = clampInt(overrides.cardCount, 1, 12, 3);
    return {
      ...base,
      ...overrides,
      type: 'cards',
      cardCount,
      cardLabels: fitLabels(overrides.cardLabels, cardCount),
    };
  }
  if (kind === 'list') {
    return {
      ...base,
      ...overrides,
      type: 'list',
      itemCount: clampInt(overrides.itemCount, 1, 20, 5),
    };
  }
  if (kind === 'chart') {
    return {
      ...base,
      ...overrides,
      type: 'chart',
      chartKind: CHART_KINDS.has(chartKind) ? chartKind : 'bar',
      points: clampInt(overrides.points, 3, 16, 6),
    };
  }
  return { ...base, ...overrides, type: 'blank' };
};

export const createDefaultWireframeDoc = () => ({
  version: 1,
  blocks: [createWireframeBlock('blank', { title: 'Place Holder' })],
});

const normalizeBlock = (raw) => {
  if (!raw || typeof raw !== 'object') return createWireframeBlock('blank');
  const type = BLOCK_TYPES.has(raw.type) ? raw.type : 'blank';
  const title = String(raw.title || '').trim() || defaultTitle(type, raw.chartKind);
  const note = String(raw.note || '');
  const id = String(raw.id || '').trim() || newId();

  if (type === 'table') {
    const cols = clampInt(raw.cols, 1, 12, 4);
    return {
      id,
      type,
      title,
      note,
      rows: clampInt(raw.rows, 1, 24, 6),
      cols,
      columnLabels: fitLabels(raw.columnLabels, cols),
    };
  }
  if (type === 'cards') {
    const cardCount = clampInt(raw.cardCount, 1, 12, 3);
    return {
      id,
      type,
      title,
      note,
      cardCount,
      cardLabels: fitLabels(raw.cardLabels, cardCount),
    };
  }
  if (type === 'list') {
    return {
      id,
      type,
      title,
      note,
      itemCount: clampInt(raw.itemCount, 1, 20, 5),
    };
  }
  if (type === 'chart') {
    return {
      id,
      type,
      title,
      note,
      chartKind: CHART_KINDS.has(raw.chartKind) ? raw.chartKind : 'bar',
      points: clampInt(raw.points, 3, 16, 6),
    };
  }
  return { id, type: 'blank', title, note };
};

export const parseWireframeDoc = (raw) => {
  if (raw == null || raw === '') return createDefaultWireframeDoc();
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return createDefaultWireframeDoc();
    }
  }
  if (!parsed || typeof parsed !== 'object') return createDefaultWireframeDoc();
  const blocksIn = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const blocks = blocksIn.map(normalizeBlock).filter(Boolean);
  return {
    version: 1,
    blocks: blocks.length ? blocks : createDefaultWireframeDoc().blocks,
  };
};

export const serializeWireframeDoc = (doc) => {
  const normalized = parseWireframeDoc(doc);
  return JSON.stringify(normalized);
};

export const updateBlockInDoc = (doc, blockId, patch) => {
  const next = parseWireframeDoc(doc);
  next.blocks = next.blocks.map((block) => (
    block.id === blockId ? normalizeBlock({ ...block, ...patch, id: block.id }) : block
  ));
  return next;
};

export const addBlockToDoc = (doc, type) => {
  const next = parseWireframeDoc(doc);
  next.blocks = [...next.blocks, createWireframeBlock(type)];
  return next;
};

export const removeBlockFromDoc = (doc, blockId) => {
  const next = parseWireframeDoc(doc);
  const filtered = next.blocks.filter((block) => block.id !== blockId);
  next.blocks = filtered.length ? filtered : createDefaultWireframeDoc().blocks;
  return next;
};

export const moveBlockInDoc = (doc, blockId, direction) => {
  const next = parseWireframeDoc(doc);
  const index = next.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) return next;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= next.blocks.length) return next;
  const copy = [...next.blocks];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  next.blocks = copy;
  return next;
};

/** Human-readable summary for Requirements Log detail. */
export const summarizeWireframeBlock = (block) => {
  const b = normalizeBlock(block);
  const lines = [`Type: ${b.type}`, `Title: ${b.title}`];
  if (b.type === 'table') {
    lines.push(`Size: ${b.rows} rows × ${b.cols} cols`);
    const named = (b.columnLabels || []).map((l, i) => l.trim() || `Col ${i + 1}`);
    if (named.some(Boolean)) lines.push(`Columns: ${named.join(', ')}`);
  }
  if (b.type === 'cards') {
    lines.push(`Cards: ${b.cardCount}`);
    const named = (b.cardLabels || []).map((l, i) => l.trim() || `Card ${i + 1}`);
    if (named.some(Boolean)) lines.push(`Card labels: ${named.join(', ')}`);
  }
  if (b.type === 'list') lines.push(`Items: ${b.itemCount}`);
  if (b.type === 'chart') lines.push(`Chart: ${b.chartKind}, ${b.points} points`);
  if (b.note) lines.push(`Note: ${b.note}`);
  lines.push('Captured from Place Holder wireframe.');
  return lines.join('\n');
};

export const summarizeWireframeDoc = (doc, panelCaption) => {
  const normalized = parseWireframeDoc(doc);
  const caption = String(panelCaption || '').trim();
  const header = caption ? `Panel: ${caption}` : 'Place Holder wireframe';
  const parts = [header, '', ...normalized.blocks.map((block, i) => {
    let extra = '';
    if (block.type === 'table') extra = ` (${block.rows}×${block.cols})`;
    if (block.type === 'cards') extra = ` (${block.cardCount} cards)`;
    if (block.type === 'list') extra = ` (${block.itemCount} items)`;
    if (block.type === 'chart') extra = ` (${block.chartKind}, ${block.points} pts)`;
    return `Block ${i + 1}: ${block.type} — ${block.title}${extra}`
      + (block.note ? `\n  Note: ${block.note}` : '');
  }), '', 'Captured from Place Holder wireframe.'];
  return parts.join('\n');
};
