#!/usr/bin/env node
/**
 * CI-friendly check: every registered arcade panel id has a control-hint entry.
 * Run from repo root: node scripts/verify-arcade-panels.mjs
 */
import { ARCADE_GAME_PANEL_COMPONENTS } from '../src/components/shared/games/arcadeGamePanelIds.js';
import { ARCADE_CONTROL_HINTS_BY_PANEL } from '../src/components/shared/games/arcadeGameControlHints.js';

let failed = false;
for (const id of ARCADE_GAME_PANEL_COMPONENTS) {
  const hint = ARCADE_CONTROL_HINTS_BY_PANEL[id];
  if (!hint || !String(hint).trim()) {
    console.error(`[verify-arcade-panels] Missing control hint for panel id: "${id}"`);
    failed = true;
  }
}

for (const key of Object.keys(ARCADE_CONTROL_HINTS_BY_PANEL)) {
  if (!ARCADE_GAME_PANEL_COMPONENTS.has(key)) {
    console.error(
      `[verify-arcade-panels] Hint for unknown panel id (add to arcadeGamePanelIds or remove hint): "${key}"`,
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('[verify-arcade-panels] OK — arcade panel ids and control hints are in sync.');
