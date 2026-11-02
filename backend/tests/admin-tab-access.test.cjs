const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const express = require('express');
const { User } = require('../dist/models/user.model');
const { createAdminUser } = require('../dist/controllers/user.controller');
const { loginAdminWithPassword, refreshSession } = require('../dist/controllers/auth.controller');
const { requireNotificationUser } = require('../dist/controllers/notification.controller');
const sessions = require('../dist/services/auth-session.service');
const { requireAdmin } = require('../dist/middleware/adminAuth');
const { canAccessAdminApi } = require('../dist/services/admin-access');
const { signAuthToken } = require('../dist/utils/jwt');
const userRoutes = require('../dist/routes/user.routes').default;

function setup(t, roles = ['super_admin'], tabs) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'tab-access-test-secret-only';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const actor = new User({ roles, status: 'active', adminTabs: tabs });
  t.mock.method(User, 'findById', async () => actor);
  const headers = { authorization: 'Bearer ' + signAuthToken(actor) };
  return { actor, headers, request: body => ({ headers, body }) };
}
const payload = () => ({ firstName: ' Reva ', lastName: ' Test ', profession: ' Accountant ', email: 'REVA@example.test', password: 'test-password-123456', adminTabs: ['reports'] });
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test('super admin creates a restricted account whose password logs into the existing admin flow', async t => {
  const f = setup(t), res = response();
  let created;
  t.mock.method(User, 'create', async data => { created = new User(data); return created; });
  await createAdminUser(f.request(payload()), res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.firstName, 'Reva');
  assert.equal(created.email, 'reva@example.test');
  assert.equal(created.profession, 'Accountant');
  assert.deepEqual([...created.roles], ['admin']);
  assert.deepEqual([...created.adminTabs], ['reports']);
  assert.notEqual(created.passwordHash, payload().password);
  assert.equal(await bcrypt.compare(payload().password, created.passwordHash), true);
  assert.equal('passwordHash' in res.body.data.user, false);
  assert.equal('password' in res.body.data.user, false);

  t.mock.method(User, 'findOne', () => ({ select: async () => created }));
  t.mock.method(created, 'save', async () => created);
  t.mock.method(sessions, 'issueAuthSession', async user => signAuthToken(user, 'test-session'));
  const login = response();
  await loginAdminWithPassword({ body: { email: created.email, password: payload().password } }, login);
  assert.equal(login.statusCode, 200);
  assert.deepEqual([...login.body.data.user.adminTabs], ['reports']);
  assert.equal(login.body.data.user.profession, 'Accountant');
  assert.equal('passwordHash' in login.body.data.user, false);
  await assert.rejects(loginAdminWithPassword({ body: { email: created.email, password: 'wrong-password' } }, response()), error => error.statusCode === 401);
});

for (const roles of [['admin'], ['staff'], ['traveller']]) {
  test(`${roles[0]} cannot create an admin even with access to Users`, async t => {
    const f = setup(t, roles, ['users']);
    const create = t.mock.method(User, 'create', async () => { throw Error('must not create'); });
    await assert.rejects(createAdminUser(f.request(payload()), response()), error => error.statusCode === 403);
    assert.equal(create.mock.callCount(), 0);
  });
}

test('creation rejects missing auth, blocked super admins, invalid permissions, weak passwords and extra privilege fields', async t => {
  const f = setup(t);
  const create = t.mock.method(User, 'create', async () => { throw Error('must not create'); });
  await assert.rejects(createAdminUser({ headers: {}, body: payload() }, response()), error => error.statusCode === 401);
  f.actor.status = 'blocked';
  await assert.rejects(createAdminUser(f.request(payload()), response()), error => error.statusCode === 403);
  f.actor.status = 'active';
  for (const changes of [{ adminTabs: [] }, { adminTabs: ['invented'] }, { password: 'short' }, { password: 'é'.repeat(40) }, { roles: ['super_admin'] }, { email: 'invalid' }, { firstName: '' }]) {
    await assert.rejects(createAdminUser(f.request({ ...payload(), ...changes }), response()), error => error.statusCode === 400);
  }
  assert.equal(create.mock.callCount(), 0);
});

