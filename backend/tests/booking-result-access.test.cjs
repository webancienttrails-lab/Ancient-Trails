const test = require('node:test');
const assert = require('node:assert/strict');
const { Booking } = require('../dist/models/booking.model');
const { BookingPaymentSession } = require('../dist/models/bookingPaymentSession.model');
const { Tour } = require('../dist/models/tour.model');
const { TourDeparture } = require('../dist/models/tourDeparture.model');
const { SmartCollectAccount, SmartCollectTransfer } = require('../dist/models/smartCollect.model');
const controller = require('../dist/controllers/booking.controller');
const { getCustomerBankTransfer } = require('../dist/controllers/smartCollect.controller');
const { mockBookingTraveller, bookingRequest, bookingResponse } = require('./helpers/booking-access.cjs');

const endpoints = {
  confirmation: controller.getBookingConfirmation,
  submission: controller.getOfflineBookingSubmission,
  recovery: controller.getBookingRecovery,
  bank: getCustomerBankTransfer,
  'recovery checkout': controller.createBookingRecoveryPaymentOrder,
};
function setup(t, traveller = {}) {
  mockBookingTraveller(t, traveller);
  const booking = new Booking({ tourId: 'TOURTEST', departureId: 'DEPTEST', totalGuest: 1,
    adultCount: 1, childCount: 0, childDetails: [], travellers: [], accommodationDetails: {},
    guestDetails: [{ title: 'Ms', firstName: 'Lead', lastName: 'Traveller', email: 'test@example.com',
      mobileNumber: '9000000000', countryCode: '+91', address: 'Test city' }],
    paymentStatus: 'paid', bookingStatus: 'confirmed', paymentMode: 'offline', amountPaid: 100,
    grandTotal: 100, confirmationToken: 'legacy-confirmation', offlineSubmissionToken: 'legacy-submission',
    recoveryToken: 'legacy-recovery', bankTransferToken: 'legacy-bank' });
  const lookup = t.mock.method(Booking, 'findOne', async filter => {
    assert.equal(filter._id, booking.id);
    assert.equal(filter.confirmationToken, undefined);
    assert.equal(filter.offlineSubmissionToken, undefined);
    assert.equal(filter.recoveryToken, undefined);
    const phones = filter['guestDetails.0.mobileNumber']?.$in;
    assert.ok(phones, 'Ownership must be checked against the lead phone, never an editable email');
    return phones.some(regex => regex.test(booking.guestDetails[0].mobileNumber)) ? booking : null;
  });
  t.mock.method(Booking, 'findById', async () => booking);
  t.mock.method(Booking, 'findOneAndUpdate', async () => null);
  t.mock.method(Booking, 'updateOne', async () => ({}));
  t.mock.method(Tour, 'findOne', async () => null);
  t.mock.method(TourDeparture, 'findOne', async () => null);
  t.mock.method(controller, 'getRazorpayCredentials', () => ({ keyId: 'rzp_test_fixture', keySecret: 'fixture' }));
  for (const model of [SmartCollectAccount, SmartCollectTransfer]) {
    t.mock.method(model, 'find', () => ({ sort() { return this; }, lean: async () => [] }));
  }
  return { booking, lookup };
}

for (const [name, endpoint] of Object.entries(endpoints)) {
  test(name + ': a legacy URL token cannot grant anonymous access', async t => {
    const f = setup(t), res = bookingResponse();
    await assert.rejects(endpoint(bookingRequest(f.booking.id, false, { query: { token: 'legacy-confirmation' } }), res), e => e.statusCode === 401);
    assert.equal(res.body, undefined);
    assert.equal(f.lookup.mock.callCount(), 0);
  });
  test(name + ': another account with the same email cannot access the lead booking', async t => {
    const f = setup(t, { mobileNumber: '919111111111', email: 'test@example.com' });
    await assert.rejects(endpoint(bookingRequest(f.booking.id, true, { query: { token: 'legacy-confirmation' } }), bookingResponse()), e => e.statusCode === 404);
  });
  test(name + ': an unverified mobile number cannot authorize access', async t => {
    const f = setup(t, { isMobileVerified: false });
    await assert.rejects(endpoint(bookingRequest(f.booking.id), bookingResponse()), e => e.statusCode === 403);
    assert.equal(f.lookup.mock.callCount(), 0);
  });
}

for (const name of ['confirmation', 'submission', 'recovery', 'bank']) {
  test(name + ': verified lead opens the clean link without any URL token', async t => {
    const f = setup(t), res = bookingResponse();
    await endpoints[name](bookingRequest(f.booking.id), res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.booking.id, f.booking.id);
    assert.match(res.headers['Cache-Control'], /no-store/);
    assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
    assert.doesNotMatch(JSON.stringify(res.body), /legacy-confirmation|legacy-submission|legacy-recovery|legacy-bank/);
  });
}

test('expired or forged sessions cannot be replaced by a valid legacy booking token', async t => {
  const f = setup(t);
  await assert.rejects(controller.getBookingConfirmation(bookingRequest(f.booking.id, true, {
    headers: { authorization: 'Bearer expired-session' }, query: { token: f.booking.confirmationToken },
  }), bookingResponse()), e => e.statusCode === 401);
  assert.equal(f.lookup.mock.callCount(), 0);
});

test('payment status cannot expose confirmation details to someone holding only an order ID', async t => {
  const f = setup(t);
  t.mock.method(BookingPaymentSession, 'findOne', async () => new BookingPaymentSession({
    bookingId: f.booking._id, razorpayOrderId: 'order_fixture', status: 'pending',
    amount: 10000, amountRupees: 100, currency: 'INR', receipt: 'fixture', bookingDraft: {},
  }));
  await assert.rejects(controller.getBookingPaymentOrderStatus({ params: { orderId: 'order_fixture' }, headers: {} }, bookingResponse()), e => e.statusCode === 401);
});

test('matching local digits in another country do not grant booking access', async t => {
  const f = setup(t);
  f.booking.guestDetails[0].countryCode = '+1';
  await assert.rejects(controller.getBookingConfirmation(bookingRequest(f.booking.id), bookingResponse()), e => e.statusCode === 404);
});
