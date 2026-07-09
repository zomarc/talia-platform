import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeColumnHeaderAlignment } from './tabulatorColumnAlignment.js';

test('normalizeColumnHeaderAlignment mirrors hozAlign when headerHozAlign is unset', () => {
  const columns = normalizeColumnHeaderAlignment([
    { field: 'name', hozAlign: 'left' },
    { field: 'amount', hozAlign: 'right' },
    { field: 'status', hozAlign: 'center' },
    { field: 'note' },
    { field: 'custom', hozAlign: 'right', headerHozAlign: 'left' },
  ]);

  assert.equal(columns[0].headerHozAlign, 'left');
  assert.equal(columns[1].headerHozAlign, 'right');
  assert.equal(columns[2].headerHozAlign, 'center');
  assert.equal(columns[3].headerHozAlign, undefined);
  assert.equal(columns[4].headerHozAlign, 'left');
});

test('normalizeColumnHeaderAlignment applies to nested column groups', () => {
  const columns = normalizeColumnHeaderAlignment([
    {
      title: 'Metrics',
      columns: [
        { field: 'sold', hozAlign: 'right' },
        { field: 'label', hozAlign: 'left' },
      ],
    },
  ]);

  assert.equal(columns[0].columns[0].headerHozAlign, 'right');
  assert.equal(columns[0].columns[1].headerHozAlign, 'left');
});
