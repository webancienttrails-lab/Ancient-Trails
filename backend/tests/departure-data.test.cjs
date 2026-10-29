const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDepartureOffer } = require("../dist/services/departure/departure-offer.validation");
const { validateDepartureForBooking } = require("../dist/services/departure/departure.validation");
const { completePastDepartures, millisecondsUntilNextTravelDay } = require("../dist/services/departure/departure-maintenance.service");
const { Tour } = require("../dist/models/tour.model");
const { TourDeparture } = require("../dist/models/tourDeparture.model");
const { createTourDeparture, updateTourDeparture } = require("../dist/controllers/tour.controller");

const now = new Date("2026-10-26T12:00:00+05:30");
const departure = {
  departureId: "CHECK-DEP", tourId: "CHECK-TOUR", destinationId: "CHECK-DEST",
  departureDate: "2026-11-16", returnDate: "2026-11-17", bookingDeadline: "2026-11-01",
  priceAdult: 11000, singleOccupancy: 14300, depositType: "fixed", depositValue: 5000,
  priceExtraBed: 9000, priceChildWithoutExtraBed: 8000, balanceDueDaysBefore: 10,
  depositAppliesTo: "per_person", seatsAvailable: 25, totalSeats: 25, status: "scheduled",
  childPricingRules: [], earlyBirdOffer: null,
};

test("duration mismatches and single occupancy below the adult price are allowed", () => {
  const ellora = validateDepartureOffer({ ...departure, returnDate: "2026-12-16", priceAdult: 50000, singleOccupancy: 20000 }, "2D/1N", now);
  assert.deepEqual(ellora, []);
  const tamilnadu = validateDepartureOffer({ ...departure, departureDate: "2027-02-15", returnDate: "2027-02-18" }, "9D/8N", now);
  assert.deepEqual(tamilnadu, []);
});

test("past departure and booking deadline restrictions remain enforced", () => {
  const rustic = validateDepartureOffer({ ...departure, departureDate: "2026-01-07", returnDate: "2026-01-14", bookingDeadline: "2026-11-30" }, "8D/7N", now);
  assert.deepEqual(rustic.map(issue => issue.path).sort(), ["bookingDeadline", "departureDate"]);
});

test("valid durations include day trips, named durations and India timezone boundaries", () => {
  assert.deepEqual(validateDepartureOffer(departure, "2D/1N", now), []);
  assert.deepEqual(validateDepartureOffer(departure, "2 Days / 1 Night", now), []);
  assert.deepEqual(validateDepartureOffer({ ...departure, returnDate: departure.departureDate }, "1 Day", now), []);
  assert.deepEqual(validateDepartureOffer({ ...departure, departureDate: "2026-11-15T20:00:00Z", returnDate: "2026-11-17T01:00:00Z" }, "2D/1N", now), []);
});

test("deposit rules distinguish percentage from fixed deposits and allow unavailable single rooms", () => {
  assert.ok(validateDepartureOffer({ ...departure, depositValue: 12000 }, "2D/1N", now).some(issue => issue.path === "depositValue"));
  assert.ok(validateDepartureOffer({ ...departure, depositType: "percentage", depositValue: 101 }, "2D/1N", now).some(issue => issue.path === "depositValue"));
  assert.deepEqual(validateDepartureOffer({ ...departure, depositType: "percentage", depositValue: 100, singleOccupancy: 0 }, "2D/1N", now), []);
  assert.ok(validateDepartureOffer({ ...departure, bookingDeadline: departure.departureDate }, "2D/1N", now).some(issue => issue.path === "bookingDeadline"));
  assert.deepEqual(validateDepartureOffer({ ...departure, status: "coming_soon", departureDate: null, returnDate: null, bookingDeadline: null }, "2D/1N", now), []);
});

test("both admin create and update reject invalid offers with field errors before any write", async t => {
  t.mock.method(Tour, "findOne", async () => ({ tourId: "CHECK-TOUR", durationDn: "2D/1N" }));
  const create = t.mock.method(TourDeparture, "create", async () => assert.fail("Must not create invalid departure"));
  const update = t.mock.method(TourDeparture, "findByIdAndUpdate", async () => assert.fail("Must not update invalid departure"));
  for (const handler of [createTourDeparture, updateTourDeparture]) {
    for (const invalid of [{ returnDate: "2026-11-15" }, { depositValue: 12000 }, { bookingDeadline: "2026-11-16" }]) {
      await assert.rejects(handler({ body: { ...departure, ...invalid }, params: { id: "000000000000000000000001" } }, {}), error => {
        assert.equal(error.statusCode, 400);
        const expectedPath = Object.hasOwn(invalid, "returnDate") ? "departureDate" : Object.keys(invalid)[0];
        assert.ok(error.details.some(issue => issue.path === expectedPath));
        return true;
      });
    }
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});

test("direct booking retains date/status checks while allowing independent duration and single pricing", () => {
  assert.equal(validateDepartureForBooking({ ...departure, status: "completed" }, 1, now).isValid, false);
  assert.equal(validateDepartureForBooking({ ...departure, departureDate: "2026-01-07", returnDate: "2026-01-14" }, 1, now).isValid, false);
  assert.equal(validateDepartureForBooking({ ...departure, returnDate: "2026-12-16", singleOccupancy: 100 }, 1, now, "2D/1N").isValid, true);
  assert.equal(validateDepartureForBooking({ ...departure, returnDate: "2026-11-15" }, 1, now, "2D/1N").isValid, false);
  assert.equal(validateDepartureForBooking(departure, 1, now, "2D/1N").isValid, true);
});

test("nightly completion uses the return date and India midnight and never changes prices or deletes records", async t => {
  const update = t.mock.method(TourDeparture, "updateMany", async () => ({ modifiedCount: 2 }));
  await completePastDepartures(now);
  assert.deepEqual(update.mock.calls[0].arguments, [
    { status: "scheduled", returnDate: { $ne: null, $lt: new Date("2026-10-26T00:00:00+05:30") } },
    { $set: { status: "completed" } },
  ]);
  assert.equal(millisecondsUntilNextTravelDay(new Date("2026-10-26T23:59:00+05:30")), 60000);
  assert.equal(millisecondsUntilNextTravelDay(new Date("2026-10-27T00:00:00+05:30")), 86400000);
});
