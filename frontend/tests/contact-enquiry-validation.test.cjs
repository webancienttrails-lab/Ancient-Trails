const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/contact-enquiry-validation.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { validateContactEnquiry } = loaded.exports;
const valid = { name: "Traveller", email: "guest@example.com", phone: "9876543210", subject: "Tour enquiry", message: "Please send the tour details." };

test("blank and spaces-only names and messages have field errors", () => {
  for (const value of ["", "   ", "\t\n", "\u00a0\u2003"]) {
    assert.ok(validateContactEnquiry({ ...valid, name: value }).errors.name);
    assert.ok(validateContactEnquiry({ ...valid, message: value }).errors.message);
  }
});
test("every required field gets its own error on an empty form", () => {
  const { errors } = validateContactEnquiry({ name: "", email: "", phone: "", subject: "", message: "" });
  assert.deepEqual(Object.keys(errors), ["name", "email", "phone", "subject", "message"]);
});
test("valid enquiries are trimmed without losing meaningful text or internal message line breaks", () => {
  const result = validateContactEnquiry({ name: "  Asha Patil  ", email: "  guest@example.com  ", phone: " (98765) 43210 ", subject: " Tour enquiry ", message: "  Please help.\nTwo travellers.  " });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, { name: "Asha Patil", email: "guest@example.com", phone: "+919876543210", subject: "Tour enquiry", message: "Please help.\nTwo travellers." });
});
test("malformed contact details and overlong messages are rejected", () => {
  assert.ok(validateContactEnquiry({ ...valid, email: "not-an-email" }).errors.email);
  for (const phone of ["     ", "12", "letters", "9".repeat(20)]) assert.ok(validateContactEnquiry({ ...valid, phone }).errors.phone);
  assert.ok(validateContactEnquiry({ ...valid, message: "a".repeat(3001) }).errors.message);
});
