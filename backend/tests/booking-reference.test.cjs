const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { BookingReferenceCounter } = require('../dist/models/bookingReferenceCounter.model');
const { allocateBookingReference } = require('../dist/services/booking/booking-reference.service');
const { Booking } = require('../dist/models/booking.model');
const { Tour } = require('../dist/models/tour.model');

test('domestic and international bookings have independent sequential IDs', async t => {
  const values = {};
  t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(update.$inc.value, 1);
    assert.equal(options.upsert, true);
    values[filter._id] = (values[filter._id] || 0) + 1;
    return { value: values[filter._id] };
  });
  assert.equal(await allocateBookingReference('Domestic'), 'AT-D0001');
  assert.equal(await allocateBookingReference('International'), 'AT-I0001');
  assert.equal(await allocateBookingReference(' domestic '), 'AT-D0002');
  assert.equal(await allocateBookingReference('INTERNATIONAL'), 'AT-I0002');
});

test('simultaneous bookings use atomic increments and never reuse reference numbers', async t => {
  let value = 0;
  t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', async () => ({ value: ++value }));
  const references = await Promise.all(Array.from({ length: 100 }, () => allocateBookingReference('Domestic')));
  assert.equal(new Set(references).size, 100);
  assert.equal(references[99], 'AT-D0100');
});

test('counter allocation uses the booking transaction and supports numbers above 9999', async t => {
  const session = {};
  t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(options.session, session);
    return { value: 10000 };
  });
  assert.equal(await allocateBookingReference('International', session), 'AT-I10000');
});

test('a concurrent initial counter insert is retried without resetting the sequence', async t => {
  let calls = 0;
  t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', async (filter, update, options) => {
    calls++;
    if (calls === 1) throw new mongoose.mongo.MongoServerError({ code: 11000, message: 'Concurrent insert' });
    assert.equal(options.upsert, undefined);
    return { value: 2 };
  });
  assert.equal(await allocateBookingReference('Domestic'), 'AT-D0002');
  assert.equal(calls, 2);
});

test('unknown tour types cannot silently receive a domestic ID', async t => {
  const increment = t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', () => { throw Error('Must not increment'); });
  await assert.rejects(allocateBookingReference('Other'), /Domestic or International/);
  assert.equal(increment.mock.callCount(), 0);
});

function bookingDocument(reference) {
  return new Booking({
    bookingReference: reference, tourId: 'TOURTEST', totalGuest: 1, adultCount: 1, childCount: 0,
    childDetails: [], travellers: [],
    guestDetails: [{ title: 'Ms', firstName: 'Test', lastName: 'Traveller', countryCode: '+91',
      mobileNumber: '9000000000', email: 'test@example.com', dateOfBirth: new Date('1990-01-01'),
      gender: 'Female', address: 'Test city' }],
    accommodationDetails: { singleOccupancyOneRoom: 1, singleOccupancyTwoRooms: 0,
      doubleOccupancy: 0, twinOccupancy: 0, tripleOccupancy: 0 },
  });
}

test('actual booking save assigns a reference once and preserves it on later edits', async t => {
  t.mock.method(Tour, 'findOne', () => ({ select: () => ({ session: async () => ({ tourType: 'International' }) }) }));
  const increment = t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', async () => ({ value: 1 }));
  t.mock.method(Booking.collection, 'insertOne', async () => ({ acknowledged: true }));
  t.mock.method(Booking.collection, 'updateOne', async () => ({ acknowledged: true, matchedCount: 1 }));
  const booking = bookingDocument();
  await booking.save();
  assert.equal(booking.bookingReference, 'AT-I0001');
  booking.amountPaid = 20000;
  await booking.save();
  assert.equal(booking.bookingReference, 'AT-I0001');
  assert.equal(increment.mock.callCount(), 1);
});

test('already-issued booking references are preserved', async t => {
  const increment = t.mock.method(BookingReferenceCounter, 'findOneAndUpdate', () => { throw Error('Must not renumber'); });
  t.mock.method(Booking.collection, 'insertOne', async () => ({ acknowledged: true }));
  const booking = bookingDocument('AT-LEGACY');
  await booking.save();
  assert.equal(booking.bookingReference, 'AT-LEGACY');
  assert.equal(increment.mock.callCount(), 0);
});