const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { jsPDF } = require("jspdf");

const source = fs.readFileSync(path.join(__dirname, "../lib/payment-receipt-document.ts"), "utf8");
const exported = {};
const texts = [];
class Pdf extends jsPDF {
  constructor(options) {
    super(options);
    const draw = this.text.bind(this);
    this.text = (value, ...args) => { texts.push(String(value)); return draw(value, ...args); };
  }
}
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exported, Intl, Date,
  Image: class { set src(value) { this.onerror(); } },
  require: name => name === "jspdf" ? { jsPDF: Pdf } : name === "@/lib/site-logo" ? { fetchSiteLogoUrl: async () => "logo" }
    : name === "@/lib/user-bookings" ? { getUserBookingTitle: () => "Heritage Trail", getUserBookingLocation: () => "Hampi", getUserBookingReference: () => "AT-TEST", getUserBookingTravellerLabel: () => "2 Travellers" } : {},
});
const booking = { booking: { guestDetails: [{ firstName: "Test", lastName: "Traveller", email: "test@example.test" }], pricingSnapshot: {} } };
const receipt = { id: "advance", receiptNumber: "AT-TEST-RCPT-01", amount: 100.25, paidAt: "2026-11-01T10:00:00Z", description: "Advance payment", transactionId: "pay_advance", method: "UPI", currency: "INR", totalPaid: 100.25, balanceAfterPayment: 899.75, bookingTotal: 1000 };
const contact = { officeAddress: "Pune", emailId: "team@example.test", primaryCalling: "1234567890", whatsapp: "", secondaryCalling: "", landline: "" };

test("receipt details use the selected payment and show the company GSTIN", () => {
  const details = exported.paymentReceiptDetails(booking, receipt, contact);
  assert.ok(details.company.includes("GSTIN: 27ABPFA1944D1ZI"));
  assert.ok(details.payment.includes("Transaction ID: pay_advance"));
  assert.ok(details.totals.includes("Payment Received: INR 100.25"));
  assert.ok(details.totals.includes("Balance Against Current Total: INR 899.75"));
  assert.equal(exported.paymentReceiptDate(null), "Not recorded");
});

test("advance receipt PDF includes its amount and transaction without claiming full payment", async () => {
  texts.length = 0;
  const pdf = await exported.createTravellerPaymentReceiptPdf(booking, receipt, contact);
  assert.ok(pdf.output("arraybuffer").byteLength > 1000);
  const content = texts.join("\n");
  assert.match(content, /PAYMENT RECEIPT/);
  assert.match(content, /AT-TEST-RCPT-01/);
  assert.match(content, /INR 100\.25/);
  assert.match(content, /pay_advance/);
  assert.doesNotMatch(content, /FULLY PAID/);
});
