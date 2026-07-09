import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERENCE_ROW_CLASS,
  chainRowFormatters,
  createReferenceRowFormatter,
  forEachTableRow,
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

test('forEachTableRow visits nested grouped data rows', () => {
  const visited = [];
  const dataRow = (id) => ({
    getType: () => 'row',
    getData: () => ({ id }),
  });
  const table = {
    getGroups: () => [{
      getSubGroups: () => [{
        getRows: () => [dataRow(1), dataRow(2)],
      }],
    }],
  };

  forEachTableRow(table, (row) => {
    visited.push(row.getData().id);
  });

  assert.deepEqual(visited, [1, 2]);
});

test('refreshReferenceRowClasses updates active rows in grouped tables', () => {
  const toggled = [];
  const makeRow = (id, active) => ({
    getType: () => 'row',
    getElement: () => ({
      classList: {
        toggle(className, on) {
          toggled.push({ id, className, on });
        },
      },
    }),
    getData: () => ({ id, active }),
  });
  const table = {
    getGroups: () => [{
      getSubGroups: () => [{
        getRows: () => [makeRow(1, true), makeRow(2, false)],
      }],
    }],
  };

  refreshReferenceRowClasses(table, (data) => data.active === true);
  assert.deepEqual(toggled, [
    { id: 1, className: REFERENCE_ROW_CLASS, on: true },
    { id: 2, className: REFERENCE_ROW_CLASS, on: false },
  ]);
});

test('refreshReferenceRowClasses updates flat table rows', () => {
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
