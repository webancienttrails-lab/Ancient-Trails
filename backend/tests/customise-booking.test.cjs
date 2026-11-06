const test = require("node:test");
const assert = require("node:assert/strict");
const { Booking } = require("../dist/models/booking.model");
const { Tour } = require("../dist/models/tour.model");
const { TourDeparture } = require("../dist/models/tourDeparture.model");
const { CustomiseTour, CustomiseTourDeparture } = require("../dist/models/customiseTour.model");
const { BookingReferenceCounter } = require("../dist/models/bookingReferenceCounter.model");
const lead = require("../dist/controllers/bookingLead.controller");
const controller = require("../dist/controllers/booking.controller");

const guest = { title: "Ms", firstName: "Asha", lastName: "Patil", countryCode: "+91",
  mobileNumber: "9000000000", email: "asha@example.com", dateOfBirth: "1990-01-01",
  gender: "Female", address: "Pune" };

test("customise booking saves its catalogue and uses its tour instead of a matching master ID", async t => {
  t.mock.method(lead, "assertAdminLeadVerification", () => {});
  t.mock.method(Tour, "exists", () => { throw Error("Must not query Tour Master"); });
  t.mock.method(Tour, "findOne", () => { throw Error("Must not query Tour Master"); });
  t.mock.method(CustomiseTour, "exists", async () => true);
  t.mock.method(CustomiseTour, "findOne", async () => ({ tourType: "International" }));
  let saved;
  t.mock.method(Booking, "create", async payload => {
    saved = payload;
    return new Booking({ ...payload, bookingReference: "AT-I0001" });
  });
  let result;
  await controller.createBooking({ body: {
    tourScope: "customise", tourId: "TOUR001", totalGuest: 1, adultCount: 1, childCount: 0,
    guestDetails: [guest], childDetails: [], paymentMethod: "cash", amountPaid: 0,
  } }, { status() { return this; }, json(value) { result = value; } });
  assert.equal(saved.tourScope, "customise");
  assert.equal(saved.tourId, "TOUR001");
  assert.equal(result.data.booking.tourScope, "customise");
});

test("customise seat reservations and releases use only customise departures", async t => {
  t.mock.method(TourDeparture, "findOneAndUpdate", () => { throw Error("Must not reserve master seats"); });
  t.mock.method(TourDeparture, "findOne", () => { throw Error("Must not release master seats"); });
  const departure = { totalSeats: 10, seatsAvailable: 8, async save() {} };
  t.mock.method(CustomiseTourDeparture, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.departureId, "DEP001");
    assert.equal(update.$inc.seatsAvailable, -2);
    return departure;
  });
  t.mock.method(CustomiseTourDeparture, "findOne", () => ({ session: async () => departure }));
  await controller.reserveDepartureSeats("DEP001", 2, undefined, "customise");
  await controller.restoreDepartureSeats("DEP001", 2, undefined, "customise");
  assert.equal(departure.seatsAvailable, 10);
});

test("customise accommodation quotes use that tour's departure pricing", async t => {
  t.mock.method(TourDeparture, "findOne", () => { throw Error("Must not price a master departure"); });
  t.mock.method(Tour, "findOne", () => { throw Error("Must not price a master tour"); });
  t.mock.method(CustomiseTour, "findOne", async () => ({ tourType: "International", durationDn: "6 Days / 5 Nights" }));
  t.mock.method(CustomiseTourDeparture, "findOne", async () => ({
    departureId: "DEP001", tourId: "TOUR001", destinationId: "INT001",
    departureDate: new Date("2099-12-13"), returnDate: new Date("2099-12-18"),
    seatsAvailable: 10, totalSeats: 10, status: "scheduled", childPricingRules: [],
    priceAdult: 35500, priceExtraBed: 31950, priceChildWithoutExtraBed: 28400, singleOccupancy: 44375,
    depositType: "fixed", depositValue: 20000, depositAppliesTo: "per_person", balanceDueDaysBefore: 15,
    bookingDeadline: new Date("2099-11-30"), earlyBirdOffer: null,
  }));
  let result;
  await controller.listBookingAccommodationOptions({ body: {
    tourScope: "customise", departureId: "DEP001", adultCount: 1, childDetails: [], gstPercentage: 5,
  } }, { status() { return this; }, json(value) { result = value; } });
  assert.ok(result.data.options.length > 0);
  assert.ok(result.data.options.some(option => option.subtotal === 44375));
  assert.ok(result.data.options.every(option => option.tcsApplicable === true));
});

test("customise booking references use the selected customise tour's type", async t => {
  t.mock.method(Tour, "findOne", () => { throw Error("Must not use master tour type"); });
  t.mock.method(CustomiseTour, "findOne", () => ({ select: () => ({ session: async () => ({ tourType: "International" }) }) }));
  t.mock.method(BookingReferenceCounter, "findOneAndUpdate", async () => ({ value: 1 }));
  t.mock.method(Booking.collection, "insertOne", async () => ({ acknowledged: true }));
  const booking = new Booking({ tourScope: "customise", tourId: "TOUR001", totalGuest: 1,
    adultCount: 1, childCount: 0, guestDetails: [guest], travellers: [], childDetails: [],
    accommodationDetails: { singleOccupancyOneRoom: 1, singleOccupancyTwoRooms: 0,
      doubleOccupancy: 0, twinOccupancy: 0, tripleOccupancy: 0 } });
  await booking.save();
  assert.equal(booking.bookingReference, "AT-I0001");
});

// Existing booking fixtures keep their original tax rates.
const taxSettings = require("../dist/services/booking/booking-tax-settings");
test.beforeEach(t => { t.mock.method(taxSettings, "getBookingTaxSettings", async () => ({ ...taxSettings.defaultBookingTaxSettings })); });
