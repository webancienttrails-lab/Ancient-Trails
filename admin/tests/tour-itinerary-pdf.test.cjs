const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/tour-itinerary-pdf.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject, require });
const tour = { tourId: "CUSTOM001", tourName: "Private Heritage Trail", durationDn: "2D/1N" };
const day = { dayNumber: 1, title: "Arrival", summary: "Explore the heritage sites.", placesVisited: ["Hampi"], hotels: "Heritage Hotel", walkingDifficulty: "Easy", meals: "Breakfast, Dinner" };

test("itinerary PDF contains the selected custom tour and all saved day details", () => {
  const pdf = exportsObject.createTourItineraryPdf(tour, { tourId: tour.tourId, itinerarySummary: "Your private journey.", days: [day] });
  const output = pdf.output();
  for (const text of ["Private Heritage Trail", "CUSTOM001", "Your private journey.", "Day 1 - Arrival", "Explore the heritage sites.", "Places visited: Hampi", "Hotels: Heritage Hotel", "Walking difficulty: Easy", "Meals: Breakfast, Dinner"]) assert.ok(output.includes(text), text);
  assert.equal(pdf.getNumberOfPages(), 1);
});

test("long itineraries paginate and print the days in order", () => {
  const days = Array.from({ length: 12 }, (_, index) => ({ ...day, dayNumber: 12 - index, summary: "A detailed heritage visit with time for exploration. ".repeat(60) }));
  const pdf = exportsObject.createTourItineraryPdf(tour, { tourId: tour.tourId, itinerarySummary: "A longer journey.", days });
  assert.ok(pdf.getNumberOfPages() > 1);
  const output = pdf.output();
  assert.ok(output.indexOf("Day 1 - Arrival") < output.indexOf("Day 12 - Arrival"));
  assert.ok(output.includes(`1 / ${pdf.getNumberOfPages()}`));
  assert.equal(days[0].dayNumber, 12, "Saved itinerary order is not mutated");
});

test("an itinerary for another tour cannot be exported", () => {
  assert.throws(() => exportsObject.createTourItineraryPdf(tour, { tourId: "MASTER001", itinerarySummary: "", days: [day] }), /does not belong/);
});
