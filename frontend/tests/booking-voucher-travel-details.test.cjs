const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { jsPDF } = require('jspdf');
const source = fs.readFileSync(path.join(__dirname, '../components/user-dashboard/user-booking-detail-page.tsx'), 'utf8');
const parsed = ts.createSourceFile('voucher.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['getVoucherTourDetails', 'getVoucherDateTime', 'getVoucherNights', 'getVoucherHotelRows', 'getVoucherFlightRows', 'getVoucherInclusions', 'getVoucherExclusions', 'downloadBookingVoucherPdf'];
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
assert.equal(functions.length, names.length);
const compiled = ts.transpileModule(functions.map(node => node.getText(parsed)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;

function setup() {
  const texts = [], errors = [], saved = [];
  class Pdf extends jsPDF {
    constructor(...args) {
      super(...args);
      const originalText = this.text.bind(this);
      this.text = (value, x, y, ...rest) => { texts.push({ value: String(value), x, y, page: this.getCurrentPageInfo().pageNumber }); return originalText(value, x, y, ...rest); };
      this.save = name => saved.push({ name, pages: this.getNumberOfPages(), bytes: this.output('arraybuffer').byteLength });
    }
  }
  const context = {
    require: name => name === 'jspdf' ? { default: Pdf } : require(name),
    parseDate: value => value ? new Date(value) : null,
    formatDate: value => value ? String(value).slice(0, 10) : '-',
    getUserBookingLocation: () => 'Badami', getUserBookingReference: () => 'AT-DTEST',
    getBookingTravellers: () => [], getTotalAmount: () => 50000, getTourPackageAmount: () => 50000,
    getUserBookingDuration: () => '6D/5N', getUserBookingTitle: () => 'Heritage tour',
    getGuestName: () => 'Test Traveller', getBalanceAmount: () => 0, getPaidAmount: () => 50000,
    getBookingTaxBreakdown: booking => ({ packageTotal: booking.packageTotal ?? (booking.subtotal || 0) + (booking.gstAmount || 0),
      applicable: !!booking.tcsApplicable, label: `TCS (${booking.tcsPercentage ?? 2}%)`, amount: booking.tcsAmount || 0 }),
    formatPdfAmount: String, formatPdfCurrency: String, fetchSiteLogoUrl: async () => '', loadPdfImageDataUrl: async () => '',
    window: { alert: value => errors.push(value) }, console: { error: (...args) => errors.push(args) }, Date, Intl,
  };
  vm.createContext(context); vm.runInContext(compiled, context);
  return { context, texts, errors, saved };
}
const hotel = { destination: 'Badami, Karnataka', hotel: 'Heritage Hotel', category: 'Deluxe double', nights: 5 };
const flight = { from: 'Mumbai', to: 'Hubli', airline: 'Air India AI 123', seats: 2, dateTime: '2026-12-13T09:30' };
function fixture(count = 1) {
  return { booking: { guestDetails: [], totalGuest: 2, hotelDetails: Array.from({ length: count }, (_, i) => ({ ...hotel, hotel: `Heritage Hotel ${i}` })), flightDetails: Array.from({ length: count }, (_, i) => ({ ...flight, airline: `Flight ${i}` })), pricingSnapshot: { departureDate: '2026-12-13', returnDate: '2026-12-18', accommodation: { rooms: [] } } }, tour: { accommodationDetails: ['Generic hotel'], flightDetails: ['Generic flight'] } };
}

test('voucher uses booking-specific hotels and flights before tour defaults', () => {
  const { context } = setup();
  const booking = fixture();
  assert.equal(context.getVoucherHotelRows(booking)[0].hotel, 'Heritage Hotel 0');
  assert.equal(context.getVoucherHotelRows(booking)[0].nights, '5 Nights');
  assert.equal(context.getVoucherFlightRows(booking)[0].airline, 'Flight 0');
  assert.equal(context.getVoucherFlightRows(booking)[0].seats, '2');
  assert.match(context.getVoucherFlightRows(booking)[0].dateTime, /09:30/);
  booking.booking.hotelDetails = []; booking.booking.flightDetails = [];
  assert.equal(context.getVoucherHotelRows(booking)[0].hotel, 'Generic hotel');
  assert.equal(context.getVoucherFlightRows(booking)[0].airline, 'Generic flight');
});

test('downloaded voucher contains the saved travel details', async () => {
  const { context, texts, saved, errors } = setup();
  await context.downloadBookingVoucherPdf(fixture());
  assert.deepEqual(errors, []);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].pages, 3);
  assert.ok(saved[0].bytes > 1000);
  assert.ok(texts.some(item => item.value === 'Heritage Hotel 0'));
  assert.ok(texts.some(item => item.value === 'Flight 0'));
});

test('voucher displays saved TCS after GST, excludes it from package total, and hides it for domestic bookings', async () => {
  for (const [applicable, percentage, tax] of [[true, 2, 2100], [true, 0, 0], [false, 0, 0]]) {
    const { context, texts, errors } = setup();
    const booking = fixture();
    Object.assign(booking.booking, { subtotal: 100000, gstPercentage: 5, gstAmount: 5000,
      packageTotal: 105000, tcsApplicable: applicable, tcsPercentage: percentage, tcsAmount: tax });
    context.getTotalAmount = () => 105000 + tax;
    context.getPaidAmount = () => 40000;
    context.getBalanceAmount = () => 65000 + tax;
    await context.downloadBookingVoucherPdf(booking);
    assert.deepEqual(errors, []);
    assert.equal(texts.filter(item => /^TCS \(/.test(item.value)).length, applicable ? 1 : 0);
    assert.ok(texts.some(item => item.value === '105000'));
    if (applicable) {
      const gstIndex = texts.findIndex(item => item.value.includes('GST 5%'));
      const taxIndex = texts.findIndex(item => item.value === `TCS (${percentage}%)`);
      assert.ok(taxIndex > gstIndex);
    }
  }
});

test('multiple hotel stays and flight legs continue on extra voucher pages', async () => {
  const { context, texts, saved, errors } = setup();
  await context.downloadBookingVoucherPdf(fixture(50));
  assert.deepEqual(errors, []);
  assert.ok(saved[0].pages > 3);
  for (let index = 0; index < 50; index++) {
    assert.ok(texts.some(item => item.value === `Heritage Hotel ${index}`));
    assert.ok(texts.some(item => item.value === `Flight ${index}`));
  }
  assert.ok(texts.some(item => item.value === `Page ${saved[0].pages} of ${saved[0].pages}`));
  for (const item of texts.filter(item => /^(Heritage Hotel |Flight )\d+$/.test(item.value))) {
    assert.ok(item.y < 790, `Travel detail below page content: ${item.value}`);
  }
});
