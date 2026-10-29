const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { sendOtp, verifyOtp } = require('../dist/services/msg91.service');
const { OtpChallenge } = require('../dist/models/otpChallenge.model');
const otpStore = require('./helpers/otp-store.cjs');
const PHONE = '919000000000';
const MINUTE = 60_000;

function setup(t) {
  const store = otpStore(t), calls = { sends: [], verifies: [] };
  let now = Math.floor(Date.now() / (15 * MINUTE)) * 15 * MINUTE + 1, valid = true, unavailable = false, delay;
  t.mock.method(Date, 'now', () => now);
  for (const [key, value] of Object.entries({ MSG91_AUTH_KEY: 'fixture-key', MSG91_TEMPLATE_ID: 'fixture-template' })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(axios, 'post', async (_url, _body, config) => {
    calls.sends.push(config);
    if (unavailable) throw Error('Provider offline');
    return { data: { type: 'success', message: 'Sent' } };
  });
  t.mock.method(axios, 'get', async (_url, config) => {
    calls.verifies.push(config);
    if (delay) await delay;
    if (unavailable) throw Error('Provider offline');
    return { data: valid ? { type: 'success', message: 'Verified' } : { type: 'error', message: 'Incorrect code' } };
  });
  return { ...store, calls, advance(ms) { now += ms; }, wrong() { valid = false; }, correct() { valid = true; },
    offline(value = true) { unavailable = value; }, delay(value) { delay = value; },
    send: (phone = PHONE, ip = '192.0.2.1') => sendOtp(phone, ip), verify: (code = '123456') => verifyOtp(PHONE, code) };
}

test('provider receives exactly six digits and five-minute validity; codes are never stored', async t => {
  const f = setup(t); await f.send();
  assert.equal(f.calls.sends[0].params.otp_length, 6);
  assert.equal(f.calls.sends[0].params.otp_expiry, 5);
  assert.ok(!JSON.stringify([...f.challenges.values()]).includes('123456'));
  await assert.rejects(f.verify('1234'), e => e.statusCode === 400);
  assert.equal(f.calls.verifies.length, 0);
});
test('code expires at five minutes even if the provider would still accept it at thirteen minutes', async t => {
  const f = setup(t); await f.send(); f.advance(5 * MINUTE);
  await assert.rejects(f.verify(), e => e.statusCode === 401 && /expired/.test(e.message));
  f.advance(8 * MINUTE); await assert.rejects(f.verify(), e => e.statusCode === 401);
  assert.equal(f.calls.verifies.length, 0);
});
test('a code is accepted just before expiry and can be used only once', async t => {
  const f = setup(t); await f.send(); f.advance(5 * MINUTE - 1); await f.verify();
  await assert.rejects(f.verify(), e => e.statusCode === 401);
  assert.equal(f.calls.verifies.length, 1);
});
test('five wrong guesses lock the number and resending cannot bypass the fifteen-minute lock', async t => {
  const f = setup(t); await f.send(); f.wrong();
  for (let i = 0; i < 4; i++) await assert.rejects(f.verify(), e => e.statusCode === 401);
  await assert.rejects(f.verify(), e => e.statusCode === 429);
  f.correct(); await assert.rejects(f.verify(), e => e.statusCode === 429);
  await assert.rejects(f.send(), e => e.statusCode === 429);
  f.advance(15 * MINUTE - 1); await assert.rejects(f.send(), e => e.statusCode === 429);
  f.advance(1); await f.send(); await f.verify();
  assert.equal(f.calls.verifies.length, 6);
});
test('a correct fifth attempt succeeds and does not leave the number locked', async t => {
  const f = setup(t); await f.send(); f.wrong();
  for (let i = 0; i < 4; i++) await assert.rejects(f.verify());
  f.correct(); await f.verify(); f.advance(MINUTE); await f.send();
});
test('simultaneous verification calls cannot verify or consume one code twice', async t => {
  const f = setup(t); await f.send(); let finish; f.delay(new Promise(resolve => { finish = resolve; }));
  const first = f.verify(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(f.verify(), e => e.statusCode === 429);
  await assert.rejects(f.send(), e => e.statusCode === 429);
  finish(); await first; assert.equal(f.calls.verifies.length, 1);
  await assert.rejects(f.verify(), e => e.statusCode === 401);
});
test('expiry is checked again after the provider response and does not create a spurious lock', async t => {
  const f = setup(t); await f.send(); f.advance(5 * MINUTE - 1);
  let finish; f.delay(new Promise(resolve => { finish = resolve; }));
  const pending = f.verify(); await new Promise(resolve => setImmediate(resolve));
  f.advance(2); finish(); await assert.rejects(pending, e => e.statusCode === 401);
  await f.send();
});
test('provider outages do not consume wrong-code attempts or leave a valid code locked', async t => {
  const f = setup(t); await f.send(); f.offline();
  for (let i = 0; i < 6; i++) await assert.rejects(f.verify(), e => e.statusCode === 502);
  assert.equal([...f.challenges.values()][0].attempts, 0);
  f.offline(false); await f.verify();
});
test('resends have a server cooldown and a five-per-number limit shared across IPs', async t => {
  const f = setup(t); await f.send(); await assert.rejects(f.send(), e => e.statusCode === 429);
  for (let i = 0; i < 4; i++) { f.advance(MINUTE); await f.send(PHONE, '192.0.2.' + (i + 2)); }
  f.advance(MINUTE); await assert.rejects(f.send(), e => e.statusCode === 429);
  assert.equal(f.calls.sends.length, 5);
});
test('one IP cannot send more than thirty codes per window by changing phone numbers', async t => {
  const f = setup(t);
  for (let i = 0; i < 30; i++) await f.send('91900000' + String(i).padStart(4, '0'));
  await assert.rejects(f.send('919999999999'), e => e.statusCode === 429);
  assert.equal(f.calls.sends.length, 30);
});
test('failed sends and missing local challenges cannot authenticate via provider verification', async t => {
  const f = setup(t); await assert.rejects(f.verify(), e => e.statusCode === 401);
  f.offline(); await assert.rejects(f.send(), e => e.statusCode === 502);
  f.offline(false); await assert.rejects(f.verify(), e => e.statusCode === 401);
  assert.equal(f.calls.verifies.length, 0);
});
test('database failure fails closed before any SMS or verification request', async t => {
  const f = setup(t); t.mock.method(OtpChallenge, 'findById', async () => { throw Error('Database unavailable'); });
  await assert.rejects(f.send(), /Database unavailable/); await assert.rejects(f.verify(), /Database unavailable/);
  assert.equal(f.calls.sends.length + f.calls.verifies.length, 0);
});

test('parallel send requests share the cooldown and deliver only one SMS', async t => {
  const f = setup(t);
  const results = await Promise.allSettled([f.send(), f.send(), f.send()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.calls.sends.length, 1);
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.statusCode, 429);
});

test('HTTP 400 incorrect-code responses count toward the same five-attempt limit', async t => {
  const f = setup(t); await f.send();
  t.mock.method(axios, 'get', async () => {
    throw Object.assign(Error('Incorrect code'), { isAxiosError: true, response: { status: 400, data: { message: 'Invalid OTP' } } });
  });
  for (let i = 0; i < 4; i++) await assert.rejects(f.verify(), e => e.statusCode === 400);
  await assert.rejects(f.verify(), e => e.statusCode === 429);
  await assert.rejects(f.send(), e => e.statusCode === 429);
});
