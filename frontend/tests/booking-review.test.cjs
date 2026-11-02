const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/tours/[tourId]/_components/single-tour-page.tsx"), "utf8");
const parsed = ts.createSourceFile("tour.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["BookingReviewModal", "createTravellerDetailTabs", "formatOrdinal", "openBookingReview", "closeBookingReview", "proceedFromBookingReview", "isTravellerDetailFormComplete", "isValidEmail", "isValidMobileNumber", "extractPhoneCountryCode", "sanitizeMobileNumber", "createBookingPayload"];
const functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.push(node.getText(parsed));
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(functions.length, names.length);
const compiled = ts.transpileModule(functions.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function setup() {
  const calls = [];
  const context = {
    require, exports: {}, useRef: () => ({ current: null }), useEffect: () => {},
    createPortal: element => element, document: { body: {} },
    Button: "button", X: "svg", BookingTermsCard: "terms-checkbox",
    canBookSeat: true, hasAcceptedBookingTerms: false, checkoutStatus: "idle",
    setIsBookingReviewOpen: value => calls.push(["review", value]),
    isValidStoredBirthDate: value => Boolean(value && !Number.isNaN(new Date(value).getTime())),
    setIsPaymentChoiceOpen: value => calls.push(["payment", value]),
    changeBookingStage: value => calls.push(["stage", value]),
    handleIncompleteBooking: () => calls.push(["incomplete"]),
  };
  vm.createContext(context); vm.runInContext(compiled, context);
  return { context, calls };
}
function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object") return text(node.props?.children);
  return node == null ? "" : String(node);
}

test("preview displays all entered traveller fields and keeps terms before payment", () => {
  const { context } = setup();
  const lead = { title: "Mr", firstName: "Rahul", lastName: "Patil", gender: "male", dateOfBirth: "1990-04-03",
    email: "rahul@example.test", phoneCountryCode: "+91", mobileNumber: "9000000000", address: "Pune, India",
    emergencyContactName: "Neha Patil", emergencyContactMobileNumber: "8000000000", pincode: "411001" };
  const callbacks = [];
  const props = { children: "Tour, departure, room and totals", travellerCounts: { adults: 1, children: 1, infants: 1 },
    travellerForms: { "adult-1": lead, "child-1": { firstName: "Child", dateOfBirth: "2018-02-01" }, "infant-1": { firstName: "Infant", dateOfBirth: "2026-02-01" } },
    accepted: false, canBook: true, onAcceptedChange: () => {}, onEdit: () => callbacks.push("edit"), onClose: () => {}, onPay: () => callbacks.push("pay") };
  const modal = context.BookingReviewModal(props);
  for (const value of Object.values(lead)) assert.ok(text(modal).includes(value), `Missing entered value: ${value}`);
  for (const value of ["Child", "Infant", "2018-02-01", "2026-02-01", props.children]) assert.ok(text(modal).includes(value));
  const nodes = elements(modal);
  const terms = nodes.find(node => node.type === "terms-checkbox");
  const pay = nodes.find(node => node.type === "button" && text(node) === "Pay Now");
  assert.ok(nodes.indexOf(terms) < nodes.indexOf(pay));
  assert.equal(pay.props.disabled, true);
  const accepted = context.BookingReviewModal({ ...props, accepted: true });
  assert.equal(elements(accepted).find(node => node.type === "button" && text(node) === "Pay Now").props.disabled, false);
  elements(modal).find(node => node.type === "button" && text(node) === "Edit Details").props.onClick();
  assert.deepEqual(callbacks, ["edit"]);
  assert.equal(lead.address, "Pune, India");
});

test("incomplete bookings cannot open review, and unaccepted terms or busy checkout cannot open payment", () => {
  const { context, calls } = setup();
  context.canBookSeat = false; context.openBookingReview();
  assert.deepEqual(calls, [["incomplete"]]); calls.length = 0;
  context.canBookSeat = true; context.openBookingReview();
  assert.deepEqual(calls, [["review", true]]); calls.length = 0;
  context.proceedFromBookingReview(); assert.deepEqual(calls, []);
  context.hasAcceptedBookingTerms = true; context.checkoutStatus = "creating";
  context.proceedFromBookingReview(); assert.deepEqual(calls, []);
  context.checkoutStatus = "idle"; context.canBookSeat = false;
  context.proceedFromBookingReview(); assert.deepEqual(calls, []);
  context.canBookSeat = true; context.proceedFromBookingReview();
  assert.deepEqual(calls, [["review", false], ["payment", true]]);
});

test("Edit closes review and returns to traveller details without clearing entered values", () => {
  const { context, calls } = setup();
  context.closeBookingReview(true);
  assert.deepEqual(calls, [["review", false], ["stage", 3]]);
});

test("child and infant details allow an empty mobile while adult details require it", () => {
  const { context } = setup();
  const form = { firstName: "Test", lastName: "Traveller", email: "test@example.test", address: "Pune",
    pincode: "411001", phoneCountryCode: "India +91", mobileNumber: "", gender: "female", dateOfBirth: "2020-01-01" };
  assert.equal(context.isTravellerDetailFormComplete(form, false, false), true);
  assert.equal(context.isTravellerDetailFormComplete(form, false, true), false);
  assert.equal(context.isTravellerDetailFormComplete(form, true, true), false);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, mobileNumber: "123" }, false, false), false);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, mobileNumber: "9000000000" }, false, true), true);
});

