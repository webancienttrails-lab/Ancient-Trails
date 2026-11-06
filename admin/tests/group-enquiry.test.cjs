const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = fs.readFileSync(path.join(__dirname, "../app/enquiries/group-enquiry-form.tsx"), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const tours = [
  { id: "tour-db-1", tourId: "TOUR001", tourName: "Flavours of Badami & Hampi" },
  { id: "tour-db-2", tourId: "TOUR002", tourName: "Heritage Trail" },
];

function load(states = []) {
  const exports = {};
  let stateIndex = 0;
  const wrapper = ({ children }) => React.createElement("div", null, children);
  vm.runInNewContext(code, {
    exports,
    Intl,
    Date,
    FormData,
    require(name) {
      if (name.endsWith(".css")) return {};
      if (name === "react") return {
        ...React,
        useEffect() {},
        useState: (initial) => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}],
      };
      if (name === "@/lib/tours") return {};
      if (name === "@/components/ui/button") return {
        Button: ({ variant, ...props }) => React.createElement("button", props),
      };
      if (name === "@/components/ui/dialog") return {
        Dialog: wrapper, DialogContent: wrapper, DialogTitle: wrapper, DialogDescription: wrapper,
      };
      return require(name);
    },
  });
  return exports;
}

test("group enquiry saves its source and guest details with the selected Tour Master record", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: " Asha Patil ", email: "asha@example.com", phone: "9876543210", gender: "Female",
    city: " Pune ", source: "Phone Call", travelDate: "2027-12-13",
  })) data.set(key, value);
  const payload = load().createGroupEnquiryPayload(data, tours[0], { adults: 12, children: 2, infants: 1 });
  assert.equal(payload.name, "Asha Patil");
  assert.equal(payload.email, "asha@example.com");
  assert.equal(payload.phone, "9876543210");
  assert.equal(payload.gender, "Female");
  assert.equal(payload.tourId, "tour-db-1");
  assert.equal(payload.tourName, tours[0].tourName);
  assert.equal(payload.subject, `Tour enquiry - ${tours[0].tourName}`);
  assert.equal(payload.source, "Phone Call");
  assert.equal(payload.status, "New");
  assert.equal(payload.message, [
    `Tour: ${tours[0].tourName}`, "Tour ID: TOUR001",
    "Current City: Pune", "Guests: 12 Adult, 2 Child, 1 Infant", "Travel Date: 2027-12-13",
  ].join("\n"));
});

test("optional fields can be omitted and tours without dates retain the announced-later value", () => {
  const data = new FormData();
  data.set("travelDate", "To be announced");
  const payload = load().createGroupEnquiryPayload(data, tours[1], { adults: 1, children: 0, infants: 0 });
  assert.equal(payload.gender, "");
  assert.equal(payload.source, "Website");
  assert.equal(payload.message.includes("Current City:"), false);
  assert.equal(payload.message.includes("Travel Date: To be announced"), true);
  assert.equal(payload.tourId, tours[1].id);
});

function render(departures = [], error = "") {
  const { GroupEnquiryForm } = load([
    tours[0].id, { adults: 1, children: 0, infants: 0 }, departures, false, error, false,
  ]);
  return renderToStaticMarkup(React.createElement(GroupEnquiryForm, {
    tours, onClose() {}, async onSubmit() {},
  }));
}

test("form lists all tours and only offers active future departures for the selected tour", () => {
  const html = render([
    { tourId: "TOUR001", status: "scheduled", departureDate: "2099-12-13" },
    { tourId: "tour-db-1", status: "coming_soon", departureDate: "2099-12-14" },
    { tourId: "TOUR002", status: "scheduled", departureDate: "2099-12-15" },
    { tourId: "TOUR001", status: "cancelled", departureDate: "2099-12-16" },
    { tourId: "TOUR001", status: "scheduled", departureDate: "2000-12-17" },
  ]);
  assert.match(html, /value="tour-db-1"/);
  assert.match(html, /value="tour-db-2"/);
  assert.match(html, /value="2099-12-13"/);
  assert.match(html, /value="2099-12-14"/);
  for (const date of ["2099-12-15", "2099-12-16", "2000-12-17"]) assert.equal(html.includes(date), false);
  for (const name of ["name", "email", "phone", "gender", "city", "travelDate", "source"]) assert.match(html, new RegExp(`name="${name}"`));
  assert.equal(html.includes('name="message"'), false);
  for (const source of ["Website", "Contact Form", "Email", "Phone Call"]) assert.ok(html.includes(`value="${source}"`));
  assert.match(html, /aria-label="Decrease Adult count" disabled=""/);
  assert.match(html, /aria-label="Decrease Child count" disabled=""/);
  assert.match(html, /aria-label="Decrease Infant count" disabled=""/);
});

