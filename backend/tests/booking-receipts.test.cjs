const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Booking } = require("../dist/models/booking.model");
const { BookingPaymentSession } = require("../dist/models/bookingPaymentSession.model");
const { BookingBalancePaymentSession } = require("../dist/models/bookingBalancePaymentSession.model");
const { BookingPaymentLinkRequest } = require("../dist/models/bookingPaymentLinkRequest.model");
const { SmartCollectTransfer } = require("../dist/models/smartCollect.model");
const { BookingReceiptShare } = require("../dist/models/bookingReceiptShare.model");
const service = require("../dist/services/booking/booking.receipts");
const controller = require("../dist/controllers/bookingReceipts.controller");
const date = "2026-11-01T10:00:00.000Z";
const fixture = () => new Booking({ tourId: "TOURTEST", bookingReference: "AT-001", totalGuest: 1, adultCount: 1, childCount: 0,
  guestDetails: [{ firstName: "Traveller", countryCode: "+91", mobileNumber: "9876543210" }],
  childDetails: [], travellers: [], accommodationDetails: {}, grandTotal: 300, amountPaid: 300,
  paymentStatus: "paid", paymentMode: "offline", paymentCapturedAt: new Date(date) });
const payment = (id, amount, paidAt = date) => ({ id, transactionId: id, amount, paidAt, method: "Cash", currency: "INR", description: "Booking payment" });

test("advance and final payments have distinct stable receipts and running balances", () => {
  const booking = fixture();
  const records = [payment("advance", 100), payment("final", 200, "2026-11-02T10:00:00.000Z")];
  const receipts = service.buildBookingReceipts(booking, records);
  assert.deepEqual(receipts.map(r => [r.amount, r.totalPaid, r.balanceAfterPayment]), [[100, 100, 200], [200, 300, 0]]);
  assert.equal(receipts[0].description, "Advance payment");
  assert.equal(receipts[1].description, "Final payment");
  assert.notEqual(receipts[0].receiptNumber, receipts[1].receiptNumber);
  assert.equal(receipts[0].receiptNumber, service.buildBookingReceipts(booking, records.reverse())[0].receiptNumber);
});

test("duplicate transaction sources do not create duplicate receipts", () => {
  const result = service.buildBookingReceipts(fixture(), [payment("p1", 100), { ...payment("p1", 100), id: "duplicate" }, payment("p2", 200)]);
  assert.equal(result.length, 2);
  assert.equal(result[1].totalPaid, 300);
});

test("legacy aggregate payments are explicitly recorded without invented dates or splits", () => {
  const result = service.buildBookingReceipts(fixture(), [payment("known-final", 200)]);
  assert.equal(result.length, 2);
  assert.equal(result[0].amount, 100);
  assert.equal(result[0].paidAt, null);
  assert.equal(result[0].description, "Previously recorded payment");
  const pending = fixture(); pending.amountPaid = 0; pending.paymentStatus = "pending"; pending.paymentCapturedAt = null;
  assert.deepEqual(service.buildBookingReceipts(pending, []), []);
});

test("receipt amounts retain paise accurately", () => {
  const booking = fixture(); booking.grandTotal = 300.75; booking.amountPaid = 300.75;
  assert.deepEqual(service.buildBookingReceipts(booking, [payment("a", 100.25), payment("b", 200.50)])[1].totalPaid, 300.75);
});

test("offline increases keep the original advance and append only the new payment", () => {
  const first = service.offlineReceiptHistory(undefined, 100, "cash", "offline", new Date(date));
  const second = service.offlineReceiptHistory({ amountPaid: 100, paymentMode: "offline", offlinePaymentHistory: first }, 300, "neft", "offline");
  assert.deepEqual(second.map(r => r.amount), [100, 200]);
  assert.equal(second[0].id, first[0].id);
  assert.equal(second[1].method, "neft");
  assert.equal(service.offlineReceiptHistory({ amountPaid: 300, offlinePaymentHistory: second }, 300, "cash", "offline").length, 2);
  assert.deepEqual(service.offlineReceiptHistory(undefined, 100, "razorpay", "online"), []);
});

test("only successful sessions and applied bank funds are used", async t => {
  const booking = fixture(); booking.amountPaid = 100;
  for (const model of [BookingPaymentSession, BookingBalancePaymentSession, BookingPaymentLinkRequest]) {
    t.mock.method(model, "find", filter => { assert.equal(filter.status, "paid"); assert.equal(String(filter.bookingId), booking.id); return { lean: async () => [] }; });
  }
  t.mock.method(SmartCollectTransfer, "find", filter => {
    assert.deepEqual(filter.amountApplied, { $gt: 0 });
    return { lean: async () => [{ _id: "bank-1", paymentId: "pay-1", amount: 15000, amountApplied: 10000, mode: "NEFT", receivedAt: date }] };
  });
  const result = await service.getBookingReceipts(booking);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 100);
});

