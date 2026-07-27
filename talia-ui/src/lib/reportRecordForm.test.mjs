import assert from 'node:assert/strict';
import {
  buildReportRecordFields,
  formatReportRecordValue,
  resolveReportRecordLabel,
  shouldShowReportRecordForm,
} from './reportRecordForm.js';

assert.equal(shouldShowReportRecordForm(null), false);
assert.equal(shouldShowReportRecordForm([]), false);
assert.equal(shouldShowReportRecordForm([{ id: 1 }, { id: 2 }]), false);
assert.equal(shouldShowReportRecordForm([{ id: 1 }]), true);

assert.equal(
  resolveReportRecordLabel({ field: 'agency_id', title: 'Agcy', titleLong: 'Agency ID' }),
  'Agency ID'
);

const columns = [
  { field: 'agency_id', title: 'Agency ID', titleLong: 'Agency ID' },
  {
    field: 'agency_name',
    title: 'Name',
    formatter: (cell) => `<strong>${cell.getValue()}</strong>`,
  },
  { field: 'hidden', title: 'Hidden', visible: false },
  { field: 'skip', title: 'Skip', excludeFromRecordForm: true },
  { formatter: 'rowSelection' },
];

const fields = buildReportRecordFields(columns, {
  agency_id: 42,
  agency_name: 'Acme Travel',
  hidden: 'nope',
  skip: 'nope',
});

assert.equal(fields.length, 2);
assert.equal(fields[0].label, 'Agency ID');
assert.equal(fields[0].text, '42');
assert.equal(fields[1].html, '<strong>Acme Travel</strong>');

const empty = formatReportRecordValue({ field: 'missing', title: 'Missing' }, {});
assert.equal(empty.empty, true);

console.log('reportRecordForm.test.mjs: ok');
