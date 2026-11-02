const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBookingTotals, adjustBookingTcs } = require('../src/services/booking/booking.pricing.ts');
const { createPricingSnapshot } = require('../src/services/booking/booking.snapshot.ts');
const { isTravellerTcsExempt } = require('../src/services/booking/booking.kyc.ts');
const option = { total: 100000, totalTravellers: 2, rooms: [], pricingBreakdown: {} };
const departure = { departureId: 'DEP1', departureDate: new Date('2027-06-01'), returnDate: new Date('2027-06-08'),
  childPricingRules: [], depositType: 'percentage', depositValue: 40, depositAppliesTo: 'booking', balanceDueDaysBefore: 30 };

test('international package consideration includes GST and excludes TCS itself', () => {
  const result = calculateBookingTotals({ accommodationOption: option, gstPercentage: 5, tcsApplicable: true });
  assert.equal(result.packageTotal, 105000);
  assert.equal(result.tcsAmount, 2100);
  assert.equal(result.tcsPercentage, 2);
  assert.equal(result.grandTotal, 107100);
  const domestic = calculateBookingTotals({ accommodationOption: option, gstPercentage: 5 });
  assert.equal(domestic.tcsApplicable, false);
  assert.equal(domestic.tcsAmount, 0);
  assert.equal(domestic.grandTotal, 105000);
});

test('only verified exemption grants 0%; an NRI declaration and uploaded Visa alone do not', () => {
  const traveller = { isNri: true, kycDocuments: [{ documentType: 'visa', fileUrl: '/uploads/visa.pdf' }] };
  assert.equal(isTravellerTcsExempt(traveller), false);
  assert.equal(isTravellerTcsExempt({ ...traveller, tcsExemptionVerified: true }), true);
  assert.equal(isTravellerTcsExempt({ ...traveller, isNri: false, tcsExemptionVerified: true }), false);
  const result = calculateBookingTotals({ accommodationOption: option, gstPercentage: 5, tcsApplicable: true, tcsExemptionVerified: true });
  assert.equal(result.tcsPercentage, 0);
  assert.equal(result.tcsAmount, 0);
  assert.equal(result.grandTotal, 105000);
});

test('advance and fixed deposits include TCS exactly once in the outstanding balance', () => {
  const args = { accommodationOption: option, departure, gstPercentage: 5, tcsApplicable: true };
  const advance = createPricingSnapshot(args);
  assert.equal(advance.depositAmount, 42840);
  assert.equal(advance.balanceAmount, 64260);
  assert.equal(advance.depositAmount + advance.balanceAmount, advance.grandTotal);
  const full = createPricingSnapshot({ ...args, departure: { ...departure, depositValue: 100 } });
  assert.equal(full.depositAmount, 107100);
  assert.equal(full.balanceAmount, 0);
  const fixed = createPricingSnapshot({ ...args, departure: { ...departure, depositType: 'fixed', depositValue: 20000 } });
  assert.equal(fixed.depositAmount, 20000);
  assert.equal(fixed.balanceAmount, 87100);
});

test('partial and full payments preserve money actually received when exemption changes', () => {
  for (const amountPaid of [0, 42840, 70000, 107100]) {
    const updated = adjustBookingTcs({ packageTotal: 105000, grandTotal: 107100, tcsAmount: 2100, amountPaid, verified: true });
    assert.equal(updated.grandTotal, 105000);
    assert.equal(updated.balanceAmount, Math.max(0, 105000 - amountPaid));
    assert.equal(updated.refundDue, Math.max(0, amountPaid - 105000));
    const revoked = adjustBookingTcs({ packageTotal: 105000, grandTotal: updated.grandTotal, tcsAmount: 0, amountPaid, verified: false });
    assert.equal(revoked.grandTotal, 107100);
    assert.equal(revoked.balanceAmount, Math.max(0, 107100 - amountPaid));
    const repeated = adjustBookingTcs({ packageTotal: 105000, grandTotal: revoked.grandTotal, tcsAmount: 2100, amountPaid, verified: false });
    assert.equal(repeated.grandTotal, 107100);
  }
});

test('separately added airfare is preserved and not taxed again when verifying exemption', () => {
  const result = adjustBookingTcs({ packageTotal: 105000, grandTotal: 127100, tcsAmount: 2100, amountPaid: 70000, verified: true });
  assert.equal(result.grandTotal, 125000);
  assert.equal(result.balanceAmount, 55000);
});
