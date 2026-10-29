const { SmartCollectAccount } = require("../dist/models/smartCollect.model");
const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const axios = require('axios');
const { Booking } = require('../dist/models/booking.model');
const { Tour } = require('../dist/models/tour.model');
const { TourDeparture } = require('../dist/models/tourDeparture.model');
const alerts = require('../dist/services/booking/offline-booking-alert.service');
const { generateOccupancyOptions } = require('../dist/services/accommodation/accommodation.generator');
const { createOfflineBooking, updateBooking, updateBookingAirFlightCharges, getOfflineBookingSubmission, getBookingConfirmation } = require('../dist/controllers/booking.controller');
const { sendOfflineBookingAdminWhatsapp } = require('../dist/services/msg91-whatsapp.service');

function fixture() {
  const departure = {
    departureId: 'DEPTEST', tourId: 'TOURTEST', destinationId: 'DOMTEST',
    departureDate: '2040-12-13T00:00:00.000Z', returnDate: '2040-12-18T00:00:00.000Z',
    bookingDeadline: '2040-12-01T00:00:00.000Z', totalSeats: 25, seatsAvailable: 25,
    priceAdult: 35500, priceExtraBed: 31950, priceChildWithoutExtraBed: 28400,
    singleOccupancy: 44375, depositType: 'fixed', depositValue: 20000,
    depositAppliesTo: 'per_person', balanceDueDaysBefore: 15, earlyBirdOffer: null,
    status: 'scheduled', childPricingRules: [],
  };
  const option = generateOccupancyOptions({ adults: 1, children: [], selectedDeparture: departure })[0];
  const guest = { title: 'Ms', firstName: 'Test', lastName: 'Traveller', countryCode: '+91',
    mobileNumber: '9000000000', email: 'test@example.com', dateOfBirth: '1990-01-01', gender: 'Female', address: 'Test city' };
  const payload = { tourId: departure.tourId, departureId: departure.departureId,
    selectedAccommodationOptionId: option.id, paymentOption: 'advance', totalGuest: 1,
    adultCount: 1, childCount: 0, childDetails: [], guestDetails: [guest],
    travellers: [{ ...guest, id: 'adult-1', type: 'adult' }], gstPercentage: 5 };
  return { departure, payload };
}
function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
}
function mockTour(t, departure) {
  t.mock.method(Tour, 'exists', async () => true);
  t.mock.method(Tour, 'findOne', async () => ({ tourId: 'TOURTEST', tourName: 'Test tour', inclusions: [], exclusions: [] }));
  t.mock.method(TourDeparture, 'findOne', async () => departure);
}

test('offline requests cannot claim payment, do not reserve seats or confirm, and retries reuse the request', async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
  const { departure, payload } = fixture();
  mockTour(t, departure);
  let saved, creations = 0, notifications = 0;
  t.mock.method(Booking, 'findOne', async () => saved || null);
  t.mock.method(Booking, 'create', async values => {
    creations++;
    saved = new Booking({ ...values, bookingReference: 'ATTEST' });
    return saved;
  });
  const reserve = t.mock.method(TourDeparture, 'findOneAndUpdate', () => { throw Error('Offline request must not reserve seats'); });
  const confirmation = t.mock.method(Booking, 'findOneAndUpdate', () => { throw Error('Unpaid request must not queue confirmation'); });
  t.mock.method(alerts, 'notifyOfflineBookingAdmins', async () => { notifications++; });
  const req = { body: { ...payload, amountPaid: 999999, paymentMethod: 'cash', airFlightCharges: 10000, paymentStatus: 'paid' } };
  const first = response();
  await createOfflineBooking(req, first);
  assert.equal(first.statusCode, 201);
  assert.match(first.body.data.submissionToken, /^[a-f0-9]{48}$/);
  assert.equal(saved.amountPaid, 0);
  assert.equal(saved.balanceAmount, saved.grandTotal);
  assert.equal(saved.paymentStatus, 'pending');
  assert.equal(saved.bookingStatus, 'payment_pending');
  assert.equal(saved.paymentMode, 'offline');
  assert.equal(saved.paymentCapturedAt, null);
  assert.equal(saved.airFlightCharges, 0);
  assert.equal(saved.heldSeatCount, 0);
  assert.equal(saved.recoveryEmailStatus, 'disabled');
  assert.equal(saved.whatsappRecoveryStatus, 'disabled');
  assert.equal(saved.paymentMethod, undefined);
  assert.equal(reserve.mock.callCount(), 0);
  assert.equal(confirmation.mock.callCount(), 0);
  assert.ok(notifications > 0);
  departure.seatsAvailable = 0;
  const second = response();
  await createOfflineBooking(req, second);
  assert.equal(creations, 1);
  assert.equal(first.body.data.submissionToken, second.body.data.submissionToken);
  assert.equal(first.body.data.booking.id, second.body.data.booking.id);
  assert.deepEqual(Object.keys(first.body.data.booking).sort(), ['bookingReference', 'id']);
});

