const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Booking } = require("../dist/models/booking.model");
const { User } = require("../dist/models/user.model");
const { Tour } = require("../dist/models/tour.model");
const { Notification, NotificationEvent, PushRegistration, PushDelivery } = require("../dist/models/notification.model");
const security = require("../dist/services/notifications/notification-security");
const policy = require("../dist/services/notifications/notification-policy");
const events = require("../dist/services/notifications/notification-events.service");
const worker = require("../dist/services/notifications/notification-worker.service");
const controller = require("../dist/controllers/notification.controller");
const bookings = require("../dist/controllers/booking.controller");
const jwt = require("../dist/utils/jwt");
const now = new Date("2040-12-06T06:00:00Z"), activation = new Date("2040-12-01T00:00:00Z");
function query(value) { return { then(a, b) { return Promise.resolve(value).then(a, b); }, select() { return this; }, lean() { return this; }, sort() { return this; }, limit() { return this; } }; }
function booking(changes = {}) { return new Booking({ tourId: "TOURTEST", bookingReference: "AT-D0001", totalGuest: 1, adultCount: 1, childCount: 0,
  guestDetails: [{ title: "Ms", firstName: "Test", lastName: "Traveller", countryCode: "+91", mobileNumber: "9000000000", email: "test@example.com", dateOfBirth: new Date("1990-01-01"), gender: "Female", address: "Test" }],
  childDetails: [], travellers: [], accommodationDetails: {}, grandTotal: 46594, amountPaid: 20000, balanceAmount: 26594,
  balanceDueDate: new Date("2040-12-13"), paymentCapturedAt: now, bookingStatus: "confirmed", paymentStatus: "paid", paymentMode: "online", createdAt: now, ...changes }); }
function response(audience = "customer", recipientId = "user-one") { return { locals: { notificationOwner: { audience, recipientId } }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function setEnv(t, name, value) { const previous = process.env[name]; process.env[name] = value; t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; }); }
function env(t) { setEnv(t, "JWT_SECRET", "notification-test-key-never-a-production-secret"); setEnv(t, "PUSH_REGISTRATION_ENCRYPTION_KEY", "notification-test-encryption-key"); }

