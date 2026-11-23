/**
 * Pure Mermaid source-lineage model for Data Lineage Display → Diagram.
 * Synapse source → Talia table → Component (pipeline lineage, not FK ER).
 * Optional advisory Talia↔Talia logical links — never Synapse FKs.
 */

import { selectVisibleLogicalLinks } from './dataLineageLogicalLinks.js';

const MAX_COMPONENT_NODES_UNFILTERED = 40;
const MAX_TOTAL_NODES = 120;

/** Screen: cool slate / teal accents on dark canvas (matches Talia dark shell). */
const SCREEN_THEME = {
  theme: 'base',
  themeVariables: {
    darkMode: true,
    background: '#0f171e',
    fontFamily: 'IBM Plex Sans, Segoe UI, sans-serif',
    fontSize: '13px',
    primaryColor: '#1a303c',
    primaryTextColor: '#e7f0f5',
    primaryBorderColor: '#4d8eab',
    secondaryColor: '#16242e',
    tertiaryColor: '#121c24',
    lineColor: '#6a93a8',
    textColor: '#e7f0f5',
    mainBkg: '#1a303c',
    nodeBorder: '#4d8eab',
    clusterBkg: '#121c24',
    clusterBorder: '#3a5566',
    titleColor: '#b8cdd8',
    edgeLabelBackground: '#121c24',
  },
  flowchart: {
    curve: 'basis',
    padding: 18,
    nodeSpacing: 32,
    rankSpacing: 64,
    htmlLabels: true,
  },
};

/** Print / PDF: light paper with the same role accents. */
const PRINT_THEME = {
  theme: 'base',
  themeVariables: {
    darkMode: false,
    background: '#ffffff',
    fontFamily: 'IBM Plex Sans, Helvetica, Arial, sans-serif',
    fontSize: '11px',
    primaryColor: '#e8f2f7',
    primaryTextColor: '#152029',
    primaryBorderColor: '#3d7a9a',
    secondaryColor: '#f3f7fa',
    tertiaryColor: '#eef3f6',
    lineColor: '#5a7f94',
    textColor: '#152029',
    mainBkg: '#e8f2f7',
    nodeBorder: '#3d7a9a',
    clusterBkg: '#f5f8fa',
    clusterBorder: '#b7c8d2',
    titleColor: '#3a5566',
    edgeLabelBackground: '#ffffff',
  },
  flowchart: {
    curve: 'basis',
    padding: 14,
    nodeSpacing: 28,
    rankSpacing: 56,
    htmlLabels: true,
  },
};

const CLASS_DEFS_SCREEN = [
  '  classDef srcNode fill:#1a303c,stroke:#5a9ab8,stroke-width:1.5px,color:#e7f0f5',
  '  classDef tblNode fill:#16352f,stroke:#4fafa0,stroke-width:1.5px,color:#e8f7f3',
  '  classDef cmpNode fill:#2a3340,stroke:#c4a35a,stroke-width:1.75px,color:#f5efe0',
  '  classDef clusterStyle fill:#121c24,stroke:#3a5566,color:#b8cdd8',
];

const CLASS_DEFS_PRINT = [
  '  classDef srcNode fill:#e3eef5,stroke:#3d7a9a,stroke-width:1.25px,color:#152029',
  '  classDef tblNode fill:#e4f4f0,stroke:#2d8a72,stroke-width:1.25px,color:#152029',
  '  classDef cmpNode fill:#f3efe4,stroke:#9a7b3c,stroke-width:1.5px,color:#152029',
  '  classDef clusterStyle fill:#f5f8fa,stroke:#b7c8d2,color:#3a5566',
];

