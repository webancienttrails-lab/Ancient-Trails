const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { User } = require('../dist/models/user.model');
const sessions = require('../dist/services/auth-session.service');
const { signAuthToken } = require('../dist/utils/jwt');
const { loginAdminWithPassword } = require('../dist/controllers/auth.controller');

function setup(t) {
  for (const [key, value] of Object.entries({
    ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: undefined, ADMIN_PASSWORD_HASH: undefined,
    JWT_SECRET: 'admin-login-safety-fixture-secret',
  })) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const admin = { _id: '111111111111111111111111', id: '111111111111111111111111',
    firstName: 'Test', lastName: 'Admin', email: 'admin@example.test', roles: ['super_admin'],
    status: 'active', isMobileVerified: true, save: async () => {} };
  t.mock.method(sessions, 'issueAuthSession', async user => signAuthToken(user));
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  return { admin, response, login: password => loginAdminWithPassword({ body: { email: admin.email, password } }, response) };
}

test('an unconfigured bootstrap credential cannot create an administrator', async t => {
  const f = setup(t);
  t.mock.method(User, 'findOne', () => ({ select: async () => null }));
  const create = t.mock.method(User, 'create', () => { throw Error('Must not create an admin'); });
  await assert.rejects(f.login('unconfigured-password'), error => error.statusCode === 401);
  assert.equal(create.mock.callCount(), 0);
});

for (const hashed of [false, true]) {
  test(`explicitly configured ${hashed ? 'hashed' : 'plain'} bootstrap credentials still work`, async t => {
    const f = setup(t), password = 'fixture-configured-password';
    process.env[hashed ? 'ADMIN_PASSWORD_HASH' : 'ADMIN_PASSWORD'] = hashed ? await bcrypt.hash(password, 4) : password;
    t.mock.method(User, 'findOne', () => ({ select: async () => null }));
    t.mock.method(User, 'create', async () => f.admin);
    await f.login(password);
    assert.equal(f.response.statusCode, 200);
    assert.equal(f.response.body.data.user.email, f.admin.email);
  });
}

test('existing administrator account passwords work without bootstrap credentials', async t => {
  const f = setup(t), password = 'fixture-account-password';
  f.admin.passwordHash = await bcrypt.hash(password, 4);
  t.mock.method(User, 'findOne', () => ({ select: async () => f.admin }));
  await f.login(password);
  assert.equal(f.response.statusCode, 200);
  await assert.rejects(f.login('wrong-fixture-password'), error => error.statusCode === 401);
});
