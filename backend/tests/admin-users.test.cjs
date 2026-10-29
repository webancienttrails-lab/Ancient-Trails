const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { User } = require('../dist/models/user.model');
const { updateAdminUser } = require('../dist/controllers/user.controller');
const userRoutes = require('../dist/routes/user.routes').default;
const { signAuthToken } = require('../dist/utils/jwt');

function setup(t, actorRoles = ['admin'], targetRoles = ['traveller']) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'admin-user-update-test-only';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const actor = new User({ roles: actorRoles, status: 'active' });
  const target = new User({ firstName: '', lastName: '', mobileNumber: '910000000000', roles: targetRoles, status: 'active', isMobileVerified: true });
  t.mock.method(User, 'findById', async id => String(id) === actor.id ? actor : String(id) === target.id ? target : null);
  let saves = 0;
  t.mock.method(target, 'save', async () => { saves++; return target; });
  const headers = { authorization: 'Bearer ' + signAuthToken(actor) };
  return { actor, target, headers, saves: () => saves, request: body => ({ headers, params: { id: target.id }, body }) };
}
const response = () => ({ body: null, json(body) { this.body = body; } });

test('incomplete OTP profile can be edited without changing verified mobile, role or status', async t => {
  const f = setup(t), res = response();
  await updateAdminUser(f.request({ firstName: ' Fixture ', lastName: ' Traveller ', email: 'FIXTURE@example.test' }), res);
  assert.equal(f.target.firstName, 'Fixture'); assert.equal(f.target.email, 'fixture@example.test');
  assert.equal(f.target.mobileNumber, '910000000000'); assert.equal(f.target.isMobileVerified, true);
  assert.deepEqual([...f.target.roles], ['traveller']); assert.equal(f.target.status, 'active');
  assert.equal(res.body.data.user.id, f.target.id); assert.equal(f.saves(), 1);
});
test('status action persists blocked and active states', async t => {
  const f = setup(t);
  await updateAdminUser(f.request({ status: 'blocked' }), response()); assert.equal(f.target.status, 'blocked');
  await updateAdminUser(f.request({ status: 'active' }), response()); assert.equal(f.target.status, 'active');
  assert.equal(f.saves(), 2);
});
test('empty optional email is unset rather than stored as a duplicate empty indexed value', async t => {
  const f = setup(t); f.target.email = 'fixture@example.test';
  await updateAdminUser(f.request({ email: '' }), response()); assert.equal(f.target.email, undefined);
});
for (const body of [{ roles: ['super_admin'] }, { mobileNumber: '0000000000' }, { passwordHash: 'not-allowed' }, { isMobileVerified: false }, { status: 'invented' }, { email: 'invalid' }, {}, { firstName: 'x'.repeat(81) }]) {
  test('invalid or unauthorized update fields are rejected: ' + Object.keys(body).join(','), async t => {
    const f = setup(t); await assert.rejects(updateAdminUser(f.request(body), response()), error => error.statusCode === 400); assert.equal(f.saves(), 0);
  });
}
test('missing authentication is rejected without saving', async t => {
  const f = setup(t), req = f.request({ status: 'blocked' }); req.headers = {};
  await assert.rejects(updateAdminUser(req, response()), error => error.statusCode === 401); assert.equal(f.saves(), 0);
});
test('customer token cannot update users', async t => {
  const f = setup(t, ['traveller']); await assert.rejects(updateAdminUser(f.request({ status: 'blocked' }), response()), error => error.statusCode === 403); assert.equal(f.saves(), 0);
});
test('regular administrator cannot modify another administrator', async t => {
  const f = setup(t, ['admin'], ['staff']); await assert.rejects(updateAdminUser(f.request({ status: 'blocked' }), response()), error => error.statusCode === 403); assert.equal(f.saves(), 0);
});
test('super administrator can manage a staff account', async t => {
  const f = setup(t, ['super_admin'], ['staff']); await updateAdminUser(f.request({ status: 'blocked' }), response()); assert.equal(f.target.status, 'blocked');
});
test('super administrator accounts cannot be changed through directory actions', async t => {
  const f = setup(t, ['super_admin'], ['super_admin']); await assert.rejects(updateAdminUser(f.request({ status: 'blocked' }), response()), error => error.statusCode === 403);
});
test('administrator cannot deactivate their own account', async t => {
  const f = setup(t), req = f.request({ status: 'blocked' }); req.params.id = f.actor.id;
  await assert.rejects(updateAdminUser(req, response()), error => error.statusCode === 400 || error.statusCode === 403); assert.equal(f.actor.status, 'active');
});
test('unknown and malformed user IDs return appropriate errors', async t => {
  const f = setup(t), req = f.request({ status: 'blocked' }); req.params.id = 'not-an-id';
  await assert.rejects(updateAdminUser(req, response()), error => error.statusCode === 400);
  req.params.id = '000000000000000000000000'; await assert.rejects(updateAdminUser(req, response()), error => error.statusCode === 404);
});
test('duplicate email save errors become a conflict response', async t => {
  const f = setup(t); t.mock.method(f.target, 'save', async () => { throw Object.assign(new Error('Fixture duplicate'), { code: 11000 }); });
  await assert.rejects(updateAdminUser(f.request({ email: 'duplicate@example.test' }), response()), error => error.statusCode === 409);
});
test('PATCH route is protected and updates the selected user with authenticated fixtures', async t => {
  const f = setup(t); const app = express(); app.use(express.json()); app.use('/users', userRoutes);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/users/${f.target.id}`;
    assert.equal((await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'blocked' }) })).status, 401);
    const result = await fetch(url, { method: 'PATCH', headers: { ...f.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'blocked' }) });
    assert.equal(result.status, 200); assert.equal((await result.json()).data.user.status, 'blocked'); assert.equal(f.saves(), 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
