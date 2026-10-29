const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.join(__dirname, '../components/auth/traveller-login-card.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TravellerLoginCard');
const handler = component.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'verifyCurrentOtp');
const compiled = ts.transpileModule(handler.getText(source) + '\nmodule.exports=verifyCurrentOtp;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function setup(request) {
  const sessions = [], redirects = [], popups = [], errors = [], fieldErrors = [], module = { exports: {} }; let requests = 0;
  const context = { module, exports: module.exports, mobileNumber: '0000000000', otp: '123456', registrationToken: '',
    isVerifyingOtp: false, verificationRef: { current: null },
    setOtpError: message => fieldErrors.push(message),
    verifyTravellerOtp: async () => { requests++; return request(); },
    saveTravellerSession: session => sessions.push(session), redirectAfterAuth: user => redirects.push(user),
    removeIndiaCountryCode: value => value, getErrorMessage: error => error.message,
    toast: { success() {}, error(title, message) { errors.push(message); } },
  };
  for (const name of ['setErrorMessage', 'setStatusMessage', 'setIsVerifyingOtp', 'setMobileNumber', 'setProfileMode', 'setFirstName', 'setLastName', 'setEmail', 'setOtpCooldownSeconds']) context[name] = () => {};
  context.setRegistrationToken = value => { context.registrationToken = value; };
  context.setIsProfilePopupOpen = value => popups.push(value);
  vm.runInNewContext(compiled, context);
  return { verify: module.exports, sessions, redirects, popups, errors, fieldErrors, requests: () => requests };
}
const existing = { data: { requiresProfile: false, sessionId: 'fixture-session', user: { id: 'existing-fixture' } }, message: 'Logged in' };
const registration = { data: { requiresProfile: true, mobileNumber: '910000000000', registrationToken: 'fixture-registration-receipt' }, message: 'Complete registration' };

test('auto verification and manual click in the same render send only one request', async () => {
  let complete; const pending = new Promise(resolve => { complete = resolve; }); const f = setup(() => pending);
  const first = f.verify(), second = f.verify(); assert.equal(f.requests(), 1);
  complete(existing); await Promise.all([first, second]); assert.equal(f.sessions.length, 1); assert.equal(f.redirects.length, 1);
});
test('completed existing-user login cannot re-submit consumed OTP during navigation', async () => {
  const f = setup(async () => existing); await f.verify(); await f.verify();
  assert.equal(f.requests(), 1); assert.equal(f.sessions.length, 1); assert.equal(f.errors.length, 0);
});
test('new user opens registration instead of storing a session or redirecting', async () => {
  const f = setup(async () => registration); await f.verify();
  assert.equal(f.popups.at(-1), true); assert.equal(f.sessions.length, 0); assert.equal(f.redirects.length, 0);
});
test('registration can be reopened without verifying the consumed OTP again', async () => {
  const f = setup(async () => registration); await f.verify(); await f.verify();
  assert.equal(f.requests(), 1); assert.equal(f.popups.length, 2);
});
test('a failed request releases the in-flight guard so retry remains possible', async () => {
  let fail = true; const f = setup(async () => { if (fail) throw Error('Synthetic network failure'); return existing; });
  await f.verify(); assert.equal(f.sessions.length, 0); fail = false; await f.verify();
  assert.equal(f.requests(), 2); assert.equal(f.sessions.length, 1);
});

test('four-digit, short and oversized codes never submit a login request', async () => {
  for (const code of ['', '1234', '12345', '1234567', 'abcdef']) {
    const f = setup(async () => existing); await f.verify(code);
    assert.equal(f.requests(), 0); assert.equal(f.sessions.length, 0);
    assert.equal(f.fieldErrors.at(-1), 'Enter the 6-digit code.');
  }
});

function phoneRequest(mobileNumber) {
  const send = component.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'sendLoginOtp');
  const compiledSend = ts.transpileModule(send.getText(source) + '\nmodule.exports=sendLoginOtp;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} }, errors = [], requests = [], steps = [];
  const context = { module, exports: module.exports, mobileNumber,
    setMobileError: message => errors.push(message),
    setErrorMessage() {}, setStatusMessage() {}, setOtpError() {}, setIsRequestingOtp() {},
    requestTravellerOtp: async value => { requests.push(value); return { data: { mobileNumber: value }, message: 'OTP sent' }; },
    verificationRef: { current: null }, autoVerifiedOtpRef: { current: '' },
    setRegistrationToken() {}, setMobileNumber() {}, setStep: value => steps.push(value), setOtp() {}, setOtpCooldownSeconds() {},
    removeIndiaCountryCode: value => value, toast: { success() {}, error() {} }, getErrorMessage: error => error.message,
  };
  vm.runInNewContext(compiledSend, context);
  return { send: module.exports, errors, requests, steps };
}

test('empty, incomplete and invalid-prefix mobile numbers show a clear error without requesting an OTP', async () => {
  for (const phone of ['', '98765', '987654321', '1234567890', '5123456789', '98765432101']) {
    const f = phoneRequest(phone);
    await f.send();
    assert.equal(f.requests.length, 0, phone);
    assert.equal(f.steps.length, 0);
    assert.equal(f.errors.at(-1), 'Enter a 10-digit mobile number starting with 6–9.');
  }
});

test('valid mobile numbers starting with 6 through 9 request an OTP and advance to verification', async () => {
  for (const phone of ['6123456789', '7123456789', '8123456789', '9123456789']) {
    const f = phoneRequest(phone);
    await f.send();
    assert.deepEqual(f.requests, [phone]);
    assert.deepEqual(f.steps, ['otp']);
    assert.equal(f.errors.at(-1), '');
  }
});

test('login input and automatic verification both require six digits and state five-minute validity', () => {
  const text = fs.readFileSync(filename, 'utf8');
  assert.match(text, /otp\.length !== 6/);
  assert.match(text, /maxLength=\{6\}/);
  assert.match(text, /Code valid for 5 minutes\./);
});
