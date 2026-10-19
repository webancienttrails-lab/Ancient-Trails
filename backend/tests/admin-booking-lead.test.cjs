const test = require("node:test");
const assert = require("node:assert/strict");
const { User } = require("../dist/models/user.model");
const otp = require("../dist/services/msg91.service");
const { signAuthToken, signAdminBookingLeadToken, verifyAdminBookingLeadToken } = require("../dist/utils/jwt");
const { requestAdminBookingLeadOtp, verifyAdminBookingLeadOtp, assertAdminLeadVerification } = require("../dist/controllers/bookingLead.controller");
const { verifiedPaymentMethod } = require("../dist/services/booking/booking.payment-method");
function setup(t) {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "lead-verification-test-secret";
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const admin = new User({ roles: ["super_admin"] });
  return { admin, headers: { authorization: "Bearer " + signAuthToken(admin) } };
}
const response = () => ({ body: null, json(body) { this.body = body; } });

test("admin verification sends OTP and returns only the matching traveller profile after successful verification", async t => {
  const { headers } = setup(t);
  const user = new User({ firstName: "Known", lastName: "Traveller", email: "known@example.com", mobileNumber: "919000000000", roles: ["traveller"], status: "active", gender: "Female", dateOfBirth: "1990-01-01" });
  t.mock.method(User, "findOne", async filter => { assert.equal(filter.mobileNumber, user.mobileNumber); return user; });
  const send = t.mock.method(otp, "sendOtp", async number => { assert.equal(number, user.mobileNumber); });
  t.mock.method(otp, "verifyOtp", async (number, code) => { assert.equal(number, user.mobileNumber); assert.equal(code, "123456"); });
  const lead = { countryCode: "+91", mobileNumber: "9000000000" };
  const sent = response(); await requestAdminBookingLeadOtp({ headers, body: lead }, sent);
  assert.equal(send.mock.callCount(), 1); assert.equal(sent.body.data.traveller, undefined);
  const verified = response(); await verifyAdminBookingLeadOtp({ headers, body: { ...lead, otp: "123456" } }, verified);
  assert.equal(verified.body.data.traveller.email, user.email);
  assert.equal(verified.body.data.traveller.passwordHash, undefined);
  assertAdminLeadVerification({ headers }, lead, verified.body.data.verificationToken);
  assert.throws(() => assertAdminLeadVerification({ headers }, { ...lead, mobileNumber: "9000000001" }, verified.body.data.verificationToken), /Verify/);
});

test("a lead OTP receipt is purpose-bound and admin-bound", t => {
  const { admin } = setup(t);
  const receipt = signAdminBookingLeadToken(admin.id, "919000000000");
  assert.doesNotThrow(() => verifyAdminBookingLeadToken(receipt, admin.id, "919000000000"));
  assert.throws(() => verifyAdminBookingLeadToken(receipt, "another-admin", "919000000000"), /Verify/);
  assert.throws(() => verifyAdminBookingLeadToken(signAuthToken(admin), admin.id, "919000000000"), /Verify/);
});

test("invalid OTP never returns autofill information", async t => {
  const { headers } = setup(t);
  t.mock.method(otp, "verifyOtp", async () => { throw Error("Invalid OTP"); });
  const lookup = t.mock.method(User, "findOne", async () => null);
  await assert.rejects(verifyAdminBookingLeadOtp({ headers, body: { countryCode: "+91", mobileNumber: "9000000000", otp: "123456" } }, response()), /Invalid OTP/);
  assert.equal(lookup.mock.callCount(), 0);
});

test("verified online methods are preserved and unknown methods are never labelled cash or UPI", () => {
  for (const method of ["UPI", "netbanking", "card", "NEFT", "RTGS", "IMPS"]) assert.equal(verifiedPaymentMethod(method), method.toLowerCase());
  assert.equal(verifiedPaymentMethod(undefined), "razorpay");
  assert.equal(verifiedPaymentMethod(undefined, "bank_transfer"), "bank_transfer");
});

for (const method of ["upi", "netbanking", "card"]) {
  test("signed Razorpay " + method + " capture persists the actual method and queues both confirmations", async t => {
    const crypto = require("node:crypto");
    const mongoose = require("mongoose");
    const { Booking } = require("../dist/models/booking.model");
    const { BookingPaymentSession } = require("../dist/models/bookingPaymentSession.model");
    const { verifyRazorpayWebhook } = require("../dist/controllers/booking.controller");
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "method-webhook-test";
    t.after(() => { if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET; else process.env.RAZORPAY_WEBHOOK_SECRET = previous; });
    const booking = new Booking({ bookingReference: "AT-D0001", tourId: "TOURTEST", departureId: "DEPTEST", totalGuest: 1, adultCount: 1, childCount: 0,
      guestDetails: [], childDetails: [], travellers: [], accommodationDetails: {}, grandTotal: 1000,
      heldSeatCount: 1, holdExpiresAt: new Date(Date.now() + 600000), bookingStatus: "payment_pending", paymentStatus: "pending" });
    const session = { _id: new mongoose.Types.ObjectId(), bookingId: booking._id, razorpayOrderId: "order_test", amountRupees: 400, currency: "INR", bookingDraft: { grandTotal: 1000 } };
    t.mock.method(BookingPaymentSession, "findOne", async () => session);
    t.mock.method(BookingPaymentSession, "updateOne", async () => ({}));
    t.mock.method(Booking, "findById", () => ({ session: async () => booking }));
    t.mock.method(booking, "save", async () => booking);
    t.mock.method(mongoose, "startSession", async () => ({ withTransaction: async fn => fn(), endSession: async () => {} }));
    const claims = [];
    t.mock.method(Booking, "findOneAndUpdate", async filter => { claims.push(filter); return null; });
    const raw = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_test", order_id: "order_test", amount: 40000, currency: "INR", status: "captured", method } } } }));
    const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
    const res = { status() { return this; }, json() {} };
    await verifyRazorpayWebhook({ body: raw, headers: { "x-razorpay-signature": signature } }, res);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(booking.paymentMethod, method);
    assert.equal(booking.paymentProvider, "razorpay");
    assert.equal(booking.amountPaid, 400);
    assert.equal(claims.length, 2);
  });
}

// Delivery lifecycle has its own tests; avoid background SMTP/DB work in these controller fixtures.
const paymentLifecycle = require("../dist/services/booking/booking.payment-lifecycle");
test.beforeEach(t => { t.mock.method(paymentLifecycle, "queueBookingPaymentLifecycle", () => {}); });
