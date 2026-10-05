import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REQUIREMENTS_LOG_EXPORT_ROOT_KEY,
  buildRequirementInputsFromPack,
  buildRequirementsLogExportPack,
  parseRequirementsLogExportPack,
  scrubRequirementItemForExport,
} from './taliaRequirementsLogExportPack.js';

describe('taliaRequirementsLogExportPack', () => {
  it('scrubs createdBy on export', () => {
    const scrubbed = scrubRequirementItemForExport({
      id: '11111111-1111-1111-1111-111111111111',
      section: 'deliverable',
      title: 'Ship Groups Explorer',
      detail: 'notes',
      status: 'backlog',
      priority: 'p0',
      area: 'ui',
      targetVersion: '0.3.2',
      owner: 'Russell',
      source: 'plaud',
      sourceRef: 'file-abc',
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      createdBy: 'user-secret-id',
    });
    assert.equal(scrubbed.createdBy, null);
    assert.equal(scrubbed.title, 'Ship Groups Explorer');
    assert.equal(scrubbed.sourceRef, 'file-abc');
  });

  it('builds and parses a pack', () => {
    const pack = buildRequirementsLogExportPack([
      {
        id: '11111111-1111-1111-1111-111111111111',
        section: 'question',
        title: 'Open question',
        status: 'backlog',
        priority: 'p1',
        source: 'manual',
        createdBy: 'should-scrub',
      },
    ]);
    assert.ok(pack[REQUIREMENTS_LOG_EXPORT_ROOT_KEY]);
    const parsed = parseRequirementsLogExportPack(pack);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.pack.items.length, 1);
    assert.equal(parsed.pack.items[0].createdBy, null);
  });

  it('mergeById keeps ids; createNew omits them', () => {
    const packRoot = {
      version: 1,
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          section: 'external',
          title: 'Invoice Michalis',
          status: 'in_progress',
          priority: 'p1',
          source: 'cursor',
          targetVersion: 'oct-5-demo',
          taliaVersion: '0.3.2',
        },
      ],
    };
    const merged = buildRequirementInputsFromPack(packRoot, { mode: 'mergeById' });
    assert.equal(merged[0].id, '11111111-1111-1111-1111-111111111111');
    assert.equal(merged[0].taliaVersion, '0.3.2');
    assert.equal(merged[0].targetVersion, 'oct-5-demo');
    const created = buildRequirementInputsFromPack(packRoot, { mode: 'createNew' });
    assert.equal(created[0].id, undefined);
    assert.equal(created[0].title, 'Invoice Michalis');
  });
});
