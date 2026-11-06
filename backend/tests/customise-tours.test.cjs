require("tsx/cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { Tour } = require("../src/models/tour.model.ts");
const { TourDeparture } = require("../src/models/tourDeparture.model.ts");
const { Booking } = require("../src/models/booking.model.ts");
const { Destination } = require("../src/models/destination.model.ts");
const { CustomiseTour, CustomiseTourDeparture, CustomiseTourItinerary } = require("../src/models/customiseTour.model.ts");
const controller = require("../src/controllers/tour.controller.ts");
const response = () => ({ status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
const request = (body = {}, params = {}) => ({ baseUrl: "/api/admin/tours/customise", body, params, query: {} });
const tourPayload = { tourId: "TOUR001", tourName: "Custom Trail", tourType: "Domestic", tourFormat: "Long Trails", destinationIds: ["DEST001"], durationDn: "2D/1N" };
const departurePayload = { departureId: "DEP001", tourId: "TOUR001", status: "coming_soon", departureDate: null, returnDate: null, bookingDeadline: null, earlyBirdOffer: null, seatsAvailable: 30, priceAdult: 10000, depositValue: 1000 };
function destinations(t) {
  t.mock.method(Destination, "find", () => ({ select: () => ({ lean: async () => [{ destinationId: "DEST001" }] }) }));
}

test("customised tours, departures and itineraries have independent collections", () => {
  assert.notEqual(CustomiseTour.collection.name, Tour.collection.name);
  assert.notEqual(CustomiseTourDeparture.collection.name, TourDeparture.collection.name);
  assert.equal(CustomiseTourItinerary.collection.name, "customiseTourItineraries");
  assert.ok(CustomiseTour.schema.path("tourName"));
  assert.ok(CustomiseTourDeparture.schema.path("priceAdult"));
});

test("Add Tour creates only a customised record, allowing an ID also used in Tour Master", async (t) => {
  destinations(t);
  t.mock.method(Tour, "create", () => assert.fail("Must not create a master tour"));
  const create = t.mock.method(CustomiseTour, "create", async (payload) => new CustomiseTour(payload));
  const res = response();
  await controller.createTour(request(tourPayload), res);
  assert.equal(res.statusCode, 201);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(res.body.data.tour.tourId, "TOUR001");
});

test("Add Departure accepts customised tours and refuses a master-only tour", async (t) => {
  destinations(t);
  t.mock.method(Tour, "findOne", () => assert.fail("Must not look up Tour Master"));
  const lookup = t.mock.method(CustomiseTour, "findOne", async () => new CustomiseTour(tourPayload));
  t.mock.method(TourDeparture, "create", () => assert.fail("Must not create a master departure"));
  const create = t.mock.method(CustomiseTourDeparture, "create", async (payload) => new CustomiseTourDeparture(payload));
  const res = response();
  await controller.createTourDeparture(request(departurePayload), res);
  assert.equal(res.statusCode, 201);
  assert.equal(create.mock.callCount(), 1);
  lookup.mock.mockImplementation(async () => null);
  await assert.rejects(controller.createTourDeparture(request(departurePayload), response()), /does not exist/);
  assert.equal(create.mock.callCount(), 1);
});

test("customised departure lists never read master booking seat counts", async (t) => {
  t.mock.method(TourDeparture, "find", () => assert.fail("Must not read master departures"));
  t.mock.method(Booking, "aggregate", () => assert.fail("Must not read master booking seats"));
  t.mock.method(CustomiseTourDeparture, "find", () => ({ sort: () => ({ limit: async () => [new CustomiseTourDeparture(departurePayload)] }) }));
  t.mock.method(CustomiseTour, "find", () => ({ select: () => ({ lean: async () => [tourPayload] }) }));
  const res = response();
  await controller.listTourDepartures(request(), res);
  assert.equal(res.body.data.departures.length, 1);
  assert.equal(res.body.data.departures[0].seatsAvailable, 30);
});

test("renaming a customised tour updates only its own links, never master bookings", async (t) => {
  destinations(t);
  t.mock.method(CustomiseTour, "findById", async () => new CustomiseTour(tourPayload));
  t.mock.method(CustomiseTour, "findByIdAndUpdate", async (id, payload) => new CustomiseTour(payload));
  t.mock.method(Tour, "findById", () => assert.fail("Must not read master tour"));
  t.mock.method(Booking, "updateMany", () => assert.fail("Must not update master bookings"));
  const linkedDepartures = t.mock.method(CustomiseTourDeparture, "updateMany", async () => ({}));
  const linkedItineraries = t.mock.method(CustomiseTourItinerary, "updateMany", async () => ({}));
  const res = response();
  await controller.updateTour(request({ ...tourPayload, tourId: "CUSTOM002" }, { id: "custom-db-id" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(linkedDepartures.mock.callCount(), 2);
  assert.equal(linkedItineraries.mock.callCount(), 1);
});

test("custom deletes cannot delete master records even when their IDs are supplied", async (t) => {
  t.mock.method(Tour, "findByIdAndDelete", () => assert.fail("Must not delete a master tour"));
  t.mock.method(TourDeparture, "findByIdAndDelete", () => assert.fail("Must not delete a master departure"));
  t.mock.method(CustomiseTour, "findByIdAndDelete", async () => null);
  t.mock.method(CustomiseTourDeparture, "findByIdAndDelete", async () => null);
  for (const handler of [controller.deleteTour, controller.deleteTourDeparture]) {
    await assert.rejects(handler(request({}, { id: "000000000000000000000001" }), response()), (error) => error.statusCode === 404);
  }
});

test("standard Tour Master writes still use the original collection", async (t) => {
  destinations(t);
  t.mock.method(CustomiseTour, "create", () => assert.fail("Must not create a customised tour"));
  const create = t.mock.method(Tour, "create", async (payload) => new Tour(payload));
  const res = response();
  await controller.createTour({ ...request(tourPayload), baseUrl: "/api/admin/tours" }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(create.mock.callCount(), 1);
});
