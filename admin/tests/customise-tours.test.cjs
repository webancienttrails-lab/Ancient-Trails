const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const calls = [];
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/tours.ts"), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, {
  exports: exportsObject, URL,
  require(name) {
    if (name === "@/lib/admin-auth") return { getAdminSession: () => ({ sessionId: "test" }) };
    if (name === "@/lib/api") return { apiRequest: async (url, options) => { calls.push({ url, options }); return { data: {} }; } };
    return {};
  },
});

test("customise CRUD only uses the isolated API, including departures and itineraries", async () => {
  calls.length = 0;
  const api = exportsObject.createAdminTourApi("customise");
  await api.listAdminTours();
  await api.createAdminTour({ tourId: "TOUR001" });
  await api.updateAdminTour("db-tour", {});
  await api.deleteAdminTour("db-tour");
  await api.listAdminTourDepartures();
  await api.createAdminTourDeparture({ tourId: "TOUR001" });
  await api.updateAdminTourDeparture("db-departure", {});
  await api.deleteAdminTourDeparture("db-departure");
  await api.listAdminTourItineraries();
  await api.createAdminTourItinerary({});
  await api.updateAdminTourItinerary("db-itinerary", {});
  assert.equal(calls.length, 11);
  for (const call of calls) assert.ok(call.url.startsWith("/api/admin/tours/customise"), call.url);
  assert.equal(calls[5].url, "/api/admin/tours/customise/departures");
});

test("master requests retain the original API routes", async () => {
  calls.length = 0;
  const api = exportsObject.createAdminTourApi("master");
  await api.listAdminTours();
  await api.listAdminTourDepartures();
  assert.deepEqual(calls.map((call) => call.url), ["/api/admin/tours", "/api/admin/tours/departures"]);
});

test("customise scope survives add, edit, view, and return navigation", () => {
  for (const href of ["/tours", "/tours/add?type=departure", "/tours/edit?type=tour&id=123", "/tours/view?type=itinerary&id=456"]) {
    const url = new URL(exportsObject.withTourScope(href, "customise"), "http://admin.local");
    assert.equal(url.searchParams.get("scope"), "customise");
    assert.equal(url.pathname, new URL(href, "http://admin.local").pathname);
    assert.equal(exportsObject.withTourScope(href, "master"), href);
  }
});
