const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require: name => imports[name] || require(name), Intl, Date });
  return module.exports;
}
const receipts = load('lib/booking-receipt.ts');
const advance = { id: 'booking-fixture', bookingReference: 'AT-D0001', amountPaid: 20000,
  grandTotal: 42000, balanceAmount: 22000, balanceDueDate: '2026-10-30T00:00:00Z',
  paymentStatus: 'paid', bookingStatus: 'confirmed', paymentCurrency: 'INR',
  paymentCapturedAt: '2026-10-27T06:00:00Z', paymentId: 'pay_fixture', paymentOrderId: 'order_fixture',
  guestDetails: [{ firstName: 'Test', lastName: 'Traveller' }] };

test('advance confirmation states the actual payment, balance and due date', () => {
  assert.equal(receipts.getBookingPaymentSummary(advance), 'Booking confirmed with an advance of \u20b920,000. Balance \u20b922,000 due 30 Oct 2026.');
  assert.match(receipts.getBookingDocumentMessage(advance), /receipt is available now.*invoice and booking voucher.*after final payment/);
  assert.equal(receipts.getBookingPaymentState(advance).canDownloadReceipt, true);
});

test('full payment does not claim an advance or an outstanding balance', () => {
  const full = { ...advance, amountPaid: 42000, balanceAmount: 0 };
  assert.match(receipts.getBookingPaymentSummary(full), /received in full/);
  assert.doesNotMatch(receipts.getBookingPaymentSummary(full), /advance|due/);
  assert.match(receipts.getBookingDocumentMessage(full), /invoice and booking voucher are available now/);
});

test('missing balance and due dates do not invent a deadline or claim full settlement', () => {
  const booking = { ...advance, balanceAmount: undefined, balanceDueDate: undefined };
  assert.equal(receipts.getBookingPaymentState(booking).balance, 22000);
  assert.match(receipts.getBookingPaymentSummary(booking), /Our team will confirm the due date/);
});

test('unpaid and unverified bookings cannot generate a receipt', async () => {
  for (const booking of [{ ...advance, amountPaid: 0 }, { ...advance, paymentStatus: 'pending' }]) {
    assert.equal(receipts.getBookingPaymentState(booking).canDownloadReceipt, false);
    await assert.rejects(receipts.createBookingPaymentReceiptPdf(booking, 'Test tour'), /only after payment has been verified/);
    assert.match(receipts.getBookingPaymentSummary(booking), /Payment is pending/);
  }
});

test('advance receipt is a real PDF containing the recorded payment and outstanding amount', async () => {
  const pdf = await receipts.createBookingPaymentReceiptPdf(advance, 'Test tour');
  const contents = pdf.output();
  assert.match(contents, /^%PDF-/);
  assert.match(contents, /Advance Payment Receipt/);
  assert.match(contents, /AT-D0001/);
  assert.match(contents, /Total verified payments: INR 20,000/);
  assert.match(contents, /Outstanding balance: INR 22,000/);
  assert.match(contents, /30 Oct 2026/);
  assert.match(contents, /pay_fixture/);
  assert.match(contents, /not a tax invoice/);
  assert.match(contents, /%%EOF/);
});

test('full-payment PDF does not use the advance receipt title', async () => {
  const pdf = await receipts.createBookingPaymentReceiptPdf({ ...advance, amountPaid: 42000, balanceAmount: 0 }, 'Test tour');
  assert.match(pdf.output(), /Payment Receipt/);
  assert.doesNotMatch(pdf.output(), /Advance Payment Receipt/);
  assert.match(pdf.output(), /Outstanding balance: INR 0/);
});

function receiptComponent() {
  const downloads = [], errors = [];
  const { BookingPaymentReceipt } = load('components/booking-payment-receipt.tsx', {
    react: { useState: () => [false, () => {}] },
    'lucide-react': { Download: 'span' },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/toast': { useToast: () => ({ error: (...args) => errors.push(args) }) },
    '@/lib/booking-receipt': { ...receipts, downloadBookingPaymentReceipt: async (...args) => { downloads.push(args); } },
  });
  return { render: BookingPaymentReceipt, downloads, errors };
}
function findButton(element) {
  if (!element || typeof element !== 'object') return null;
  if (element.type === 'button') return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findButton(child); if (found) return found;
  }
  return null;
}

test('the shared receipt control is enabled after an advance and downloads on click', async () => {
  const page = receiptComponent();
  const button = findButton(page.render({ booking: advance, tourName: 'Test tour' }));
  assert.ok(button);
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.downloads.length, 1);
  assert.equal(page.downloads[0][0], advance);
  assert.equal(page.errors.length, 0);
});

test('the receipt control is absent before any payment has been received', () => {
  const page = receiptComponent();
  assert.equal(page.render({ booking: { ...advance, amountPaid: 0 }, tourName: 'Test tour' }), null);
});
