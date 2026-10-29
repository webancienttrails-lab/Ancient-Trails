const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../app/tours/[tourId]/_components/single-tour-page.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createBookingPayload');
assert.ok(node);
const compiled = ts.transpileModule(node.getText(source) + '\ncreateBookingPayload;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const createPayload = vm.runInNewContext(compiled, {
  GST_PERCENTAGE: 5,
  createTravellerDetailTabs: () => [{ id: 'adult-1', travellerType: 'adult' }],
  getTotalTravellers: counts => counts.adults + counts.children + counts.infants,
  createAccommodationDetails: () => ({ singleOccupancyOneRoom: 1 }),
  extractPhoneCountryCode: () => '+91',
  sanitizeMobileNumber: value => value.replace(/\D/g, ''),
});

for (const paymentOption of ['advance', 'full']) {
  test(paymentOption + ' booking request omits client tax while preserving booking details', () => {
    const form = { title: 'Ms', firstName: 'Test', lastName: 'Traveller', phoneCountryCode: 'India +91',
      mobileNumber: '9000000000', email: 'test@example.test', dateOfBirth: '1990-01-01', gender: 'female',
      address: 'Test address', emergencyContactName: 'Emergency contact', emergencyContactMobileNumber: '9111111111' };
    const payload = JSON.parse(JSON.stringify(createPayload({
      accommodationOption: { id: 'room-fixture' }, departure: { departureId: 'DEPTEST' },
      tour: { tourId: 'TOURTEST' }, forms: { 'adult-1': form }, paymentOption,
      travellerCounts: { adults: 1, children: 0, infants: 0 },
    })));
    assert.equal(Object.hasOwn(payload, 'gstPercentage'), false);
    assert.equal(Object.hasOwn(payload, 'gstAmount'), false);
    assert.equal(Object.hasOwn(payload, 'amount'), false);
    assert.equal(payload.paymentOption, paymentOption);
    assert.equal(payload.tourId, 'TOURTEST');
    assert.equal(payload.departureId, 'DEPTEST');
    assert.equal(payload.selectedAccommodationOptionId, 'room-fixture');
    assert.equal(payload.guestDetails[0].email, form.email);
    assert.equal(payload.travellers[0].firstName, form.firstName);
    assert.equal(payload.emergencyContactName, form.emergencyContactName);
  });
}
