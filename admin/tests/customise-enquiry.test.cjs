const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const options = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX };
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/enquiries.ts"), "utf8"), { compilerOptions: options }).outputText, { exports: helpers, require: () => ({}) });
const source = fs.readFileSync(path.join(__dirname, "../app/enquiries/page.tsx"), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const formNode = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "EnquiryForm");
const scope = {
  exports: {},
  require,
  useState: (initial) => [initial, () => {}],
  createCustomiseEnquiryPayload: helpers.createCustomiseEnquiryPayload,
  sourceOptions: ["All Sources", "Website", "Contact Form", "Email", "Phone Call"],
  statusOptions: ["All Status", "New", "In Progress", "Replied", "Closed"],
  Button: ({ variant, ...props }) => React.createElement("button", props),
  Save: () => null, Minus: () => null, Plus: () => null,
};
vm.runInNewContext(ts.transpileModule(formNode.getText(parsed), { compilerOptions: options }).outputText, scope);
const form = { name: "Asha", email: "asha@example.com", phone: "9876543210", subject: "Bespoke Kerala Tour", message: "Please plan a family trip.", tourId: "", tourName: "", gender: "", source: "Email", status: "New", socialMediaReferral: "Instagram" };
const props = { editing: false, form, tours: [{ id: "db-tour", tourName: "Heritage Trail" }], onChange() {}, onClose() {}, onSubmit() {} };

test("Customise Add Enquiry has Which Tour and guest counters without Tour Master or Status dropdowns", () => {
  const html = renderToStaticMarkup(React.createElement(scope.EnquiryForm, { ...props, customise: true }));
  assert.ok(html.includes("Which Tour"));
  assert.equal(html.includes("Available Tour"), false);
  assert.equal(html.includes("All Status"), false);
  assert.equal(html.includes('>Status<'), false);
  for (const label of ["Adult", "Child", "Infant"]) assert.ok(html.includes(`aria-label="Increase ${label} count"`));
  for (const text of ["Social Media Referral", "Message", "Source", "Gender"]) assert.ok(html.includes(text));
});

test("other enquiry add/edit forms retain their existing fields", () => {
  const html = renderToStaticMarkup(React.createElement(scope.EnquiryForm, props));
  assert.ok(html.includes("Available Tour"));
  assert.ok(html.includes("Status"));
  assert.equal(html.includes("Total No. of Guests"), false);
  assert.equal(html.includes("Which Tour"), false);
});

test("customised enquiries save under Customise with all guest counts and a clean message in the view", () => {
  const payload = helpers.createCustomiseEnquiryPayload(form, { adults: 3, children: 2, infants: 1 });
  assert.equal(helpers.getEnquiryCategory(payload), "customise");
  assert.equal(payload.tourId, "");
  assert.equal(payload.tourName, form.subject);
  assert.equal(payload.status, "New");
  assert.equal(payload.source, "Email");
  assert.equal(payload.socialMediaReferral, "Instagram");
  const details = helpers.getEnquiryDisplayDetails(payload);
  assert.equal(details.tourName, form.subject);
  assert.equal(details.guests, "3 Adult, 2 Child, 1 Infant");
  assert.equal(details.message, form.message);
});

test("customise submit passes the customised payload while normal submits preserve the form", () => {
  let submitted;
  const custom = scope.EnquiryForm({ ...props, customise: true, onSubmit: (event, payload) => { submitted = payload; } });
  custom.props.children.props.onSubmit({});
  assert.equal(helpers.getEnquiryCategory(submitted), "customise");
  assert.ok(submitted.message.includes("Guests: 1 Adult, 0 Child, 0 Infant"));
  const normal = scope.EnquiryForm({ ...props, onSubmit: (event, payload) => { submitted = payload; } });
  normal.props.children.props.onSubmit({});
  assert.equal(submitted, form);
});

test("Which Tour shows the entered tour for admin enquiries and the preferred destination for older website enquiries", () => {
  const payload = helpers.createCustomiseEnquiryPayload(form, { adults: 1, children: 0, infants: 0 });
  assert.equal(helpers.getCustomiseEnquiryTourName(payload), "Bespoke Kerala Tour");
  assert.equal(helpers.getCustomiseEnquiryTourName({ subject: "Customised tour request", message: "Preferred destination: Kerala\nNumber of travellers: 4" }), "Kerala");
  assert.equal(helpers.getCustomiseEnquiryTourName({ subject: "Customised tour enquiry - Hampi", message: "" }), "Hampi");
  assert.equal(helpers.getCustomiseEnquiryTourName({ subject: "Customised tour request", message: "" }), "-");
});

test("Customise table hides Status while other enquiry tables retain it", () => {
  const tableNode = parsed.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "EnquiriesTable");
  const tableScope = {
    exports: {}, require,
    getCustomiseEnquiryTourName: helpers.getCustomiseEnquiryTourName,
    getEnquiryTourName: helpers.getEnquiryTourName,
    cn: (...values) => values.filter(Boolean).join(" "),
    getSourceClassName: () => "", getStatusClassName: () => "",
    EnquiryActions: () => React.createElement("button", null, "Actions"),
    PaginationButton: ({ children }) => React.createElement("button", null, children),
    ChevronLeft: () => null, ChevronRight: () => null,
  };
  vm.runInNewContext(ts.transpileModule(tableNode.getText(parsed), { compilerOptions: options }).outputText, tableScope);
  const enquiry = { ...form, id: "enquiry-1", enquiryReference: "EN0006", initials: "AP", date: "30/10/2026", time: "11:40 am", status: "Replied", subject: "Customised tour request", message: "Preferred destination: Kerala" };
  const render = (showWhichTour) => renderToStaticMarkup(React.createElement(tableScope.EnquiriesTable, { enquiries: [enquiry], showTourName: false, showWhichTour, isLoading: false }));
  const custom = render(true);
  for (const text of ["Which Tour", "Name &amp; Contact", "Source", "Date &amp; Time", "Actions", "Kerala", "EN0006"]) assert.ok(custom.includes(text), text);
  assert.equal(custom.includes('data-label="Status"'), false);
  assert.equal(custom.includes(">Subject</th>"), false);
  assert.equal((custom.match(/<th /g) || []).length, 6);
  const normal = render(false);
  assert.ok(normal.includes('data-label="Status"'));
  assert.ok(normal.includes(">Subject</th>"));
  assert.equal((normal.match(/<th /g) || []).length, 7);
});
