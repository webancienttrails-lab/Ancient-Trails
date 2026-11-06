const test = require("node:test");
const assert = require("node:assert/strict");
const { generateOccupancyOptions } = require("../dist/services/accommodation/accommodation.generator");
const { validateDepartureForBooking } = require("../dist/services/departure/departure.validation");
const { Booking } = require("../dist/models/booking.model");
const lead = require("../dist/controllers/bookingLead.controller");
const controller = require("../dist/controllers/booking.controller");

const departure = {
  departureId: "DEP001", tourId: "TOUR001", destinationId: "DOM001",
  departureDate: "2099-12-13", returnDate: "2099-12-18", seatsAvailable: 2000,
  priceAdult: 35500, priceExtraBed: 31950, priceChildWithoutExtraBed: 28400, singleOccupancy: 44375,
  depositType: "fixed", depositValue: 20000, depositAppliesTo: "per_person", balanceDueDaysBefore: 15,
  earlyBirdOffer: null, bookingDeadline: "2099-11-30", status: "scheduled", childPricingRules: [],
};

test("admin accommodation supports over 1000 travellers while public limits remain", () => {
  const options = generateOccupancyOptions({ adults: 1002, children: [], selectedDeparture: departure, allowLargeGroups: true });
  assert.ok(options.length > 0);
  for (const option of options) {
    const allocations = option.rooms.flatMap((room) => room.allocations);
    assert.equal(allocations.length, 1002);
    assert.equal(new Set(allocations.map((person) => person.travellerId)).size, 1002);
    assert.equal(option.total, allocations.reduce((sum, person) => sum + person.amount, 0));
  }
  assert.throws(() => generateOccupancyOptions({ adults: 26, children: [], selectedDeparture: departure }), /maximum of 25/);
});

test("large admin groups still respect availability and departure status", () => {
  const now = new Date("2099-01-01");
  assert.equal(validateDepartureForBooking(departure, 1002, now, "5N/6D", true).isValid, true);
  assert.equal(validateDepartureForBooking(departure, 1002, now, "5N/6D").isValid, false);
  assert.equal(validateDepartureForBooking({ ...departure, seatsAvailable: 20 }, 26, now, "5N/6D", true).isValid, false);
  assert.equal(validateDepartureForBooking({ ...departure, status: "closed" }, 26, now, "5N/6D", true).isValid, false);
});

test("admin booking accepts large groups and still requires lead verification", async (t) => {
  const guest = { title: "Mr", firstName: "Guest", lastName: "Traveller", countryCode: "+91", mobileNumber: "9876543210", email: "guest@example.com", dateOfBirth: "1990-01-01", gender: "Male", address: "Pune" };
  const sentinel = Error("Lead verification reached");
  t.mock.method(lead, "assertAdminLeadVerification", () => { throw sentinel; });
  const body = {
    tourId: "TOUR001", totalGuest: 1001, adultCount: 1001, childCount: 0,
    guestDetails: Array.from({ length: 1001 }, () => ({ ...guest })), childDetails: [],
    travellers: Array.from({ length: 1001 }, (_, index) => ({ id: `adult-${index + 1}`, type: "adult" })),
    accommodationDetails: { singleOccupancyOneRoom: 0, singleOccupancyTwoRooms: 0, doubleOccupancy: 0, twinOccupancy: 501, tripleOccupancy: 0 },
  };
  await assert.rejects(controller.createBooking({ body }, {}), (error) => error === sentinel);
  await assert.rejects(controller.createOfflineBooking({ body }, {}), (error) => error.statusCode === 400 && error !== sentinel);
  const booking = new Booking(body);
  const errors = booking.validateSync()?.errors || {};
  for (const key of ["totalGuest", "adultCount", "childCount", "accommodationDetails.twinOccupancy"]) assert.equal(errors[key], undefined);
});

// Existing booking fixtures keep their original tax rates.
const taxSettings = require("../dist/services/booking/booking-tax-settings");
test.beforeEach(t => { t.mock.method(taxSettings, "getBookingTaxSettings", async () => ({ ...taxSettings.defaultBookingTaxSettings })); });
