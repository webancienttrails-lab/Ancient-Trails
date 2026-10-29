const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function extract(file, predicate) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `Handler exists in ${file}`);
  return ts.transpileModule(found.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
}

const booking = extract('app/tours/[tourId]/_components/single-tour-page.tsx', node => ts.isFunctionDeclaration(node) && node.name?.text === 'openBookingFlow');
for (const mobile of [false, true]) {
  test(`Book Now focuses the booking heading after opening (${mobile ? 'mobile' : 'desktop'})`, () => {
    const frames = [];
    const events = [];
    const offset = mobile ? 76 : 64;
    const heading = { focus(options) { events.push(['focus', options.preventScroll]); } };
    const section = { getBoundingClientRect: () => ({ top: offset }) };
    const sandbox = {
      bestDeparture: {}, bookingScrollFrameRef: { current: 0 },
      document: { getElementById: id => id === 'booking-heading' ? heading : section },
      window: { scrollY: 0, matchMedia: query => ({ matches: query.includes('max-width') && mobile }), scrollTo() {}, scrollBy() {}, requestAnimationFrame(cb) { frames.push(cb); return frames.length; } },
      performance: { now: () => 0 }, flushSync: cb => cb(),
      setIsBookingFlowOpen: value => events.push(['open', value]),
      setActiveTab: value => events.push(['tab', value]),
      setIsTourEnquiryOpen: () => assert.fail('Bookable tour opens booking'),
    };
    vm.runInNewContext(booking + '\nopenBookingFlow();', sandbox);
    while (frames.length) frames.shift()();
    assert.deepEqual(events, [['open', true], ['tab', 'pricing'], ['focus', true]]);
    assert.equal(sandbox.bookingScrollFrameRef.current, 0);
  });
}

const escape = extract('components/layout/header.tsx', node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText() === 'handleEscape'));
test('Header Escape leaves active dialogs and unrelated keyboard focus alone', () => {
  for (const hasDialog of [true, false]) {
    const calls = [];
    const sandbox = {
      document: { querySelector: () => hasDialog ? {} : null },
      isAccountMenuOpen: false, isDesktopMenuOpen: false,
      setIsAccountMenuOpen: () => calls.push('account'), setIsDesktopMenuOpen: () => calls.push('desktop'), setHoveredItem: () => calls.push('hover'),
      accountLinkRef: { current: { focus: () => calls.push('account focus') } },
      menuButtonRef: { current: { focus: () => calls.push('menu focus') } },
    };
    vm.runInNewContext(escape + '\nhandleEscape({key:"Escape"});', sandbox);
    assert.deepEqual(calls, []);
    sandbox.isAccountMenuOpen = true;
    vm.runInNewContext('handleEscape({key:"Escape"});', sandbox);
    assert.deepEqual(calls, hasDialog ? [] : ['account', 'account focus']);
  }
});
