const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(relative) {
  const filename = path.resolve(__dirname, relative);
  const loaded = new Module(filename, module);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}
const { getTourExperienceSearchText } = load("../lib/experience-search.ts");
const { getExperiencesHref } = load("../lib/routes.ts");
const tour = { tourId: "TOUR1", tourName: "Royal Heritage", destinationId: "JAIPUR", destinationIds: ["UDAIPUR"], inclusions: [] };
const destinations = [
  { destinationId: "JAIPUR", destinationName: "Jaipur", state: "Rajasthan", region: "North India" },
  { destinationId: "UDAIPUR", destinationName: "Udaipur", state: "Rajasthan" },
  { destinationId: "GOA", destinationName: "Goa", state: "Goa" },
];
test("experience search matches tour names and all linked destination names, states and regions", () => {
  const text = getTourExperienceSearchText(tour, [], destinations);
  for (const query of ["royal heritage", "jaipur", "udaipur", "rajasthan", "north india"]) assert.ok(text.includes(query), query);
  assert.equal(text.includes("goa"), false);
});
test("experience search retains traveller and review matches", () => {
  const text = getTourExperienceSearchText(tour, [{ travellerName: "Test Traveller", title: "Palace Visit", writtenReview: "Wonderful journey" }], []);
  for (const query of ["test traveller", "palace visit", "wonderful journey"]) assert.ok(text.includes(query));
});
test("Explore Experiences targets the listing and carries a safely encoded destination filter", () => {
  assert.equal(getExperiencesHref(), "/experiences");
  const href = getExperiencesHref({ destinationId: "GOA & COAST" });
  const url = new URL(href, "https://example.com");
  assert.equal(url.pathname, "/experiences");
  assert.equal(url.searchParams.get("destination"), "GOA & COAST");
});
