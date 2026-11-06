const test = require("node:test");
const assert = require("node:assert/strict");
const { SiteSettings } = require("../dist/models/siteSettings.model");
const { getSiteSettings, updateSiteSettings, updateTaxSettings } = require("../dist/controllers/siteSettings.controller");
const { getBookingTaxSettings, getSavedBookingTaxSettings, splitBookingGst, defaultBookingTaxSettings } = require("../dist/services/booking/booking-tax-settings");
const { calculateBookingTotals, adjustBookingTcs } = require("../dist/services/booking/booking.pricing");
const { createPricingSnapshot } = require("../dist/services/booking/booking.snapshot");
const controller = require("../dist/controllers/booking.controller");
const { Tour } = require("../dist/models/tour.model");
const { TourDeparture } = require("../dist/models/tourDeparture.model");
const { Booking } = require("../dist/models/booking.model");
const contact = { emailId: "help@example.com", primaryCalling: "9000000000", secondaryCalling: "", landline: "", officeAddress: "Pune", whatsapp: "" };
const response = () => ({ body: null, status() { return this; }, json(body) { this.body = body; } });

test("tax settings persist separately from general settings and are available to public readers", async t => {
  const stored = new SiteSettings({ key: "site", contact, logo: "/logo.png" });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (_filter, update, options) => {
    if (update.$set?.taxes) {
      assert.equal(options.runValidators, true);
      assert.equal(Object.hasOwn(update.$set, "contact"), false);
      stored.set(update.$set);
    } else if (update.$set) {
      assert.equal(Object.hasOwn(update.$set, "taxes"), false);
      stored.set(update.$set);
    }
    return stored;
  });
  const res = response();
  await updateTaxSettings({ body: { sgstPercentage: 3, cgstPercentage: 6, tcsPercentage: 4.25 } }, res);
  assert.deepEqual(res.body.data.settings.taxes, { sgstPercentage: 3, cgstPercentage: 6, tcsPercentage: 4.25 });
  assert.equal(res.body.data.settings.contact.emailId, contact.emailId);
  assert.equal(res.body.data.settings.logo, "/logo.png");
  await updateSiteSettings({ body: { contact } }, res);
  await getSiteSettings({}, res);
  assert.equal(res.body.data.settings.taxes.tcsPercentage, 4.25);
});

test("missing saved rates use the existing defaults and explicit zero rates stay zero", async t => {
  let taxes;
  t.mock.method(SiteSettings, "findOne", () => ({ select: async () => ({ taxes }) }));
  assert.deepEqual(await getBookingTaxSettings(), defaultBookingTaxSettings);
  taxes = { sgstPercentage: 0, cgstPercentage: 0, tcsPercentage: 0 };
  assert.deepEqual(await getBookingTaxSettings(), taxes);
});

test("invalid tax values are rejected before any database write", async t => {
  const write = t.mock.method(SiteSettings, "findOneAndUpdate", () => { throw Error("Must not write invalid taxes"); });
  const valid = { sgstPercentage: 2.5, cgstPercentage: 2.5, tcsPercentage: 2 };
  for (const body of [
    { ...valid, sgstPercentage: -1 }, { ...valid, cgstPercentage: 101 },
    { ...valid, tcsPercentage: "5" }, { ...valid, tcsPercentage: 1.234 },
    { ...valid, tcsPercentage: null }, { ...valid, sgstPercentage: 60, cgstPercentage: 50 },
    { sgstPercentage: 5 }, { ...valid, contact },
  ]) await assert.rejects(updateTaxSettings({ body }, response()), error => error.statusCode === 400);
  assert.equal(write.mock.callCount(), 0);
});

