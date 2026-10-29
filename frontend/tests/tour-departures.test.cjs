const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, relative);
  const loaded = new Module(filename, module);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}
const selector = load("../lib/tour-departures.ts");
const { buildUpcomingTourCards } = load("../lib/home-travel.ts", {
  "@/lib/api": { apiBaseUrl: "http://localhost:5000" },
  "./tour-departures": selector,
});
const now = new Date("2026-10-22T10:00:00+05:30");
const tour = { tourId: "ELLORA", tourName: "Ellora", durationDn: "3 Days", galleryImages: [], destinationId: "INDIA" };
const departure = (departureId, date, overrides = {}) => ({
  id: departureId, departureId, tourId: "ELLORA", departureDate: date,
  returnDate: date && Number.isFinite(Date.parse(date)) ? new Date(Date.parse(date) + 86400000 * 3).toISOString() : null,
  status: "scheduled", seatsAvailable: 5, priceAdult: 1000, bookingDeadline: null, ...overrides,
});
const old = departure("old", "2026-09-05T00:00:00+05:30");
const soldOut = departure("full", "2026-11-01T00:00:00+05:30", { seatsAvailable: 0 });
const next = departure("next", "2026-11-16T00:00:00+05:30");
const later = departure("later", "2026-12-01T00:00:00+05:30");

test("remaining seats always use capacity minus filled seats, including zero capacity", () => {
  const inconsistent = departure("badami", later.departureDate, { totalSeats: 25, filledSeats: 1, seatsAvailable: 15 });
  assert.equal(selector.getDepartureSeatsLeft(inconsistent), 24);
  assert.equal(selector.getDepartureTotalSeats(inconsistent), 25);
  assert.equal(selector.getDepartureFilledSeats(inconsistent), 1);
  assert.equal(selector.getDepartureTotalSeats({ ...inconsistent, totalSeats: 9 }), 9);
  assert.equal(selector.getDepartureSeatsLeft({ ...inconsistent, totalSeats: 0 }), 0);
  assert.equal(selector.getDepartureSeatsLeft({ ...inconsistent, filledSeats: 30 }), 0);
  assert.equal(selector.getDepartureSeatsLeft({ ...inconsistent, filledSeats: 0 }), 25);
  assert.equal(selector.getDepartureSeatsLeft(departure("legacy", later.departureDate)), 5);
});

test("eligibility uses the same remaining-seat calculation as the cards", () => {
  const full = departure("full-count", next.departureDate, { totalSeats: 25, filledSeats: 25, seatsAvailable: 15 });
  const available = departure("available-count", later.departureDate, { totalSeats: 25, filledSeats: 1, seatsAvailable: 0 });
  assert.deepEqual(selector.getBookableDepartures([full, available], now), [available]);
});

test("inconsistent offers flagged by the API and completed departures cannot be offered", () => {
  const invalid = departure("bad-offer", next.departureDate, { validationErrors: [{ path: "returnDate", message: "Duration does not match the tour." }] });
  const completed = departure("completed", next.departureDate, { status: "completed" });
  assert.deepEqual(selector.getBookableDepartures([invalid, completed, later], now), [later]);
});

test("Rustic skips January and selects December with that departure's price", () => {
  const january = departure("jan", "2026-01-07", { priceAdult: 49000 });
  const december = departure("dec", "2026-12-16", { priceAdult: 51000 });
  assert.equal(selector.getNextBookableDeparture([january, december], now), december);
  assert.equal(selector.getNextBookableDeparture([january, december], now).priceAdult, 51000);
});

test("Ellora selects 16 November, skipping September and sold-out November departures", () => {
  const input = [later, old, soldOut, next];
  assert.equal(selector.getNextBookableDeparture(input, now), next);
  assert.deepEqual(selector.getBookableDepartures(input, now), [next, later]);
  assert.deepEqual(input, [later, old, soldOut, next]);
});

test("invalid, closed, cancelled, coming-soon and expired bookings are excluded", () => {
  const input = [old, soldOut,
    departure("invalid", "invalid"), departure("missing", null),
    departure("closed", next.departureDate, { status: "closed" }),
    departure("cancelled", next.departureDate, { status: "cancelled" }),
    departure("soon", next.departureDate, { status: "coming_soon" }),
    departure("expired", next.departureDate, { bookingDeadline: "2026-10-21" }),
    departure("unpriced", next.departureDate, { priceAdult: 0 }),
    departure("no-return", next.departureDate, { returnDate: null }),
    departure("fallback-departure-1", next.departureDate),
  ];
  assert.equal(selector.getNextBookableDeparture(input, now), undefined);
});

