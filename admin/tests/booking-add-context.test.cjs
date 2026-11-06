const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, "../lib/booking-add-context.ts"), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject });
const context = exportsObject.getBookingAddContext;

test("regular and unsupported categories use the regular booking form", () => {
  for (const category of [null, "normal", "cancelled", "unknown"]) {
    assert.equal(context(category).tourScope, "master");
    assert.equal(context(category).title, "Add Booking");
  }
});

test("customised bookings load the customised tour catalogue", () => {
  assert.equal(context("customise").tourScope, "customise");
  assert.equal(context("customise").title, "Add Customised Booking");
});

test("group bookings use the group form with the regular tour catalogue", () => {
  assert.equal(context("group").tourScope, "master");
  assert.equal(context("group").title, "Add Group Booking");
});

test("the actual enquiry category takes precedence over the URL category", () => {
  assert.equal(context("normal", "customise").tourScope, "customise");
  assert.equal(context("customise", "group").title, "Add Group Booking");
  assert.equal(context("group", "normal").title, "Add Booking");
});