for (const method of ['cash', 'cheque', 'zero', 'neft']) {
  test('admin offline payment: ' + method, async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
    const { departure, payload } = fixture();
    mockTour(t, departure);
    const existing = new Booking({ ...payload, paymentMode: 'offline', paymentStatus: 'pending',
      bookingStatus: 'payment_pending', amountPaid: 0, airFlightCharges: 0, grandTotal: 46594 });
    const claimFilters = [];
    t.mock.method(Booking, 'findById', async () => existing);
    t.mock.method(Booking, 'findOneAndUpdate', async filter => {
      if (filter.paymentStatus) { claimFilters.push(filter); return null; }
      return existing;
    });
    t.mock.method(Booking, 'updateOne', async () => ({}));
    let update;
    t.mock.method(Booking, 'findByIdAndUpdate', async (id, values) => {
      update = values;
      return new Booking({ ...existing.toObject(), ...values });
    });
    const reserve = t.mock.method(TourDeparture, 'findOneAndUpdate', async () => ({ ...departure, seatsAvailable: 24 }));
    t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
    const req = { params: { id: existing._id.toString() }, body: { ...payload,
      amountPaid: method === 'zero' ? 0 : 20000, paymentMethod: method === 'zero' ? 'cash' : method } };
    if (method === 'neft') {
      await assert.rejects(updateBooking(req, response()), /Choose cash or cheque/);
      assert.equal(update, undefined);
      return;
    }
    const res = response();
    await updateBooking(req, res);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(res.statusCode, 200);
    if (method === 'zero') {
      assert.equal(update.amountPaid, 0);
      assert.equal(update.paymentStatus, 'pending');
      assert.equal(update.bookingStatus, 'payment_pending');
      assert.equal(claimFilters.length, 0);
      assert.equal(reserve.mock.callCount(), 0);
    } else {
      assert.equal(update.amountPaid, 20000);
      assert.equal(update.paymentStatus, 'paid');
      assert.equal(update.bookingStatus, 'confirmed');
      assert.equal(update.paymentMethod, method);
      assert.equal(reserve.mock.callCount(), 1);
      assert.equal(claimFilters.length, 2, 'Email and WhatsApp confirmation queued after payment');
      assert.ok(claimFilters.every(filter => filter.paymentStatus === 'paid'));
    }
  });
}

