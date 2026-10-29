const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/tour-booking.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { generateOccupancyOptions, selectAccommodationOption } = loaded.exports;
const departure = {
  departureId: "DEP014", departureDate: "2026-11-14", returnDate: "2026-11-19",
  status: "scheduled", priceAdult: 40000, singleOccupancy: 52000,
  priceExtraBed: 36000, priceChildWithoutExtraBed: 28000, childPricingRules: [],
};
const optionsFor = adults => generateOccupancyOptions({ adults, children: [], selectedDeparture: departure });

test("a solo traveller defaults to twin sharing at 40000, giving 42000 including GST", () => {
  const options = optionsFor(1);
  const selected = selectAccommodationOption(options, "");
  assert.equal(options[0].title, "Single Occupancy");
  assert.equal(selected.title, "Twin Sharing");
  assert.equal(selected.total, 40000);
  assert.equal(selected.total + Math.round(selected.total * .05), 42000);
  assert.equal(selectAccommodationOption([...options].reverse(), "").id, selected.id);
});

test("two adults default to twin occupancy at the advertised price per traveller", () => {
  const selected = selectAccommodationOption(optionsFor(2), "");
  assert.equal(selected.title, "Twin Occupancy");
  assert.equal(selected.total, 80000);
});

test("explicit selection of single occupancy is retained and charged correctly", () => {
  const options = optionsFor(1);
  const single = options.find(option => option.title === "Single Occupancy");
  assert.equal(selectAccommodationOption(options, single.id), single);
  assert.equal(single.total, 52000);
});

test("no matching twin room or an invalid previous selection requires a fresh choice", () => {
  const options = optionsFor(1);
  assert.equal(selectAccommodationOption(options.filter(option => option.title !== "Twin Sharing"), ""), undefined);
  assert.equal(selectAccommodationOption(options, "old-selection"), undefined);
  assert.equal(selectAccommodationOption([], ""), undefined);
  assert.equal(selectAccommodationOption(optionsFor(3), ""), undefined);
});
