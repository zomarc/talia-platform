import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNumberDisplayFormatter,
  formatDisplayNumber,
  formatExactNumber,
  displayDecimalsForKind,
} from './numberDisplay.js';

test('money display rounds to whole numbers; exact keeps cents', () => {
  assert.equal(formatDisplayNumber(2251.18, 'money'), '2,251');
  assert.equal(formatExactNumber(2251.18, 'money'), '2,251.18');
  assert.equal(displayDecimalsForKind('money'), 0);
});

test('pct keeps at least one decimal on display', () => {
  assert.equal(formatDisplayNumber(89.86, 'pct'), '89.9');
  assert.equal(formatExactNumber(89.86, 'pct'), '89.86');
});

test('quantity trims trailing zeros', () => {
  assert.equal(formatDisplayNumber(2, 'quantity'), '2');
  assert.equal(formatDisplayNumber(2.5, 'quantity'), '2.5');
  assert.equal(formatDisplayNumber(1077.0, 'quantity'), '1,077');
});

test('count is integer', () => {
  assert.equal(formatDisplayNumber(630.4, 'count'), '630');
  assert.equal(formatExactNumber(630.4, 'count'), '630');
});

test('formatter adds title when display differs from exact', () => {
  const formatter = createNumberDisplayFormatter('money');
  const html = formatter({ getValue: () => 2251.18 });
  assert.match(html, /title="2,251\.18"/);
  assert.match(html, />2,251</);
});

test('formatter omits title when display equals exact', () => {
  const formatter = createNumberDisplayFormatter('count');
  assert.equal(formatter({ getValue: () => 12 }), '12');
});
