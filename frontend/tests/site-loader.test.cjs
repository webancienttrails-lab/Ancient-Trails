const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loaderClickHandler() {
  const file = path.join(__dirname, '../components/layout/site-loader.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' &&
      node.arguments[0]?.getText(source).includes('const handlePageClick')) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(effect, 'Navigation loader click listener exists');
  const timers = new Map();
  const handlers = new Map();
  const state = { visible: false, leaving: false };
  let nextTimer = 0;
  class Anchor {
    constructor(href) { this.href = href; this.target = ''; }
    closest() { return this; }
    hasAttribute() { return false; }
  }
  const startedAtRef = { current: 0 };
  const context = {
    URL, Element: Anchor, HTMLAnchorElement: Anchor,
    window: {
      location: new URL('https://example.test/tours'),
      performance: { now: () => 100 },
      setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id),
    },
    document: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      removeEventListener: name => handlers.delete(name),
    },
    startedAtRef, fadeTimerRef: { current: 0 }, removeTimerRef: { current: 0 },
    setIsVisible: value => { state.visible = value; },
    setIsLeaving: value => { state.leaving = value; },
  };
  const code = ts.transpileModule('(' + effect.getText(source) + ')()', {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const cleanup = vm.runInNewContext(code, context);
  return {
    state, timers, startedAtRef, cleanup,
    click(href, extra = {}) {
      handlers.get('click')({ button: 0, target: new Anchor(href), ...extra });
    },
  };
}

test('query-only, hash, external and modified links do not start a blocking page loader', () => {
  const loader = loaderClickHandler();
  for (const href of ['https://example.test/tours?page=2', 'https://example.test/tours#details', 'https://elsewhere.test/about']) {
    loader.click(href);
    assert.equal(loader.state.visible, false, href);
  }
  loader.click('https://example.test/about', { ctrlKey: true });
  loader.click('https://example.test/about', { defaultPrevented: true });
  assert.equal(loader.state.visible, false);
  assert.equal(loader.timers.size, 0);
  loader.cleanup();
});

test('a cancelled route navigation cannot leave the loader blocking the website forever', () => {
  const loader = loaderClickHandler();
  loader.click('https://example.test/about');
  assert.equal(loader.state.visible, true);
  const fallback = [...loader.timers.values()].find(timer => timer.delay === 10000);
  assert.ok(fallback, 'Cancelled navigation has a bounded recovery timeout');
  fallback.callback();
  assert.equal(loader.state.visible, false);
  assert.equal(loader.state.leaving, false);
  assert.equal(loader.startedAtRef.current, 0);
  loader.cleanup();
});
