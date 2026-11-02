const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Booking } = require("../dist/models/booking.model");
const { formatBooking } = require("../dist/controllers/booking.controller");

// Exercise the compiled request schema without invoking payment or database services.
const controller = fs.readFileSync(path.join(__dirname, "../dist/controllers/booking.controller.js"), "utf8");
const start = controller.indexOf("const requiredTextField =");
const end = controller.indexOf("const airFlightChargesPayloadSchema =", start);
assert.ok(start >= 0 && end > start);
const context = { zod_1: require("zod"), Date };
vm.createContext(context);
vm.runInContext(controller.slice(start, end) + "\nglobalThis.schema = bookingPayloadSchema;", context);

function fixture() {
  const lead = { title: "Ms", firstName: "Test", lastName: "Traveller", countryCode: "+91", mobileNumber: "9000000000",
    email: "test@example.test", dateOfBirth: "1990-01-01", gender: "female", address: "Pune", pincode: "411001", isNri: true };
  const child = { ...lead, firstName: "Child", mobileNumber: "", email: "", dateOfBirth: "2020-01-01" };
  const infant = { ...child, firstName: "Infant", dateOfBirth: "2026-01-01" };
  return { tourId: "TOURTEST", totalGuest: 3, adultCount: 1, childCount: 2, childDetails: [{ age: 6 }, { age: 0 }],
    guestDetails: [lead, child, infant], travellers: [lead, child, infant].map((guest, i) => ({ ...guest, id: `traveller-${i}`, type: i === 0 ? "adult" : "child" })) };
}

test("public payloads cannot declare their own TCS amount, eligibility or verification", () => {
  const input = { ...fixture(), tcsAmount: 0, tcsPercentage: 0, tcsApplicable: false, tcsExemptionVerified: true };
  const payload = context.schema.parse(input);
  for (const key of ["tcsAmount", "tcsPercentage", "tcsApplicable", "tcsExemptionVerified"]) assert.equal(payload[key], undefined);
  assert.equal(new Booking(payload).tcsExemptionVerified, false);
});

test("booking API permits child and infant guests without mobile numbers", () => {
  const payload = context.schema.parse(fixture());
  assert.equal(payload.guestDetails[1].mobileNumber, "");
  assert.equal(payload.guestDetails[2].mobileNumber, "");
  assert.equal(payload.travellers[1].pincode, "411001");
});

test("adult mobile numbers stay required and supplied invalid child mobile numbers are rejected", () => {
  const missingAdult = fixture(); missingAdult.guestDetails[0].mobileNumber = "";
  assert.equal(context.schema.safeParse(missingAdult).success, false);
  const malformedChild = fixture(); malformedChild.guestDetails[1].mobileNumber = "abc";
  assert.equal(context.schema.safeParse(malformedChild).success, false);
});

test("PIN codes survive booking model persistence and API formatting", async () => {
  const payload = context.schema.parse(fixture());
  const booking = new Booking(payload);
  await booking.validate();
  const restored = new Booking(booking.toObject());
  const formatted = formatBooking(restored);
  assert.equal(formatted.guestDetails[0].pincode, "411001");
  assert.equal(formatted.guestDetails[0].isNri, true);
  assert.equal(formatted.travellers[0].isNri, true);
  assert.equal(formatted.travellers[1].pincode, "411001");
  assert.equal(formatted.guestDetails[2].mobileNumber, "");
  restored.guestDetails[0].mobileNumber = "";
  await assert.rejects(restored.validate(), /Adult traveller mobile number is required/);
});

test("invalid PIN codes are rejected while existing clients without PIN codes remain supported", () => {
  const invalid = fixture(); invalid.guestDetails[0].pincode = "41100";
  assert.equal(context.schema.safeParse(invalid).success, false);
  const legacy = fixture();
  for (const item of [...legacy.guestDetails, ...legacy.travellers]) delete item.pincode;
  assert.equal(context.schema.safeParse(legacy).success, true);
});
