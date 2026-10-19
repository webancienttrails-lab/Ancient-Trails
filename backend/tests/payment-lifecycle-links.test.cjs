const test = require("node:test");
const assert = require("node:assert/strict");
const Razorpay = require("razorpay");
const { Booking } = require("../dist/models/booking.model");
const { Tour } = require("../dist/models/tour.model");
const { SmartCollectAccount } = require("../dist/models/smartCollect.model");
const { BookingBalancePaymentSession } = require("../dist/models/bookingBalancePaymentSession.model");
const { BookingPaymentLinkRequest: Links } = require("../dist/models/bookingPaymentLinkRequest.model");
const { prepareBookingPaymentLink } = require("../dist/controllers/booking.controller");
function setup(t, options = {}) {
  const previousKey = process.env.RAZORPAY_KEY_ID, previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy"; process.env.RAZORPAY_KEY_SECRET = "test-only";
  t.after(() => { if (previousKey === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = previousKey;
    if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previousSecret; });
  const booking = new Booking({ bookingReference: "AT-D0001", tourId: "TOURTEST", bookingStatus: "confirmed", paymentStatus: "paid",
    grandTotal: 46594, amountPaid: 20000, balanceAmount: 26594,
    guestDetails: [{ title: "Ms", firstName: "Test", lastName: "Traveller", countryCode: "+91", mobileNumber: "9000000000", email: "test@example.com", dateOfBirth: "1990-01-01", gender: "Female", address: "Test city" }],
    totalGuest: 1, adultCount: 1, childCount: 0, childDetails: [], travellers: [], accommodationDetails: {},
  });
  const created = [], cancelled = [];
  t.mock.method(SmartCollectAccount, "exists", async () => options.bankActive || false);
  t.mock.method(BookingBalancePaymentSession, "exists", async () => false);
  t.mock.method(Tour, "findOne", async () => ({ tourName: "Badami Heritage" }));
  const existing = options.existing ? new Links({ bookingId: booking._id, purpose: "final", status: "sent", obligationKey: "final",
    amount: 2659400, amountRupees: 26594, paymentLinkUrl: "https://rzp.io/i/existing", razorpayPaymentLinkId: "plink_existing",
    currency: "INR", purposeLabel: "Final Payment", expiresAt: new Date(Date.now() + 9 * 86400000), ...options.existing }) : null;
  if (existing) t.mock.method(existing, "save", async () => existing);
  t.mock.method(Links, "findOne", () => ({ sort: async () => existing }));
  t.mock.method(Links, "create", async input => new Links(input));
  t.mock.method(Razorpay.prototype, "addResources", function () {
    this.paymentLink = { create: async input => { created.push(input); return { id: "plink_new", short_url: "https://rzp.io/i/new" }; },
      cancel: async id => { cancelled.push(id); } };
  });
  const expiresAt = new Date(Date.now() + 8 * 86400000);
  return { booking, created, cancelled, existing, expiresAt,
    run: () => prepareBookingPaymentLink(booking, { purpose: "final", additionalChargeAlreadyApplied: false, description: "" }, { expiresAt }) };
}

test("scheduled reminders create a normal final payment link for only the saved outstanding balance", async t => {
  const f = setup(t); const result = await f.run();
  assert.equal(f.created.length, 1); assert.equal(f.created[0].amount, 2659400); assert.equal(f.created[0].accept_partial, false);
  assert.equal(f.created[0].expire_by, Math.floor(f.expiresAt.getTime() / 1000));
  assert.equal(result.paymentLinkRequest.purpose, "final"); assert.equal(result.paymentLinkRequest.amountRupees, 26594);
  assert.equal(f.booking.grandTotal, 46594); assert.equal(f.booking.amountPaid, 20000);
});
test("an existing valid final-payment link is reused", async t => {
  const f = setup(t, { existing: {} }); const result = await f.run();
  assert.equal(result.paymentLinkRequest.id, f.existing.id); assert.equal(f.created.length, 0); assert.equal(f.cancelled.length, 0);
});
test("a reminder replaces an active link that would expire before the due date", async t => {
  const f = setup(t, { existing: { expiresAt: new Date(Date.now() + 2 * 86400000) } }); await f.run();
  assert.deepEqual(f.cancelled, ["plink_existing"]); assert.equal(f.created.length, 1); assert.equal(f.existing.status, "cancelled");
});
test("an already expired link is replaced without attempting to cancel it again", async t => {
  const f = setup(t, { existing: { expiresAt: new Date(Date.now() - 86400000) } }); await f.run();
  assert.equal(f.cancelled.length, 0); assert.equal(f.created.length, 1); assert.equal(f.existing.status, "expired");
});
test("a stale final-payment amount is cancelled and replaced with the current balance", async t => {
  const f = setup(t, { existing: { amountRupees: 30000, amount: 3000000 } }); await f.run();
  assert.equal(f.cancelled.length, 1); assert.equal(f.created[0].amount, 2659400);
});
test("an active bank-transfer collection prevents creation of a competing payment link", async t => {
  const f = setup(t, { bankActive: true }); await assert.rejects(f.run(), /active bank-transfer identifier/);
  assert.equal(f.created.length, 0);
});
