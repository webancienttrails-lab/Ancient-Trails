const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => imports[name] || {}, Date });
  return exports;
}
const enquiries = load("lib/enquiries.ts");
const { getEnquiryBookingPrefill } = load("lib/enquiry-booking.ts", { "@/lib/enquiries": enquiries });
const tours = [{ id: "db-tour", tourId: "TOUR001", tourName: "Heritage Trail" }];
const departures = [{ departureId: "DEP001", tourId: "TOUR001", departureDate: "2099-12-13T00:00:00Z", status: "scheduled" }];
const enquiry = {
  name: "Asha Patil", phone: "+91 98765 43210", email: "asha@example.com", gender: "Female",
  subject: "Tour enquiry - Heritage Trail",
  message: "Please call me.\nTour: Heritage Trail\nTour ID: TOUR001\nGuests: 30 Adults, 2 Children, 1 Infant\nTravel Date: 13 Dec 2099",
};

test("conversion prefills the matching tour, departure, large group and lead contact", () => {
  const value = getEnquiryBookingPrefill(enquiry, tours, departures);
  assert.equal(value.sourceEnquiryCategory, "group");
  assert.equal(value.tourId, "TOUR001");
  assert.equal(value.departureId, "DEP001");
  assert.equal(value.adultCount, 30);
  assert.equal(value.childCount, 3);
  assert.equal(value.lead.firstName, "Asha");
  assert.equal(value.lead.lastName, "Patil");
  assert.equal(value.lead.mobileNumber, "9876543210");
  assert.equal(value.lead.email, enquiry.email);
  assert.equal(value.lead.gender, "Female");
});

test("missing tours and dates remain unselected instead of selecting another tour", () => {
  const value = getEnquiryBookingPrefill({ ...enquiry, subject: "Contact", message: "Please call me." }, tours, departures);
  assert.equal(value.sourceEnquiryCategory, "normal");
  assert.equal(value.tourId, "");
  assert.equal(value.departureId, "");
  assert.equal(value.adultCount, 1);
  assert.equal(value.childCount, 0);
});

test("saved Tour Master IDs take precedence and cancelled departures are not selected", () => {
  const value = getEnquiryBookingPrefill({ ...enquiry, tourId: "db-tour" }, tours, [{ ...departures[0], status: "cancelled" }]);
  assert.equal(value.tourId, "TOUR001");
  assert.equal(value.departureId, "");
});

test("customise conversion uses the preferred destination and enquiry guest counts", () => {
  const value = getEnquiryBookingPrefill({
    ...enquiry,
    subject: "Customised tour request - Jordan",
    message: "Please call me.\nPreferred destination: Jordan",
  }, [{ ...tours[0], tourName: "Jordan" }], departures);
  assert.equal(value.tourId, "TOUR001");
  assert.equal(value.departureId, "");
  assert.equal(value.lead.firstName, "Asha");

  const saved = getEnquiryBookingPrefill({
    ...enquiry,
    subject: "Customised tour enquiry - Jordan",
    tourName: "Jordan",
    message: "Please call me.\nTour: Jordan\nGuests: 4 Adult, 2 Child, 1 Infant",
  }, [{ ...tours[0], tourName: "Jordan" }], departures);
  assert.equal(saved.tourId, "TOUR001");
  assert.equal(saved.adultCount, 4);
  assert.equal(saved.childCount, 3);
});
