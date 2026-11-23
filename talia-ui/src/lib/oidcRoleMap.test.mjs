import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractOidcRoleHints,
  parseOidcRoleMap,
  resolveOidcSeedRole,
} from './oidcRoleMap.js';

test('parseOidcRoleMap accepts JSON and objects', () => {
  assert.deepEqual(parseOidcRoleMap('{"rm-controllers":"MANAGER"}'), {
    'rm-controllers': 'MANAGER',
  });
  assert.deepEqual(parseOidcRoleMap({ ADMINS: 'ADMIN' }), { ADMINS: 'ADMIN' });
  assert.deepEqual(parseOidcRoleMap('not-json'), {});
});

test('extractOidcRoleHints reads groups and sub', () => {
  const hints = extractOidcRoleHints({
    app_metadata: { groups: ['rm-controllers'], sub: 'entra-sub-1' },
    user_metadata: { talia_role: 'manager' },
    identities: [{ provider: 'azure', id: 'entra-sub-1', identity_data: {} }],
  });
  assert.equal(hints.oidcSub, 'entra-sub-1');
  assert.deepEqual(hints.groups, ['rm-controllers']);
  assert.equal(hints.explicitRole, 'manager');
});

test('resolveOidcSeedRole prefers explicit talia_role then group map', () => {
  assert.equal(
    resolveOidcSeedRole({
      user_metadata: { talia_role: 'ADMIN' },
    }, {}),
    'ADMIN'
  );
  assert.equal(
    resolveOidcSeedRole({
      app_metadata: { groups: ['rm-controllers'] },
    }, { 'rm-controllers': 'MANAGER' }),
    'MANAGER'
  );
  assert.equal(
    resolveOidcSeedRole({
      user_metadata: {
        custom_claims: { groups: ['40a4cefa-1557-4b41-9817-ca0a8c985d53'] },
      },
    }, { '40a4cefa-1557-4b41-9817-ca0a8c985d53': 'ADMIN' }),
    'ADMIN'
  );
  assert.equal(resolveOidcSeedRole({}, {}), 'USER');
});