test("same-day departures and deadlines use the India calendar day", () => {
  const indiaMidnight = new Date("2026-10-22T19:00:00Z"); // 23 October in India.
  const yesterday = departure("yesterday", "2026-10-22T00:00:00+05:30");
  const today = departure("today", "2026-10-23T00:00:00+05:30", { bookingDeadline: "2026-10-23" });
  assert.deepEqual(selector.getBookableDepartures([yesterday, today], indiaMidnight), [today]);
});

test("curated cards replace pinned old or later dates with the next bookable departure", t => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  for (const departureId of ["old", "full", "later"]) {
    const cards = buildUpcomingTourCards([tour], [later, old, soldOut, next], 6,
      [{ tourId: "ELLORA", departureId, sortOrder: 0 }]);
    assert.equal(cards.length, 1);
    assert.match(cards[0].date, /16.*Nov.*2026/);
  }
});

test("automatic cards use one next departure per tour and never fall back to past dates", t => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const cards = buildUpcomingTourCards([tour], [later, old, soldOut, next]);
  assert.equal(cards.length, 1);
  assert.match(cards[0].date, /16.*Nov.*2026/);
  assert.deepEqual(buildUpcomingTourCards([tour], [old, soldOut]), []);
  assert.deepEqual(buildUpcomingTourCards([tour], [old, soldOut], 6,
    [{ tourId: "ELLORA", departureId: "old", sortOrder: 0 }]), []);
});

test("three curated tours keep their order and fill six slots with distinct upcoming tours", t => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const tours = Array.from({ length: 8 }, (_, index) => ({ ...tour, tourId: `TOUR-${index}`, tourName: `Tour ${index}` }));
  const departures = tours.map((item, index) => departure(`DEP-${index}`, `2026-11-${10 + index}`, { tourId: item.tourId }));
  departures.push(departure("DEP-0-LATER", "2026-12-01", { tourId: "TOUR-0" }));
  const curated = [
    { tourId: "TOUR-7", sortOrder: 2 },
    { tourId: "TOUR-5", sortOrder: 0 },
    { tourId: "TOUR-2", sortOrder: 1 },
  ];
  assert.deepEqual(buildUpcomingTourCards(tours, departures, 6, curated).map(card => card.tourId),
    ["TOUR-5", "TOUR-2", "TOUR-7", "TOUR-0", "TOUR-1", "TOUR-3"]);
});

test("fewer than six eligible tours do not produce sold-out or invented filler cards", t => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const tours = [tour, { ...tour, tourId: "OTHER" }, { ...tour, tourId: "SOLD-OUT" }];
  const departures = [next, departure("OTHER-NEXT", "2026-12-01", { tourId: "OTHER" }),
    departure("SOLD-OUT-NEXT", "2026-12-02", { tourId: "SOLD-OUT", seatsAvailable: 0 })];
  const cards = buildUpcomingTourCards(tours, departures, 6, [{ tourId: tour.tourId, sortOrder: 0 }]);
  assert.deepEqual(cards.map(card => card.tourId), ["ELLORA", "OTHER"]);
});

test("five scheduled tours include a real coming-soon tour as the sixth card without enabling booking", t => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const tours = Array.from({ length: 6 }, (_, index) => ({ ...tour, tourId: `TOUR-${index}`, tourName: `Tour ${index}` }));
  const departures = tours.map((item, index) => departure(`DEP-${index}`, `2026-11-${10 + index}`, { tourId: item.tourId }));
  const comingSoon = { ...departures[5], status: "coming_soon", departureDate: null, returnDate: null, bookingDeadline: null };
  departures[5] = comingSoon;
  const cards = buildUpcomingTourCards(tours, departures);
  assert.equal(cards.length, 6);
  assert.deepEqual(cards.map(card => card.tourId), tours.map(item => item.tourId));
  assert.equal(cards[5].date, "Coming Soon");
  assert.equal(selector.getNextBookableDeparture([comingSoon], now), undefined);
});