test('admin WhatsApp uses all eight approved variables and the admin recipient only', async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
  const before = { ...process.env };
  t.after(() => { process.env = before; });
  process.env.MSG91_AUTH_KEY = 'test-only';
  process.env.OFFLINE_BOOKING_ALERT_WHATSAPP_NUMBERS = '917057476950';
  process.env.MSG91_WHATSAPP_OFFLINE_BOOKING_TEMPLATE_NAME = 'admin_offline_booking_request';
  let sent;
  t.mock.method(axios, 'post', async (url, body) => { sent = body; return { data: { success: true, request_id: 'mock' } }; });
  await sendOfflineBookingAdminWhatsapp({ bookingReference: 'ATTEST', travellerName: 'Test Traveller',
    travellerPhone: '+91 9000000000', tourName: 'Test Tour', departureDate: '13/12/2040',
    totalGuests: '1', totalAmount: '46594', paymentMethod: 'Offline (Cash / Cheque)' });
  assert.equal(sent.payload.template.name, 'admin_offline_booking_request');
  const destination = sent.payload.template.to_and_components[0];
  assert.deepEqual(destination.to, ['917057476950']);
  assert.deepEqual(Object.values(destination.components).map(item => item.value),
    ['ATTEST', 'Test Traveller', '+91 9000000000', 'Test Tour', '13/12/2040', '1', '46594', 'Offline (Cash / Cheque)']);
});
test('offline email goes only to configured admins and clearly says payment is pending', async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
  const before = { ...process.env };
  t.after(() => { process.env = before; });
  Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'test',
    SMTP_PASS: 'test', SMTP_FROM: 'no-reply@example.com', BOOKING_ALERT_EMAILS: 'admin@example.com' });
  const nodemailer = require('nodemailer');
  let sent;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async mail => { sent = mail; return { messageId: 'mock-email' }; } }));
  const { sendBookingAlertEmail } = require('../dist/services/booking-confirmation-email.service');
  await sendBookingAlertEmail({ offlinePending: true, bookingId: 'test', bookingReference: 'ATTEST',
    travellerName: 'Test Traveller', travellerEmail: 'traveller@example.com', recipientEmail: 'traveller@example.com',
    travellerPhone: '+91 9000000000', tourName: 'Test Tour', travellersLabel: '1',
    totalAmount: 46594, amountPaid: 0, balanceAmount: 46594 });
  assert.equal(sent.to, 'admin@example.com');
  assert.match(sent.subject, /payment pending/i);
  assert.match(sent.html, /awaiting cash or cheque payment/);
  assert.doesNotMatch(sent.html, /A booking has been confirmed/);
  assert.match(sent.text, /Payment Status: Pending/);
  assert.match(sent.text, /Amount Paid:.*0/);
  assert.doesNotMatch(sent.text, /Confirmed On/);
});
test('offline submission details require the lead traveller session and preserve unpaid state', async t => {
  const { mockBookingTraveller, bookingRequest, bookingResponse } = require('./helpers/booking-access.cjs');
  const { departure, payload } = fixture();
  mockTour(t, departure);
  mockBookingTraveller(t);
  const booking = new Booking({ ...payload, offlineSubmissionToken: 'private-token',
    paymentMode: 'offline', paymentStatus: 'pending', bookingStatus: 'payment_pending',
    amountPaid: 0, grandTotal: 46594, balanceAmount: 46594 });
  const filters = [];
  t.mock.method(Booking, 'findOne', async filter => { filters.push(filter); return booking; });
  const notifications = t.mock.method(Booking, 'findOneAndUpdate', () => { throw Error('Viewing a receipt must not send notifications'); });
  await assert.rejects(getOfflineBookingSubmission(bookingRequest(booking.id, false, { query: { token: 'private-token' } }), bookingResponse()), e => e.statusCode === 401);
  assert.equal(filters.length, 0);
  const res = bookingResponse();
  await getOfflineBookingSubmission(bookingRequest(booking.id), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.booking.paymentStatus, 'pending');
  assert.equal(res.body.data.booking.amountPaid, 0);
  assert.equal(res.body.data.tour.tourName, 'Test tour');
  assert.equal(notifications.mock.callCount(), 0);
  assert.equal(res.body.data.booking.offlineSubmissionToken, undefined);
  assert.equal(filters[0].offlineSubmissionToken, undefined);
  assert.ok(filters[0]['guestDetails.0.mobileNumber']);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  await assert.rejects(getBookingConfirmation(bookingRequest(booking.id), bookingResponse()), /Booking confirmation not found/);
});

test('airfare can be added and corrected on pending offline bookings without recording payment or sending confirmation', async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
  const { payload } = fixture();
  const booking = new Booking({ ...payload, paymentMode: 'offline', paymentStatus: 'pending',
    bookingStatus: 'payment_pending', amountPaid: 0, grandTotal: 37275, balanceAmount: 37275,
    airFlightCharges: 0, airfareExcluded: true });
  t.mock.method(Booking, 'findById', async () => booking);
  t.mock.method(Booking, 'findOneAndUpdate', async filter => {
    assert.equal(filter.paymentStatus, undefined, 'No traveller confirmation should be claimed');
    return booking;
  });
  t.mock.method(Booking, 'updateOne', async () => ({}));
  t.mock.method(booking, 'save', async () => booking);
  t.mock.method(Tour, 'findOne', async () => ({ exclusions: ['Flights'] }));
  const { BookingPaymentLinkRequest } = require('../dist/models/bookingPaymentLinkRequest.model');
  const { BookingBalancePaymentSession } = require('../dist/models/bookingBalancePaymentSession.model');
  t.mock.method(BookingPaymentLinkRequest, 'exists', async () => null);
  t.mock.method(BookingBalancePaymentSession, 'exists', async () => null);
  t.mock.method(require('../dist/utils/jwt'), 'verifyAuthToken', () => ({ userId: 'admin-test', roles: ['admin'] }));
  const req = { params: { id: booking.id }, headers: { authorization: 'Bearer test' }, body: { airFlightCharges: 8000 } };
  let res = response();
  await updateBookingAirFlightCharges(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(booking.grandTotal, 45275);
  assert.equal(booking.balanceAmount, 45275);
  assert.equal(booking.amountPaid, 0);
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(booking.bookingStatus, 'payment_pending');
  assert.equal(booking.airfareHistory.length, 1);
  assert.equal(booking.airfareHistory[0].changedBy, 'admin-test');
  assert.equal(res.body.data.finalPaymentUrl, '');
  req.body.airFlightCharges = 9000;
  res = response();
  await updateBookingAirFlightCharges(req, res);
  assert.equal(booking.grandTotal, 46275);
  assert.equal(booking.balanceAmount, 46275);
  assert.equal(booking.amountPaid, 0);
  assert.equal(booking.airfareHistory.length, 2);
});

