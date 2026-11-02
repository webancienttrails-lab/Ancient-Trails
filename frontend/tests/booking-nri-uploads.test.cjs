const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/tours/[tourId]/_components/single-tour-page.tsx"), "utf8");
const parsed = ts.createSourceFile("tour.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let fields, handler;
function visit(node) {
  if (ts.isConditionalExpression(node) && node.condition.getText(parsed).includes('tour.tourType.trim().toLowerCase() === "international"') && node.whenTrue.getText(parsed).includes("NRI status")) fields = node.getText(parsed);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "handleNriDocumentUpload") handler = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(fields && handler);
const code = ts.transpileModule(handler + `\nfunction renderFields() { return (${fields}); }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function elements(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
function setup() {
  let forms = { "adult-1": { isNri: false } };
  const context = { require, Error, exports: {}, tour: { tourType: "International" },
    activeTravellerDetailTab: { id: "adult-1", label: "Adult 1" }, canEditTravellerDetailFields: true,
    defaultTravellerDetailForm: {}, fieldProps: () => ({}), bookingFieldId: (id, field) => `${id}-${field}`, cn: (...args) => args.join(" "),
    uploadPrebookingKycDocument: async () => ({ data: { fileName: "visa.pdf", token: "visa-token" } }),
  };
  context.activeTravellerDetails = forms["adult-1"];
  context.setTravellerDetailForms = (update) => { forms = update(forms); context.activeTravellerDetails = forms[context.activeTravellerDetailTab.id] || {}; };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { context, inputs: () => elements(context.renderFields()).filter((node) => node.type === "input") };
}

test("ticking NRI reveals required Visa and optional OCI fields immediately", () => {
  const { context, inputs } = setup();
  assert.equal(inputs().length, 1);
  inputs()[0].props.onChange({ target: { checked: true } });
  const files = inputs().filter((node) => node.props.type === "file");
  assert.equal(files.length, 2);
  assert.equal(files[0].props["aria-label"], "Adult 1 visa document");
  assert.equal(files[0].props.required, true);
  assert.equal(files[1].props.required, false);
  inputs()[0].props.onChange({ target: { checked: false } });
  assert.equal(inputs().length, 1);
  assert.equal(context.activeTravellerDetails.nriDocuments, undefined);
  context.tour.tourType = "Domestic";
  assert.equal(context.renderFields(), null);
});

test("uploads show progress, retain the saved reference and report rejected files", async () => {
  const { context, inputs } = setup();
  inputs()[0].props.onChange({ target: { checked: true } });
  let finish;
  context.uploadPrebookingKycDocument = () => new Promise((resolve) => { finish = resolve; });
  const uploading = context.handleNriDocumentUpload("visa", { name: "visa.pdf", size: 10, type: "application/pdf" });
  assert.equal(context.activeTravellerDetails.nriDocuments.visa.uploading, true);
  assert.equal(inputs().find((node) => node.props.type === "file").props.disabled, true);
  finish({ data: { fileName: "visa.pdf", token: "signed-token" } });
  await uploading;
  assert.equal(context.activeTravellerDetails.nriDocuments.visa.token, "signed-token");
  assert.equal(inputs().find((node) => node.props.type === "file").props.required, false);
  await context.handleNriDocumentUpload("oci", { name: "bad.exe", size: 10, type: "application/octet-stream" });
  assert.match(context.activeTravellerDetails.nriDocuments.oci.error, /PDF/);
  context.uploadPrebookingKycDocument = async () => { throw new Error("Upload failed"); };
  await context.handleNriDocumentUpload("oci", { name: "oci.pdf", size: 10, type: "application/pdf" });
  assert.equal(context.activeTravellerDetails.nriDocuments.oci.error, "Upload failed");
  elements(context.renderFields()).find((node) => node.type === "button").props.onClick();
  assert.equal(context.activeTravellerDetails.nriDocuments.visa, undefined);
  assert.equal(inputs().find((node) => node.props.type === "file").props.required, true);
});

test("upload transport sends authenticated multipart files and returns the signed reference", async () => {
  const uploadSource = fs.readFileSync(path.join(__dirname, "../lib/user-bookings.ts"), "utf8");
  let request;
  const context = { exports: {}, FormData, require: (name) => {
    if (name === "@/lib/auth") return { getTravellerSession: () => ({ sessionId: "fixture-session" }) };
    if (name === "@/lib/api") return { apiBaseUrl: "https://api.example.test", ApiError: Error,
      sessionFetch: async (url, options) => { request = { url, ...options }; return new Response(JSON.stringify({ success: true, data: { token: "signed-token", fileName: "visa.pdf" } }), { headers: { "content-type": "application/json" } }); } };
    throw new Error(`Unexpected import: ${name}`);
  } };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(uploadSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const file = new File(["visa"], "visa.pdf", { type: "application/pdf" });
  const response = await context.exports.uploadPrebookingKycDocument({ travellerId: "adult-1", documentType: "visa", file });
  assert.equal(response.data.token, "signed-token");
  assert.equal(request.url, "https://api.example.test/api/bookings/kyc/upload");
  assert.equal(request.headers["X-Session-Id"], "fixture-session");
  assert.equal(request.body.get("travellerId"), "adult-1");
  assert.equal(request.body.get("documentType"), "visa");
  assert.equal(request.body.get("document").name, "visa.pdf");
});
