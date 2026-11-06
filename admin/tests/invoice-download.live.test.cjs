const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require });
  return exports;
}

function invoiceFixture(receiptMode = false) {
  const file = fs.readFileSync(path.join(__dirname, "../app/bookings/invoice/page.tsx"), "utf8");
  const parsed = ts.createSourceFile("page.tsx", file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = parsed.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(parsed)).join("\n");
  let download;
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "downloadInvoice") download = node.getText(parsed);
    ts.forEachChild(node, find);
  }
  find(parsed);
  assert.ok(download);
  const exported = {};
  const fields = load("components/booking-invoice-field.tsx");
  const logo = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "../public/brand/header-logo.png")).toString("base64");
  vm.runInNewContext(ts.transpileModule(declarations + "\nexports.sheet = InvoiceSheet; exports.styles = invoiceExportStyles;", {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    exports: exported, require, Intl, Date,
    InvoiceText: fields.BookingInvoiceText,
    cn: (...values) => values.filter(Boolean).join(" "),
    SiteLogo: ({ priority, ...props }) => React.createElement("img", { ...props, src: logo }),
    AirfareDisclosure: () => null,
    formatBookingPaymentMethod: () => "Cash",
  });
  const booking = {
    id: "123456789012345678901234", bookingReference: "AT-D0012", tourId: "TOUR1",
    paymentStatus: "paid", paymentOption: "full", paymentCurrency: "INR",
    subtotal: 10000, gstPercentage: 5, gstAmount: 500, grandTotal: 10500, amountPaid: 10500,
    totalGuest: 2, adultCount: 2, childCount: 0,
    createdAt: "2026-11-04T10:00:00Z", updatedAt: "2026-11-04T10:00:00Z",
    guestDetails: [{ firstName: "Invoice", lastName: "Traveller", email: "fixture@example.test", countryCode: "+91", mobileNumber: "0000000000", address: "Test address" }],
    accommodationDetails: { singleOccupancyOneRoom: 0, singleOccupancyTwoRooms: 0, doubleOccupancy: 0, twinOccupancy: 1, tripleOccupancy: 0 },
    invoiceOverrides: { invoiceNumber: "EDITED-INV-001", "customer.name": "Edited Traveller" },
  };
  const receipt = receiptMode ? { id: "advance-1", receiptNumber: "AT-001-RCPT-1", amount: 100.25, paidAt: "2026-11-01T10:00:00Z", method: "Cash", currency: "INR", description: "Advance payment", transactionId: "payment-1", totalPaid: 100.25, balanceAfterPayment: 10399.75, bookingTotal: 10500 } : undefined;
  const html = renderToStaticMarkup(React.createElement(fields.BookingInvoiceEditorContext.Provider, {
    value: { values: receiptMode ? {} : booking.invoiceOverrides, editing: false, disabled: false, onChange() {} },
  }, React.createElement(exported.sheet, { booking, receipt, destinationLabel: "Test destination" })));
  const compiledDownload = ts.transpileModule(download, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace('import("html2canvas")', 'Promise.resolve({ default: window.html2canvas })')
    .replace('import("jspdf")', 'Promise.resolve({ default: TestPdf })');
  return { html, booking, receipt, styles: exported.styles, download: compiledDownload };
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  let nextId = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) pending.get(message.id)?.(message);
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`Browser timed out: ${method}`)); }, 30000);
        pending.set(id, (message) => { clearTimeout(timer); pending.delete(id); message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result); });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

