const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function policy(storage = new Map()) {
  const exports = {};
  vm.runInNewContext(compile(read('lib/profile-prompt.ts')), { exports,
    window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } } });
  return exports;
}
const rules = policy();
const blocked = ['/tours', '/tours/test-tour', '/booking-confirmed/123', '/booking-submitted/123',
  '/booking/recover/123', '/bank-transfer/123', '/payment', '/checkout/pay', '/me/bookings', '/me/bookings/123'];
for (const route of blocked) test(route + ' never triggers the profile pop-up', () => assert.equal(rules.suppressProfilePrompt(route), true));

test('ordinary pages remain eligible and similarly named routes are not blocked', () => {
  for (const route of ['/', '/about', '/contact', '/me/wishlist', '/tours-extra']) assert.equal(rules.suppressProfilePrompt(route), false);
});

test('dismissal survives a reload for 30 days and is scoped to the account', () => {
  const storage = new Map(), now = Date.now(), day = 86400000;
  policy(storage).rememberProfilePromptDismissal('user-a', now);
  const reloaded = policy(storage);
  assert.equal(reloaded.isProfilePromptDismissed('user-a', now + 29 * day), true);
  assert.equal(reloaded.isProfilePromptDismissed('user-b', now + day), false);
  assert.equal(reloaded.isProfilePromptDismissed('user-a', now + 30 * day), false);
});

test('blocked browser storage does not prevent closing the profile prompt', () => {
  const rules = policy({ get() { throw Error('Storage blocked'); }, set() { throw Error('Storage blocked'); } });
  assert.doesNotThrow(() => rules.rememberProfilePromptDismissal('user-a'));
  assert.equal(rules.isProfilePromptDismissed('user-a'), false);
});

test('missing name and email use the saved phone instead of fake profile data', () => {
  const user = { firstName: ' ', lastName: '', email: '', mobileNumber: '919876543210' };
  assert.equal(rules.getTravellerAccountName(user), '919876543210');
  assert.equal(rules.getTravellerAccountContact(user), '919876543210');
  assert.equal(rules.getTravellerAccountName({ ...user, firstName: 'Asha', lastName: 'Patel' }), 'Asha Patel');
  assert.equal(rules.getTravellerAccountContact({ ...user, email: 'asha@example.test' }), 'asha@example.test');
  assert.equal(rules.getTravellerAccountContact(null), '');
});

const filename = 'components/auth/profile-completion-prompt.tsx';
const source = ts.createSourceFile(filename, read(filename), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ProfileCompletionPrompt');
const effect = component.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
  && node.expression.expression.getText(source) === 'useEffect' && node.expression.arguments[1]?.getText(source).includes('pathname'));
const effectCode = compile('(' + effect.expression.arguments[0].getText(source) + ');');
function prompt(route = '/') {
  let open = false;
  const storage = new Map(), rules = policy(storage);
  const context = { ...rules, pathname: route, travellerUser: { id: 'user-a' }, isProfileComplete: false,
    shownUserIds: { current: new Set() }, setIsOpen: value => { open = value; }, setErrorMessage: () => {} };
  const run = vm.runInNewContext(effectCode, context);
  const dismiss = component.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'dismissPrompt');
  const close = vm.runInNewContext(compile(dismiss.getText(source) + '; dismissPrompt;'), context);
  return { run, close, context, get open() { return open; } };
}

test('the actual prompt closes on entering booking and does not reopen later in the same visit', () => {
  const page = prompt(); page.run(); assert.equal(page.open, true);
  page.context.pathname = '/booking-confirmed/123'; page.run(); assert.equal(page.open, false);
  page.context.pathname = '/about'; page.run(); assert.equal(page.open, false);
});

test('the actual prompt stays closed on a tour and reuses the stored dismissal', () => {
  const page = prompt('/tours/test'); page.run(); assert.equal(page.open, false);
  page.context.pathname = '/about'; page.run(); assert.equal(page.open, true);
  page.close(); assert.equal(page.open, false);
  assert.equal(page.context.isProfilePromptDismissed('user-a'), true);
  page.context.shownUserIds.current.clear();
  page.context.pathname = '/contact'; page.run(); assert.equal(page.open, false);
});

const tourFile = 'app/tours/[tourId]/_components/single-tour-page.tsx';
const tourSource = ts.createSourceFile(tourFile, read(tourFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['shouldSyncLeadTravellerProfile', 'syncLeadTravellerProfileFromBooking'];
const syncCode = tourSource.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  .map(node => node.getText(tourSource)).join('\n');
test('the existing booking sync prefills an incomplete profile from the matching lead traveller', async () => {
  let session = { sessionId: 'fixture-session', user: { id: 'user-a', firstName: '', lastName: '', email: '', mobileNumber: '919000000000' } };
  let updates = 0;
  const sync = vm.runInNewContext(compile(syncCode + '\nsyncLeadTravellerProfileFromBooking;'), {
    getTravellerSession: () => session,
    getLeadTravellerAuthMobileNumber: form => '91' + form.mobileNumber,
    getProfileAuthMobileNumber: value => value,
    isValidEmail: value => value.includes('@'),
    getProfileSaveGender: value => value,
    updateTravellerProfile: async values => { updates++; return { data: { sessionId: session.sessionId, user: { ...session.user, ...values } } }; },
    saveTravellerSession: value => { session = value; },
  });
  await sync({ 'adult-1': { firstName: 'Asha', lastName: 'Patel', email: 'ASHA@example.test', mobileNumber: '9000000000', gender: 'female', dateOfBirth: '1990-01-01' } });
  assert.equal(updates, 1);
  assert.equal(session.user.firstName, 'Asha');
  assert.equal(session.user.email, 'asha@example.test');
  assert.equal(rules.getTravellerAccountName(session.user), 'Asha Patel');
  await sync({ 'adult-1': { firstName: 'Other', lastName: 'Person', email: 'other@example.test', mobileNumber: '9111111111', gender: 'female', dateOfBirth: '1990-01-01' } });
  assert.equal(updates, 1, 'Another traveller cannot overwrite this profile');
});
