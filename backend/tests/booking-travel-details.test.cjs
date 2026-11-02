const test = require('node:test');
const assert = require('node:assert/strict');
const { Booking } = require('../dist/models/booking.model');
const { updateBookingTravelDetails, formatBooking } = require('../dist/controllers/booking.controller');
const { bookingTravelDetailsSchema } = require('../dist/services/booking/booking.travel-details');
const hotel = { destination: 'Badami, Karnataka', hotel: 'Heritage Hotel', category: 'Deluxe double', nights: 5 };
const flight = { from: 'Mumbai', to: 'Hubli', airline: 'Air India AI 123', seats: 2, dateTime: '2026-12-13T09:30' };
const fixture = () => new Booking({ tourId: 'TOURTEST', guestDetails: [], childDetails: [], travellers: [], accommodationDetails: {}, totalGuest: 2, adultCount: 2, childCount: 0, grandTotal: 50000, amountPaid: 20000, hotelDetails: [hotel], flightDetails: [flight] });

test('travel details are stored in the booking schema and exposed to vouchers', () => {
  const booking = fixture();
  const restored = new Booking(booking.toObject());
  const result = JSON.parse(JSON.stringify(formatBooking(restored)));
  assert.deepEqual(result.hotelDetails, [hotel]);
  assert.deepEqual(result.flightDetails, [flight]);
  assert.equal(result.grandTotal, 50000);
  assert.deepEqual(formatBooking(new Booking({ ...fixture().toObject(), hotelDetails: undefined, flightDetails: undefined })).hotelDetails, []);
});

test('saving hotels changes only that booking and leaves flights and totals alone', async t => {
  const booking = fixture();
  t.mock.method(Booking, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(String(filter._id), booking.id);
    assert.equal(filter.archivedAt, null);
    assert.deepEqual(update, { $set: { hotelDetails: [{ ...hotel, hotel: 'Updated Hotel' }] } });
    assert.equal(options.runValidators, true);
    booking.hotelDetails = update.$set.hotelDetails;
    return booking;
  });
  const res = { json(value) { this.body = value; } };
  await updateBookingTravelDetails({ params: { id: booking.id }, body: { hotelDetails: [{ ...hotel, hotel: ' Updated Hotel ' }] } }, res);
  assert.equal(res.body.data.booking.hotelDetails[0].hotel, 'Updated Hotel');
  assert.equal(res.body.data.booking.flightDetails[0].airline, flight.airline);
  assert.equal(res.body.data.booking.amountPaid, 20000);
});

test('flight details support multiple legs and can be explicitly cleared', () => {
  assert.equal(bookingTravelDetailsSchema.parse({ flightDetails: [flight, { ...flight, from: flight.to, to: flight.from }] }).flightDetails.length, 2);
  assert.deepEqual(bookingTravelDetailsSchema.parse({ flightDetails: [] }), { flightDetails: [] });
});

test('invalid counts, dates, oversized lists and payment changes are rejected', () => {
  for (const payload of [{}, { grandTotal: 1 }, { hotelDetails: [{ ...hotel, nights: 0 }] }, { hotelDetails: [{ ...hotel, hotel: ' ' }] }, { flightDetails: [{ ...flight, seats: 1.5 }] }, { flightDetails: [{ ...flight, dateTime: '2026-02-30T09:30' }] }, { hotelDetails: Array(51).fill(hotel) }]) {
    assert.equal(bookingTravelDetailsSchema.safeParse(payload).success, false);
  }
});

test('missing bookings and invalid IDs fail without updating another booking', async t => {
  const query = t.mock.method(Booking, 'findOneAndUpdate', async () => null);
  await assert.rejects(updateBookingTravelDetails({ params: { id: 'invalid' }, body: { hotelDetails: [] } }, {}), /Invalid booking ID/);
  assert.equal(query.mock.callCount(), 0);
  await assert.rejects(updateBookingTravelDetails({ params: { id: fixture().id }, body: { hotelDetails: [] } }, {}), /Booking not found/);
});

test('travel details endpoint is protected by the admin middleware', () => {
  const router = require('../dist/routes/booking.routes').default;
  const auth = router.stack.findIndex(layer => layer.handle.name === 'requireAdmin');
  const update = router.stack.findIndex(layer => layer.route?.path === '/:id/travel-details');
  assert.ok(auth >= 0 && update > auth);
  assert.equal(router.stack[update].route.methods.patch, true);
});
