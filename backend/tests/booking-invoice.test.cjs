const test = require("node:test");
const assert = require("node:assert/strict");
const { Booking } = require("../dist/models/booking.model");
const { formatBooking } = require("../dist/controllers/booking.controller");
const { bookingInvoicePayloadSchema, updateBookingInvoice } = require("../dist/controllers/bookingInvoice.controller");

const fixture = () => new Booking({
  tourId: "TOURTEST", totalGuest: 1, adultCount: 1, childCount: 0,
  guestDetails: [], childDetails: [], travellers: [], accommodationDetails: {},
  grandTotal: 50000, amountPaid: 50000, paymentStatus: "paid", bookingStatus: "confirmed",
});

test("invoice edits survive booking storage and are returned on reload", () => {
  const original = fixture();
  original.invoiceOverrides = { invoiceNumber: "INV-EDITED", "customer.address": "Line 1\nLine 2", grandTotal: "₹ 60,000" };
  const restored = new Booking(original.toObject());
  assert.deepEqual(formatBooking(restored).invoiceOverrides, original.invoiceOverrides);
  assert.equal(restored.grandTotal, 50000);
  assert.deepEqual(formatBooking(fixture()).invoiceOverrides, {});
});

test("saving an invoice updates only its display fields", async (t) => {
  const booking = fixture();
  const edits = { "customer.name": "Updated Traveller", grandTotal: "₹ 60,000" };
  t.mock.method(Booking, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(String(filter._id), booking.id);
    assert.equal(filter.archivedAt, null);
    assert.deepEqual(update, { $set: { invoiceOverrides: edits } });
    assert.equal(options.runValidators, true);
    booking.invoiceOverrides = update.$set.invoiceOverrides;
    return booking;
  });
  const response = { json(body) { this.body = body; } };
  await updateBookingInvoice({ params: { id: booking.id }, body: { invoiceOverrides: edits } }, response);
  assert.deepEqual(response.body.data.invoiceOverrides, edits);
  assert.equal(booking.grandTotal, 50000);
  assert.equal(booking.amountPaid, 50000);
  assert.equal(booking.bookingStatus, "confirmed");
});

test("empty values and clearing invoice overrides are supported", () => {
  assert.deepEqual(bookingInvoicePayloadSchema.parse({ invoiceOverrides: { footer: "" } }).invoiceOverrides, { footer: "" });
  assert.deepEqual(bookingInvoicePayloadSchema.parse({ invoiceOverrides: {} }).invoiceOverrides, {});
});

test("invalid fields, excessive edits and booking mutations are rejected", () => {
  for (const body of [
    {}, { invoiceOverrides: { footer: 123 } }, { invoiceOverrides: { footer: "x".repeat(4001) } },
    { invoiceOverrides: { "$set": "bad" } }, { invoiceOverrides: {}, amountPaid: 1 },
    { invoiceOverrides: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`field${i}`, "x"])) },
    { invoiceOverrides: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`field${i}`, "x".repeat(4000)])) },
  ]) assert.equal(bookingInvoicePayloadSchema.safeParse(body).success, false);
});

test("invalid, missing and archived bookings cannot be edited", async (t) => {
  await assert.rejects(updateBookingInvoice({ params: { id: "invalid" }, body: { invoiceOverrides: {} } }, {}), /Invalid booking ID/);
  t.mock.method(Booking, "findOneAndUpdate", async () => null);
  await assert.rejects(updateBookingInvoice({ params: { id: fixture().id }, body: { invoiceOverrides: {} } }, {}), /Booking not found/);
});
