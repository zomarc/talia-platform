import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatColumnTotalInteger,
  formatColumnTotalNumber,
  setTabulatorColumnTotalsVisible,
  withColumnTotal,
} from './tabulatorColumnTotals.js';

const cell = (value) => ({ getValue: () => value });

test('withColumnTotal count sets bottomCalc and integer formatter', () => {
  const col = withColumnTotal({ field: 'res_id', title: 'Res ID' }, 'count');
  assert.equal(col.bottomCalc, 'count');
  assert.equal(col.bottomCalcFormatter, formatColumnTotalInteger);
  assert.equal(formatColumnTotalInteger(cell(1284)), '1,284');
});

test('withColumnTotal sum uses money display for revenue fields', () => {
  const col = withColumnTotal({ field: 'net_ticket_revenue_eur' }, 'sum');
  assert.equal(col.bottomCalc, 'sum');
  assert.deepEqual(col.bottomCalcParams, { precision: 0 });
  assert.equal(col.bottomCalcFormatterParams?.displayKind, 'money');
  assert.equal(col.bottomCalcFormatter(cell(1234.56)), '1,235');
});

test('withColumnTotal sum honors explicit precision on untyped fields', () => {
  const col = withColumnTotal(
    { field: 'unknown_amount' },
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

test('setTabulatorColumnTotalsVisible hides via removeCalcs and shows via reinitialize+recalc', () => {
  let columnCalcs = true;
  const calls = [];
  const footer = {
    style: {
      display: '',
      removeProperty(key) {
        if (key === 'display') this.display = '';
      },
    },
    querySelector(sel) {
      if (sel === '.tabulator-calcs-holder') return this._calcs || null;
      if (sel === '.tabulator-footer-contents') return { childElementCount: 0 };
      return null;
    },
  };
  const root = {
    querySelector(sel) {
      return sel === '.tabulator-footer' ? footer : null;
    },
  };
  const table = {
    element: root,
    getElement: () => root,
    options: { columnCalcs: true },
    setOption(key, value) {
      if (key === 'columnCalcs') columnCalcs = value;
      this.options[key] = value;
    },
    modules: {
      columnCalcs: {
        removeCalcs: () => {
          calls.push('remove');
          footer._calcs = null;
        },
        reinitializeCalcs: () => {
          calls.push('reinit');
          footer._calcs = {};
        },
        recalcActiveRows: () => calls.push('recalcRows'),
      },
    },
    recalc: () => calls.push('recalc'),
    rowManager: { adjustTableSize: () => calls.push('adjust') },
  };

  assert.equal(setTabulatorColumnTotalsVisible(table, false), true);
  assert.equal(columnCalcs, false);
  assert.equal(footer.style.display, 'none');
  assert.deepEqual(calls, ['remove', 'adjust']);

  calls.length = 0;
  assert.equal(setTabulatorColumnTotalsVisible(table, true), true);
  assert.equal(columnCalcs, true);
  assert.equal(footer.style.display, '');
  assert.deepEqual(calls, ['reinit', 'recalc', 'adjust']);
});

test('setTabulatorColumnTotalsVisible is a safe no-op without a table', () => {
  assert.equal(setTabulatorColumnTotalsVisible(null, false), false);
});
