import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateDockviewPanel,
  activateDockviewPanelFromHost,
  isDockviewPanelActive,
  replayClickAfterActivate,
  wasDockviewPanelJustActivated,
} from './activateDockviewPanel.js';

const createShell = (panelInstanceId = 'panel-1') => {
  const attrs = new Map([['data-panel-instance-id', panelInstanceId]]);
  const shell = {
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
    closest() { return shell; },
  };
  return { shell, attrs };
};

const installWindow = ({ panelApi = null, getPanel = null } = {}) => {
  const listeners = new Map();
  globalThis.window = {
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== handler));
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    dockviewApi: {
      getPanel: getPanel || ((id) => (panelApi ? { id, api: panelApi } : null)),
    },
  };
  return { listeners };
};

test('isDockviewPanelActive reads function and boolean APIs', () => {
  assert.equal(isDockviewPanelActive({ isActive: () => false }), false);
  assert.equal(isDockviewPanelActive({ isActive: () => true }), true);
  assert.equal(isDockviewPanelActive({ isActive: false }), false);
  assert.equal(isDockviewPanelActive({ isActive: true }), true);
  assert.equal(isDockviewPanelActive({}), false);
});

test('activateDockviewPanel activates when isActive is a function returning false', () => {
  const { shell } = createShell('explorer-1');
  let active = false;
  const panelApi = {
    id: 'explorer-1',
    isActive: () => active,
    setActive() { active = true; },
  };
  installWindow({ panelApi });
  globalThis.document = { querySelector: () => shell };

  assert.equal(activateDockviewPanel(panelApi, { panelInstanceId: 'explorer-1', shell }), true);
  assert.equal(active, true);
  assert.equal(wasDockviewPanelJustActivated(shell), true);
});

test('activateDockviewPanel is a no-op when the panel is already active', () => {
  const { shell } = createShell('explorer-1');
  const panelApi = {
    id: 'explorer-1',
    isActive: () => true,
    setActive() { throw new Error('should not activate'); },
  };
  installWindow({ panelApi });

  assert.equal(activateDockviewPanel(panelApi, { panelInstanceId: 'explorer-1', shell }), false);
  assert.equal(wasDockviewPanelJustActivated(shell), false);
});

test('activateDockviewPanelFromHost marks the nearest report shell', () => {
  const { shell } = createShell('explorer-2');
  let active = false;
  const panelApi = {
    id: 'explorer-2',
    isActive: false,
    setActive() { active = true; },
  };
  installWindow({ panelApi });
  const host = { closest: () => shell };

  assert.equal(activateDockviewPanelFromHost(host), true);
  assert.equal(active, true);
  assert.equal(wasDockviewPanelJustActivated(host), true);
});

test('replayClickAfterActivate blocks the native click and re-dispatches once', async () => {
  installWindow();
  const events = [];
  const target = {
    addEventListener(type, handler, options) {
      events.push(['add', type, handler, options]);
    },
    removeEventListener(type, handler) {
      events.push(['remove', type, handler]);
    },
    dispatchEvent(event) {
      events.push(['dispatch', event.type]);
      return true;
    },
  };

  replayClickAfterActivate({ target, clientX: 12, clientY: 34 });
  assert.equal(events[0][0], 'add');
  assert.equal(events[0][1], 'click');

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.some((item) => item[0] === 'dispatch' && item[1] === 'click'), true);
  assert.equal(events.some((item) => item[0] === 'remove'), true);
});
