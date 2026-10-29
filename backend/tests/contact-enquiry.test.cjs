const test = require("node:test");
const assert = require("node:assert/strict");
const { Enquiry } = require("../dist/models/enquiry.model");
const references = require("../dist/services/enquiry-reference.service");
const { createPublicContactEnquiry } = require("../dist/controllers/enquiry.controller");
const valid = { name: "Traveller", email: "guest@example.com", phone: "+919876543210", subject: "Tour enquiry", message: "Please send the tour details." };
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("contact API rejects blank or whitespace-only names and messages with 400 before any database work", async t => {
  const prepare = t.mock.method(references, "ensureEnquiryReferences", async () => { throw Error("Must not prepare references"); });
  const create = t.mock.method(Enquiry, "create", async () => { throw Error("Must not write"); });
  for (const field of ["name", "message"]) {
    for (const value of ["", "   ", "\t\n", "\u00a0\u2003"]) {
      await assert.rejects(createPublicContactEnquiry({ body: { ...valid, [field]: value } }, response()), error => {
        assert.equal(error.statusCode, 400);
        assert.ok(error.details.some(issue => issue.path === field && /required/i.test(issue.message)));
        return true;
      });
    }
    const missing = { ...valid }; delete missing[field];
    await assert.rejects(createPublicContactEnquiry({ body: missing }, response()), error => error.statusCode === 400);
  }
  assert.equal(prepare.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});
test("contact API stores trimmed required values as a new website enquiry", async t => {
  t.mock.method(references, "ensureEnquiryReferences", async () => {});
  t.mock.method(references, "allocateEnquiryReference", async () => "EN0001");
  const create = t.mock.method(Enquiry, "create", async payload => new Enquiry(payload));
  const res = response();
  await createPublicContactEnquiry({ body: { ...valid, name: "  Asha Patil  ", message: "  Please help.\nTwo travellers.  " } }, res);
  assert.equal(res.statusCode, 201);
  const saved = create.mock.calls[0].arguments[0];
  assert.equal(saved.name, "Asha Patil");
  assert.equal(saved.message, "Please help.\nTwo travellers.");
  assert.equal(saved.status, "New");
  assert.equal(saved.source, "Website");
});
