const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { Booking } = require("../dist/models/booking.model");
const { TourDeparture } = require("../dist/models/tourDeparture.model");
const { Tour } = require("../dist/models/tour.model");
const { BookingPaymentNotice: Notices } = require("../dist/models/bookingPaymentNotice.model");
const policy = require("../dist/services/booking/booking.payment-lifecycle-policy");
const lifecycle = require("../dist/services/booking/booking.payment-lifecycle");
const emails = require("../dist/services/booking-confirmation-email.service");
const whatsapp = require("../dist/services/msg91-whatsapp.service");
const now = new Date("2040-12-06T06:00:00Z");
function base(changes = {}) {
  return new Booking({ bookingReference: "AT-D0001", tourId: "TOURTEST", departureId: "DEPTEST",
    bookingStatus: "confirmed", paymentStatus: "paid", paymentMode: "online", totalGuest: 1, adultCount: 1, childCount: 0,
    guestDetails: [{ title: "Ms", firstName: "Test", lastName: "Traveller", countryCode: "+91", mobileNumber: "9000000000", email: "test@example.com", dateOfBirth: new Date("1990-01-01"), gender: "Female", address: "Test city" }],
    childDetails: [], travellers: [], accommodationDetails: {}, grandTotal: 46594, amountPaid: 20000,
    balanceAmount: 26594, balanceDueDate: new Date("2040-12-13T00:00:00Z"), paymentCapturedAt: now,
    ...changes,
  });
}
function setup(t, changes = {}) {
  const booking = base(changes), records = new Map(), sent = { email: [], reminder: [], full: [], airfare: [] };
  let links = 0, failWhatsapp = false, locked = false;
  t.mock.method(console, "error", () => {});
  t.mock.method(Booking, "findById", async () => booking);
  t.mock.method(Booking, "updateOne", async (filter, update) => { Object.assign(booking, update.$set || {}); return {}; });
  t.mock.method(TourDeparture, "findOne", async () => ({ departureDate: new Date("2040-12-13"), returnDate: new Date("2040-12-18") }));
  t.mock.method(Tour, "findOne", async () => ({ tourName: "Badami Heritage" }));
  t.mock.method(Notices, "updateOne", async (filter, update) => {
    let record = records.get(filter._id);
    if (!record && update.$setOnInsert) { record = { _id: filter._id, ...update.$setOnInsert }; records.set(filter._id, record); }
    if (record) Object.assign(record, update.$set || {});
    return {};
  });
  t.mock.method(Notices, "findOneAndUpdate", async (filter, update) => {
    const record = records.get(filter._id);
    if (!record || record.status === "sent" || record.nextAttemptAt > filter.nextAttemptAt.$lte) return null;
    if (record.status === "sending" && record.attemptedAt >= filter.$or[1].attemptedAt.$lt) return null;
    Object.assign(record, update.$set); record.attempts += update.$inc.attempts;
    return record;
  });
  t.mock.method(Notices, "findById", async id => records.get(id));
  t.mock.method(emails, "sendTourFullPaymentConfirmationEmail", async payload => { sent.email.push(payload); });
  t.mock.method(emails, "sendBookingPaymentNoticeEmail", async payload => { sent.email.push(payload); });
  t.mock.method(whatsapp, "sendRemainingPaymentReminderWhatsapp", async payload => {
    if (failWhatsapp) throw Error("Temporary WhatsApp outage"); sent.reminder.push(payload); return { requestId: "reminder-test" };
  });
  t.mock.method(whatsapp, "sendTourFullPaymentConfirmationWhatsapp", async payload => { sent.full.push(payload); return { requestId: "full-test" }; });
  t.mock.method(whatsapp, "sendBookingPaymentLinkWhatsapp", async payload => { sent.airfare.push(payload); return { requestId: "airfare-test" }; });
  const link = { paymentLinkUrl: "https://rzp.io/i/test", whatsappStatus: "pending", status: "created", save: async () => {} };
  const hooks = {
    async withLock(id, action) { assert.equal(id, booking.id); if (locked) throw Error("Collection already in progress"); locked = true; try { return await action(); } finally { locked = false; } },
    async syncPayments() {},
    async closePaidLinks() {},
    async prepareLink(current, airfare, expiry) { assert.equal(current.id, booking.id); assert(expiry > now); links++; return link; },
  };
  return { booking, records, sent, hooks, link, links: () => links,
    failWhatsapp(value) { failWhatsapp = value; }, process: (at = now) => lifecycle.processBookingPaymentLifecycle(booking.id, hooks, at) };
}