for (const scenario of ['online-pending', 'cancelled', 'expired', 'flights-included']) {
  test('airfare remains blocked for ' + scenario, async t => {
  t.mock.method(SmartCollectAccount, "exists", async () => false);
    const { payload } = fixture();
    const booking = new Booking({ ...payload, paymentMode: scenario === 'online-pending' ? 'online' : 'offline',
      paymentStatus: 'pending', bookingStatus: ['cancelled', 'expired'].includes(scenario) ? scenario : 'payment_pending',
      amountPaid: 0, grandTotal: 37275, balanceAmount: 37275, airfareExcluded: scenario !== 'flights-included' });
    t.mock.method(Booking, 'findOneAndUpdate', async () => booking);
    t.mock.method(Booking, 'findById', async () => booking);
    t.mock.method(Booking, 'updateOne', async () => ({}));
    t.mock.method(Tour, 'findOne', async () => ({ inclusions: ['Flights'], exclusions: [] }));
    const req = { params: { id: booking.id }, body: { airFlightCharges: 8000 } };
    await assert.rejects(updateBookingAirFlightCharges(req, response()), scenario === 'flights-included'
      ? /does not explicitly exclude flights/ : /confirmed booking or a pending offline booking/);
    assert.equal(booking.grandTotal, 37275);
  });
}
for (const method of ["cash", "cheque", "bank_transfer", "razorpay", "unpaid_cash"]) {
  test("new admin booking verifies lead and handles " + method + " without inventing payment", async t => {
    const { createBooking } = require("../dist/controllers/booking.controller");
    const { User } = require("../dist/models/user.model");
    const { signAuthToken, signAdminBookingLeadToken } = require("../dist/utils/jwt");
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "admin-booking-test-secret";
    t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
    const { departure, payload } = fixture();
    mockTour(t, departure);
    const admin = new User({ roles: ["super_admin"] });
    const headers = { authorization: "Bearer " + signAuthToken(admin) };
    const leadVerificationToken = signAdminBookingLeadToken(admin.id, "919000000000");
    const paid = ["cash", "cheque"].includes(method);
    const claims = [];
    t.mock.method(Booking, "findOneAndUpdate", async filter => { claims.push(filter); return null; });
    t.mock.method(Booking, "create", async input => {
      const make = values => new Booking({ ...values, bookingReference: "AT-D0123" });
      return Array.isArray(input) ? input.map(make) : make(input);
    });
    const reserve = t.mock.method(TourDeparture, "findOneAndUpdate", async () => ({ ...departure, totalSeats: 1000 }));
    t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
    const req = { headers, body: { ...payload, leadVerificationToken, amountPaid: paid ? 20000 : 0,
      paymentMethod: method === "unpaid_cash" ? "cash" : method } };
    const res = response();
    await createBooking(req, res);
    await new Promise(resolve => setImmediate(resolve));
    const booking = res.body.data.booking;
    assert.equal(booking.amountPaid, paid ? 20000 : 0);
    assert.equal(booking.paymentStatus, paid ? "paid" : "pending");
    assert.equal(booking.bookingStatus, paid ? "confirmed" : "payment_pending");
    assert.equal(booking.paymentMethod, method === "unpaid_cash" ? "cash" : method);
    assert.equal(reserve.mock.callCount(), paid ? 1 : 0);
    assert.equal(claims.length, paid ? 2 : 0, "Both confirmation channels follow recorded payment only");
    await assert.rejects(createBooking({ ...req, body: { ...req.body, leadVerificationToken: undefined } }, response()), /Verify.*OTP/);
    if (!paid && method !== "unpaid_cash") await assert.rejects(createBooking({ ...req, body: { ...req.body, amountPaid: 20000 } }, response()), /verified by the payment provider/);
  });
}