test('duplicate emails return a conflict without altering the existing account', async t => {
  const f = setup(t);
  t.mock.method(User, 'create', async () => { throw Object.assign(Error('duplicate'), { code: 11000 }); });
  await assert.rejects(createAdminUser(f.request(payload()), response()), error => error.statusCode === 409);
});

test('session refresh returns the current profession and tab permissions', async t => {
  const f = setup(t, ['admin'], ['reports']);
  f.actor.profession = 'Accountant';
  t.mock.method(sessions, 'refreshAuthSession', async () => ({ user: f.actor, sessionId: 'test-refresh' }));
  const res = response();
  await refreshSession({}, res);
  assert.deepEqual([...res.body.data.user.adminTabs], ['reports']);
  assert.equal(res.body.data.user.profession, 'Accountant');
});

test('reports permission grants the report endpoint, denies every other admin section and denies unknown paths', () => {
  const user = { roles: ['admin'], adminTabs: ['reports'] };
  assert.equal(canAccessAdminApi(user, 'GET', '/api/admin/dashboard/reports?days=30'), true);
  for (const path of ['/api/admin/dashboard', '/api/admin/users', '/api/admin/tours', '/api/admin/bookings', '/api/admin/enquiries', '/api/admin/site-settings', '/api/admin/home', '/api/admin/unknown', '/api/admin/dashboard/reports/export']) {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.equal(canAccessAdminApi(user, method, path), false, method + ' ' + path);
  }
  assert.equal(canAccessAdminApi({ roles: ['admin'], adminTabs: ['dashboard'] }, 'GET', '/api/admin/dashboard/reports'), false);
});

test('legacy and super admin access is preserved, while an explicit empty list denies access', () => {
  for (const user of [{ roles: ['admin'] }, { roles: ['super_admin'], adminTabs: [] }]) {
    assert.equal(canAccessAdminApi(user, 'POST', '/api/admin/tours'), true);
  }
  assert.equal(canAccessAdminApi({ roles: ['admin'], adminTabs: [] }, 'GET', '/api/admin/dashboard'), false);
  assert.equal(new User({ roles: ['admin'] }).adminTabs, undefined);
});

test('editor dependencies permit list reads without granting mutations or unrelated detail endpoints', () => {
  const user = { roles: ['admin'], adminTabs: ['bookings'] };
  assert.equal(canAccessAdminApi(user, 'GET', '/api/admin/tours'), true);
  assert.equal(canAccessAdminApi(user, 'GET', '/api/admin/tours/departures'), true);
  assert.equal(canAccessAdminApi(user, 'POST', '/api/admin/tours'), false);
  assert.equal(canAccessAdminApi(user, 'GET', '/api/admin/tours/itineraries'), false);
  assert.equal(canAccessAdminApi(user, 'DELETE', '/api/admin/destinations/test'), false);
});

test('middleware checks current database permissions instead of trusting cached token roles', async t => {
  const f = setup(t, ['admin'], ['reports']);
  async function check(path) {
    let error;
    await requireAdmin({ headers: f.headers, method: 'GET', originalUrl: path }, {}, value => { error = value; });
    return error;
  }
  assert.equal(await check('/api/admin/dashboard/reports'), undefined);
  assert.equal((await check('/api/admin/users')).statusCode, 403);
  f.actor.adminTabs = ['users'];
  assert.equal((await check('/api/admin/dashboard/reports')).statusCode, 403);
  f.actor.status = 'blocked';
  assert.equal((await check('/api/admin/users')).statusCode, 403);
});

test('restricted admins cannot read the general admin notification inbox', async t => {
  const f = setup(t, ['admin'], ['reports']);
  let error;
  await requireNotificationUser({ headers: f.headers, params: { audience: 'admin' } }, { locals: {} }, value => { error = value; });
  assert.equal(error.statusCode, 403);
});

test('Users POST route enforces super admin creation rights', async t => {
  const f = setup(t, ['admin'], ['users']);
  const create = t.mock.method(User, 'create', async () => { throw Error('must not create'); });
  const app = express(); app.use(express.json()); app.use('/api/admin/users', userRoutes);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users`, { method: 'POST', headers: { ...f.headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
  assert.equal(result.status, 403);
  assert.equal(create.mock.callCount(), 0);
});
