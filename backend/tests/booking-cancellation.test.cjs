const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const axios = require("axios");
const { Booking } = require("../dist/models/booking.model");
const { TourDeparture } = require("../dist/models/tourDeparture.model");
const { BookingPaymentSession } = require("../dist/models/bookingPaymentSession.model");
const { BookingPaymentLinkRequest } = require("../dist/models/bookingPaymentLinkRequest.model");
const { cancelPendingBooking } = require("../dist/controllers/booking.controller");

const payload = { reason: "Customer cannot travel", chargePercentage: 30, requestedBy: "Customer", notes: "Discussed with guest" };
const response = () => ({ status() { return this; }, json(body) { this.body = body; } });

function setup(t, overrides = {}, missingDeparture = false) {
  const booking = new Booking({
    tourId: "TOURTEST", departureId: "DEPTEST", totalGuest: 2, adultCount: 2, childCount: 0,
    childDetails: [], guestDetails: [], travellers: [], accommodationDetails: {},
    bookingStatus: "confirmed", paymentStatus: "paid", amountPaid: 10000, grandTotal: 20000,
    ...overrides,
  });
  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  let savedBooking = 0, savedDeparture = 0;
  const departure = { seatsAvailable: 18, totalSeats: 20, async save(options) {
    assert.equal(options.session, session); savedDeparture++;
  } };
  t.mock.method(mongoose, "startSession", async () => session);
  t.mock.method(Booking, "findById", () => ({ session: async value => {
    assert.equal(value, session); return booking;
  } }));
  t.mock.method(booking, "save", async options => {
    assert.equal(options.session, session); savedBooking++;
  });
  t.mock.method(TourDeparture, "findOne", () => ({
    session: async value => { assert.equal(value, session); return missingDeparture ? null : departure; },
    select() { return this; },
    lean: async () => missingDeparture ? null : departure,
  }));
  const sessions = t.mock.method(BookingPaymentSession, "updateMany", async (_, update, options) => {
    assert.equal(options.session, session); assert.equal(update.$set.status, "expired");
  });
  const links = t.mock.method(BookingPaymentLinkRequest, "updateMany", async (_, update, options) => {
    assert.equal(options.session, session); assert.equal(update.$set.status, "cancelled");
  });
  for (const name of ["request", "post", "get"]) t.mock.method(axios, name, () => { throw Error("Cancellation must not contact Razorpay"); });
  return { booking, departure, sessions, links, counts: () => ({ savedBooking, savedDeparture }) };
}

test("confirmed cancellation records required fields, releases seats, and leaves payment/refunds unchanged", async t => {
  const state = setup(t);
  const res = response();
  await cancelPendingBooking({ params: { id: state.booking.id }, body: payload }, res);
  assert.equal(state.booking.bookingStatus, "cancelled");
  assert.equal(state.booking.cancellation.reason, payload.reason);
  assert.equal(state.booking.cancellation.chargePercentage, 30);
  assert.equal(state.booking.cancellation.requestedBy, "Customer");
  assert.ok(state.booking.cancellation.cancelledAt instanceof Date);
  assert.equal(state.booking.paymentStatus, "paid");
  assert.equal(state.booking.amountPaid, 10000);
  assert.equal(state.booking.grandTotal, 20000);
  assert.equal(state.booking.recoveryEmailStatus, "disabled");
  assert.equal(state.booking.whatsappRecoveryStatus, "disabled");
  assert.deepEqual(res.body.data.availability, { departureId: "DEPTEST", seatsReleased: 2, seatsAvailable: 20 });
  assert.equal(res.body.data.booking.cancellation.chargePercentage, 30);
  assert.deepEqual(state.counts(), { savedBooking: 1, savedDeparture: 1 });
  assert.equal(state.sessions.mock.callCount(), 1);
  assert.equal(state.links.mock.callCount(), 1);
});

test("repeated cancellation releases seats once and preserves the original reason and charges", async t => {
  const state = setup(t);
  await cancelPendingBooking({ params: { id: state.booking.id }, body: payload }, response());
  const res = response();
  await cancelPendingBooking({ params: { id: state.booking.id }, body: { ...payload, reason: "Changed", chargePercentage: 100 } }, res);
  assert.equal(res.body.data.availability.seatsReleased, 0);
  assert.equal(state.departure.seatsAvailable, 20);
  assert.equal(state.booking.cancellation.chargePercentage, 30);
  assert.equal(state.booking.cancellation.reason, payload.reason);
  assert.deepEqual(state.counts(), { savedBooking: 1, savedDeparture: 1 });
});

for (const expired of [false, true]) {
  test("pending cancellation releases an unreleased " + (expired ? "expired" : "active") + " seat hold", async t => {
    const state = setup(t, { paymentStatus: "pending", bookingStatus: "payment_pending", heldSeatCount: 2,
      holdExpiresAt: new Date(Date.now() + (expired ? -60000 : 60000)) });
    await cancelPendingBooking({ params: { id: state.booking.id }, body: payload }, response());
    assert.equal(state.departure.seatsAvailable, 20);
    assert.equal(state.booking.heldSeatCount, 0);
    assert.equal(state.booking.holdExpiresAt, null);
  });
}

test("unpaid offline request does not create seats that were never reserved", async t => {
  const state = setup(t, { paymentStatus: "pending", bookingStatus: "payment_pending", paymentMode: "offline", heldSeatCount: 0 });
  const res = response();
  await cancelPendingBooking({ params: { id: state.booking.id }, body: { ...payload, chargePercentage: 0 } }, res);
  assert.equal(state.departure.seatsAvailable, 18);
  assert.equal(res.body.data.availability.seatsReleased, 0);
  assert.equal(state.counts().savedDeparture, 0);
});

test("invalid cancellation fields are rejected before opening a database transaction", async t => {
  const start = t.mock.method(mongoose, "startSession", () => { throw Error("Must not open transaction"); });
  for (const body of [{}, { ...payload, reason: " " }, { ...payload, chargePercentage: -1 },
    { ...payload, chargePercentage: 101 }, { ...payload, chargePercentage: 10.5 },
    { ...payload, chargePercentage: "30" }, { ...payload, requestedBy: "Unknown" }]) {
    await assert.rejects(cancelPendingBooking({ body }, response()), /Provide a cancellation reason/);
  }
  assert.equal(start.mock.callCount(), 0);
});

test("expired bookings cannot be cancelled or release seats again", async t => {
  const state = setup(t, { bookingStatus: "expired", paymentStatus: "pending" });
  await assert.rejects(cancelPendingBooking({ params: { id: state.booking.id }, body: payload }, response()), /Expired bookings/);
  assert.deepEqual(state.counts(), { savedBooking: 0, savedDeparture: 0 });
});

test("missing reserved departure prevents cancellation instead of losing reserved seats", async t => {
  const state = setup(t, {}, true);
  await assert.rejects(cancelPendingBooking({ params: { id: state.booking.id }, body: payload }, response()), /seats could not be released/);
  assert.equal(state.booking.bookingStatus, "confirmed");
  assert.equal(state.counts().savedBooking, 0);
});