// Delivery lifecycle has its own tests; avoid background SMTP/DB work in these controller fixtures.
const paymentLifecycle = require("../dist/services/booking/booking.payment-lifecycle");
test.beforeEach(t => { t.mock.method(paymentLifecycle, "queueBookingPaymentLifecycle", () => {}); });


for (const scenario of [
  { label: "part-paid booking with sent confirmations", paid: 20000, status: "sent", included: false },
  { label: "part-paid booking with pending confirmations", paid: 20000, status: "pending", included: false },
  { label: "paid package needing a separate airfare link", paid: 37275, status: "sent", included: false },
  { label: "fully paid booking with included airfare", paid: 37275, status: "sent", included: true },
]) {
  test("airfare edit does not reset or send booking confirmations: " + scenario.label, async t => {
    const { payload } = fixture();
    const sentAt = scenario.status === "sent" ? new Date("2040-10-01") : null;
    const booking = new Booking({ ...payload, bookingReference: "AT-D0001", paymentMode: "offline", paymentStatus: "paid",
      bookingStatus: "confirmed", amountPaid: scenario.paid, grandTotal: 37275, balanceAmount: 37275 - scenario.paid,
      airfareExcluded: true, airFlightCharges: 0, emailBookingConfirmationStatus: scenario.status,
      whatsappBookingConfirmationStatus: scenario.status, emailBookingConfirmationSentAt: sentAt,
      whatsappBookingConfirmationSentAt: sentAt });
    let claims = 0;
    t.mock.method(Booking, "findById", async () => booking);
    t.mock.method(Booking, "findOneAndUpdate", async filter => {
      if (filter.paymentStatus) { claims++; return null; }
      return booking;
    });
    t.mock.method(Booking, "updateOne", async () => ({}));
    t.mock.method(booking, "save", async () => booking);
    t.mock.method(Tour, "findOne", async () => ({ exclusions: ["Flights"] }));
    t.mock.method(SmartCollectAccount, "exists", async () => false);
    t.mock.method(require("../dist/models/bookingPaymentLinkRequest.model").BookingPaymentLinkRequest, "exists", async () => null);
    t.mock.method(require("../dist/models/bookingBalancePaymentSession.model").BookingBalancePaymentSession, "exists", async () => null);
    t.mock.method(require("../dist/utils/jwt"), "verifyAuthToken", () => ({ userId: "admin-test", roles: ["admin"] }));
    const lifecycle = t.mock.method(paymentLifecycle, "queueBookingPaymentLifecycle", () => {});
    const res = response();
    await updateBookingAirFlightCharges({ params: { id: booking.id }, headers: { authorization: "Bearer test" },
      body: { airFlightCharges: 8000, airfareIncludedInTotal: scenario.included } }, res);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(res.statusCode, 200);
    assert.equal(claims, 0, "An airfare edit must not claim a new confirmation");
    assert.equal(booking.emailBookingConfirmationStatus, scenario.status);
    assert.equal(booking.whatsappBookingConfirmationStatus, scenario.status);
    assert.equal(booking.emailBookingConfirmationSentAt?.getTime() || null, sentAt?.getTime() || null);
    assert.equal(booking.whatsappBookingConfirmationSentAt?.getTime() || null, sentAt?.getTime() || null);
    assert.equal(booking.amountPaid, scenario.paid);
    assert.equal(booking.grandTotal, scenario.included ? 37275 : 45275);
    assert.equal(booking.balanceAmount, booking.grandTotal - scenario.paid);
    assert.equal(lifecycle.mock.callCount(), scenario.paid === 37275 && !scenario.included ? 1 : 0);
  });
}

for (const gstPercentage of [0, undefined]) {
  test('offline booking ignores client GST ' + gstPercentage + ' and retains server tax', async t => {
    const { departure, payload } = fixture();
    mockTour(t, departure);
    t.mock.method(Booking, 'findOne', async () => null);
    let saved;
    t.mock.method(Booking, 'create', async values => {
      saved = new Booking({ ...values, bookingReference: 'ATTEST' }); return saved;
    });
    t.mock.method(alerts, 'notifyOfflineBookingAdmins', async () => {});
    await createOfflineBooking({ body: { ...payload, gstPercentage } }, response());
    assert.equal(saved.gstPercentage, 5);
    assert.equal(saved.gstAmount, Math.round(saved.subtotal * 0.05));
    assert.equal(saved.grandTotal, saved.subtotal + saved.gstAmount);
    assert.equal(saved.balanceAmount, saved.grandTotal);
  });
}
