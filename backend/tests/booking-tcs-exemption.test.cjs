const test = require("node:test");
const assert = require("node:assert/strict");
const { isTravellerTcsExempt } = require("../dist/services/booking/booking.kyc");
const { Booking } = require("../dist/models/booking.model");
const { formatBooking } = require("../dist/controllers/booking.controller");

const visa = { documentType: "visa", fileUrl: "/uploads/booking-kyc/visa.pdf" };

test("TCS exemption requires NRI status and an uploaded Visa, independently of PAN and OCI", () => {
  assert.equal(isTravellerTcsExempt({ isNri: true, kycDocuments: [visa] }), true);
  assert.equal(isTravellerTcsExempt({ isNri: true, tcsExemptionVerified: true, kycDocuments: [visa] }), true);
  assert.equal(isTravellerTcsExempt({ isNri: false, kycDocuments: [visa] }), false);
  assert.equal(isTravellerTcsExempt({ kycDocuments: [visa] }), false);
  assert.equal(isTravellerTcsExempt({ isNri: true }), false);
  assert.equal(isTravellerTcsExempt({ isNri: true, kycDocuments: [] }), false);
  for (const documentType of ["pan_card", "oci"]) {
    assert.equal(isTravellerTcsExempt({ isNri: true, kycDocuments: [{ ...visa, documentType }] }), false);
  }
  assert.equal(isTravellerTcsExempt({ isNri: true, kycDocuments: [{ ...visa, fileUrl: " " }] }), false);
});

test("saved Visa uploads update only the eligible traveller's exemption and preserve totals", () => {
  const booking = new Booking({
    tourId: "TEST", subtotal: 100000, gstPercentage: 5, gstAmount: 5000, grandTotal: 105000,
    depositAmount: 42000, balanceAmount: 63000,
    travellers: [
      { id: "nri", type: "adult", isNri: true },
      { id: "resident", type: "adult", isNri: false },
    ],
  });
  assert.equal(formatBooking(booking).travellers[0].tcsExempt, false);
  booking.travellers[0].kycDocuments = [visa];
  booking.travellers[1].kycDocuments = [visa];
  const restored = new Booking(booking.toObject());
  const formatted = formatBooking(restored);
  assert.deepEqual(formatted.travellers.map((traveller) => traveller.tcsExempt), [true, false]);
  restored.tcsExemptionVerified = true;
  assert.equal(formatBooking(restored).travellers[0].tcsExempt, true);
  assert.equal(formatted.gstAmount, 5000);
  assert.equal(formatted.grandTotal, 105000);
  assert.equal(formatted.depositAmount, 42000);
  assert.equal(formatted.balanceAmount, 63000);
  restored.travellers[0].kycDocuments = [];
  assert.equal(formatBooking(restored).travellers[0].tcsExempt, false);
});
