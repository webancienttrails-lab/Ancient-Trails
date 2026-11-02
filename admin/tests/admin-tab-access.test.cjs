const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in imports ? imports[name] : require(name) });
  return exports;
}
const access = load('lib/admin-access.ts');
const reva = { roles: ['admin'], adminTabs: ['reports'] };

test('a Reports-only account lands on Reports and only has access to that tab', () => {
  assert.equal(access.getAdminHomePath(reva), '/reports');
  for (const tab of access.adminTabOptions) assert.equal(access.canAccessAdminPath(reva, tab.href), tab.key === 'reports', tab.key);
  assert.equal(access.canAccessAdminPath(reva, '/reports?days=30'), true);
  assert.equal(access.canAccessAdminPath(reva, '/reports-other'), false);
  assert.equal(access.canAccessAdminPath(reva, '/bookings/add'), false);
  assert.equal(access.canAccessAdminPath(reva, '/users'), false);
});

test('multiple grants allow child routes without matching unrelated paths', () => {
  const user = { roles: ['admin'], adminTabs: ['pages', 'bookings'] };
  assert.equal(access.canAccessAdminPath(user, '/pages/home'), true);
  assert.equal(access.canAccessAdminPath(user, '/bookings/add'), true);
  assert.equal(access.canAccessAdminPath(user, '/pages-other'), false);
  assert.equal(access.canAccessAdminPath(user, '/'), false);
});

test('super admins and legacy accounts retain existing tabs; empty grants fail closed', () => {
  for (const user of [{ roles: ['super_admin'], adminTabs: [] }, { roles: ['staff'] }]) {
    assert.equal(access.getAdminHomePath(user), '/');
    for (const tab of access.adminTabOptions) assert.equal(access.canAccessAdminPath(user, tab.href), true);
  }
  assert.equal(access.getAdminHomePath({ roles: ['admin'], adminTabs: [] }), '/login');
  assert.equal(access.canAccessAdminPath(null, '/reports'), false);
});

test('both sidebar menus render only the granted Reports tab for a restricted account', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AdminSidebar } = load('components/admin-dashboard/admin-sidebar.tsx', {
    react: { ...React, useEffect: () => {}, useState: () => [reva, () => {}] },
    'next/link': props => React.createElement('a', props),
    '@/lib/admin-auth': { getAdminSession: () => ({ user: reva }), listenForAdminSessionChanges: () => () => {} },
    '@/lib/admin-access': access,
    '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
    '@/components/admin-dashboard/admin-sidebar-logout': { AdminSidebarLogout: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(AdminSidebar, { activeLabel: 'Report' }));
  assert.equal((html.match(/title="Report"/g) || []).length, 2);
  for (const tab of access.adminTabOptions.filter(tab => tab.key !== 'reports')) {
    assert.equal(html.includes(`href="${tab.href}"`), false, tab.href);
  }
});

test('client and backend offer the same permission keys', () => {
  const backend = load('../backend/src/services/admin-access.ts');
  assert.deepEqual(Array.from(access.adminTabOptions, tab => tab.key), Array.from(backend.adminTabs));
});
