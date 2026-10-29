const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(compile(read(file)), { exports, require: name => imports[name] || require(name) });
  return exports;
}
function functionCode(file, name) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(found, name + ' must exist');
  return compile(found.getText(source) + '; ' + name + ';');
}
const { paymentFailureMessage } = load('lib/payment-failure.ts');
const mainFile = 'app/tours/[tourId]/_components/single-tour-page.tsx';
const retryCode = functionCode(mainFile, 'retryFailedPayment');
function retryFixture(check = async () => false) {
  const payments = [], notices = [], busy = [];
  const checkingRetryRef = { current: false };
  const retry = vm.runInNewContext(retryCode, {
    checkingRetryRef, bookingSubmissionRef: { current: false }, checkoutStatus: 'idle',
    failedPaymentOrderRef: { current: 'order_fixture' }, retryPaymentOptionRef: { current: 'full' },
    setIsCheckingRetry: value => busy.push(value), setPaymentRetryMessage: value => notices.push(value),
    recoverConfirmedPaymentOrder: check, handleBookSeat: async option => payments.push(option),
  });
  return { retry, payments, notices, busy, checkingRetryRef };
}

test('failure message explains debit uncertainty and keeps choices without promising a charge or refund date', () => {
  const message = paymentFailureMessage('Bank declined the payment');
  assert.match(message, /No successful charge has been confirmed/);
  assert.match(message, /details and choices have been kept/);
  assert.match(message, /If money was deducted.*before retrying/);
  assert.match(message, /timing can vary/);
  assert.match(message, /Bank declined the payment/);
  assert.doesNotMatch(message, /You have not been charged|returns in 5-7 days/);
});

test('retry checks the old payment before preserving the selected full-payment option', async () => {
  const calls = [], page = retryFixture(async id => { calls.push(id); return false; });
  await page.retry();
  assert.deepEqual(calls, ['order_fixture']);
  assert.deepEqual(page.payments, ['full']);
  assert.deepEqual(page.busy, [true, false]);
});

test('a late confirmed payment cannot start a second payment', async () => {
  const page = retryFixture(async () => true);
  await page.retry();
  assert.deepEqual(page.payments, []);
  assert.equal(page.notices.at(-1), null);
});

test('an unavailable status check keeps the choices and blocks another payment', async () => {
  const page = retryFixture(async () => { throw Error('Network unavailable'); });
  await page.retry();
  assert.deepEqual(page.payments, []);
  assert.match(page.notices.at(-1), /could not check.*before paying again/);
  assert.equal(page.checkingRetryRef.current, false);
});

test('rapid Retry clicks share one status check and create only one attempt', async () => {
  let finish, checks = 0;
  const page = retryFixture(() => { checks++; return new Promise(resolve => { finish = resolve; }); });
  const first = page.retry(); const second = page.retry();
  assert.equal(checks, 1);
  finish(false); await Promise.all([first, second]);
  assert.deepEqual(page.payments, ['full']);
});

for (const [flow, file, name] of [
  ['recovery', 'app/booking/recover/[bookingId]/page.tsx', 'openRazorpayCheckout'],
  ['balance', 'components/user-dashboard/user-booking-detail-page.tsx', 'openBalanceRazorpayCheckout'],
]) {
  async function mount() {
    let options, verifications = 0;
    const events = {}, messages = [], notices = [];
    const verify = async () => { verifications++; return { data: { booking: { id: 'booking_fixture' } } }; };
    const open = vm.runInNewContext(functionCode(file, name), {
      window: { Razorpay: class { constructor(value) { options = value; } on(event, callback) { events[event] = callback; } open() {} } },
      loadRazorpayCheckoutScript: async () => {}, paymentFailureMessage,
      setStatus: () => {}, setCheckoutStatus: () => {}, setMessage: value => messages.push(value),
      setPaymentFeedback: value => messages.push(value), setPaymentRetryMessage: value => notices.push(value),
      verifyBookingPayment: verify, verifyBookingBalancePayment: verify, setBookings: () => {},
      router: { push() {} }, getPaymentErrorMessage: error => error.message,
    });
    await open({ checkout: { orderId: 'order_fixture', amount: 2000000, currency: 'INR' } }, { booking: { id: 'booking_fixture' } });
    return { options, events, messages, notices, get verifications() { return verifications; } };
  }
  for (const event of ['failed', 'dismissed']) {
    test(flow + ': ' + event + ' shows one reassurance notice and ignores repeated close/failure callbacks', async () => {
      const page = await mount();
      if (event === 'failed') page.events['payment.failed']({ error: { description: 'Bank declined' } });
      else page.options.modal.ondismiss();
      page.events['payment.failed']({ error: {} }); page.options.modal.ondismiss();
      assert.equal(page.notices.length, 1);
      assert.match(page.notices[0], /If money was deducted/);
      assert.equal(page.messages.length, 1);
    });
  }
  test(flow + ': closing after a successful gateway response never displays a failure notice', async () => {
    const page = await mount();
    page.options.handler({ razorpay_order_id: 'order_fixture' }); page.options.modal.ondismiss();
    page.events['payment.failed']({ error: {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(page.verifications, 1);
    assert.deepEqual(page.notices, [null]);
  });
}

test('the persistent notice exposes enabled Retry and Dismiss actions and disables them during a check', () => {
  const { PaymentRetryNotice } = load('components/payment-retry-notice.tsx', {
    'lucide-react': { X: 'svg' }, '@/components/ui/button': { Button: 'button' },
  });
  let retries = 0, dismissals = 0;
  const props = { message: paymentFailureMessage(), busy: false, onRetry: () => retries++, onDismiss: () => dismissals++ };
  function buttons(node) {
    if (!node || typeof node !== 'object') return [];
    const children = node.props?.children;
    return (node.type === 'button' ? [node] : []).concat((Array.isArray(children) ? children : [children]).flatMap(buttons));
  }
  const notice = PaymentRetryNotice(props);
  assert.equal(notice.props.role, 'alert');
  assert.match(notice.props.className, /fixed/);
  const actions = buttons(notice);
  const retry = actions.find(button => button.props.children === 'Retry Payment');
  const dismiss = actions.find(button => button.props['aria-label'] === 'Dismiss payment message');
  assert.equal(retry.props.disabled, false); retry.props.onClick(); dismiss.props.onClick();
  assert.equal(retries, 1); assert.equal(dismissals, 1);
  assert.ok(buttons(PaymentRetryNotice({ ...props, busy: true })).every(button => button.props.disabled));
  assert.equal(PaymentRetryNotice({ ...props, message: null }), null);
});
