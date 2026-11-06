const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, "../components/booking-invoice-field.tsx"), "utf8");
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: exportsObject, require });
const { BookingInvoiceEditorContext, BookingInvoiceText } = exportsObject;

function render(values = {}, editing = false, disabled = false) {
  return renderToStaticMarkup(React.createElement(BookingInvoiceEditorContext.Provider, {
    value: { values, editing, disabled, onChange() {} },
  }, React.createElement(BookingInvoiceText, { field: "customer.name" }, "Original Traveller")));
}

test("unchanged invoices render their original values without editing controls", () => {
  const html = render();
  assert.match(html, /Original Traveller/);
  assert.doesNotMatch(html, /textarea/);
});

test("saved edits replace display values and are rendered as escaped text", () => {
  const html = render({ "customer.name": "<script>alert(1)</script>" });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /Original Traveller/);
});

test("a deliberately blank field remains blank", () => {
  assert.doesNotMatch(render({ "customer.name": "" }), /Original Traveller/);
});

test("edit mode provides a labelled control with the current saved value", () => {
  const html = render({ "customer.name": "Edited Traveller" }, true, true);
  assert.match(html, /<textarea/);
  assert.match(html, /aria-label="customer name"/);
  assert.match(html, /Edited Traveller/);
  assert.match(html, /disabled=""/);
});