test("an actual lack of dates shows announced later while a loading failure blocks submission", () => {
  assert.match(render(), /value="To be announced"/);
  const html = render([], "Unable to load travel dates.");
  assert.match(html, /role="alert"/);
  assert.match(html, /<button type="submit" disabled=""/);
  assert.equal(html.includes('value="To be announced"'), false);
});

test("every supported enquiry source is preserved when saving", () => {
  for (const source of ["Website", "Contact Form", "Email", "Phone Call"]) {
    const data = new FormData();
    data.set("source", source);
    assert.equal(load().createGroupEnquiryPayload(data, tours[0], { adults: 1, children: 0, infants: 0 }).source, source);
  }
});

test("tour names are read from saved metadata and legacy public enquiry records", () => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/enquiries.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}) });
  const getName = exports.getEnquiryTourName;
  assert.equal(getName({ tourName: "Saved tour", subject: "Tour enquiry - Old name", message: "Tour: Old name" }), "Saved tour");
  assert.equal(getName({ subject: "Enquiry", message: "Details\nTour: Heritage Trail\nTour ID: TOUR001" }), "Heritage Trail");
  assert.equal(getName({ subject: "Tour enquiry - Flavours of Badami & Hampi", message: "" }), "Flavours of Badami & Hampi");
  assert.equal(getName({ subject: "Specialised tour enquiry: Kids", message: "" }), "-");
});

test("view enquiry separates saved tour form details from the actual customer message", () => {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/enquiries.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({}) });
  const readDetails = exports.getEnquiryDisplayDetails;
  const enquiry = {
    subject: "Tour enquiry - Flavours of Badami & Hampi",
    message: "Test\r\nGuests: please confirm the age policy.\r\n\r\nTour: Flavours of Badami & Hampi\r\nTour ID: TOUR001\r\nCurrent City: Pune\r\nGuests: 2 Adult, 1 Child, 0 Infant\r\nTravel Date: 2027-12-13",
  };
  const details = readDetails(enquiry);
  assert.equal(details.tourName, "Flavours of Badami & Hampi");
  assert.equal(details.tourId, "TOUR001");
  assert.equal(details.city, "Pune");
  assert.equal(details.guests, "2 Adult, 1 Child, 0 Infant");
  assert.equal(details.travelDate, "2027-12-13");
  assert.equal(details.message, "Test\nGuests: please confirm the age policy.");
  assert.equal(enquiry.message.includes("\r\nTour ID: TOUR001"), true, "Saved data is unchanged");

  const payload = load().createGroupEnquiryPayload(new FormData(), tours[0], { adults: 1, children: 0, infants: 0 });
  const adminDetails = readDetails(payload);
  assert.equal(adminDetails.message, "");
  assert.equal(adminDetails.tourName, tours[0].tourName);
  assert.equal(adminDetails.guests, "1 Adult, 0 Child, 0 Infant");

  const contact = { subject: "Office hours", message: "Guests: two people\nTravel Date: next week" };
  assert.equal(readDetails(contact).message, contact.message);
  const unstructured = { subject: "Tour enquiry - Heritage Trail", message: "Tour: Heritage Trail\nCan I join with my family?" };
  assert.equal(readDetails(unstructured).message, unstructured.message);
  assert.equal(readDetails({ subject: "Tour enquiry - Heritage Trail", message: "Please call me." }).tourName, "Heritage Trail");
});
