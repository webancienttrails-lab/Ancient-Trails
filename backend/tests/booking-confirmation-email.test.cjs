const assert = require("node:assert/strict");
const test = require("node:test");
const nodemailer = require("nodemailer");
const { SiteSettings } = require("../dist/models/siteSettings.model");
const { sendBookingConfirmationEmail, sendTourFullPaymentConfirmationEmail } = require("../dist/services/booking-confirmation-email.service");
const { AIRFARE_NOTE } = require("../dist/services/booking/booking.airfare");

let sequence = 0;
function setup(t, settings) {
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  Object.assign(process.env, {
    SMTP_HOST: "confirmation-" + (++sequence) + ".test",
    SMTP_PORT: "587", SMTP_USER: "mock-user", SMTP_PASS: "mock-password",
    SMTP_FROM: "bookings@example.com",
    BOOKING_CONFIRMATION_SUPPORT_EMAIL: "fallback@example.com",
    BOOKING_CONFIRMATION_SUPPORT_PHONE: "9000000001",
  });
  const mails = [];
  t.mock.method(nodemailer, "createTransport", () => ({
    sendMail: async mail => { mails.push(mail); return { messageId: "mock-confirmation" }; },
  }));
  t.mock.method(SiteSettings, "findOne", async filter => {
    assert.deepEqual(filter, { key: "site" });
    return typeof settings === "function" ? settings() : settings;
  });
  const payload = {
    bookingId: "booking-test", bookingReference: "AT-D0001",
    travellerName: "Test Traveller", recipientEmail: "traveller@example.com",
    tourName: "Badami & Hampi <Tour>", destinationName: "Badami (City)",
    travellersLabel: "2 Adults", durationLabel: "6 Days",
    departureDate: "2040-12-13", returnDate: "2040-12-18",
    totalAmount: 46594, amountPaid: 20000, balanceAmount: 26594,
    paymentId: "pay_private_reference", confirmedAt: "2040-11-01",
    supportEmail: "old-payload@example.com", supportPhone: "old-phone",
  };
  return { payload, mails, send: changes => sendBookingConfirmationEmail({ ...payload, ...changes }) };
}

test("confirmation uses a bordered booking table, removes city/reference, and reads current admin support contacts", async t => {
  const settings = { contact: {
    emailId: "help@example.com", primaryCalling: "9000000002",
    secondaryCalling: "9000000002", landline: "02012345678",
    whatsapp: "9000000004", officeAddress: "Office 1 & 2 <Main Road>",
  } };
  const f = setup(t, settings);
  await f.send({});
  const mail = f.mails[0];
  assert.match(mail.html, /<table aria-label="Booking details"/);
  assert.match(mail.html, /<th scope="row" class="detail-label" style="[^"]*border:1px solid/);
  for (const label of ["Tour", "Departure", "Return", "Duration", "Travellers"]) assert.ok(mail.html.includes(label));
  assert.match(mail.html, /Badami &amp; Hampi &lt;Tour&gt;/);
  for (const body of [mail.html, mail.text]) {
    assert.doesNotMatch(body, /Badami \(City\)|payment reference|pay_private_reference|old-payload@example.com|old-phone/i);
    assert.ok(body.includes("help@example.com"));
    assert.ok(body.includes("9000000002 | 02012345678"));
    assert.ok(body.includes("9000000004"));
  }
  assert.ok(mail.html.includes("Office 1 &amp; 2 &lt;Main Road&gt;"));
  assert.ok(mail.text.includes("Office 1 & 2 <Main Road>"));
  settings.contact.emailId = "updated@example.com";
  settings.contact.primaryCalling = "9000000003";
  await f.send({});
  assert.ok(f.mails[1].text.includes("updated@example.com"));
  assert.ok(f.mails[1].text.includes("9000000003"));
});

test("confirmation explains pending airfare in both HTML and plain text", async t => {
  const f = setup(t, null);
  await f.send({ airfareExcluded: true, airFlightCharges: 0 });
  assert.ok(f.mails[0].html.includes(AIRFARE_NOTE));
  assert.ok(f.mails[0].text.includes(AIRFARE_NOTE));
  assert.match(f.mails[0].html, /Current Total \(Excluding Airfare\)/);
});

for (const included of [false, true]) {
  test("confirmation explains airfare already " + (included ? "included" : "added") + " without claiming it is pending", async t => {
    const f = setup(t, null);
    await f.send({ airfareExcluded: true, airfareAddedAt: new Date("2040-11-01"), airFlightCharges: 5000, airfareIncludedInTotal: included });
    for (const body of [f.mails[0].html, f.mails[0].text]) {
      assert.ok(body.includes(included ? "are included in the booking total" : "have been added to the booking total"));
      assert.ok(!body.includes(AIRFARE_NOTE));
    }
  });
}

test("confirmation uses existing support fallbacks when admin contacts are empty", async t => {
  const f = setup(t, { contact: { emailId: "", primaryCalling: "", secondaryCalling: "", landline: "" } });
  await f.send({ supportEmail: undefined, supportPhone: undefined });
  assert.ok(f.mails[0].text.includes("fallback@example.com"));
  assert.ok(f.mails[0].text.includes("9000000001"));
  assert.ok(!f.mails[0].text.includes(AIRFARE_NOTE));
});

