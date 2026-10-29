const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function client({ server = false, failOnce = false } = {}) {
  const module = { exports: {} }, calls = []; let now = 0;
  class Clock extends Date { static now() { return now; } }
  const context = { module, exports: module.exports, Headers, AbortController, Date: Clock, setTimeout, clearTimeout,
    process: { env: {} }, require: name => { throw Error('Unexpected import: ' + name); },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const failed = failOnce && calls.length === 1;
      return new Response(JSON.stringify(failed ? { message: 'Unavailable' } : { success: true, message: 'OK', data: { value: 'original' } }), {
        status: failed ? 503 : 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  };
  if (!server) context.window = {};
  vm.runInNewContext(compile('lib/api.ts'), context);
  return { ...module.exports, calls, advance: value => { now += value; } };
}

test('concurrent and repeat public GETs use one request per endpoint for 60 seconds', async () => {
  const api = client();
  for (const endpoint of ['/api/site-settings', '/api/tours', '/api/tours/departures']) {
    await Promise.all([api.apiRequest(endpoint), api.apiRequest(endpoint)]);
    await api.apiRequest(endpoint);
    assert.equal(api.calls.filter(call => call.url.endsWith(endpoint)).length, 1);
  }
  assert.ok(api.calls.every(call => call.options.credentials === 'omit'));
  api.advance(60001);
  await api.apiRequest('/api/tours');
  assert.equal(api.calls.filter(call => call.url.endsWith('/api/tours')).length, 2);
});

test('cached data is isolated from caller edits and explicit invalidation fetches fresh data', async () => {
  const api = client();
  const result = await api.apiRequest('/api/site-settings');
  result.data.value = 'edited';
  assert.equal((await api.apiRequest('/api/site-settings')).data.value, 'original');
  api.invalidatePublicApiCache('/api/site-settings');
  await api.apiRequest('/api/site-settings');
  assert.equal(api.calls.length, 2);
});

test('sessions, bookings, authenticated requests and writes bypass the shared cache', async () => {
  const api = client();
  for (const [endpoint, options] of [
    ['/api/bookings/me', {}], ['/api/auth/refresh', { method: 'POST' }],
    ['/api/tours', { headers: { 'X-Session-Id': 'session-a' } }],
    ['/api/tours', { method: 'POST', body: '{}' }],
    ['/api/tours', { cache: 'reload' }],
  ]) {
    const before = api.calls.length;
    await api.apiRequest(endpoint, options); await api.apiRequest(endpoint, options);
    assert.equal(api.calls.length - before, 2, endpoint);
  }
});

test('API failures are not cached and the server cache expires after 60 seconds', async () => {
  const api = client({ failOnce: true, server: true });
  await assert.rejects(api.apiRequest('/api/tours'), error => error.statusCode === 503);
  await api.apiRequest('/api/tours'); await api.apiRequest('/api/tours');
  assert.equal(api.calls.length, 2);
  assert.equal(api.calls[1].options.cache, 'no-store');
  api.advance(60001);
  await api.apiRequest('/api/tours');
  assert.equal(api.calls.length, 3);
});

test('Firebase SDKs are dynamically imported and anonymous cleanup never loads them', async () => {
  for (const file of ['components/auth/traveller-login-card.tsx', 'lib/notification-push.ts']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(tree.statements.filter(ts.isImportDeclaration).filter(node => /^firebase\//.test(node.moduleSpecifier.text)).length, 0, file);
    assert.match(text, /import\("firebase\/(auth|messaging)"\)/);
  }
  const module = { exports: {} }, records = new Map(); let sdkImports = 0;
  vm.runInNewContext(compile('lib/notification-push.ts'), {
    module, exports: module.exports, setTimeout, clearTimeout, Event, process: { env: {} },
    window: { dispatchEvent() {} }, navigator: { serviceWorker: { getRegistration: async () => undefined } },
    localStorage: { getItem: key => records.get(key) ?? null, removeItem: key => records.delete(key) },
    require: name => { if (name === '@/lib/api') return { apiBaseUrl: 'https://api.example' }; sdkImports++; throw Error('SDK loaded during anonymous cleanup'); },
  });
  await module.exports.disableBrowserPush();
  assert.equal(sdkImports, 0);
});

test('large home, navigation and tour link lists disable viewport and hover prefetching', () => {
  const files = ['components/layout/header.tsx', 'components/layout/footer.tsx'];
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = directory + '/' + entry.name;
      if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.tsx')) files.push(file);
    }
  }
  for (const directory of ['app/(home)/_components', 'components/tours', 'app/tours', 'app/destinations', 'app/tour-calendar']) walk(directory);
  let links = 0;
  for (const file of files) {
    const tree = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === 'Link') {
        links++;
        const prefetch = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(tree) === 'prefetch');
        assert.equal(prefetch?.initializer?.expression?.kind, ts.SyntaxKind.FalseKeyword, file);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.ok(links >= 60);
});