test("remaining reminder becomes due seven calendar days before the due date in India", () => {
  const booking = base();
  assert.equal(policy.paymentLifecycleState(booking, now).reminderDue, true);
  assert.equal(policy.paymentLifecycleState(booking, new Date("2040-12-05T06:00:00Z")).reminderDue, false);
  assert.equal(policy.paymentLifecycleState(booking, new Date("2040-12-14T06:00:00Z")).reminderDue, false);
  // Just after midnight in India is already 6 December, even though UTC is 5 December.
  assert.equal(policy.paymentLifecycleState(booking, new Date("2040-12-05T18:31:00Z")).reminderDue, true);
});
for (const paymentMode of ["online", "offline", "bank_transfer"]) {
  test(paymentMode + " reminder uses the real balance and one Razorpay link across both channels", async t => {
    const f = setup(t, { paymentMode }); await f.process();
    assert.equal(f.sent.email.length, 1); assert.equal(f.sent.reminder.length, 1); assert.equal(f.links(), 1);
    assert.equal(f.sent.reminder[0].remainingAmount, "26,594"); assert.equal(f.sent.reminder[0].amountPaid, "20,000");
    assert.equal(f.sent.reminder[0].paymentUrl, "https://rzp.io/i/test");
    assert.equal(f.sent.email[0].paymentUrl, f.sent.reminder[0].paymentUrl);
    assert(f.sent.email[0].lines.some(line => line.includes("13 December 2040")));
  });
}

test("repeated maintenance never repeats a successful reminder or generates another link", async t => {
  const f = setup(t); await f.process(); await f.process();
  assert.equal(f.sent.email.length, 1); assert.equal(f.sent.reminder.length, 1); assert.equal(f.links(), 1);
});

test("a failed WhatsApp delivery retries without repeating email", async t => {
  const f = setup(t); f.failWhatsapp(true); await f.process();
  assert.equal(f.sent.email.length, 1); assert.equal(f.sent.reminder.length, 0);
  f.failWhatsapp(false); await f.process(new Date(now.getTime() + 60000));
  assert.equal(f.sent.reminder.length, 0, "Retry backoff is respected");
  await f.process(new Date(now.getTime() + 6 * 60000));
  assert.equal(f.sent.email.length, 1); assert.equal(f.sent.reminder.length, 1);
});
for (const changes of [{ bookingStatus: "cancelled" }, { bookingStatus: "expired" }, { paymentStatus: "pending", bookingStatus: "payment_pending" }, { balanceDueDate: null }, { archivedAt: now }]) {
  test("ineligible booking does not receive a balance reminder: " + JSON.stringify(changes), async t => {
    const f = setup(t, changes); await f.process();
    assert.equal(f.sent.email.length, 0); assert.equal(f.sent.reminder.length, 0); assert.equal(f.links(), 0);
  });
}

test("full payment produces the separate confirmation once, with zero balance and the actual paid amount", async t => {
  const f = setup(t, { amountPaid: 46594, balanceAmount: 0, paymentLifecyclePending: true });
  await f.process(); await f.process();
  assert.equal(f.sent.email.length, 1); assert.equal(f.sent.full.length, 1);
  assert.equal(f.sent.full[0].amountPaid, "46,594"); assert.equal(f.links(), 0); assert.equal(f.sent.reminder.length, 0);
  assert.equal(f.sent.email[0].balanceAmount, 0);
  assert.equal(f.sent.email[0].amountPaid, 46594);
  assert.equal(f.sent.email[0].travellersLabel, "1 Adult");
  assert.equal(f.sent.email[0].departureDate.toISOString().slice(0, 10), "2040-12-13");
  assert.equal(f.booking.paymentLifecyclePending, false);
});

test("payment completed before the reminder run sends full confirmation rather than an outdated balance link", async t => {
  const f = setup(t); f.hooks.syncPayments = async () => { f.booking.amountPaid = 46594; f.booking.balanceAmount = 0; };
  await f.process(); assert.equal(f.sent.full.length, 1); assert.equal(f.sent.reminder.length, 0); assert.equal(f.links(), 0);
});

test("a fully paid package explains excluded airfare without inventing an airfare charge", async t => {
  const f = setup(t, { amountPaid: 46594, balanceAmount: 0, airfareExcluded: true }); await f.process();
  assert.equal(f.sent.full.length, 1); assert.equal(f.links(), 0);
  assert.equal(f.sent.email[0].airfareExcluded, true);
  assert.equal(f.sent.email[0].airFlightCharges, 0);
});

test("finalized additional airfare sends a separate WhatsApp payment link without claiming full settlement", async t => {
  const f = setup(t, { airfareExcluded: true, airfareAddedAt: now, airFlightCharges: 5000,
    grandTotal: 51594, amountPaid: 46594, balanceAmount: 5000 }); await f.process(); await f.process();
  assert.equal(f.sent.airfare.length, 1); assert.equal(f.sent.airfare[0].amount, "5,000");
  assert.equal(f.sent.airfare[0].paymentPurpose, "Air-Flight Charges (Additional)");
  assert.equal(f.sent.full.length, 0); assert.equal(f.sent.reminder.length, 0);
});

test("included airfare never creates a separate airfare collection", () => {
  assert.equal(policy.paymentLifecycleState(base({ airfareExcluded: true, airfareIncludedInTotal: true, airfareAddedAt: now, airFlightCharges: 5000 }), now).airfareDue, false);
});

