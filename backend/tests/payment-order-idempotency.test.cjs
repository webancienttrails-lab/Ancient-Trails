const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const { Booking } = require('../dist/models/booking.model');
const { BookingPaymentSession } = require('../dist/models/bookingPaymentSession.model');
const { Tour } = require('../dist/models/tour.model');
const { TourDeparture } = require('../dist/models/tourDeparture.model');
const { BookingOrderLock, withPaymentOrderLock } = require('../dist/services/booking/booking.order-lock');
const { generateOccupancyOptions } = require('../dist/services/accommodation/accommodation.generator');
const { createBookingPaymentOrder } = require('../dist/controllers/booking.controller');

function setup(t) {
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
  const locks = new Map(), sessions = [];
  let booking, orders = 0, reservations = 0;
  const previous = [process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET];
  process.env.RAZORPAY_KEY_ID = 'rzp_test_fixture';
  process.env.RAZORPAY_KEY_SECRET = 'fixture-secret';
  t.after(() => {
    ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'].forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    });
  });
  t.mock.method(BookingOrderLock, 'create', async doc => {
    if (locks.has(doc._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
    locks.set(doc._id, doc); return doc;
  });
  t.mock.method(BookingOrderLock, 'deleteOne', async filter => {
    if (locks.get(filter._id)?.token === filter.token) locks.delete(filter._id);
  });
  t.mock.method(Tour, 'findOne', async () => ({ tourId: 'TOURTEST', tourName: 'Test tour', inclusions: [], exclusions: [] }));
  t.mock.method(TourDeparture, 'findOne', async () => departure);
  t.mock.method(TourDeparture, 'findOneAndUpdate', async (_, update) => {
    reservations++; departure.seatsAvailable += update.$inc.seatsAvailable; return departure;
  });
  t.mock.method(Booking, 'findOne', () => ({ session: async () => booking || null }));
  t.mock.method(Booking, 'findById', async () => booking);
  t.mock.method(Booking, 'create', async docs => { booking = new Booking(docs[0]); return [booking]; });
  t.mock.method(Booking.prototype, 'save', async function () { return this; });
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
  t.mock.method(BookingPaymentSession, 'find', () => ({ limit: async () => [] }));
  t.mock.method(BookingPaymentSession, 'findOne', async filter => sessions.find(s =>
    filter.idempotencyKeys ? s.idempotencyKeys?.includes(filter.idempotencyKeys)
      : s.requestHash === filter.requestHash && s.status === filter.status) || null);
  t.mock.method(BookingPaymentSession, 'create', async docs => {
    const session = new BookingPaymentSession(docs[0]); sessions.push(session); return [session];
  });
  t.mock.method(BookingPaymentSession, 'updateOne', async (filter, update) => {
    const session = sessions.find(s => s.id === String(filter._id));
    if (!session.idempotencyKeys.includes(update.$addToSet.idempotencyKeys)) session.idempotencyKeys.push(update.$addToSet.idempotencyKeys);
  });
  t.mock.method(Razorpay.prototype, 'addResources', function () {
    this.orders = { create: async () => {
      orders++; await new Promise(resolve => setTimeout(resolve, 20)); return { id: 'order_fixture_' + orders };
    } };
  });
  async function pay(key = 'fixture-payment-key-0001', changes = {}) {
    const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await createBookingPaymentOrder({ body: { ...payload, ...changes }, get: () => key }, response);
    return response.body.data;
  }
  return { pay, payload, sessions, locks, departure, booking: () => booking, counts: () => ({ orders, reservations }) };
}

for (const paymentOption of ['advance', 'full']) {
test(paymentOption + ': rapid concurrent payments create one order and reserve seats once', async t => {
  const f = setup(t);
  const results = await Promise.all([f.pay(undefined, { paymentOption }), f.pay(undefined, { paymentOption }), f.pay(undefined, { paymentOption })]);
  assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
  assert.equal(new Set(results.map(r => r.checkout.orderId)).size, 1);
  assert.equal(f.departure.seatsAvailable, 24);
  assert.equal(f.locks.size, 0);
});
}

test('refresh with a new key reuses the order even when the held seat is the last seat', async t => {
  const f = setup(t), first = await f.pay();
  f.departure.seatsAvailable = 0;
  const second = await f.pay('fixture-payment-key-0002');
  assert.deepEqual(second, first);
  assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
  assert.equal(f.sessions[0].idempotencyKeys.length, 2);
});

test('same payment key cannot change the payment amount or booking details', async t => {
  const f = setup(t); await f.pay();
  await assert.rejects(f.pay(undefined, { paymentOption: 'full' }), e => e.statusCode === 409);
  assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
});

for (const state of ['paid', 'failed', 'expired']) {
  test(state + ' payment keys cannot create another order', async t => {
    const f = setup(t); await f.pay(); f.sessions[0].status = state;
    await assert.rejects(f.pay(), e => e.statusCode === 410);
    assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
  });
}

test('expired seat hold cannot be extended by replaying its payment key', async t => {
  const f = setup(t); await f.pay();
  f.booking().holdExpiresAt = new Date(Date.now() - 1);
  await assert.rejects(f.pay(), e => e.statusCode === 410);
  assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
});

test('legacy callers without a key also reuse a pending order', async t => {
  const f = setup(t), first = await f.pay(null);
  assert.deepEqual(await f.pay(null), first);
  assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
});

test('failed order creation releases the database lock for a safe retry', async t => {
  const f = setup(t);
  await assert.rejects(withPaymentOrderLock('fixture-scope', async () => { throw Error('Fixture failure'); }), /Fixture failure/);
  assert.equal(await withPaymentOrderLock('fixture-scope', async () => 'retried'), 'retried');
  assert.equal(f.locks.size, 0);
});

test('invalid payment keys are rejected before creating an order', async t => {
  const f = setup(t);
  await assert.rejects(f.pay('invalid key'), e => e.statusCode === 400);
  assert.deepEqual(f.counts(), { orders: 0, reservations: 0 });
});

for (const paymentOption of ['advance', 'full']) {
  for (const gstPercentage of [0, 99, undefined, 'invalid']) {
    test(paymentOption + ': client GST ' + gstPercentage + ' cannot change the order amount', async t => {
      const f = setup(t);
      const first = await f.pay(undefined, { paymentOption, gstPercentage });
      const draft = f.sessions[0].bookingDraft;
      assert.equal(draft.gstPercentage, 5);
      assert.equal(draft.gstAmount, Math.round(draft.subtotal * 0.05));
      assert.equal(draft.grandTotal, draft.subtotal + draft.gstAmount);
      assert.equal(first.checkout.amountRupees, paymentOption === 'full' ? draft.grandTotal : draft.depositAmount);
      assert.equal(first.checkout.amount, first.checkout.amountRupees * 100);
      const retry = await f.pay(undefined, { paymentOption, gstPercentage: 5 });
      assert.deepEqual(retry, first, 'Ignored GST changes do not change payment idempotency');
      assert.deepEqual(f.counts(), { orders: 1, reservations: 1 });
    });
  }
}
