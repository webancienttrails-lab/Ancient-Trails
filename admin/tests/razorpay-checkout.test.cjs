const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../lib/razorpay-checkout.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup(options = {}) {
  const calls = [];
  let checkout, failureHandler, closes = 0, scripts = 0;
  const booking = { id: "booking-test", paymentStatus: "pending", recoveryUrl: "https://tour.example/booking/recover/booking-test?token=test-token" };
  const paid = { ...booking, paymentStatus: "paid", paymentMethod: "upi", ...options.verifiedBooking };
  const response = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: "test-signature", ...options.response };
  const window = { location: { origin: "https://admin.example" }, setTimeout, clearTimeout };
  function Razorpay(config) {
    if (options.constructorError) throw Error("Checkout unavailable");
    checkout = config;
    return { open() {
      if (options.action === "dismiss") config.modal.ondismiss();
      else if (options.action === "failed") failureHandler({ error: { description: "Payment declined" } });
      else { config.handler(response); if (options.duplicate) config.handler(response); if (options.dismissDuringVerification) config.modal.ondismiss(); }
    }, close() { closes++; config.modal.ondismiss(); }, on(event, handler) { assert.equal(event, "payment.failed"); failureHandler = handler; } };
  }
  if (!options.loadScript) window.Razorpay = Razorpay;
  const context = { exports: {}, window, URL, document: {
    createElement() { return { remove() {} }; },
    head: { appendChild(script) { scripts++; if (options.scriptError) script.onerror(); else { window.Razorpay = Razorpay; script.onload(); } } },
  }, require: () => ({ apiRequest: async (url, request) => {
    calls.push({ url, request });
    if (url.includes("/recovery/payment/order")) return { data: { checkout: { key: "rzp_test_public", orderId: "order_test", amount: 2000000, currency: "INR", name: "Ancient Trails", description: "Tour payment", prefill: { name: "Test Traveller", email: "traveller@example.com", contact: "+919000000000" } } } };
    if (url.endsWith("/payment/verify")) { if (options.verifyError) throw Error("Network unavailable"); return { data: { booking: paid } }; }
    return { data: {} };
  } }) };
  vm.createContext(context); vm.runInContext(compiled, context);
  return { booking, paid, calls, run: option => context.exports.openAdminRazorpayCheckout(booking, option), checkout: () => checkout, closes: () => closes, scripts: () => scripts };
}

test("opens standard checkout with server pricing and verifies the provider response once", async () => {
  const f = setup({ duplicate: true, dismissDuringVerification: true });
  assert.equal((await f.run()).paymentMethod, "upi");
  assert.equal(f.checkout().amount, 2000000);
  assert.equal(f.checkout().order_id, "order_test");
  assert.equal(f.checkout().prefill.email, "traveller@example.com");
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/verify")).length, 1);
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/cancel")).length, 0);
  assert.match(f.calls[0].url, /token=test-token/);
});
test("closing checkout cancels the order and keeps the booking unpaid", async () => {
  const f = setup({ action: "dismiss" });
  assert.equal(await f.run(), null);
  assert.equal(f.booking.paymentStatus, "pending");
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/cancel")).length, 1);
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/verify")).length, 0);
});
test("a failed payment closes checkout and cancels the unpaid order", async () => {
  const f = setup({ action: "failed" });
  await assert.rejects(f.run(), /Payment declined/);
  assert.equal(f.closes(), 1);
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/cancel")).length, 1);
});
test("verification errors do not cancel a potentially successful payment", async () => {
  const f = setup({ verifyError: true });
  await assert.rejects(f.run(), /verification is pending/);
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/cancel")).length, 0);
});
test("a mismatched checkout response is not submitted for verification", async () => {
  const f = setup({ response: { razorpay_order_id: "order_other" } });
  await assert.rejects(f.run(), /order mismatch/);
  assert.equal(f.calls.length, 1);
});
test("a verification response cannot confirm a different booking", async () => {
  const f = setup({ verifiedBooking: { id: "another-booking" } });
  await assert.rejects(f.run(), /verification is pending/);
});
test("paid bookings never start another order", async () => {
  const f = setup(); f.booking.paymentStatus = "paid";
  await assert.rejects(f.run(), /already been paid/);
  assert.equal(f.calls.length, 0);
});
test("loads the hosted Razorpay script before creating an order", async () => {
  const f = setup({ loadScript: true }); await f.run(); assert.equal(f.scripts(), 1);
});
test("script failures do not create payment orders", async () => {
  const f = setup({ loadScript: true, scriptError: true });
  await assert.rejects(f.run(), /Unable to load/); assert.equal(f.calls.length, 0);
});
test("an unavailable checkout cancels its unused order", async () => {
  const f = setup({ constructorError: true });
  await assert.rejects(f.run(), /Checkout unavailable/);
  assert.equal(f.calls.filter(call => call.url.endsWith("/payment/cancel")).length, 1);
});

for (const option of ["advance", "full"]) {
  test("checkout requests the selected " + option + " amount from the server", async () => {
    const f = setup(); await f.run(option);
    assert.equal(JSON.parse(f.calls[0].request.body).paymentOption, option);
  });
}
