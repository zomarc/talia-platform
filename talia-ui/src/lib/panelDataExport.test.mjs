import assert from 'node:assert/strict';
import {
  rowsToCsv,
  rowsToMarkdown,
  escapeCsvCell,
  buildExportFilename,
  shortDateStamp,
  payloadFromReport,
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

const markdown = rowsToMarkdown(
  [{ field: 'id', title: 'ID' }, { field: 'name', title: 'Name' }],
  [{ id: 1, name: 'A|B' }, { id: 2, name: 'line\nbreak' }]
);
assert.equal(markdown, '| ID | Name |\n| --- | --- |\n| 1 | A\\|B |\n| 2 | line<br>break |\n');
assert.match(buildExportFilename('Documents', 'md'), /^Documents-\d{4}-\d{2}-\d{2}_\d{6}_\d{3}\.md$/);

const fixed = new Date(2026, 7, 13, 16, 1, 45, 123); // local Aug 13 2026
assert.equal(shortDateStamp(fixed), '2026-08-13_160145_123');

const name = buildExportFilename('Reservation Current', 'csv');
assert.match(name, /^Reservation-Current-\d{4}-\d{2}-\d{2}_\d{6}_\d{3}\.csv$/);

const a = shortDateStamp();
const b = shortDateStamp(new Date(Date.now() + 1));
assert.notEqual(a, b);

const report = payloadFromReport({
  title: 'MR Retrospect',
  html: '<html><body>ok</body></html>',
  columns: [{ field: 'dtd', title: 'DTD' }],
  rows: [{ dtd: 90 }],
  chartImage: 'data:image/png;base64,AAA',
});
assert.equal(report.title, 'MR Retrospect');
assert.equal(report.html, '<html><body>ok</body></html>');
assert.equal(report.chartImage, 'data:image/png;base64,AAA');
assert.deepEqual(report.columns, [{ field: 'dtd', title: 'DTD' }]);
assert.deepEqual(report.rows, [{ dtd: 90 }]);

const bare = payloadFromReport({ title: 'Bare', rows: [{ a: 1 }] });
assert.equal(bare.html, undefined);
assert.equal(bare.chartImage, undefined);
assert.deepEqual(bare.columns, []);
assert.deepEqual(bare.rows, [{ a: 1 }]);

console.log('panelDataExport.test.mjs: ok');
