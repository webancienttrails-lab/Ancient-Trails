const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/bookings/page.tsx"), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "getBookingCategory"
);
assert.ok(declaration);
const code = ts.transpileModule(declaration.getText(parsed), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = vm.createContext({});
vm.runInContext(code, context);
const category = context.getBookingCategory;

test("regular bookings include older records without a tour scope", () => {
  assert.equal(category({ totalGuest: 1 }), "normal");
  assert.equal(category({ totalGuest: 9, tourScope: "master" }), "normal");
});

test("only bookings converted from group enquiries are group bookings", () => {
  assert.equal(category({ totalGuest: 1, sourceEnquiryCategory: "group" }), "group");
  assert.equal(category({ totalGuest: 33, sourceEnquiryCategory: "group" }), "group");
  assert.equal(category({ totalGuest: 33 }), "normal");
});

test("customised bookings stay in their category regardless of group size", () => {
  for (const totalGuest of [1, 10, 33]) {
    assert.equal(category({ totalGuest, tourScope: "customise", sourceEnquiryCategory: "customise" }), "customise");
  }
});

test("cancelled bookings move out of every active category", () => {
  for (const booking of [
    { totalGuest: 1 },
    { totalGuest: 10, sourceEnquiryCategory: "group" },
    { totalGuest: 33, tourScope: "customise" },
  ]) {
    assert.equal(category({ ...booking, bookingStatus: "cancelled" }), "cancelled");
  }
});

test("expired and pending bookings keep their original category", () => {
  for (const bookingStatus of ["expired", "payment_pending", "payment_processing"]) {
    assert.equal(category({ bookingStatus, totalGuest: 1 }), "normal");
    assert.equal(category({ bookingStatus, totalGuest: 10, sourceEnquiryCategory: "group" }), "group");
  }
});
