#!/usr/bin/env node
/**
 * Publish the branded executive overview HTML into the Talia database
 * (project_summary table) so the in-app "Project Summary" panel shows the latest.
 *
 * Marks any existing current row as not-current, then inserts a new current row.
 *
 * Env (defaults match talia-server/src/services/supabase.js local dev):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/publish-project-summary.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const HTML_SOURCE = path.join(rootDir, 'docs', 'EXECUTIVE-OVERVIEW.html');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveVersion() {
  const ui = readJSON(path.join(rootDir, 'talia-ui', 'package.json'));
  const server = readJSON(path.join(rootDir, 'talia-server', 'package.json'));
  const uiV = ui?.version ? `UI ${ui.version}` : null;
  const serverV = server?.version ? `Server ${server.version}` : null;
  return [uiV, serverV].filter(Boolean).join(' · ') || null;
}

async function main() {
  if (!fs.existsSync(HTML_SOURCE)) {
    console.error(`✗ Source HTML not found: ${HTML_SOURCE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(HTML_SOURCE, 'utf8');
  const version = resolveVersion();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Demote existing current rows (best-effort; ignore if table just created/empty).
  const { error: demoteError } = await supabase
    .from('project_summary')
    .update({ is_current: false })
    .eq('is_current', true);

  if (demoteError && !/no rows/i.test(demoteError.message || '')) {
    // Non-fatal for empty table, but surface real failures (e.g. missing table).
    if (/relation .* does not exist|could not find the table/i.test(demoteError.message || '')) {
      console.error(`✗ project_summary table not found. Apply the migration first.`);
      console.error(`  ${demoteError.message}`);
      process.exit(2);
    }
    console.warn(`! Warning demoting current rows: ${demoteError.message}`);
  }

  const { data, error } = await supabase
    .from('project_summary')
    .insert({
      title: 'Project Summary',
      version,
      format: 'html',
      content,
      source_path: 'docs/EXECUTIVE-OVERVIEW.html',
      is_current: true,
      generated_at: new Date().toISOString()
    })
    .select('id, generated_at')
    .limit(1);

  if (error) {
    console.error(`✗ Failed to publish project summary: ${error.message}`);
    process.exit(2);
  }

  const row = Array.isArray(data) ? data[0] : null;
  console.log(
    `✓ Published project summary → project_summary (id ${row?.id ?? '?'}, ${version || 'no version'}) at ${SUPABASE_URL}`
  );
}

main().catch((err) => {
  console.error(`✗ Publish error: ${err?.message || err}`);
  process.exit(2);
});
