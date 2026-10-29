const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual PricingPanel session effect with a saved browser session.
const filename = path.join(__dirname, '../app/tours/[tourId]/_components/single-tour-page.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const panel = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'PricingPanel');
const effect = panel.body.statements.find(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression)
  && node.expression.expression.getText(source) === 'useEffect'
  && node.expression.arguments[1]?.getText(source) === '[applyLeadTravellerProfile]');
assert.ok(effect, 'PricingPanel must synchronize the traveller session');
const callback = effect.expression.arguments[0].getText(source);
const compiled = ts.transpileModule(`const mount = ${callback}; mount();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(savedSession) {
  let session = savedSession;
  let listener;
  const sessions = [];
  const profiles = [];
  const cleanup = vm.runInNewContext(compiled, {
    getTravellerSession: () => session,
    setTravellerSession: value => sessions.push(value),
    applyLeadTravellerProfile: value => profiles.push(value),
    listenForTravellerSessionChanges(callback) {
      listener = callback;
      return () => { listener = undefined; };
    },
  });
  return { sessions, profiles, cleanup, change(value) { session = value; listener?.(); } };
}

const registeredSession = {
  sessionId: 'registered-session',
  user: { firstName: 'Asha', lastName: 'Patel', email: 'asha@example.test', mobileNumber: '919876543210', isMobileVerified: true },
};

test('registration completed before the tour mounts fills the lead profile without another login event', () => {
  const page = mount(registeredSession);
  assert.equal(page.sessions[0], registeredSession);
  assert.equal(page.profiles[0], registeredSession.user);
});

test('registration after the tour mounts still fills the lead profile', () => {
  const page = mount(null);
  assert.equal(page.sessions[0], null);
  assert.equal(page.profiles[0], null);
  page.change(registeredSession);
  assert.equal(page.sessions.at(-1), registeredSession);
  assert.equal(page.profiles.at(-1), registeredSession.user);
});

test('profile changes synchronize and the listener is removed when the tour unmounts', () => {
  const page = mount(registeredSession);
  const updated = { ...registeredSession, user: { ...registeredSession.user, firstName: 'Updated' } };
  page.change(updated);
  assert.equal(page.profiles.at(-1), updated.user);
  page.cleanup();
  page.change(null);
  assert.equal(page.profiles.length, 2);
});