const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../app/bookings/add/page.tsx"), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = [];
function collect(node) {
  if (ts.isFunctionDeclaration(node) && ["handlePaymentMethodChange", "handlePayNow", "handleOpenCheckout", "saveBooking"].includes(node.name?.text)) functions.push(node.getText(parsed));
  ts.forEachChild(node, collect);
}
collect(parsed);
assert.equal(functions.length, 4);
const compiled = ts.transpileModule(functions.join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
function setup(options = {}) {
  const calls = [], routes = [], booking = { id: "new-booking", paymentStatus: "pending" };
  const form = { paymentMethod: "cash", adultCount: "1", childCount: "0", departureId: "DEP", selectedAccommodationOptionId: "room", amountPaid: "0", paymentOption: "advance" };
  const context = {
    mode: "add", selectedBooking: options.selectedBooking || null, checkoutPaymentOption: null, bookingId: undefined, bookingForm: form, leadVerified: options.verified !== false,
    leadVerification: { token: "otp-proof" }, paymentInProgress: { current: false }, savedPaymentBooking: { current: null },
    bookingFormRef: { current: { reportValidity: () => options.valid !== false, dataset: { adminUnsaved: "true" } } },
    updateBookingForm: (field, value) => { calls.push(["select", field, value]); form[field] = value; },
    setCheckoutPaymentOption: value => { context.checkoutPaymentOption = value; },
    updatePaymentOption: value => calls.push(["option", value]),
    setBookingForm: update => { Object.assign(form, update(form)); },
    openSavedCheckout: async (saved, option) => calls.push(["savedCheckout", saved, option]),
    toWholeNumber: value => Number(value), createBookingPayload: value => ({ ...value }), setIsSaving() {},
    toast: { success() {}, error: (...args) => calls.push(["error", ...args]) },
    router: { push: route => routes.push(route), refresh() {} }, getErrorMessage: error => error.message,
    createAdminBooking: async payload => { calls.push(["create", payload]); return { data: { booking }, message: "Saved" }; },
    openAdminRazorpayCheckout: async saved => { calls.push(["checkout", saved]); return options.paid ? { ...saved, paymentStatus: "paid" } : null; },
    createAdminBankTransfer: async (id, payload) => { calls.push(["bank", id, payload]); if (options.bankError) throw Error("Gateway temporarily unavailable"); },
    updateAdminBooking: async () => { throw Error("New booking must not use edit API"); },
  };
  vm.createContext(context); vm.runInContext(compiled, context);
  return { calls, routes, form, context, async select(method) { context.handlePaymentMethodChange(method); await new Promise(resolve => setImmediate(resolve)); }, async pay(option) { context.handlePayNow(option); await new Promise(resolve => setImmediate(resolve)); }, async open() { await context.handleOpenCheckout(); } };
}

test("Advance selects the amount; the separate checkout button opens Razorpay", async () => {
  const f = setup({ paid: true }); await f.select("razorpay");
  assert.equal(f.calls.filter(call => call[0] === "create").length, 0);
  await f.pay("advance");
  assert.equal(f.calls.filter(call => call[0] === "create").length, 0);
  await f.open();
  assert.equal(f.calls.find(call => call[0] === "create")[1].paymentOption, "advance");
  assert.equal(f.calls.find(call => call[0] === "create")[1].paymentMethod, "razorpay");
  assert.equal(f.calls.filter(call => call[0] === "checkout").length, 1);
  assert.match(f.routes[0], /bookings\/view/);
});
test("choosing bank transfer creates the identifier and opens bank details", async () => {
  const f = setup(); await f.select("bank_transfer");
  assert.equal(f.calls.find(call => call[0] === "bank")[2].purpose, "advance");
  assert.equal(f.calls.filter(call => call[0] === "checkout").length, 0);
  assert.match(f.routes[0], /bookings\/bank-transfer/);
});
test("incomplete forms and unverified lead phones cannot start payment or create bookings", async () => {
  for (const options of [{ valid: false }, { verified: false }]) {
    const f = setup(options); await f.select("razorpay"); await f.pay("advance"); await f.open();
    assert.equal(f.calls.filter(call => call[0] === "create").length, 0);
  }
});
test("closing checkout preserves one unpaid booking and cannot create a duplicate on repeated save", async () => {
  const f = setup(); await f.select("razorpay"); await f.pay("advance"); await f.context.saveBooking("razorpay");
  assert.equal(f.calls.filter(call => call[0] === "create").length, 1);
  assert.equal(f.context.savedPaymentBooking.current.paymentStatus, "pending");
});
test("bank setup failure preserves the saved booking for recovery", async () => {
  const f = setup({ bankError: true }); await f.select("bank_transfer");
  assert.match(f.routes[0], /bookings\/view/);
  assert.equal(f.calls.filter(call => call[0] === "create").length, 1);
  assert.equal(f.context.savedPaymentBooking.current.paymentStatus, "pending");
});
test("choosing cash or cheque does not automatically submit the booking or launch checkout", async () => {
  for (const method of ["cash", "cheque"]) {
    const f = setup(); await f.select(method);
    assert.equal(f.calls.filter(call => call[0] === "create" || call[0] === "checkout" || call[0] === "bank").length, 0);
  }
});

test("Full is passed to checkout even when the previous selection was Advance", async () => {
  const f = setup({ paid: true }); await f.select("razorpay");
  assert.equal(f.form.paymentOption, "advance");
  await f.pay("full");
  assert.equal(f.calls.filter(call => call[0] === "checkout").length, 0);
  await f.open();
  assert.equal(f.calls.find(call => call[0] === "create")[1].paymentOption, "full");
  assert.equal(f.calls.filter(call => call[0] === "checkout").length, 1);
});
test("Cash and Cheque Pay Now controls only change the amount selection", async () => {
  for (const method of ["cash", "cheque"]) {
    const f = setup(); await f.select(method); await f.pay("full");
    assert.equal(f.calls.filter(call => call[0] === "create" || call[0] === "checkout").length, 0);
    assert.equal(f.calls.find(call => call[0] === "option")[1], "full");
  }
});

test("checkout cannot open until Advance or Full is explicitly selected", async () => {
  const f = setup(); await f.select("razorpay"); await f.open();
  assert.equal(f.calls.filter(call => call[0] === "create" || call[0] === "checkout").length, 0);
});
test("existing unpaid bookings use the selected Full option without creating another booking", async () => {
  const booking = { id: "existing", paymentMode: "online", paymentStatus: "pending", paymentOption: "advance" };
  const f = setup({ selectedBooking: booking }); await f.pay("full"); await f.open();
  assert.equal(f.calls.find(call => call[0] === "savedCheckout")[2], "full");
  assert.equal(f.calls.filter(call => call[0] === "create").length, 0);
});
