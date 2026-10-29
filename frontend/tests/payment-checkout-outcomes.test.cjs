const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const failureExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/payment-failure.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: failureExports });

// Execute the actual checkout handlers with a fake gateway; no payment API calls.
const filename = path.join(__dirname, '../app/tours/[tourId]/_components/single-tour-page.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let checkoutFunction;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'openRazorpayCheckout') checkoutFunction = node;
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(checkoutFunction, 'The tour checkout handler must exist');
const compiled = ts.transpileModule(checkoutFunction.getText(source) + '\nopenRazorpayCheckout;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

async function mount({ openError, verificationError } = {}) {
  let options;
  const events = {}, cancellations = [], statuses = [], messages = [], notices = [], redirects = [], verifications = [];
  const forms = { 'adult-1': { firstName: 'Test', lastName: 'Traveller', email: 'test@example.test' } };
  const originalForms = JSON.stringify(forms);
  const orderRef = { current: { checkout: { orderId: 'order_fixture' } } };
  const open = vm.runInNewContext(compiled, {
    Error,
    paymentFailureMessage: failureExports.paymentFailureMessage,
    failedPaymentOrderRef: { current: null },
    setPaymentRetryMessage: () => {},
    window: { Razorpay: class {
      constructor(value) { options = value; }
      on(event, callback) { events[event] = callback; }
      open() { if (openError) throw openError; }
    } },
    loadRazorpayCheckoutScript: async () => {},
    cancelPaymentOrder: id => { cancellations.push(id); return Promise.resolve(); },
    clearPaymentOrderState: () => { orderRef.current = null; messages.push(''); },
    setCheckoutStatus: status => statuses.push(status),
    setPaymentFeedback: message => messages.push(message),
    toast: { warning: (...args) => notices.push(args) },
    flushSync: callback => callback(),
    verifyBookingPayment: async response => {
      verifications.push(response);
      if (verificationError) throw verificationError;
      return { data: { booking: { id: 'booking_fixture' }, confirmationToken: 'token_fixture' } };
    },
    recoverConfirmedPaymentOrder: async () => false,
    redirectToBookingConfirmation: (...args) => redirects.push(args),
    travellerDetailForms: forms,
    setTravellerDetailForms: () => { throw Error('Payment outcomes must preserve traveller details'); },
  });
  const opening = open({ checkout: { orderId: 'order_fixture', amount: 2000000, currency: 'INR' } });
  if (openError) await assert.rejects(opening, /Gateway could not open/); else await opening;
  return { options, events, cancellations, statuses, messages, notices, redirects, verifications, orderRef,
    assertFormsKept() { assert.equal(JSON.stringify(forms), originalForms); } };
}
const failure = { error: { description: 'Your bank declined this payment' } };
const settle = () => new Promise(resolve => setImmediate(resolve));

for (const sequence of [['failed', 'dismissed'], ['dismissed', 'failed'], ['failed', 'failed', 'dismissed'], ['dismissed', 'dismissed']]) {
  test(sequence.join(' then ') + ' cancels exactly once and keeps a visible retry message', async () => {
    const page = await mount();
    for (const event of sequence) {
      if (event === 'failed') page.events['payment.failed'](failure); else page.options.modal.ondismiss();
    }
    assert.deepEqual(page.cancellations, ['order_fixture']);
    assert.equal(page.statuses.filter(status => status === 'idle').length, 1);
    assert.equal(page.notices.length, 1, 'A toast makes the message visible without scrolling to the summary');
    assert.match(page.messages.at(-1), /Payment not completed.*try again/);
    assert.equal(page.notices[0][1], page.messages.at(-1));
    if (sequence[0] === 'failed') assert.match(page.messages.at(-1), /bank declined/);
    assert.equal(page.orderRef.current, null);
    page.assertFormsKept();
  });
}

test('success followed by dismiss or failure does not cancel a payment being verified', async () => {
  const page = await mount();
  const response = { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'payment_fixture' };
  page.options.handler(response);
  page.options.modal.ondismiss();
  page.events['payment.failed'](failure);
  page.options.handler(response);
  await settle();
  assert.deepEqual(page.cancellations, []);
  assert.equal(page.notices.length, 0);
  assert.equal(page.verifications.length, 1);
  assert.deepEqual(page.redirects, [['booking_fixture']]);
});

test('late success is still verified after the modal has been dismissed', async () => {
  const page = await mount();
  page.options.modal.ondismiss();
  page.options.handler({ razorpay_order_id: 'order_fixture' });
  await settle();
  assert.equal(page.cancellations.length, 1);
  assert.equal(page.verifications.length, 1);
  assert.equal(page.redirects.length, 1);
});

test('gateway opening failure and a following dismiss share the same cancellation guard', async () => {
  const page = await mount({ openError: Error('Gateway could not open') });
  page.options.modal.ondismiss();
  assert.deepEqual(page.cancellations, ['order_fixture']);
  assert.equal(page.notices.length, 1);
  assert.match(page.messages.at(-1), /Gateway could not open/);
  page.assertFormsKept();
});

test('verification failure preserves payment feedback and never cancels a received payment', async () => {
  const page = await mount({ verificationError: Error('Verification is temporarily unavailable') });
  page.options.handler({ razorpay_order_id: 'order_fixture' });
  page.options.modal.ondismiss();
  await settle();
  assert.deepEqual(page.cancellations, []);
  assert.match(page.messages.at(-1), /Verification is temporarily unavailable/);
  page.assertFormsKept();
});