test("saving a newly fully paid booking records pending delivery durably", async t => {
  const booking = base({ amountPaid: 46594, balanceAmount: 0 });
  t.mock.method(Booking.collection, "insertOne", async () => ({ acknowledged: true, insertedId: booking._id }));
  await booking.save(); assert.equal(booking.paymentLifecyclePending, true);
});

test("new template payloads use exactly eight and five variables in the approved order", async t => {
  const previous = process.env.MSG91_AUTH_KEY; process.env.MSG91_AUTH_KEY = "test-only";
  t.after(() => { if (previous === undefined) delete process.env.MSG91_AUTH_KEY; else process.env.MSG91_AUTH_KEY = previous; });
  const bodies = [];
  t.mock.method(axios, "post", async (url, body) => { bodies.push(body); return { data: { success: true, request_id: "test" } }; });
  await whatsapp.sendRemainingPaymentReminderWhatsapp({ recipientNumber: "919000000000", travellerName: "Test Traveller", dueDate: "13 December 2040", tourName: "Badami Heritage", bookingReference: "AT-D0001", totalAmount: "46,594", amountPaid: "20,000", remainingAmount: "26,594", paymentUrl: "https://rzp.io/i/test", crqId: "reminder-key" });
  await whatsapp.sendTourFullPaymentConfirmationWhatsapp({ recipientNumber: "919000000000", travellerName: "Test Traveller", tourName: "Badami Heritage", bookingReference: "AT-D0001", amountPaid: "46,594", paymentDate: "06 December 2040", crqId: "full-key" });
  const values = body => Object.values(body.payload.template.to_and_components[0].components).map(item => item.value);
  assert.equal(bodies[0].payload.template.name, "remaining_payment_reminder");
  assert.deepEqual(values(bodies[0]), ["Test Traveller", "13 December 2040", "Badami Heritage", "AT-D0001", "46,594", "20,000", "26,594", "https://rzp.io/i/test"]);
  assert.equal(bodies[1].payload.template.name, "tour_full_payment_confirmation");
  assert.deepEqual(values(bodies[1]), ["Test Traveller", "Badami Heritage", "AT-D0001", "46,594", "06 December 2040"]);
});

test("full confirmation closes unused balance links before either delivery channel sends", async t => {
  const f = setup(t, { amountPaid: 46594, balanceAmount: 0 }); let closed = 0;
  f.hooks.closePaidLinks = async () => { closed++; };
  await f.process(); assert.equal(closed, 1); assert.equal(f.sent.full.length, 1); assert.equal(f.sent.email.length, 1);
});

test("a link-closing failure retries full confirmation without claiming success early", async t => {
  const f = setup(t, { amountPaid: 46594, balanceAmount: 0, paymentLifecyclePending: true });
  f.hooks.closePaidLinks = async () => { throw Error("Gateway temporarily unavailable"); };
  await f.process(); assert.equal(f.sent.full.length, 0); assert.equal(f.sent.email.length, 0);
  assert.equal(f.booking.paymentLifecyclePending, true);
  f.hooks.closePaidLinks = async () => {};
  await f.process(new Date(now.getTime() + 6 * 60000));
  assert.equal(f.sent.full.length, 1); assert.equal(f.sent.email.length, 1); assert.equal(f.booking.paymentLifecyclePending, false);
});

test("the scheduled maintenance runner processes eligible bookings and avoids unpaid requests", async t => {
  const f = setup(t);
  t.mock.method(Booking, "find", filter => {
    assert.equal(filter.bookingStatus, "confirmed"); assert.equal(filter.paymentStatus, "paid");
    return { select() { return this; }, limit: async () => [f.booking] };
  });
  await lifecycle.runBookingPaymentLifecycleMaintenance(f.hooks, now);
  assert.equal(f.sent.email.length, 1); assert.equal(f.sent.reminder.length, 1);
});


test("saving included airfare on a paid booking does not queue another full-payment confirmation", async t => {
  const booking = Booking.hydrate(base({ amountPaid: 46594, balanceAmount: 0, airfareExcluded: true,
    airfareIncludedInTotal: true, paymentLifecyclePending: false }).toObject());
  t.mock.method(Booking.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1 }));
  booking.airFlightCharges = 5000; booking.airfareAddedAt = now;
  await booking.save();
  assert.equal(booking.paymentLifecyclePending, false);
});

test("an actual balance receipt on an existing booking still queues full-payment confirmation", async t => {
  const booking = Booking.hydrate(base({ paymentLifecyclePending: false }).toObject());
  t.mock.method(Booking.collection, "updateOne", async () => ({ acknowledged: true, matchedCount: 1 }));
  booking.amountPaid = 46594; booking.balanceAmount = 0;
  await booking.save();
  assert.equal(booking.paymentLifecyclePending, true);
});
