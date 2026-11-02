const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { Booking } = require('../src/models/booking.model.ts');
const { BookingPaymentLinkRequest } = require('../src/models/bookingPaymentLinkRequest.model.ts');
const { BookingPaymentSession } = require('../src/models/bookingPaymentSession.model.ts');
const { BookingBalancePaymentSession } = require('../src/models/bookingBalancePaymentSession.model.ts');
const { SmartCollectAccount } = require('../src/models/smartCollect.model.ts');
const { verifyBookingTcsExemption } = require('../src/controllers/booking.controller.ts');
process.env.JWT_SECRET = 'isolated-tax-verification-test-secret';

test('admin verification requires buyer evidence, recalculates saved totals, and blocks open payment collections', async (t) => {
  const documents = ['pan_card', 'visa'].map(documentType => ({ documentType, fileUrl: `/uploads/${documentType}.pdf` }));
  const booking = new Booking({ subtotal: 100000, gstAmount: 5000, packageTotal: 105000,
    tcsApplicable: true, tcsAmount: 2100, tcsPercentage: 2, grandTotal: 107100,
    amountPaid: 40000, paymentStatus: 'pending', totalGuest: 1,
    guestDetails: [{ isNri: true }], travellers: [{ id: 'adult-1', type: 'adult', isNri: true, kycDocuments: documents }] });
  let saved = 0, active = false;
  t.mock.method(booking, 'save', async () => { saved++; return booking; });
  t.mock.method(Booking, 'findOneAndUpdate', async () => booking);
  t.mock.method(Booking, 'findById', async () => booking);
  t.mock.method(Booking, 'updateOne', async () => ({}));
  for (const model of [BookingPaymentLinkRequest, BookingBalancePaymentSession, SmartCollectAccount]) t.mock.method(model, 'exists', async () => false);
  t.mock.method(BookingPaymentSession, 'exists', async () => active);
  const request = { params: { id: String(booking._id) }, body: { verified: true },
    headers: { authorization: `Bearer ${jwt.sign({ userId: 'admin-reviewer', roles: ['admin'] }, process.env.JWT_SECRET)}` } };
  let result;
  const response = { json: value => { result = value; } };
  await verifyBookingTcsExemption(request, response);
  assert.equal(result.data.booking.tcsPercentage, 0);
  assert.equal(booking.grandTotal, 105000);
  assert.equal(booking.amountPaid, 40000);
  assert.equal(booking.balanceAmount, 65000);
  assert.equal(booking.tcsExemptionVerifiedBy, 'admin-reviewer');
  assert.equal(saved, 1);
  active = true;
  request.body.verified = false;
  await assert.rejects(verifyBookingTcsExemption(request, response), /pending payment/);
  assert.equal(booking.grandTotal, 105000);
  active = false;
  await verifyBookingTcsExemption(request, response);
  assert.equal(booking.grandTotal, 107100);
  assert.equal(booking.balanceAmount, 67100);
  booking.travellers[0].kycDocuments = [];
  request.body.verified = true;
  await assert.rejects(verifyBookingTcsExemption(request, response), /PAN and Visa/);
  assert.equal(booking.tcsExemptionVerified, false);
});
