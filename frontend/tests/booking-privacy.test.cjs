const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, process,
    require: name => imports[name] || require(name), URL, Headers, Request, Response });
  return module.exports;
}
const privacy = load('lib/booking-privacy.ts');

test('result contacts reveal only four phone digits and a masked email', () => {
  assert.equal(privacy.maskBookingPhone('+91 98765-43210'), '******3210');
  assert.equal(privacy.maskBookingPhone(''), '-');
  assert.equal(privacy.maskBookingEmail('traveller@example.com'), 't***@example.com');
  assert.equal(privacy.maskBookingEmail('malformed'), '***');
  assert.equal(privacy.maskBookingEmail(''), '-');
});

const protectedPaths = ['/booking-confirmed/booking-id', '/booking-submitted/booking-id', '/bank-transfer/booking-id', '/booking/recover/booking-id'];
test('global response headers protect framing and MIME types without enforcing trial resource restrictions', async () => {
  const { default: config } = load('next.config.ts');
  assert.equal(config.poweredByHeader, false);
  const rules = await config.headers();
  const global = rules.find(rule => rule.source === '/:path*');
  assert.ok(global, 'Headers must cover every page');
  const headers = new Headers(global.headers.map(({ key, value }) => [key, value]));
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.match(headers.get('Strict-Transport-Security'), /max-age=31536000/);
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.doesNotMatch(headers.get('Content-Security-Policy'), /(?:default|script|connect)-src/);
  const trial = headers.get('Content-Security-Policy-Report-Only');
  assert.match(trial, /https:\/\/checkout\.razorpay\.com/);
  assert.match(trial, /https:\/\/\*\.firebaseapp\.com/);
  for (const route of protectedPaths) {
    const effective = new Headers();
    for (const rule of rules) {
      if (rule === global || route.startsWith(rule.source.replace('/:path*', '/'))) {
        for (const { key, value } of rule.headers) effective.set(key, value);
      }
    }
    assert.equal(effective.get('Referrer-Policy'), 'no-referrer');
    assert.match(effective.get('Cache-Control'), /no-store/);
    assert.equal(effective.get('X-Frame-Options'), 'DENY');
  }
});

for (const route of protectedPaths) {
  test(route + ' redirects legacy tokens to a clean URL without referring or caching them', () => {
    const { proxy } = load('proxy.ts');
    const { NextRequest } = require('next/server');
    const response = proxy(new NextRequest('https://example.test' + route + '?token=private-token&view=details'));
    const target = new URL(response.headers.get('location'));
    assert.equal(target.pathname, route);
    assert.equal(target.searchParams.has('token'), false);
    assert.equal(target.searchParams.get('view'), 'details');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  });
}

test('all booking result routes configure no-referrer and private no-store responses', async () => {
  const { default: config } = load('next.config.ts');
  const rules = await config.headers();
  const bookingRules = rules.filter(rule => rule.source !== '/:path*');
  assert.equal(bookingRules.length, 4);
  for (const rule of bookingRules) {
    assert.equal(rule.headers.find(header => header.key === 'Referrer-Policy').value, 'no-referrer');
    assert.match(rule.headers.find(header => header.key === 'Cache-Control').value, /no-store/);
  }
});

test('result and recovery API requests use the signed-in session without URL credentials', async () => {
  let session = { sessionId: 'fixture-session' };
  const calls = [];
  const api = { ApiError: class extends Error { constructor(code, message) { super(message); this.statusCode = code; } },
    apiRequest: async (url, options) => { calls.push({ url, options }); return {}; } };
  const imports = { '@/lib/api': api, '@/lib/auth': { getTravellerSession: () => session } };
  const payment = load('lib/booking-payment.ts', imports);
  const bank = load('lib/bank-transfer.ts', imports);
  for (const call of [payment.getBookingConfirmation, payment.getOfflineBookingSubmission,
    payment.getBookingRecovery, payment.createBookingRecoveryPaymentOrder, bank.getBankTransfer]) await call('booking-id');
  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, 'Bearer fixture-session');
    assert.equal(call.url.includes('?'), false);
    if (call.options.method !== 'POST') assert.equal(call.options.cache, 'no-store');
  }
  session = null;
  assert.throws(() => payment.getBookingConfirmation('booking-id'), error => error.statusCode === 401);
  assert.equal(calls.length, 5);
});

const pageFile = path.join(__dirname, '../components/booking-result-page.tsx');
const pageSource = ts.createSourceFile(pageFile, fs.readFileSync(pageFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const page = pageSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'BookingResultPage');
const effect = page.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
  && node.expression.expression.getText(pageSource) === 'useEffect');
const compiledEffect = ts.transpileModule('const mount = ' + effect.expression.arguments[0].getText(pageSource) + '; mount();', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));
function mountResult() {
  let session = null, listener, resolveRequest, calls = 0, data;
  const cleanup = vm.runInNewContext(compiledEffect, {
    bookingId: 'booking-id', variant: 'confirmation',
    getTravellerSession: () => session,
    listenForTravellerSessionChanges: callback => { listener = callback; return () => { listener = undefined; }; },
    getBookingConfirmation: () => { calls++; return new Promise(resolve => { resolveRequest = resolve; }); },
    getPublicSiteSettings: async () => ({ data: { settings: { contact: {} } } }),
    setData: value => { data = value; }, setLoading: () => {}, setSiteContact: () => {},
  });
  return { cleanup, get data() { return data; }, get calls() { return calls; },
    login() { session = { sessionId: 'fixture-session' }; listener?.(); },
    logout() { session = null; listener?.(); },
    resolve(value) { resolveRequest({ data: value }); } };
}

test('private-window result pages do not fetch any booking data without a session', async () => {
  const result = mountResult();
  await settle();
  assert.equal(result.calls, 0);
  assert.equal(result.data, null);
  result.cleanup();
});

test('sign-in loads the booking, and logout immediately hides it', async () => {
  const result = mountResult();
  result.login(); result.resolve({ booking: { id: 'booking-id' } });
  await settle();
  assert.equal(result.data.booking.id, 'booking-id');
  result.logout();
  assert.equal(result.data, null);
  result.cleanup();
});

test('a response started before logout cannot reveal the booking after logout', async () => {
  const result = mountResult();
  result.login(); result.logout(); result.resolve({ booking: { id: 'booking-id' } });
  await settle();
  assert.equal(result.data, null);
  result.cleanup();
});