const sanitizeId = (prefix, value) => {
  const raw = String(value || '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const body = raw || 'x';
  // Mermaid IDs must not start with a digit.
  const safe = /^[0-9]/.test(body) ? `n_${body}` : body;
  return `${prefix}_${safe}`.slice(0, 64);
};

const escapeLabel = (value) => String(value || '—')
  .replace(/"/g, '#quot;')
  .replace(/[[\]]/g, '')
  .replace(/\n/g, ' ')
  .trim()
  .slice(0, 80) || '—';

const themeInitDirective = (appearance = 'screen') => {
  const config = appearance === 'print' ? PRINT_THEME : SCREEN_THEME;
  return `%%{init: ${JSON.stringify(config)}}%%`;
};

/**
 * Drop Mermaid click hooks (not useful / unsafe in print HTML).
 * @param {string} mermaidSource
 */
export function stripLineageDiagramClicks(mermaidSource = '') {
  return String(mermaidSource || '')
    .split('\n')
    .filter((line) => !/^\s*click\s+/.test(line))
    .join('\n');
}

/**
 * Rebuild diagram source for PDF (light theme, no click hooks).
 * @param {string} mermaidSource
 */
export function toPrintableLineageDiagramSource(mermaidSource = '') {
  const withoutClicks = stripLineageDiagramClicks(mermaidSource);
  const withoutInit = withoutClicks
    .replace(/^%%\{init:[\s\S]*?\}%%\s*/m, '')
    .replace(/^---\n[\s\S]*?\n---\s*/m, '');
  const withPrintClasses = withoutInit
    .replace(/classDef srcNode .+/g, CLASS_DEFS_PRINT[0].trim())
    .replace(/classDef tblNode .+/g, CLASS_DEFS_PRINT[1].trim())
    .replace(/classDef cmpNode .+/g, CLASS_DEFS_PRINT[2].trim())
    .replace(/classDef clusterStyle .+/g, CLASS_DEFS_PRINT[3].trim());
  return `${themeInitDirective('print')}\n${withPrintClasses.trim()}\n`;
}

/**
 * Render Mermaid source to an SVG string (for PDF embed).
 * @param {string} mermaidSource
 * @returns {Promise<string>}
 */
export async function renderLineageDiagramSvg(mermaidSource = '') {
  const source = String(mermaidSource || '').trim();
  if (!source) return '';
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    fontFamily: 'IBM Plex Sans, Helvetica, Arial, sans-serif',
  });
  const id = `dl-export-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const result = await mermaid.render(id, source);
  return String(result?.svg || '');
}

/**
 * Distinct Synapse source labels from table/field rows.
 * @param {Array<object>} rows
 * @returns {string[]}
 */
export function listLineageSources(rows = []) {
  const set = new Set();
  (rows || []).forEach((row) => {
    if (row?.kind === 'table' && row.sourceLabel && row.sourceLabel !== '—') {
      set.add(String(row.sourceLabel));
    }
    if (row?.kind === 'field') {
      (row.synapseSources || []).forEach((s) => {
        if (s && s !== '—') set.add(String(s));
      });
      if (row.sourceLabel && row.sourceLabel !== '—') set.add(String(row.sourceLabel));
    }
    if (row?.kind === 'component') {
      (row.tables || []).forEach((t) => {
        if (t?.sourceLabel && t.sourceLabel !== '—') set.add(String(t.sourceLabel));
      });
    }
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Component options for the Component filter.
 * @param {Array<{ panelId?: string, title?: string, componentKey?: string }>} panelCatalog
 */
export function listLineageComponentOptions(panelCatalog = []) {
  return (panelCatalog || [])
    .map((p) => ({
      id: String(p.panelId || p.componentKey || ''),
      title: String(p.title || p.panelId || p.componentKey || ''),
    }))
    .filter((p) => p.id)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Filter orientation rows by Synapse source and/or component panel id.
 */
export function filterRowsBySourceAndComponent(rows = [], {
  sourceFilter = '',
  componentFilter = '',
  orientation = 'tables',
} = {}) {
  const source = String(sourceFilter || '').trim();
  const component = String(componentFilter || '').trim();
  let next = [...(rows || [])];

  if (source) {
    next = next.filter((row) => {
      if (row.kind === 'table') return String(row.sourceLabel || '') === source;
      if (row.kind === 'field') {
        if (String(row.sourceLabel || '') === source) return true;
        return (row.synapseSources || []).includes(source);
      }
      if (row.kind === 'component') {
        return (row.tables || []).some((t) => String(t.sourceLabel || '') === source);
      }
      return false;
    });
  }

  if (component) {
    next = next.filter((row) => {
      if (row.kind === 'component') {
        return row.panelId === component || row.componentKey === component;
      }
      if (row.kind === 'table') {
        return (row.consumers || []).some(
          (c) => c.panelId === component || c.componentKey === component,
        );
      }
      if (row.kind === 'field') {
        return (row.components || []).some(
          (c) => c.panelId === component || c.componentKey === component,
        );
      }
      return false;
    });
  }

  // Orientation hint unused today but kept for callers / future field bipartite tweaks.
  void orientation;
  return next;
}

/**
 * Build Mermaid flowchart + selection map for diagram display.
 *
 * @returns {{
 *   mermaidSource: string,
 *   nodeToRowId: Record<string, string>,
 *   labelToRowId: Record<string, string>,
 *   truncated: boolean,
 *   nodeCount: number,
 *   includeComponents: boolean,
 * }}
 */
/**
 * Mermaid connector by usage intensity.
 * @param {number} usage
 * @param {'lineage'|'logical'} [kind]
 */
export function lineageEdgeConnector(usage = 0, kind = 'lineage') {
  if (kind === 'logical') return '-.->';
  const n = Number(usage) || 0;
  if (n <= 0) return '-.->';
  if (n >= 12) return '==>';
  return '-->';
}

export function buildLineageDiagramModel({
  rows = [],
  orientation = 'tables',
  componentFilter = '',
  includeCoConsumers = false,
  showLogicalLinks = false,
  appearance = 'screen',
  interactive = true,
} = {}) {
  const nodeToRowId = {};
  const labelToRowId = {};
  const sourceNodes = new Map(); // id → label
  const taliaNodes = new Map(); // id → { label, rowId, tableName? }
  const componentNodes = new Map(); // id → { label, rowId? }
  const edges = []; // { from, to, usage, kind }
  const edgeKeys = new Set();

  const componentRowByPanel = new Map();
  (rows || []).forEach((row) => {
    if (row?.kind !== 'component') return;
    if (row.panelId) componentRowByPanel.set(String(row.panelId), row);
    if (row.componentKey) componentRowByPanel.set(String(row.componentKey), row);
    if (row.title) componentRowByPanel.set(String(row.title), row);
  });

  const rememberLabel = (label, rowId) => {
    const text = String(label || '').trim();
    if (!text || !rowId) return;
    labelToRowId[text] = rowId;
  };

  const addEdge = (from, to, { usage = 0, kind = 'lineage' } = {}) => {
    if (!from || !to) return;
    const key = `${kind}:${from}->${to}`;
    const nextUsage = Number(usage) || 0;
    if (edgeKeys.has(key)) {
      const existing = edges.find((e) => e.from === from && e.to === to && e.kind === kind);
      if (existing && nextUsage > (existing.usage || 0)) existing.usage = nextUsage;
      return;
    }
    edgeKeys.add(key);
    edges.push({ from, to, usage: nextUsage, kind });
  };

  const ensureSource = (label) => {
    const text = String(label || '').trim();
    if (!text || text === '—') return null;
    const id = sanitizeId('src', text);
    if (!sourceNodes.has(id)) sourceNodes.set(id, escapeLabel(text));
    return id;
  };

  const ensureTalia = (table, rowId) => {
    const text = String(table || '').trim();
    if (!text || text === '—') return null;
    const id = sanitizeId('tbl', text);
    const label = escapeLabel(text);
    if (!taliaNodes.has(id)) {
      taliaNodes.set(id, { label, rowId: rowId || null, tableName: text });
    } else {
      const node = taliaNodes.get(id);
      if (rowId && !node.rowId) node.rowId = rowId;
      if (!node.tableName) node.tableName = text;
    }
    if (rowId) {
      nodeToRowId[id] = rowId;
      rememberLabel(label, rowId);
      rememberLabel(text, rowId);
    }
    return id;
  };

  const ensureComponent = (panelId, title, rowId) => {
    const key = String(panelId || title || '').trim();
    if (!key) return null;
    const resolvedRow = rowId
      ? { id: rowId }
      : (componentRowByPanel.get(String(panelId || ''))
        || componentRowByPanel.get(String(title || ''))
        || null);
    const resolvedId = rowId || resolvedRow?.id || null;
    const id = sanitizeId('cmp', key);
    const label = escapeLabel(title || panelId);
    if (!componentNodes.has(id)) {
      componentNodes.set(id, {
        label,
        rowId: resolvedId,
      });
    } else if (resolvedId && !componentNodes.get(id).rowId) {
      componentNodes.get(id).rowId = resolvedId;
    }
    if (resolvedId) {
      nodeToRowId[id] = resolvedId;
      rememberLabel(label, resolvedId);
      if (title) rememberLabel(title, resolvedId);
      if (panelId) rememberLabel(panelId, resolvedId);
    }
    return id;
  };

  const componentScope = String(componentFilter || '').trim();
  const forceComponents = Boolean(componentScope);
  const coConsumers = Boolean(includeCoConsumers) && forceComponents;
  let includeComponents = forceComponents || orientation === 'components';

  const matchesComponentScope = (panelId, componentKey, title) => {
    if (!componentScope || coConsumers) return true;
    return panelId === componentScope
      || componentKey === componentScope
      || title === componentScope;
  };

  // First pass: collect edges without flooding components.
  // Component filter alone → only that panel. Co-consumers opt-in restores fan-out.
  const pendingComponentLinks = []; // { tableId, panelId, title, rowId, usage }

  (rows || []).forEach((row) => {
    if (row.kind === 'table') {
      const rowUsage = Number(row.usageCount) || 0;
      const tblId = ensureTalia(row.taliaTable, row.id);
      const srcId = ensureSource(row.sourceLabel || row.synapseSource);
      if (srcId && tblId) addEdge(srcId, tblId, { usage: rowUsage });
      (row.consumers || []).forEach((c) => {
        if (!matchesComponentScope(c.panelId, c.componentKey, c.title)) return;
        const consumerRow = componentRowByPanel.get(String(c.panelId || ''))
          || componentRowByPanel.get(String(c.componentKey || ''))
          || componentRowByPanel.get(String(c.title || ''));
        pendingComponentLinks.push({
          tableId: tblId,
          panelId: c.panelId || c.componentKey,
          title: c.title,
          rowId: consumerRow?.id || null,
          usage: Number(c.openCount) || 0,
        });
      });
      return;
    }

    if (row.kind === 'component') {
      if (!matchesComponentScope(row.panelId, row.componentKey, row.title)) return;
      const cmpId = ensureComponent(row.panelId || row.componentKey, row.title, row.id);
      const rowUsage = Number(row.usageCount) || 0;
      (row.tables || []).forEach((t) => {
        const tblId = ensureTalia(t.taliaTable, null);
        const srcId = ensureSource(t.sourceLabel);
        if (srcId && tblId) addEdge(srcId, tblId, { usage: rowUsage });
        if (cmpId && tblId) addEdge(tblId, cmpId, { usage: rowUsage });
      });
      return;
    }

    if (row.kind === 'field') {
      const fieldId = sanitizeId('fld', row.field);
      const fieldLabel = escapeLabel(row.label || row.field);
      const fieldUsage = Number(row.usageCount) || 0;
      nodeToRowId[fieldId] = row.id;
      rememberLabel(fieldLabel, row.id);
      rememberLabel(row.field, row.id);
      // Treat field as a lightweight node linked to its table/source.
      taliaNodes.set(fieldId, {
        label: fieldLabel,
        rowId: row.id,
        isField: true,
      });
      (row.taliaTables || []).forEach((table) => {
        const tblId = ensureTalia(table, null);
        if (tblId) addEdge(fieldId, tblId, { usage: fieldUsage });
        const srcId = ensureSource(row.sourceLabel);
        if (srcId && tblId) addEdge(srcId, tblId, { usage: fieldUsage });
      });
      if (!(row.taliaTables || []).length) {
        const srcId = ensureSource(row.sourceLabel);
        if (srcId) addEdge(srcId, fieldId, { usage: fieldUsage });
      }
      (row.components || []).forEach((c) => {
        if (!matchesComponentScope(c.panelId, c.componentKey, c.title)) return;
        pendingComponentLinks.push({
          tableId: fieldId,
          panelId: c.panelId || c.componentKey,
          title: c.title,
          rowId: null,
          usage: Number(c.openCount) || 0,
        });
      });
    }
  });

  const uniquePending = [];
  const pendingSeen = new Set();
  pendingComponentLinks.forEach((link) => {
    if (!link.tableId || !link.panelId) return;
    const key = `${link.tableId}|${link.panelId}`;
    if (pendingSeen.has(key)) return;
    pendingSeen.add(key);
    uniquePending.push(link);
  });

  if (!includeComponents && uniquePending.length <= MAX_COMPONENT_NODES_UNFILTERED) {
    includeComponents = true;
  }

  if (includeComponents) {
    const limited = (forceComponents && !coConsumers)
      ? uniquePending
      : uniquePending.slice(0, forceComponents ? Math.max(uniquePending.length, MAX_COMPONENT_NODES_UNFILTERED) : MAX_COMPONENT_NODES_UNFILTERED);
    limited.forEach((link) => {
      const cmpId = ensureComponent(link.panelId, link.title, link.rowId);
      if (cmpId && link.tableId) addEdge(link.tableId, cmpId, { usage: link.usage || 0 });
    });
  }

  // Advisory logical links: only between Talia tables already on the canvas.
  let logicalLinkCount = 0;
  if (showLogicalLinks) {
    const taliaNames = [...taliaNodes.values()]
      .map((node) => node.tableName)
      .filter(Boolean);
    const visible = selectVisibleLogicalLinks(taliaNames);
    visible.forEach((link) => {
      const fromId = sanitizeId('tbl', link.from);
      const toId = sanitizeId('tbl', link.to);
      if (!taliaNodes.has(fromId) || !taliaNodes.has(toId)) return;
      addEdge(fromId, toId, { usage: 0, kind: 'logical' });
      logicalLinkCount += 1;
    });
  }

  const truncated = !includeComponents && uniquePending.length > 0;

  const isPrint = appearance === 'print';
  const classDefs = isPrint ? CLASS_DEFS_PRINT : CLASS_DEFS_SCREEN;

  if (sourceNodes.size === 0 && taliaNodes.size === 0) {
    return {
      mermaidSource: `${themeInitDirective(appearance)}\nflowchart LR\n  empty("No lineage edges for current filters")\n`,
      nodeToRowId: {},
      labelToRowId: {},
      truncated: false,
      nodeCount: 0,
      includeComponents: false,
    };
  }

  const lines = [themeInitDirective(appearance), 'flowchart LR'];

  if (sourceNodes.size) {
    lines.push('  subgraph Sources');
    sourceNodes.forEach((label, id) => {
      // Rounded nodes: id("label") reads cleaner than sharp rectangles.
      lines.push(`    ${id}("${label}")`);
    });
    lines.push('  end');
  }

  const taliaLabel = orientation === 'fields' ? 'Fields_and_Tables' : 'Talia';
  if (taliaNodes.size) {
    lines.push(`  subgraph ${taliaLabel}`);
    taliaNodes.forEach((node, id) => {
      lines.push(`    ${id}("${node.label}")`);
    });
    lines.push('  end');
  }

  if (includeComponents && componentNodes.size) {
    lines.push('  subgraph Components');
    componentNodes.forEach((node, id) => {
      lines.push(`    ${id}("${node.label}")`);
    });
    lines.push('  end');
  }

  const emittedEdgeIndexes = [];
  edges.forEach((edge) => {
    const { from, to, usage = 0, kind = 'lineage' } = edge;
    const fromOk = sourceNodes.has(from) || taliaNodes.has(from) || componentNodes.has(from);
    const toOk = sourceNodes.has(to) || taliaNodes.has(to) || componentNodes.has(to);
    if (!fromOk || !toOk) return;
    const connector = lineageEdgeConnector(usage, kind);
    lines.push(`  ${from} ${connector} ${to}`);
    emittedEdgeIndexes.push({ usage, kind });
  });

  classDefs.forEach((line) => lines.push(line));
  if (sourceNodes.size) {
    lines.push(`  class ${[...sourceNodes.keys()].join(',')} srcNode`);
  }
  if (taliaNodes.size) {
    lines.push(`  class ${[...taliaNodes.keys()].join(',')} tblNode`);
  }
  if (includeComponents && componentNodes.size) {
    lines.push(`  class ${[...componentNodes.keys()].join(',')} cmpNode`);
  }

  // Usage / logical stroke styling (linkStyle index = order of edges above).
  const muteStroke = isPrint ? '#9aa8b2' : '#5a6d7a';
  const activeStroke = isPrint ? '#3d7a9a' : '#6a93a8';
  const hotStroke = isPrint ? '#2d8a72' : '#4fafa0';
  const logicalStroke = isPrint ? '#9a7b3c' : '#c4a35a';
  emittedEdgeIndexes.forEach((meta, index) => {
    if (meta.kind === 'logical') {
      lines.push(`  linkStyle ${index} stroke:${logicalStroke},stroke-width:1.5px,stroke-dasharray:6 4,opacity:0.9`);
      return;
    }
    const n = Number(meta.usage) || 0;
    if (n <= 0) {
      lines.push(`  linkStyle ${index} stroke:${muteStroke},stroke-width:1px,opacity:0.35`);
    } else if (n >= 12) {
      lines.push(`  linkStyle ${index} stroke:${hotStroke},stroke-width:2.4px,opacity:0.95`);
    } else {
      lines.push(`  linkStyle ${index} stroke:${activeStroke},stroke-width:1.6px,opacity:0.8`);
    }
  });

  // Final pass: ensure every node with a rowId is in both maps + Mermaid click hooks.
  taliaNodes.forEach((node, id) => {
    if (node.rowId) {
      nodeToRowId[id] = node.rowId;
      rememberLabel(node.label, node.rowId);
      if (interactive && !isPrint) {
        lines.push(`  click ${id} taliaLineageNodeClick "${node.label}"`);
      }
    }
  });
  componentNodes.forEach((node, id) => {
    if (node.rowId) {
      nodeToRowId[id] = node.rowId;
      rememberLabel(node.label, node.rowId);
      if (interactive && !isPrint) {
        lines.push(`  click ${id} taliaLineageNodeClick "${node.label}"`);
      }
    }
  });

  const nodeCount = sourceNodes.size + taliaNodes.size + componentNodes.size;
  return {
    mermaidSource: `${lines.join('\n')}\n`,
    nodeToRowId,
    labelToRowId,
    truncated: truncated || nodeCount > MAX_TOTAL_NODES,
    nodeCount,
    includeComponents,
    includeCoConsumers: coConsumers,
    logicalLinkCount,
    showLogicalLinks: Boolean(showLogicalLinks) && logicalLinkCount > 0,
  };
}