test("sharing targets the booking lead and stores a hashed, expiring receipt token", async t => {
  const booking = fixture();
  const receipt = service.buildBookingReceipts(booking, [payment("paid", 300)])[0];
  t.mock.method(Booking, "findOne", async () => booking);
  t.mock.method(service, "getBookingReceipts", async () => [receipt]);
  let stored;
  t.mock.method(BookingReceiptShare, "create", async values => { stored = values; return values; });
  const response = { json(body) { this.body = body; } };
  await controller.shareBookingReceipt({ params: { id: booking.id, receiptId: receipt.id },
    protocol: "https", get: () => "receipts.example.test", file: { mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.4\nfixture") } }, response);
  const url = new URL(response.body.data.whatsappUrl);
  assert.equal(url.pathname, "/919876543210");
  const text = url.searchParams.get("text");
  const token = text.match(/payment-receipts\/([a-f0-9]{64})\.pdf/)[1];
  assert.equal(stored.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.ok(stored.expiresAt > new Date());
  assert.equal(stored.receiptId, receipt.id);
  assert.ok(!JSON.stringify(stored).includes(token));
});

test("receipts cannot be shared under another booking or without a valid PDF", async t => {
  const booking = fixture();
  t.mock.method(Booking, "findOne", async () => booking);
  t.mock.method(service, "getBookingReceipts", async () => [payment("real", 300)]);
  await assert.rejects(controller.shareBookingReceipt({ params: { id: booking.id, receiptId: "other" } }, {}), /Payment receipt not found/);
  await assert.rejects(controller.shareBookingReceipt({ params: { id: booking.id, receiptId: "real" }, file: { mimetype: "application/pdf", buffer: Buffer.from("not a PDF") } }, {}), /valid receipt PDF/);
});

test("shared receipt downloads reject expired tokens and request private responses", async t => {
  t.mock.method(BookingReceiptShare, "findOne", query => {
    assert.ok(query.expiresAt.$gt instanceof Date);
    return { select: async () => null };
  });
  await assert.rejects(controller.downloadSharedBookingReceipt({ params: { token: "a".repeat(64) } }, {}), /invalid or expired/);
  await assert.rejects(controller.downloadSharedBookingReceipt({ params: { token: "guess" } }, {}), /invalid or expired/);
});

test("localhost and insecure addresses are rejected for WhatsApp downloads", () => {
  if (process.env.PAYMENT_RECEIPT_PUBLIC_BASE_URL) return;
  for (const [protocol, host] of [["http", "example.test"], ["https", "localhost"], ["https", "192.168.1.10"]]) {
    assert.throws(() => controller.receiptShareBaseUrl({ protocol, get: () => host }), /public HTTPS/);
  }
});

test("valid shared PDFs are returned privately without exposing other booking data", async t => {
  const pdf = Buffer.from("%PDF-1.4\nprivate receipt");
  t.mock.method(BookingReceiptShare, "findOne", () => ({ select: async () => ({ bookingId: fixture()._id, filename: "receipt.pdf", pdf }) }));
  t.mock.method(Booking, "exists", async () => ({ _id: fixture()._id }));
  const response = { set(headers) { this.headers = headers; }, send(body) { this.body = body; } };
  await controller.downloadSharedBookingReceipt({ params: { token: "b".repeat(64) } }, response);
  assert.equal(response.headers["Content-Type"], "application/pdf");
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.match(response.headers["Content-Disposition"], /attachment/);
  assert.deepEqual(response.body, pdf);
});

test("listing and sharing receipts require admin access", () => {
  const router = require("../dist/routes/booking.routes").default;
  const auth = router.stack.findIndex(layer => layer.handle.name === "requireAdmin");
  for (const route of ["/:id/receipts", "/:id/receipts/:receiptId/share"]) {
    assert.ok(router.stack.findIndex(layer => layer.route?.path === route) > auth);
  }
  assert.ok(auth >= 0);
});

test("travellers can load only receipts belonging to their verified lead phone", async t => {
  const { mockBookingTraveller, bookingRequest, bookingResponse } = require("./helpers/booking-access.cjs");
  mockBookingTraveller(t, { mobileNumber: "919876543210" });
  const booking = fixture();
  t.mock.method(Booking, "findOne", async filter => {
    assert.equal(String(filter._id), booking.id);
    assert.ok(filter["guestDetails.0.mobileNumber"]);
    return booking;
  });
  const receipts = service.buildBookingReceipts(booking, [payment("advance", 100), payment("final", 200)]);
  t.mock.method(service, "getBookingReceipts", async () => receipts);
  const response = bookingResponse();
  await controller.listTravellerPaymentReceipts(bookingRequest(booking.id), response);
  assert.deepEqual(response.body.data.receipts, receipts);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
});

test("other travellers and unverified phones cannot access payment receipts", async t => {
  const { mockBookingTraveller, bookingRequest, bookingResponse } = require("./helpers/booking-access.cjs");
  const user = mockBookingTraveller(t, { mobileNumber: "919000000000" });
  const booking = fixture();
  t.mock.method(Booking, "findOne", async () => booking);
  await assert.rejects(controller.listTravellerPaymentReceipts(bookingRequest(booking.id), bookingResponse()), /not found for this account/);
  user.isMobileVerified = false;
  await assert.rejects(controller.listTravellerPaymentReceipts(bookingRequest(booking.id), bookingResponse()), /Verify your mobile/);
  await assert.rejects(controller.listTravellerPaymentReceipts(bookingRequest(booking.id, false), bookingResponse()), /sign in|authorization|session/i);
});
