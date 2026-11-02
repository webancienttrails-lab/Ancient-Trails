const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../components/user-dashboard/user-booking-detail-page.tsx"), "utf8");
const parsed = ts.createSourceFile("kyc.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const statements = parsed.statements.filter(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === "isInternationalBooking" ||
  ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ["domesticKycDocumentOptions", "internationalKycDocumentOptions"].includes(item.name.getText(parsed)))
);
assert.equal(statements.length, 3);
const policy = fs.readFileSync(path.join(__dirname, "../../backend/src/services/booking/booking.kyc.ts"), "utf8");
const context = { exports: {} };
vm.createContext(context);
vm.runInContext(ts.transpileModule(statements.map(node => node.getText(parsed)).join("\n") + "\n" + policy, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText + "\nglobalThis.options = { domestic: domesticKycDocumentOptions, international: internationalKycDocumentOptions };", context);
const values = options => Array.from(options, option => option.value).sort();

test("international tours offer and require only PAN", () => {
  assert.deepEqual(values(context.options.international), ["pan_card"]);
  assert.deepEqual(Array.from(context.exports.getBookingKycDocumentTypes("International", "Egypt")), ["pan_card"]);
  assert.equal(context.isInternationalBooking({ tour: { tourType: "International" }, booking: { guestDetails: [{ countryCode: "+91" }] } }), true);
});

test("domestic tours offer Voter ID, Driving License and PAN regardless of phone country code", () => {
  assert.deepEqual(values(context.options.domestic), ["driving_license", "pan_card", "voter_id"]);
  assert.deepEqual(Array.from(context.exports.getBookingKycDocumentTypes("Domestic", "India")).sort(), values(context.options.domestic));
  assert.equal(context.isInternationalBooking({ tour: { tourType: "Domestic" }, booking: { guestDetails: [{ countryCode: "+44" }] } }), false);
});

test("destination country supplies the policy for older bookings without tour type", () => {
  assert.equal(context.isInternationalBooking({ destination: { countryRegion: " Egypt " } }), true);
  assert.equal(context.isInternationalBooking({ destination: { countryRegion: " India " } }), false);
  assert.deepEqual(Array.from(context.exports.getBookingKycDocumentTypes(undefined, " Egypt ")), ["pan_card"]);
});

test("international NRI travellers can upload Visa and optional OCI as well as PAN", () => {
  const base = context.exports.getBookingKycDocumentTypes("International", "Egypt");
  const nri = context.exports.getTravellerKycDocumentTypes(base, true);
  assert.deepEqual(Array.from(nri), ["pan_card", "visa", "oci"]);
  assert.deepEqual(Array.from(context.exports.getTravellerKycDocumentTypes(base, false)), ["pan_card"]);
  const domestic = context.exports.getBookingKycDocumentTypes("Domestic", "India");
  assert.deepEqual(Array.from(context.exports.getTravellerKycDocumentTypes(domestic, true)), Array.from(domestic));
});

test("NRI KYC requires PAN and Visa while OCI remains optional", () => {
  const policy = context.exports;
  const types = policy.getTravellerKycDocumentTypes(policy.getBookingKycDocumentTypes("International", "Egypt"), true);
  assert.equal(policy.hasRequiredBookingKycDocuments(["pan_card"], types), false);
  assert.equal(policy.hasRequiredBookingKycDocuments(["visa", "oci"], types), false);
  assert.equal(policy.hasRequiredBookingKycDocuments(["pan_card", "oci"], types), false);
  assert.equal(policy.hasRequiredBookingKycDocuments(["pan_card", "visa"], types), true);
  assert.equal(policy.hasRequiredBookingKycDocuments(["pan_card", "visa", "oci"], types), true);
  assert.equal(policy.hasRequiredBookingKycDocuments(["voter_id"], policy.getBookingKycDocumentTypes("Domestic")), true);
});