test("review readiness requires a valid six-digit PIN code", () => {
  const { context } = setup();
  const form = { firstName: "Test", lastName: "Traveller", email: "test@example.test", address: "Pune",
    pincode: "411001", phoneCountryCode: "India +91", mobileNumber: "9000000000", gender: "female", dateOfBirth: "2000-01-01" };
  assert.equal(context.isTravellerDetailFormComplete(form, true), true);
  for (const pincode of ["", "41100", "4110012", "ABCDEF"]) {
    assert.equal(context.isTravellerDetailFormComplete({ ...form, pincode }, true), false);
  }
});

test("NRI travellers require a completed Visa upload while OCI remains optional", () => {
  const { context } = setup();
  const form = { firstName: "Test", lastName: "Traveller", email: "test@example.test", address: "Pune",
    pincode: "411001", phoneCountryCode: "India +91", mobileNumber: "9000000000", gender: "female", dateOfBirth: "2000-01-01", isNri: true };
  assert.equal(context.isTravellerDetailFormComplete(form, true), false);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, nriDocuments: { oci: { token: "oci-token" } } }, true), false);
  const visa = { fileName: "visa.pdf", token: "visa-token" };
  assert.equal(context.isTravellerDetailFormComplete({ ...form, nriDocuments: { visa } }, true), true);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, nriDocuments: { visa, oci: undefined } }, true), true);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, nriDocuments: { visa, oci: { uploading: true } } }, true), false);
  assert.equal(context.isTravellerDetailFormComplete({ ...form, nriDocuments: { visa: { uploading: true } } }, true), false);
});

test("booking payload carries only completed uploads for international NRI travellers", () => {
  const { context } = setup();
  context.getTotalTravellers = () => 1;
  context.createAccommodationDetails = () => ({});
  const form = { title: "Ms", firstName: "Test", lastName: "Traveller", email: "test@example.test", address: "Pune",
    pincode: "411001", phoneCountryCode: "India +91", mobileNumber: "9000000000", gender: "female", dateOfBirth: "2000-01-01",
    emergencyContactName: "Contact", emergencyContactMobileNumber: "8000000000", isNri: true,
    nriDocuments: { visa: { fileName: "visa.pdf", token: "visa-token" }, oci: undefined } };
  const args = { forms: { "adult-1": form }, tour: { tourId: "TOUR1", tourType: "International" },
    departure: { departureId: "DEP1" }, accommodationOption: { id: "room-1" }, paymentOption: "advance",
    travellerCounts: { adults: 1, children: 0, infants: 0 } };
  assert.deepEqual(Array.from(context.createBookingPayload(args).travellers[0].nriDocumentTokens), ["visa-token"]);
  form.nriDocuments.oci = { fileName: "oci.pdf", token: "oci-token" };
  assert.deepEqual(Array.from(context.createBookingPayload(args).travellers[0].nriDocumentTokens), ["visa-token", "oci-token"]);
  form.isNri = false;
  assert.equal(context.createBookingPayload(args).travellers[0].nriDocumentTokens.length, 0);
  form.isNri = true;
  args.tour.tourType = "Domestic";
  assert.equal(context.createBookingPayload(args).travellers[0].nriDocumentTokens.length, 0);
});
