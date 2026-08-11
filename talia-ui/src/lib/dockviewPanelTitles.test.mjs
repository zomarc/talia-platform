import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRegistryTitlesToDockviewLayout,
  resolveRegistryPanelTitle,
  syncOpenDockviewPanelTitles,
} from './dockviewPanelTitles.js';

const metadata = new Map([
  ['master-sailing-explorer', { title: 'Explorer' }],
  ['reservation-booking-curve', { title: 'Reservation Profile' }],
]);

test('resolveRegistryPanelTitle reads registry title', () => {
  assert.equal(resolveRegistryPanelTitle('master-sailing-explorer', metadata), 'Explorer');
  assert.equal(resolveRegistryPanelTitle('missing', metadata), null);
});

test('applyRegistryTitlesToDockviewLayout rewrites stale panel titles', () => {
  const layout = {
    panels: {
      a: { id: 'a', contentComponent: 'master-sailing-explorer', title: 'Master Sailing Explorer' },
      b: { id: 'b', contentComponent: 'reservation-booking-curve', title: 'Reservation booking curve' },
      c: { id: 'c', contentComponent: 'unknown', title: 'Keep Me' },
    },
  };
  const next = applyRegistryTitlesToDockviewLayout(layout, metadata);
  assert.equal(next.panels.a.title, 'Explorer');
  assert.equal(next.panels.b.title, 'Reservation Profile');
  assert.equal(next.panels.c.title, 'Keep Me');
});

test('syncOpenDockviewPanelTitles updates live panels via setTitle', () => {
  const titles = [];
  const api = {
    panels: [
      {
        component: 'master-sailing-explorer',
        title: 'Master Sailing Explorer',
        api: { setTitle: (value) => titles.push(value) },
      },
    ],
  };
  assert.equal(syncOpenDockviewPanelTitles(api, metadata), 1);
  assert.deepEqual(titles, ['Explorer']);
});
