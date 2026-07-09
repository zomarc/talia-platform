import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_ROW_CLASS,
  chainRowFormatters,
  createReferenceRowFormatter,
  refreshReferenceRowClasses,
} from './tabulatorReferenceSelection.js';

test('createReferenceRowFormatter toggles reference class from row data', () => {
  const formatter = createReferenceRowFormatter((data) => data?.sail_code === 'REF1');
  const element = { classList: { value: '', toggle(className, on) { this.value = on ? className : ''; } } };
  const row = {
    getElement: () => element,
    getData: () => ({ sail_code: 'REF1' }),
  };

  formatter(row);
  assert.equal(element.classList.value, REFERENCE_ROW_CLASS);

  row.getData = () => ({ sail_code: 'OTHER' });
  formatter(row);
  assert.equal(element.classList.value, '');
});

test('chainRowFormatters runs all formatters in order', () => {
  const calls = [];
  const chained = chainRowFormatters(
    () => calls.push('a'),
    () => calls.push('b'),
    null,
    () => calls.push('c'),
  );
  chained({});
  assert.deepEqual(calls, ['a', 'b', 'c']);
});

test('refreshReferenceRowClasses updates active rows', () => {
  const rows = [
    {
      getElement: () => ({ classList: { toggle() {} } }),
      getData: () => ({ id: 1, active: true }),
    },
    {
      getElement: () => ({ classList: { toggle() {} } }),
      getData: () => ({ id: 2, active: false }),
    },
  ];
  const toggled = [];
  rows.forEach((row) => {
    row.getElement = () => ({
      classList: {
        toggle(className, on) {
          toggled.push({ id: row.getData().id, className, on });
        },
      },
    });
  });

  refreshReferenceRowClasses({ getRows: () => rows }, (data) => data.active === true);
  assert.deepEqual(toggled, [
    { id: 1, className: REFERENCE_ROW_CLASS, on: true },
    { id: 2, className: REFERENCE_ROW_CLASS, on: false },
  ]);
});
