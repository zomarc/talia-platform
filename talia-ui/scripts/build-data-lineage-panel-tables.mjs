#!/usr/bin/env node
/**
 * Scrape focus-panel sources for tableName / columns usage and sync.config column lists.
 * Run: npm run build:lineage-tables
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const panelsRoot = path.join(root, 'src/components/focus-panels');
const syncConfigPath = path.resolve(root, '../talia-server/sync.config.json');
const outFile = path.join(root, 'src/lib/dataLineagePanelTables.generated.js');

const IGNORE_TABLES = new Set([
  'your_table_name',
  'data_source',
  'availableVoyages',
  'unknown',
]);

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(jsx?|mjs|tsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
};

const parseStringArrayBody = (inner) => (
  [...String(inner || '').matchAll(/['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g)].map((m) => m[1])
);

/** Collect const FOO = [ 'a', 'b' ] style arrays in a file. */
const collectConstArrays = (text) => {
  const map = new Map();
  for (const match of text.matchAll(
    /(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]\s*;/g,
  )) {
    const cols = parseStringArrayBody(match[2]);
    if (cols.length) map.set(match[1], cols);
  }
  return map;
};

const extractColumnsFromObjectBody = (body, constArrays) => {
  const inline = String(body || '').match(/columns\s*:\s*\[([\s\S]*?)\]/);
  if (inline) return parseStringArrayBody(inline[1]);
  const ref = String(body || '').match(/columns\s*:\s*([A-Z][A-Z0-9_]*)\b/);
  if (ref && constArrays.has(ref[1])) return constArrays.get(ref[1]);
  return [];
};

/**
 * Walk balanced `{ ... }` starting at openIdx (must point at '{').
 * Returns the inner body or null.
 */
const readObjectBody = (text, openIdx) => {
  if (text[openIdx] !== '{') return null;
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return null;
};

const recordTableConfig = (folderTables, folderTableCols, tableName, body, constArrays) => {
  if (!tableName || IGNORE_TABLES.has(tableName)) return;
  folderTables.add(tableName);
  const cols = extractColumnsFromObjectBody(body, constArrays);
  if (!cols.length) return;
  const set = folderTableCols.get(tableName) || new Set();
  cols.forEach((c) => set.add(c));
  folderTableCols.set(tableName, set);
};

const byFolderTables = new Map();
const byFolderTableColumns = new Map();

for (const file of walk(panelsRoot)) {
  const rel = path.relative(panelsRoot, file);
  const folder = rel.split(path.sep)[0];
  if (!folder || folder.startsWith('_')) continue;
  const text = fs.readFileSync(file, 'utf8');
  const constArrays = collectConstArrays(text);

  const tables = byFolderTables.get(folder) || new Set();
  const tableCols = byFolderTableColumns.get(folder) || new Map();

  // Prefer whole config objects (useTableDataWithContext / trackedFetchGraphql args).
  for (const match of text.matchAll(
    /(?:useTableDataWithContext|trackedFetchGraphql)\(\s*\{/g,
  )) {
    const openIdx = text.indexOf('{', match.index);
    const body = readObjectBody(text, openIdx);
    if (!body) continue;
    const tableMatch = body.match(/tableName:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/);
    if (!tableMatch) continue;
    recordTableConfig(tables, tableCols, tableMatch[1], body, constArrays);
  }

  // Fallback: any remaining tableName tags without a matched hook wrapper.
  for (const match of text.matchAll(/tableName:\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g)) {
    tables.add(match[1]);
  }

  if (tables.size) byFolderTables.set(folder, tables);
  if (tableCols.size) byFolderTableColumns.set(folder, tableCols);
}

const panelTables = {};
[...byFolderTables.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([folder, tables]) => {
    panelTables[folder] = [...tables].sort((a, b) => a.localeCompare(b));
  });

const panelTableColumns = {};
[...byFolderTableColumns.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([folder, map]) => {
    const obj = {};
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([table, cols]) => {
        obj[table] = [...cols].sort((a, b) => a.localeCompare(b));
      });
    panelTableColumns[folder] = obj;
  });

const syncTableColumns = {};
const syncSources = {};
try {
  const sync = JSON.parse(fs.readFileSync(syncConfigPath, 'utf8'));
  Object.values(sync.tables || {}).forEach((def) => {
    const target = String(def?.target || '').trim();
    if (!target) return;
    if (Array.isArray(def.columns) && def.columns.length) {
      // Strip Synapse bracket quoting: [Sail_Code] → Sail_Code
      syncTableColumns[target] = def.columns.map((c) => String(c).replace(/^\[|\]$/g, ''));
    }
    if (def.source) syncSources[target] = String(def.source);
  });
} catch (err) {
  console.warn('Could not read sync.config.json:', err.message);
}

const body = `/**
 * AUTO-GENERATED by scripts/build-data-lineage-panel-tables.mjs
 * Do not edit by hand. Regenerate with: npm run build:lineage-tables
 *
 * Generated: ${new Date().toISOString()}
 */

export const DATA_LINEAGE_PANEL_TABLES = ${JSON.stringify(panelTables, null, 2)};

/** panelKey -> { tableName: string[] } from nearby columns: arrays in source */
export const DATA_LINEAGE_PANEL_TABLE_COLUMNS = ${JSON.stringify(panelTableColumns, null, 2)};

/** Talia target table -> sync.config column list */
export const DATA_LINEAGE_SYNC_TABLE_COLUMNS = ${JSON.stringify(syncTableColumns, null, 2)};

/** Talia target table -> Synapse source (from sync.config) */
export const DATA_LINEAGE_SYNC_SOURCES = ${JSON.stringify(syncSources, null, 2)};

export default DATA_LINEAGE_PANEL_TABLES;
`;

fs.writeFileSync(outFile, body);
console.log(
  `Wrote ${Object.keys(panelTables).length} panels, `
  + `${Object.keys(panelTableColumns).length} panel column maps, `
  + `${Object.keys(syncTableColumns).length} sync tables → ${path.relative(root, outFile)}`,
);
