const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../app/tours/[tourId]/_components/single-tour-page.tsx'), 'utf8');
const parsed = ts.createSourceFile('tour.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const summary = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'BookingSummary');
const code = ts.transpileModule(summary.getText(parsed), { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
test('summary places TCS directly after GST and shows distinct package, grand, advance and balance amounts', () => {
  const context = { require, exports: {}, SummaryLine: 'summary-line', BookingTermExplanation: 'term', BookingTermsLink: 'terms',
    formatTravellerSummary: () => '2 Adults', formatCurrency: String, formatBalanceDueDate: () => '-',
    isAirfareExcluded: () => false, cn: (...values) => values.join(' ') };
  vm.createContext(context); vm.runInContext(code, context);
  const props = { tour: { tourName: 'Test', tourType: 'International' }, travellerCounts: {},
    subtotal: 100000, gstPercentage: 5, gstAmount: 5000, tcsAmount: 2100, grandTotal: 107100,
    depositAmount: 42840, balanceAmount: 64260, paymentOption: 'advance', paymentFeedback: '' };
  let rows = elements(context.BookingSummary(props)).filter(node => node.type === 'summary-line').map(node => node.props);
  const gst = rows.findIndex(row => row.label === 'GST (5%)');
  assert.equal(rows[gst + 1].label, 'TCS (2%)');
  assert.equal(rows[gst + 1].value, '2100');
  for (const [label, value] of [['Package Total (Excluding TCS)', '105000'], ['Grand Total', '107100'], ['Deposit Payable', '42840'], ['Balance', '64260']]) {
    assert.equal(rows.find(row => row.label === label)?.value, value);
  }
  rows = elements(context.BookingSummary({ ...props, tour: { ...props.tour, tourType: 'Domestic' }, tcsAmount: 0 })).filter(node => node.type === 'summary-line');
  assert.equal(rows.some(row => row.props.label.startsWith('TCS')), false);

  rows = elements(context.BookingSummary({ ...props, gstPercentage: 9, gstAmount: 9000,
    tcsPercentage: 4, tcsAmount: 4360 })).filter(node => node.type === 'summary-line');
  assert.equal(rows.find(row => row.props.label === 'GST (9%)')?.props.value, '9000');
  assert.equal(rows.find(row => row.props.label === 'TCS (4%)')?.props.value, '4360');

  const exemptElements = elements(context.BookingSummary({ ...props, tcsPercentage: 0, tcsAmount: 0,
    tcsExempt: true, grandTotal: 105000 }));
  rows = exemptElements.filter(node => node.type === 'summary-line');
  assert.equal(rows.find(row => row.props.label === 'TCS (0%)')?.props.value, '₹0');
  assert.equal(rows.find(row => row.props.label === 'Grand Total')?.props.value, '105000');
  assert.ok(exemptElements.some(node => node.type === 'p' && node.props.children.includes('TCS excluded:')));
  const zeroRateElements = elements(context.BookingSummary({ ...props, tcsPercentage: 0, tcsAmount: 0 }));
  assert.equal(zeroRateElements.some(node => node.type === 'p' && typeof node.props.children === 'string' && node.props.children.includes('TCS excluded:')), false);
});

test('review totals exempt an NRI lead only after a successful Visa upload', () => {
  const names = ['bookingSubtotal', 'bookingGstAmount', 'leadTraveller', 'leadVisa', 'bookingTcsExempt', 'bookingTcsPercentage', 'bookingTcsAmount', 'bookingGrandTotal'];
  const statements = [];
  function visit(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.includes(item.name.getText(parsed)))) statements.push(node.getText(parsed));
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(statements.length, names.length);
  const context = {};
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`function totals(completeTravellerDetailForms, tourType = 'International', rate = 2) {
    const detail = { tour: { tourType } }, taxes = { tcsPercentage: rate }, selectedAccommodationOption = { total: 108000 }, gstPercentage = 5;
    ${statements.join('\n')}
    return { bookingGstAmount, bookingTcsPercentage, bookingTcsAmount, bookingGrandTotal };
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const visa = { token: 'signed-upload', fileName: 'visa.pdf' };
  for (const lead of [
    { isNri: false, nriDocuments: { visa } }, { isNri: true },
    { isNri: true, nriDocuments: { oci: visa } },
    { isNri: true, nriDocuments: { visa: { ...visa, uploading: true } } },
    { isNri: true, nriDocuments: { visa: { ...visa, error: 'Failed' } } },
    { isNri: true, nriDocuments: { visa: { fileName: 'visa.pdf' } } },
  ]) {
    const totals = context.totals({ 'adult-1': lead });
    assert.equal(totals.bookingTcsAmount, 2268);
    assert.equal(totals.bookingGrandTotal, 115668);
  }
  const forms = { 'adult-1': { isNri: true, nriDocuments: { visa } } };
  const exempt = context.totals(forms);
  assert.equal(exempt.bookingTcsPercentage, 0);
  assert.equal(exempt.bookingTcsAmount, 0);
  assert.equal(exempt.bookingGstAmount, 5400);
  assert.equal(exempt.bookingGrandTotal, 113400);
  assert.equal(context.totals({}, 'Domestic').bookingTcsAmount, 0);
  assert.equal(context.totals({}, 'International', 4).bookingTcsAmount, 4536);
  assert.equal(context.totals({ 'adult-1': { isNri: false }, 'adult-2': forms['adult-1'] }).bookingTcsAmount, 2268);
});