test("configured GST and TCS drive new pricing, deposits and exemption recalculation", () => {
  const taxRates = { sgstPercentage: 3, cgstPercentage: 6, tcsPercentage: 4 };
  const accommodationOption = { total: 100000, totalTravellers: 1, rooms: [], pricingBreakdown: {} };
  const totals = calculateBookingTotals({ accommodationOption, gstPercentage: 99, taxRates, tcsApplicable: true });
  assert.equal(totals.gstPercentage, 9);
  assert.equal(totals.gstAmount, 9000);
  assert.equal(totals.tcsAmount, 4360);
  assert.equal(totals.grandTotal, 113360);
  const snapshot = createPricingSnapshot({ accommodationOption, taxRates, tcsApplicable: true, departure: {
    departureId: "DEP1", departureDate: new Date("2099-12-13"), returnDate: new Date("2099-12-18"), childPricingRules: [],
    depositType: "percentage", depositValue: 40, depositAppliesTo: "booking", balanceDueDaysBefore: 15,
  } });
  assert.equal(snapshot.depositAmount, 45344);
  assert.deepEqual(snapshot.taxRates, taxRates);
  const exempt = adjustBookingTcs({ packageTotal: totals.packageTotal, grandTotal: totals.grandTotal, tcsAmount: totals.tcsAmount, amountPaid: 45344, verified: true, tcsPercentage: taxRates.tcsPercentage });
  const revoked = adjustBookingTcs({ packageTotal: totals.packageTotal, grandTotal: exempt.grandTotal, tcsAmount: 0, amountPaid: 45344, verified: false, tcsPercentage: taxRates.tcsPercentage });
  assert.equal(revoked.grandTotal, totals.grandTotal);
  assert.deepEqual(splitBookingGst({ gstAmount: 9000, pricingSnapshot: snapshot }), { sgst: 3000, cgst: 6000 });
  assert.deepEqual(getSavedBookingTaxSettings({ gstPercentage: 5, tcsPercentage: 0 }), defaultBookingTaxSettings);
  assert.deepEqual(getSavedBookingTaxSettings({ pricingSnapshot: snapshot }), taxRates);
  assert.deepEqual(getSavedBookingTaxSettings({ pricingSnapshot: { taxRates: {
    sgstPercentage: 0, cgstPercentage: 0, tcsPercentage: 0,
  } } }), { sgstPercentage: 0, cgstPercentage: 0, tcsPercentage: 0 });
});

test("admin quotes use stored tax rates and ignore client supplied GST", async t => {
  t.mock.method(SiteSettings, "findOne", () => ({ select: async () => ({ taxes: { sgstPercentage: 3, cgstPercentage: 6, tcsPercentage: 4 } }) }));
  t.mock.method(Tour, "findOne", async () => ({ tourType: "International", durationDn: "6 Days / 5 Nights" }));
  t.mock.method(TourDeparture, "findOne", async () => ({
    departureId: "DEP001", tourId: "TOUR001", destinationId: "INT001",
    departureDate: new Date("2099-12-13"), returnDate: new Date("2099-12-18"), seatsAvailable: 10, totalSeats: 10,
    status: "scheduled", childPricingRules: [], priceAdult: 100000, priceExtraBed: 90000, priceChildWithoutExtraBed: 80000,
    singleOccupancy: 100000, depositType: "percentage", depositValue: 40, depositAppliesTo: "booking", balanceDueDaysBefore: 15,
    bookingDeadline: new Date("2099-11-30"), earlyBirdOffer: null,
  }));
  const res = response();
  await controller.listBookingAccommodationOptions({ body: { departureId: "DEP001", adultCount: 1, gstPercentage: 0 } }, res);
  assert.ok(res.body.data.options.length > 0);
  for (const option of res.body.data.options) {
    assert.equal(option.gstPercentage, 9);
    assert.equal(option.tcsPercentage, 4);
    assert.equal(option.tcsAmount, Math.round(option.packageTotal * 0.04));
  }
  t.mock.method(Booking, "findById", async () => ({
    tourId: "TOUR001", tcsApplicable: true, gstPercentage: 5, tcsPercentage: 2,
  }));
  await controller.listBookingAccommodationOptions({ body: {
    bookingId: "507f1f77bcf86cd799439011", departureId: "DEP001", adultCount: 1, gstPercentage: 0,
  } }, res);
  for (const option of res.body.data.options) {
    assert.equal(option.gstPercentage, 5);
    assert.equal(option.tcsPercentage, 2);
  }
});
