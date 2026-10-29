const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { User } = require('../dist/models/user.model');
const email = require('../dist/utils/email');
const auth = require('../dist/controllers/auth.controller');
const jwt = require('../dist/utils/jwt');
const PHONE = '0000000000', MOBILE = '910000000000';
const CODE = '123456';
const response = () => ({ body: null, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } });

function setup(t, existing) {
  require('./helpers/otp-store.cjs')(t);
  t.mock.method(require("../dist/services/auth-session.service"), "issueAuthSession", async user => jwt.signAuthToken(user, 'fixture-session-'+user.id));
  for (const [key, value] of Object.entries({ JWT_SECRET: 'otp-registration-fixture-key', MSG91_AUTH_KEY: 'mock-key', MSG91_TEMPLATE_ID: 'mock-template' })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const records = []; let creates = 0, verifications = 0;
  function user(fields) {
    const record = new User({ firstName: 'Fixture', lastName: 'Traveller', email: 'fixture@example.test', mobileNumber: MOBILE, roles: ['traveller'], status: 'active', isMobileVerified: true, ...fields });
    t.mock.method(record, 'save', async () => record);
    return record;
  }
  if (existing) records.push(user(existing === true ? {} : existing));
  t.mock.method(User, 'findOne', async query => records.find(record => Object.entries(query).every(([key, value]) => {
    if (key === 'roles') return record.roles.includes(value);
    if (value?.$ne !== undefined) return String(record[key]) !== String(value.$ne);
    return record[key] === value;
  })) || null);
  t.mock.method(User, 'create', async values => {
    if (records.some(record => record.mobileNumber === values.mobileNumber)) throw Object.assign(new Error('Fixture duplicate'), { code: 11000 });
    creates++; const record = user(values); records.push(record); return record;
  });
  t.mock.method(email, 'validateTravellerEmailAddress', async () => {});
  t.mock.method(axios, 'get', async () => { verifications++; return { data: { type: 'success', message: 'OTP verified' } }; });
  t.mock.method(axios, 'post', async () => ({ data: { type: 'success', message: 'OTP sent' } }));
  let sent = false;
  return { records, creates: () => creates, verifications: () => verifications,
    async verify() { if (!sent) { await require('../dist/services/msg91.service').sendOtp(MOBILE, '192.0.2.1'); sent = true; } const res = response(); await auth.verifyTravellerOtpAndLogin({ body: { mobileNumber: PHONE, otp: CODE } }, res); return res; },
    async complete(registrationToken, changes = {}) { const res = response(); await auth.completeTravellerProfile({ body: { registrationToken, firstName: 'New', lastName: 'Traveller', email: 'new@example.test', ...changes } }, res); return res; },
  };
}

test('registered customer signs into the same profile after OTP', async t => {
  const f = setup(t, true), res = await f.verify();
  assert.equal(res.body.data.requiresProfile, false); assert.equal(res.body.data.sessionId, 'fixture-session-'+f.records[0].id);assert.equal(res.body.data.token,undefined);
  assert.equal(res.body.data.user.email, 'fixture@example.test'); assert.equal(f.creates(), 0);
});
test('unregistered OTP produces only a mobile-bound registration receipt and no account/session', async t => {
  const f = setup(t), res = await f.verify();
  assert.equal(res.body.data.requiresProfile, true); assert.equal(res.body.data.mobileNumber, MOBILE);
  assert.equal(jwt.verifyTravellerRegistrationToken(res.body.data.registrationToken), MOBILE);
  assert.equal(res.body.data.token, undefined); assert.equal(res.body.data.user, undefined); assert.equal(f.creates(), 0);
  assert.throws(() => jwt.verifyAuthToken(res.body.data.registrationToken));
});
test('new account is created only after verified registration details are completed', async t => {
  const f = setup(t), verification = await f.verify();
  assert.equal(f.records.length, 0);
  const res = await f.complete(verification.body.data.registrationToken);
  assert.equal(res.statusCode, 201); assert.equal(f.creates(), 1); assert.equal(f.records[0].firstName, 'New');
  assert.equal(f.records[0].mobileNumber, MOBILE); assert.equal(f.records[0].isMobileVerified, true);
  assert.equal(res.body.data.sessionId, 'fixture-session-'+f.records[0].id);assert.equal(res.body.data.token,undefined);
  assert.equal(f.verifications(), 1, 'Registration must use its receipt instead of verifying the consumed OTP again');
});
test('old mobile-only account must complete registration and reuses its existing ID', async t => {
  const f = setup(t, { firstName: '', lastName: '', email: undefined }); const id = f.records[0].id;
  const verification = await f.verify(); assert.equal(verification.body.data.requiresProfile, true); assert.equal(verification.body.data.token, undefined);
  const res = await f.complete(verification.body.data.registrationToken);
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.user.id, id); assert.equal(f.creates(), 0);
});
test('registration cannot complete without an authenticated mobile receipt', async t => {
  const f = setup(t);
  await assert.rejects(f.complete('invalid-fixture-receipt'), error => error.statusCode === 401); assert.equal(f.creates(), 0);
});
test('registration cannot use an authentication token in place of the registration receipt', async t => {
  const f = setup(t, true), token = jwt.signAuthToken(f.records[0]);
  await assert.rejects(f.complete(token), error => error.statusCode === 401); assert.equal(f.creates(), 0);
});
for (const changes of [{ firstName: '' }, { lastName: '' }, { email: 'invalid' }]) {
  test('incomplete registration fields never create an account: ' + Object.keys(changes).join(','), async t => {
    const f = setup(t), verification = await f.verify();
    await assert.rejects(f.complete(verification.body.data.registrationToken, changes), error => error.statusCode === 400); assert.equal(f.creates(), 0);
  });
}
test('repeated profile submission reuses the account instead of creating a duplicate', async t => {
  const f = setup(t), verification = await f.verify();
  const first = await f.complete(verification.body.data.registrationToken), second = await f.complete(verification.body.data.registrationToken);
  assert.equal(first.body.data.user.id, second.body.data.user.id); assert.equal(f.creates(), 1);
});
test('blocked account receives neither login nor registration receipt', async t => {
  const f = setup(t, { status: 'blocked' }); await assert.rejects(f.verify(), error => error.statusCode === 403); assert.equal(f.creates(), 0);
});
test('incorrect or expired OTP cannot create an account or issue registration receipt', async t => {
  const f = setup(t); t.mock.method(axios, 'get', async () => ({ data: { type: 'error', message: 'Invalid or expired OTP' } }));
  await assert.rejects(f.verify(), error => error.statusCode === 401); assert.equal(f.creates(), 0);
});
test('explicit MSG91 error cannot be treated as successful verification through wording', async t => {
  const f = setup(t); t.mock.method(axios, 'get', async () => ({ data: { type: 'error', message: 'OTP not verified successfully' } }));
  await assert.rejects(f.verify(), error => error.statusCode === 401); assert.equal(f.creates(), 0);
});
for (const transportError of [false, true]) {
  test('already-used OTP requires a fresh code, with no verification bypass: ' + transportError, async t => {
    const f = setup(t);
    t.mock.method(axios, 'get', async () => {
      const data = { type: 'error', message: 'Mobile no. already verified' };
      if (transportError) throw Object.assign(new Error('Fixture provider rejection'), { isAxiosError: true, response: { status: 400, data } });
      return { data };
    });
    await assert.rejects(f.verify(), error => error.statusCode === 401 && /Request a new OTP/.test(error.message)); assert.equal(f.creates(), 0);
  });
}