for (const receiptMode of [false, true]) test(receiptMode ? "advance receipt exports independently with a compressed PDF" : "the actual invoice download handles Tailwind colours and preserves saved edits", { timeout: 120000 }, async (t) => {
  const executable = [process.env.BROWSER_BIN, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/chromium"].filter(Boolean).find(fs.existsSync);
  assert.ok(executable, "Set BROWSER_BIN to Chrome/Chromium to run this browser test.");
  const fixture = invoiceFixture(receiptMode);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-invoice-pdf-"));
  const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let launchError;
  browser.on("error", (error) => { launchError = error; });
  let client;
  t.after(async () => {
    if (client) { await client.send("Browser.close").catch(() => {}); client.close(); }
    for (let i = 0; i < 20 && browser.exitCode === null; i++) await pause(100);
    if (browser.exitCode === null) browser.kill();
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-invoice-pdf-")) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) { if (launchError) throw launchError; await pause(100); }
  assert.ok(fs.existsSync(portFile), "Browser did not start");
  const [port] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  client = await connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await evaluate(`document.body.innerHTML = ${JSON.stringify(fixture.html)};
    const css = document.createElement('style');
    css.textContent = 'body { background: white; } .bg-slate-100 { background-color: oklch(96.8% 0.007 247.896); } .text-slate-700 { color: oklch(37.2% 0.044 257.287); } .bg-primary\\/5 { background-color: color-mix(in oklab, #d47220 5%, transparent); }';
    document.head.appendChild(css);`);
  await evaluate(fs.readFileSync(require.resolve("html2canvas/dist/html2canvas.js"), "utf8"));
  await evaluate(fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8"));
  const before = await evaluate(`html2canvas(document.querySelector('.admin-invoice-sheet'), {logging:false}).then(() => '', error => error.message)`);
  assert.match(before, /unsupported color function "oklch"/);
  t.diagnostic(`Reproduced original rendering error: ${before}`);
  const result = await evaluate(`(async () => {
    const booking = ${JSON.stringify(fixture.booking)};
    const invoiceExportStyles = ${JSON.stringify(fixture.styles)};
    const A4_WIDTH_MM = 210, A4_HEIGHT_MM = 297;
    const invoiceRef = { current: document.querySelector('.admin-invoice-sheet') };
    const isDownloading = false, isEditing = false, isSaving = false;
    const receiptsMode = ${receiptMode}, selectedReceipt = ${JSON.stringify(fixture.receipt)};
    let downloading = false, saved, alerts = [], errors = [];
    const originalAlert = window.alert, originalError = console.error;
    window.alert = message => alerts.push(message);
    console.error = (...args) => errors.push(args.map(value => value?.message || String(value)).join(' '));
    const setIsDownloading = value => { downloading = value; };
    const getInvoiceNumber = () => 'DEFAULT-INVOICE';
    function TestPdf(options) {
      const pdf = new jspdf.jsPDF(options);
      pdf.save = filename => { const bytes = new Uint8Array(pdf.output('arraybuffer')); saved = { filename, size: bytes.length, signature: String.fromCharCode(...bytes.slice(0,5)) }; };
      return pdf;
    }
    try {
      ${fixture.download}
      await downloadInvoice();
      return { saved, alerts, errors, downloading, exporting: invoiceRef.current.classList.contains('admin-invoice-exporting'), text: invoiceRef.current.innerText };
    } finally { window.alert = originalAlert; console.error = originalError; }
  })()`);
  assert.deepEqual(result.alerts, [], result.errors.join("\n"));
  assert.ok(result.saved?.size > 1000, JSON.stringify(result));
  assert.equal(result.saved.signature, "%PDF-");
  assert.equal(result.saved.filename, receiptMode ? "AT-001-RCPT-1-Ancient-Trails-Payment-Receipt.pdf" : "EDITED-INV-001-Ancient-Trails-Invoice.pdf");
  assert.equal(result.downloading, false);
  assert.equal(result.exporting, false);
  if (receiptMode) {
    assert.match(result.text, /PAYMENT RECEIVED/);
    assert.match(result.text, /100\.25/);
    assert.doesNotMatch(result.text, /FULLY PAID/);
    t.diagnostic(`Receipt PDF size: ${result.saved.size} bytes`);
    assert.ok(result.saved.size <= 10 * 1024 * 1024);
  } else assert.match(result.text, /Edited Traveller/);
});