test("an admin-contact lookup error does not prevent a confirmation email", async t => {
  const f = setup(t, () => { throw Error("Settings temporarily unavailable"); });
  t.mock.method(console, "error", () => {});
  await f.send({});
  assert.equal(f.mails.length, 1);
  assert.ok(f.mails[0].text.includes("old-payload@example.com"));
});

for (const amountPaid of [20000, 46594]) {
  test("booking_confirmation sends all five approved variables for " + (amountPaid === 20000 ? "partial" : "full") + " payment", async t => {
    const axios = require("axios");
    const { Booking } = require("../dist/models/booking.model");
    const { Tour } = require("../dist/models/tour.model");
    const { TourDeparture } = require("../dist/models/tourDeparture.model");
    const { queueBookingConfirmationNotifications } = require("../dist/controllers/booking.controller");
    const previous = process.env.MSG91_AUTH_KEY;
    process.env.MSG91_AUTH_KEY = "test-only";
    t.after(() => { if (previous === undefined) delete process.env.MSG91_AUTH_KEY; else process.env.MSG91_AUTH_KEY = previous; });
    const booking = new Booking({ tourId: "TOURTEST", departureId: "DEPTEST", bookingReference: "AT-D0001",
      bookingStatus: "confirmed", paymentStatus: "paid", totalGuest: 1, adultCount: 1, childCount: 0,
      grandTotal: 46594, amountPaid, balanceAmount: 46594 - amountPaid,
      guestDetails: [{ title: "Ms", firstName: "Test", lastName: "Traveller", countryCode: "+91", mobileNumber: "9000000000", email: "test@example.com", dateOfBirth: new Date("1990-01-01"), gender: "Female", address: "Test city" }],
      childDetails: [], travellers: [], accommodationDetails: {},
    });
    t.mock.method(Booking, "findOneAndUpdate", async filter => {
      assert.equal(filter.paymentStatus, "paid"); assert.equal(filter.bookingStatus, "confirmed");
      return Object.hasOwn(filter, "whatsappBookingConfirmationSentAt") ? booking : null;
    });
    t.mock.method(Booking, "updateOne", async () => ({}));
    t.mock.method(Tour, "findOne", async () => ({ tourName: "Badami Heritage" }));
    t.mock.method(TourDeparture, "findOne", async () => ({ departureDate: new Date("2040-12-13") }));
    let sent;
    const post = t.mock.method(axios, "post", async (url, body) => { sent = body; return { data: { success: true, request_id: "confirmation-test" } }; });
    queueBookingConfirmationNotifications(booking);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(post.mock.callCount(), 1);
    assert.equal(sent.payload.template.name, "booking_confirmation");
    const destination = sent.payload.template.to_and_components[0];
    assert.deepEqual(destination.to, ["919000000000"]);
    assert.equal(Object.keys(destination.components).length, 5);
    const values = Object.values(destination.components).map(item => item.value);
    assert.deepEqual(values.slice(0, 2), ["Test Traveller", "Badami Heritage"]);
    assert.match(values[2], /13.*Dec.*2040/);
    assert.equal(values[3], String(amountPaid));
    assert.equal(values[4], amountPaid === 20000 ? "Partially Paid" : "Paid in Full");
    assert.ok(!values[3].includes("?"), "The approved template already contains the rupee sign");
  });
}

// Delivery lifecycle has its own tests; avoid background SMTP/DB work in these controller fixtures.
const paymentLifecycle = require("../dist/services/booking/booking.payment-lifecycle");
test.beforeEach(t => { t.mock.method(paymentLifecycle, "queueBookingPaymentLifecycle", () => {}); });


test("full-payment email shares the confirmation layout with settled payment wording and airfare disclosure", async t => {
  const f = setup(t, { contact: { emailId: "current-support@example.com", whatsapp: "9000000004" } });
  const result = await sendTourFullPaymentConfirmationEmail({ ...f.payload, amountPaid: 46594, balanceAmount: 0,
    airfareExcluded: true, airFlightCharges: 0, confirmationUrl: "https://example.com/booking-confirmed/test" });
  const mail = f.mails[0];
  assert.equal(result.messageId, "mock-confirmation");
  assert.equal(mail.subject, "Full payment received - AT-D0001");
  for (const fragment of ["email-shell", "logo-img", "Your Tour is Fully Paid", 'aria-label="Booking details"',
    "Payment Summary", "View Booking", "Full Payment Received Successfully", "What Happens Next?", "Support"]) {
    assert.ok(mail.html.includes(fragment), fragment);
  }
  assert.ok(mail.html.includes("Badami &amp; Hampi &lt;Tour&gt;"));
  for (const body of [mail.html, mail.text]) {
    for (const fragment of ["FULLY PAID", "Payment Date", "Paid in full", "No further payment is pending",
      "current-support@example.com", "Razorpay payment link sent on WhatsApp", "confirmed tour package"]) {
      assert.ok(body.includes(fragment), fragment);
    }
    assert.ok(!body.includes("once the complete booking amount has been received"));
    assert.ok(!body.includes("pay_private_reference"));
  }
});
