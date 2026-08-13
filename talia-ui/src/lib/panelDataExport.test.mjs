import assert from 'node:assert/strict';
import {
  rowsToCsv,
  escapeCsvCell,
  buildExportFilename,
  shortDateStamp,
} from './panelDataExport.js';

assert.equal(escapeCsvCell(null), '');
assert.equal(escapeCsvCell('plain'), 'plain');
assert.equal(escapeCsvCell('a,b'), '"a,b"');
assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');

const csv = rowsToCsv(
  [{ field: 'id', title: 'ID' }, { field: 'name', title: 'Name' }],
  [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Be,ta' }]
);
assert.equal(csv, 'ID,Name\n1,Alpha\n2,"Be,ta"');

const fixed = new Date(2026, 7, 13, 16, 1, 45, 123); // local Aug 13 2026
assert.equal(shortDateStamp(fixed), '2026-08-13_160145_123');

const name = buildExportFilename('Reservation Current', 'csv');
assert.match(name, /^Reservation-Current-\d{4}-\d{2}-\d{2}_\d{6}_\d{3}\.csv$/);

const a = shortDateStamp();
const b = shortDateStamp(new Date(Date.now() + 1));
assert.notEqual(a, b);

console.log('panelDataExport.test.mjs: ok');
