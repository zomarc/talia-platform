import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatColumnTotalInteger,
  formatColumnTotalNumber,
  withColumnTotal,
} from './tabulatorColumnTotals.js';

const cell = (value) => ({ getValue: () => value });

test('withColumnTotal count sets bottomCalc and integer formatter', () => {
  const col = withColumnTotal({ field: 'res_id', title: 'Res ID' }, 'count');
  assert.equal(col.bottomCalc, 'count');
  assert.equal(col.bottomCalcFormatter, formatColumnTotalInteger);
  assert.equal(formatColumnTotalInteger(cell(1284)), '1,284');
});

test('withColumnTotal sum sets precision and numeric formatter', () => {
  const col = withColumnTotal(
    { field: 'net_ticket_revenue_eur' },
    'sum',
    { precision: 2 }
  );
  assert.equal(col.bottomCalc, 'sum');
  assert.deepEqual(col.bottomCalcParams, { precision: 2 });
  assert.equal(col.bottomCalcFormatter, formatColumnTotalNumber);
  assert.equal(formatColumnTotalNumber(cell(1234.5), { precision: 2 }), '1,234.50');
});

test('withColumnTotal rejects unknown kinds without mutating calc', () => {
  const col = withColumnTotal({ field: 'x', title: 'X' }, 'nope');
  assert.equal(col.bottomCalc, undefined);
  assert.equal(col.field, 'x');
});