test("push identifiers use authenticated encryption and keyed hashes", t => {
  env(t); const fid = "c1234567890123456789012", encrypted = security.encryptRegistration(fid);
  assert.equal(security.decryptRegistration(encrypted), fid); assert(!encrypted.includes(fid));
  assert.notEqual(encrypted, security.encryptRegistration(fid));
  const [iv, tag, cipher] = encrypted.split("."); const bytes = Buffer.from(cipher, "base64url"); bytes[0] ^= 1;
  assert.throws(() => security.decryptRegistration([iv, tag, bytes.toString("base64url")].join(".")));
  assert.equal(security.registrationHash(fid), security.registrationHash(fid));
  assert.notEqual(security.registrationHash(fid), crypto.createHash("sha256").update(fid).digest("hex"));
});
test("notification URLs cannot leave the correct application or inject another origin", () => {
  for (const path of ["https://evil.test", "//evil.test", "/me/\\evil", "/me//evil", "/bookings"]) assert.equal(security.safeNotificationUrl(path, "customer"), "/me");
  assert.equal(security.safeNotificationUrl("/me/bookings/abc", "customer"), "/me/bookings/abc");
  assert.equal(security.safeNotificationUrl("/users", "admin"), "/users");
  assert.equal(security.safeNotificationUrl("/me", "admin"), "/bookings");
});
test("only invalid registrations deactivate; server and configuration errors retry with backoff", () => {
  assert(security.invalidRegistrationCode("messaging/registration-token-not-registered"));
  assert(security.invalidRegistrationCode("messaging/installation-id-not-registered"));
  assert(!security.invalidRegistrationCode("messaging/invalid-argument"));
  assert(!security.invalidRegistrationCode("messaging/server-unavailable"));
  assert(security.retryDate(1, now).getTime() >= now.getTime() + 60000);
  assert(security.retryDate(5, now).getTime() >= now.getTime() + 960000);
});
test("pending online or bank details never count as confirmed payments", () => {
  for (const mode of ["online", "bank_transfer"]) assert.equal(policy.bookingNotificationEvents(booking({ paymentMode: mode, bookingStatus: "payment_pending", paymentStatus: "pending", amountPaid: 0 }), activation, now).length, 0);
});
test("offline verification alerts precede confirmation and confirmed events cover every payment channel", () => {
  assert.deepEqual(policy.bookingNotificationEvents(booking({ paymentMode: "offline", bookingStatus: "payment_pending", paymentStatus: "pending", amountPaid: 0 }), activation, now).map(event => event.kind), ["offline_payment_pending"]);
  for (const mode of ["online", "offline", "bank_transfer"]) {
    const kinds = policy.bookingNotificationEvents(booking({ paymentMode: mode }), activation, now).map(event => event.kind);
    assert(kinds.includes("booking_confirmed")); assert(kinds.includes("advance_payment_received"));
  }
});
test("seven-day reminders reuse India-calendar due dates and stop for full, cancelled and overdue bookings", () => {
  const current = booking(); const hasReminder = (value, at = now) => policy.bookingNotificationEvents(value, activation, at).some(event => event.kind === "remaining_payment_reminder");
  assert(hasReminder(current)); assert(!hasReminder(current, new Date("2040-12-05T06:00:00Z")));
  assert(hasReminder(current, new Date("2040-12-05T18:31:00Z")));
  assert(!hasReminder(current, new Date("2040-12-14T06:00:00Z")));
  assert(!hasReminder(booking({ amountPaid: 46594, balanceAmount: 0 })));
  assert(!hasReminder(booking({ bookingStatus: "cancelled" })));
});
test("fare changes never produce a new payment event; later actual receipts do", () => {
  const current = booking({ amountPaid: 46594, balanceAmount: 0 });
  const first = policy.bookingNotificationEvents(current, activation, now).find(event => event.kind === "full_payment_received");
  current.grandTotal += 10000; current.balanceAmount = 10000;
  const afterFare = policy.bookingNotificationEvents(current, activation, now).find(event => event.kind === "advance_payment_received");
  assert.equal(first.key, afterFare.key);
  current.amountPaid += 10000; current.paymentCapturedAt = new Date(now.getTime() + 1000);
  const receipt = policy.bookingNotificationEvents(current, activation, now).find(event => event.kind === "full_payment_received");
  assert.notEqual(first.key, receipt.key);
});
test("deployment does not replay historical payments or registrations", () => {
  const value = booking({ createdAt: new Date("2039-01-01"), paymentCapturedAt: new Date("2039-01-01"), balanceDueDate: new Date("2041-01-01") });
  assert.deepEqual(policy.bookingNotificationEvents(value, activation, now), []);
});
test("cancellation event is stable and suppresses payment/reminder events", () => {
  const value = booking({ bookingStatus: "cancelled", cancellation: { cancelledAt: now, reason: "Customer request", chargePercentage: 0, requestedBy: "Customer", notes: "" } });
  assert.deepEqual(policy.bookingNotificationEvents(value, activation, now).map(event => event.kind), ["booking_cancelled"]);
  assert.equal(policy.bookingNotificationEvents(value, activation, now)[0].key, policy.bookingNotificationEvents(value, activation, new Date())[0].key);
});
test("recipient resolution requires the verified lead phone, never editable email", async t => {
  const current = booking(); let filter;
  t.mock.method(User, "findOne", value => { filter = value; return query(null); });
  assert.equal(await worker.bookingNotificationCustomer(current), null);
  assert.equal(filter.mobileNumber, "919000000000"); assert.equal(filter.isMobileVerified, true); assert(!("email" in filter));
  current.notificationOwnerId = "111111111111111111111111";
  await worker.bookingNotificationCustomer(current); assert.equal(String(filter._id), "111111111111111111111111"); assert(!("mobileNumber" in filter));
});
test("event and per-device fanout are idempotent across duplicate webhook processing", async t => {
  const eventRows = new Map(), notices = new Map(), deliveries = new Map();
  function upsert(map) { return async (filter, update) => { if (!map.has(filter._id)) map.set(filter._id, { _id: filter._id, ...update.$setOnInsert }); return {}; }; }
  t.mock.method(NotificationEvent, "updateOne", upsert(eventRows));
  await events.stageNotificationEvent("same-receipt", "full_payment_received", { bookingId: "one" });
  await events.stageNotificationEvent("same-receipt", "full_payment_received", { bookingId: "one" }); assert.equal(eventRows.size, 1);
  t.mock.method(Booking, "findById", async () => booking({ notificationOwnerId: "222222222222222222222222" }));
  t.mock.method(Tour, "findOne", async () => ({ tourName: "Test tour" }));
  t.mock.method(User, "find", async () => [{ id: "admin" }]); t.mock.method(User, "findOne", async () => ({ id: "customer" }));
  t.mock.method(Notification, "updateOne", upsert(notices)); t.mock.method(PushDelivery, "updateOne", upsert(deliveries));
  t.mock.method(PushRegistration, "find", async filter => [{ id: filter.userId + "-phone", bindingId: "phone" }, { id: filter.userId + "-laptop", bindingId: "laptop" }]);
  const event = { _id: "payment-event", kind: "full_payment_received", payload: { bookingId: "one", amountPaid: 46594 }, createdAt: now };
  await worker.materializeNotificationEvent(event); await worker.materializeNotificationEvent(event);
  assert.equal(notices.size, 2); assert.equal(deliveries.size, 4);
  assert.equal([...notices.values()].filter(notice => notice.audience === "customer").length, 1);
});
test("inbox listing, counts, single read and bulk read always constrain recipient and audience", async t => {
  const filters = []; t.mock.method(Notification, "find", filter => { filters.push(filter); return query([]); });
  t.mock.method(Notification, "countDocuments", async filter => { filters.push(filter); return 0; });
  t.mock.method(Notification, "findOneAndUpdate", async filter => { filters.push(filter); return null; });
  t.mock.method(Notification, "updateMany", async filter => { filters.push(filter); return {}; });
  await controller.listNotifications({ query: { recipientId: "other-user" } }, response());
  await assert.rejects(controller.readNotification({ params: { id: "another-notice" }, body: { read: true } }, response()), /not found/);
  await controller.readAllNotifications({}, response());
  assert.equal(filters.length, 4); for (const filter of filters) { assert.equal(filter.recipientId, "user-one"); assert.equal(filter.audience, "customer"); }
});
test("authentication uses current database roles/status and rejects recipient impersonation", async t => {
  env(t); const token = jwt.signAuthToken({ _id: "user-one", roles: ["super_admin"] });
  t.mock.method(User, "findById", async () => ({ id: "user-one", status: "active", roles: ["traveller"] }));
  let error; await controller.requireNotificationUser({ params: { audience: "admin" }, headers: { authorization: "Bearer " + token } }, response(), value => { error = value; });
  assert(error); assert.equal(error.statusCode, 403);
  const res = response(); error = undefined;
  await controller.requireNotificationUser({ params: { audience: "customer" }, headers: { authorization: "Bearer " + token } }, res, value => { error = value; });
  assert.equal(error, undefined); assert.equal(res.locals.notificationOwner.recipientId, "user-one");
});
test("a Firebase installation cannot be stolen without its browser capability", async t => {
  env(t); t.mock.method(PushRegistration, "findOne", () => query({ userId: "other-user", deviceKeyHash: security.registrationHash("a".repeat(64)) }));
  await assert.rejects(controller.registerPush({ body: { fid: "c123456789012345678901", deviceKey: "b".repeat(64) } }, response()), /already bound/);
});
test("browser registration is encrypted, binds to the signed-in recipient and rotates account bindings", async t => {
  env(t); const fid = "c123456789012345678901", key = "a".repeat(64); let stored;
  t.mock.method(PushRegistration, "findOne", () => query({ _id: "device", userId: "old-user", deviceKeyHash: security.registrationHash(key), bindingId: "old-binding", active: true }));
  t.mock.method(PushRegistration, "findOneAndUpdate", async (filter, update) => { assert.equal(filter.userId, "old-user"); stored = update.$set; return { _id: "device", ...stored }; });
  t.mock.method(PushRegistration, "updateMany", async () => ({}));
  const res = response(); await controller.registerPush({ body: { fid, deviceKey: key, userId: "forged-user" } }, res);
  assert.equal(stored.userId, "user-one"); assert.notEqual(stored.bindingId, "old-binding"); assert.equal(security.decryptRegistration(stored.encryptedIdentifier), fid);
  assert.deepEqual(Object.keys(res.body.data), ["bindingId"]);
});
test("stale or reassigned browser bindings skip delivery before accessing Firebase", async t => {
  t.mock.method(Notification, "findById", async () => ({ recipientId: "old-user", audience: "customer" }));
  t.mock.method(PushRegistration, "findById", () => query({ active: true, userId: "new-user", audience: "customer", bindingId: "new-binding" }));
  assert.equal(await worker.deliverPush({ notificationId: "notice", registrationId: "device", bindingId: "old-binding" }), "skipped");
});
test("refund notifications reject unsigned webhook requests and deduplicate verified candidates", async t => {
  setEnv(t, "RAZORPAY_WEBHOOK_SECRET", "refund-test-secret"); const rows = new Map();
  t.mock.method(NotificationEvent, "updateOne", async (filter, update) => { rows.set(filter._id, update.$setOnInsert); return {}; });
  const body = Buffer.from(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_test123" } } } }));
  await assert.rejects(bookings.verifyRazorpayWebhook({ body, headers: { "x-razorpay-signature": "bad" } }, response()), /signature/); assert.equal(rows.size, 0);
  const headers = { "x-razorpay-signature": crypto.createHmac("sha256", "refund-test-secret").update(body).digest("hex") };
  await bookings.verifyRazorpayWebhook({ body, headers }, response()); await bookings.verifyRazorpayWebhook({ body, headers }, response());
  assert.equal(rows.size, 1); assert.equal([...rows.values()][0].kind, "refund_candidate");
});
test("tour updates fan out only to confirmed paid bookings of the selected tour/departure", async t => {
  let filter;
  t.mock.method(Booking, "find", value => { filter = value; return { cursor: async function* () {} }; });
  await worker.materializeNotificationEvent({ kind: "tour_update", payload: { tourId: "TOURTEST", departureId: "DEPTEST" } });
  assert.equal(filter.tourId, "TOURTEST"); assert.equal(filter.departureId, "DEPTEST"); assert.equal(filter.bookingStatus, "confirmed"); assert.equal(filter.paymentStatus, "paid"); assert.deepEqual(filter.amountPaid, { $gt: 0 });
});
test("Firebase sends target FIDs and invalid registrations deactivate without exposing financial data", async t => {
  env(t); setEnv(t, "FIREBASE_CLIENT_EMAIL", "test@example.invalid"); setEnv(t, "FIREBASE_PRIVATE_KEY", "test-placeholder");
  const sdk = require("firebase-admin/messaging"), firebase = require("../dist/services/firebase-admin.service");
  const fid = "c123456789012345678901", updates = []; let failure, sent;
  t.mock.method(firebase, "getFirebaseApp", () => ({ options: { projectId: "ancient-trails-e598a" } }));
  t.mock.method(sdk, "getMessaging", () => ({ async send(message) { sent = message; if (failure) throw { code: failure }; } }));
  t.mock.method(Notification, "findById", async () => ({ _id: "notice", recipientId: "customer", audience: "customer", title: "Payment received", body: "Private financial information", url: "/me/bookings/one" }));
  t.mock.method(PushRegistration, "findById", () => query({ _id: "device", userId: "customer", audience: "customer", active: true, bindingId: "binding", encryptedIdentifier: security.encryptRegistration(fid) }));
  t.mock.method(User, "findById", async () => ({ status: "active", roles: ["traveller"] }));
  t.mock.method(PushRegistration, "updateOne", async (filter, update) => { updates.push({ filter, update }); return {}; });
  const job = { notificationId: "notice", registrationId: "device", bindingId: "binding" };
  assert.equal(await worker.deliverPush(job), "sent"); assert.equal(sent.fid, fid); assert(!("token" in sent)); assert(!("notification" in sent));
  assert(!JSON.stringify(sent).includes("Private financial information"));
  failure = "messaging/server-unavailable"; await assert.rejects(worker.deliverPush(job), /server-unavailable/); assert.equal(updates.length, 0);
  failure = "messaging/invalid-argument"; await assert.rejects(worker.deliverPush(job), /invalid-argument/); assert.equal(updates.length, 0);
  failure = "messaging/installation-id-not-registered"; assert.equal(await worker.deliverPush(job), "invalid"); assert.equal(updates[0].update.$set.active, false); assert.equal(updates[0].filter.bindingId, "binding");
});
test("verified refund processing checks canonical provider amount, currency and payment before fanout", async t => {
  const refund = { id: "rfnd_verified", payment_id: "pay_verified", status: "processed", currency: "INR", amount: 100000 };
  const payment = { id: "pay_verified", currency: "INR", status: "refunded", amount: 200000 };
  t.mock.method(bookings, "createRazorpayClient", () => ({ refunds: { fetch: async () => refund }, payments: { fetch: async () => payment } }));
  t.mock.method(Booking, "findOne", async () => booking({ notificationOwnerId: "222222222222222222222222" }));
  t.mock.method(User, "find", async () => [{ id: "admin" }]); t.mock.method(User, "findOne", async () => ({ id: "customer" }));
  const notices = []; t.mock.method(Notification, "updateOne", async (filter, update) => { notices.push(update.$setOnInsert); });
  t.mock.method(PushRegistration, "find", async () => []);
  const event = new NotificationEvent({ _id: "refund-event", kind: "refund_candidate", payload: { refundId: refund.id }, createdAt: now });
  refund.status = "pending"; await assert.rejects(worker.materializeNotificationEvent(event), /not-yet-processed/); assert.equal(notices.length, 0);
  refund.status = "processed"; payment.currency = "USD"; await assert.rejects(worker.materializeNotificationEvent(event), /mismatch/); assert.equal(notices.length, 0);
  payment.currency = "INR"; await worker.materializeNotificationEvent(event); assert.equal(notices.length, 2);
  assert(notices.every(notice => notice.kind === "refund_confirmed" && notice.eventId === "refund-event"));
  assert(notices.find(notice => notice.audience === "customer").url.startsWith("/me/notifications/"));
});
test("leased worker failures retry asynchronously and stop after the configured attempt limit", async t => {
  t.mock.method(console, "error", () => {});
  t.mock.method(events, "reconcileNotificationSources", async () => {});
  let job, claimed = false, updates = [];
  t.mock.method(NotificationEvent, "findOneAndUpdate", async (filter, update) => {
    assert(filter.$or.some(value => value.status === "sending")); assert(update.$set.leaseToken); assert(update.$set.leaseUntil > new Date());
    if (claimed) return null; claimed = true; return job;
  });
  t.mock.method(NotificationEvent, "updateOne", async (filter, update) => { updates.push({ filter, update }); return {}; });
  t.mock.method(PushDelivery, "findOneAndUpdate", async () => null);
  t.mock.method(User, "findById", async () => { throw Error("temporary-source-error"); });
  for (const attempts of [1, 10]) {
    job = { _id: "job", kind: "customer_registered", payload: { userId: "user" }, attempts }; claimed = false; updates = [];
    const before = Date.now(); await worker.runNotificationMaintenance();
    const result = updates.find(value => value.update.$set.status); assert.equal(result.update.$set.status, attempts === 10 ? "failed" : "pending");
    assert(result.update.$set.nextAttemptAt.getTime() >= before + 60000); assert(result.filter.leaseToken); assert(result.update.$unset.leaseToken === "");
  }
});
test("mounted HTTP notification routes enforce authentication and current audience roles", async t => {
  env(t); t.mock.method(console, "error", () => {});
  const app = require("../dist/app").default;
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = "http://127.0.0.1:" + server.address().port + "/api/notifications/";
  assert.equal((await fetch(url + "customer")).status, 401);
  assert.equal((await fetch(url + "admin")).status, 401);
  assert.equal((await fetch(url + "invalid")).status, 404);
  t.mock.method(User, "findById", async () => ({ id: "user-one", status: "active", roles: ["traveller"] }));
  const token = jwt.signAuthToken({ _id: "user-one", roles: ["super_admin"] });
  assert.equal((await fetch(url + "admin", { headers: { Authorization: "Bearer " + token } })).status, 403);
  const counts = []; t.mock.method(Notification, "find", filter => { counts.push(filter); return query([]); });
  t.mock.method(Notification, "countDocuments", async () => 0);
  const inbox = await fetch(url + "customer?recipientId=another-user", { headers: { Authorization: "Bearer " + token } });
  assert.equal(inbox.status, 200); assert.equal((await inbox.json()).data.unreadCount, 0); assert.equal(counts[0].recipientId, "user-one");
});
test("a queued reminder push is suppressed after the customer pays the full balance", async t => {
  t.mock.method(Notification, "findById", async () => ({ recipientId: "customer", audience: "customer", kind: "remaining_payment_reminder", eventId: "event" }));
  t.mock.method(PushRegistration, "findById", () => query({ userId: "customer", audience: "customer", active: true, bindingId: "binding" }));
  t.mock.method(NotificationEvent, "findById", async () => ({ payload: { bookingId: "booking", dueDate: "2040-12-13" } }));
  t.mock.method(Booking, "findById", async () => booking({ amountPaid: 46594, balanceAmount: 0 }));
  assert.equal(await worker.deliverPush({ notificationId: "notice", registrationId: "device", bindingId: "binding" }), "skipped");
});
test("important tour updates exclude completed trips and bookings created after the update", async t => {
  const future = booking({ notificationOwnerId: "111111111111111111111111", createdAt: new Date("2020-01-01"), pricingSnapshot: { returnDate: new Date("2099-01-01") } });
  const past = booking({ notificationOwnerId: "222222222222222222222222", createdAt: new Date("2020-01-01"), pricingSnapshot: { returnDate: new Date("2020-01-01") } });
  const later = booking({ notificationOwnerId: "333333333333333333333333", createdAt: new Date("2099-01-01"), pricingSnapshot: { returnDate: new Date("2099-01-01") } });
  t.mock.method(Booking, "find", () => ({ cursor: async function* () { yield future; yield past; yield later; } }));
  t.mock.method(User, "findOne", async filter => ({ id: String(filter._id) }));
  t.mock.method(PushRegistration, "find", async () => []);
  const notices = []; t.mock.method(Notification, "updateOne", async (filter, update) => { notices.push(update.$setOnInsert); });
  await worker.materializeNotificationEvent({ _id: "tour-update", kind: "tour_update", createdAt: new Date(), payload: { tourId: "TOURTEST" } });
  assert.equal(notices.length, 1); assert.equal(notices[0].recipientId, "111111111111111111111111");
});
test("source reconciliation recovers a late transaction behind the durable checkpoint without duplicate events", async t => {
  const { NotificationCursor } = require("../dist/models/notification.model");
  const checkpoint = new Date(), committed = new Date(checkpoint.getTime() - 60000);
  const late = { id: "111111111111111111111111", createdAt: committed, roles: ["traveller"] }, staged = new Map();
  t.mock.method(NotificationCursor, "findOneAndUpdate", async filter => filter._id === "activation" ? { at: new Date("2020-01-01") } : { at: checkpoint, lastId: "ffffffffffffffffffffffff" });
  t.mock.method(NotificationCursor, "updateOne", async () => ({}));
  t.mock.method(User, "findById", async () => late);
  t.mock.method(User, "find", filter => ({ sort() { return this; },
    cursor: async function* () { assert(filter.createdAt.$gte <= committed && filter.createdAt.$lte >= committed); yield late; },
    limit: async () => [],
  }));
  t.mock.method(NotificationEvent, "updateOne", async (filter, update) => { if (!staged.has(filter._id)) staged.set(filter._id, update.$setOnInsert); });
  await events.reconcileNotificationStream("users"); await events.reconcileNotificationStream("users");
  assert.equal(staged.size, 1); assert.equal([...staged.values()][0].payload.userId, late.id);
});
test("concurrent lead-phone lookups honor the user that won the atomic ownership binding", async t => {
  const current = booking();
  t.mock.method(User, "findOne", async filter => ({ id: filter._id ? "original-owner" : "changed-lead" }));
  t.mock.method(Booking, "updateOne", async () => ({ matchedCount: 0 }));
  t.mock.method(Booking, "findById", () => query({ notificationOwnerId: "111111111111111111111111" }));
  const recipient = await worker.bookingNotificationCustomer(current);
  assert.equal(recipient.id, "original-owner");
});
